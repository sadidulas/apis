const express = require('express');
const router = express.Router();
const db = require('./db');
const { requireApiKey } = require('./middleware-auth');

// ─── Model lookup with Supabase fallback ────────────────────────────────────

async function findModelWithApis(modelName) {
  // Try SQLite first
  const modelConfig = db.getModelByName(modelName);
  if (modelConfig && modelConfig.active) {
    const apis = db.getActiveModelApis(modelConfig.id);
    return { modelConfig, apis };
  }

  // Fallback: try Supabase (models may exist there after Render restart)
  try {
    const { supabase } = require('./supabase');
    const result = await supabase
      .from('models')
      .select('*')
      .eq('name', modelName)
      .eq('active', true)
      .single();

    if (result.data) {
      const { data: supabaseApis } = await supabase
        .from('model_apis')
        .select('*')
        .eq('model_id', result.data.id)
        .eq('active', true)
        .order('priority');

      if (supabaseApis && supabaseApis.length > 0) {
        // Sync model to SQLite for future requests
        try {
          db.createModel({
            name: result.data.name,
            system_prompt: result.data.system_prompt || '',
            temperature: result.data.temperature ?? 0.7,
            max_tokens: result.data.max_tokens ?? 4096
          });
          const syncedModel = db.getModelByName(modelName);
          if (syncedModel) {
            for (let i = 0; i < supabaseApis.length; i++) {
              const a = supabaseApis[i];
              db.addModelApi({
                model_id: syncedModel.id,
                provider: a.provider || 'custom',
                base_url: a.base_url,
                api_key: a.api_key,
                model_id_provider: a.model_id_provider,
                priority: a.priority ?? i
              });
            }
            return { modelConfig: syncedModel, apis: db.getActiveModelApis(syncedModel.id) };
          }
        } catch (e) {
          console.log('Sync to SQLite failed (non-critical):', e.message);
        }

        // Return from Supabase data directly if sync failed
        return {
          modelConfig: result.data,
          apis: supabaseApis
        };
      }
    }
  } catch (e) {
    console.log('Supabase fallback lookup failed:', e.message);
  }

  return { modelConfig: null, apis: [] };
}

// ─── List available models ────────────────────────────────────────────────────

router.get('/models', requireApiKey, async (req, res) => {
  let models = db.getActiveModels();

  // Also include Supabase models that might not be in SQLite
  try {
    const { supabase } = require('./supabase');
    const { data: supabaseModels } = await supabase
      .from('models')
      .select('name, created_at')
      .eq('active', true);

    if (supabaseModels) {
      const sqliteNames = new Set(models.map(m => m.name));
      for (const sm of supabaseModels) {
        if (!sqliteNames.has(sm.name)) {
          models.push({ name: sm.name, created_at: sm.created_at });
        }
      }
    }
  } catch (e) { /* non-critical */ }

  res.json({
    object: 'list',
    data: models.map(m => ({
      id: m.name,
      object: 'model',
      created: new Date(m.created_at).getTime()
    }))
  });
});

// ─── OpenAI-compatible chat completions ──────────────────────────────────────

router.post('/chat/completions', requireApiKey, async (req, res) => {
  const { model, messages, temperature, max_tokens } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: 'model and messages are required' });
  }

  const { modelConfig, apis } = await findModelWithApis(model);
  if (!modelConfig || !modelConfig.active) {
    return res.status(404).json({ error: `Model '${model}' not found or inactive` });
  }

  if (apis.length === 0) {
    return res.status(503).json({ error: `Model '${model}' has no active API endpoints configured` });
  }

  // Build base messages
  const requestMessages = buildMessages(messages, modelConfig.system_prompt);

  let lastError = null;

  // Try each API endpoint in priority order until one succeeds
  for (const apiConfig of apis) {
    try {
      const result = await tryProvider(apiConfig, requestMessages, temperature, max_tokens, modelConfig);
      // Log success
      try {
        db.logUsage({
          model_id: modelConfig.id,
          model_api_id: apiConfig.id,
          api_key_id: req.apiKeyId,
          prompt_tokens: result.usage?.prompt_tokens || 0,
          completion_tokens: result.usage?.completion_tokens || 0,
          endpoint: '/chat/completions',
          status: 'success'
        });
      } catch (e) { /* silent */ }
      return res.json(result.data);
    } catch (err) {
      lastError = err;
      // Log the failure
      try {
        db.logUsage({
          model_id: modelConfig.id,
          model_api_id: apiConfig.id,
          api_key_id: req.apiKeyId,
          endpoint: '/chat/completions',
          status: 'error',
          error_message: err.message
        });
      } catch (e) { /* silent */ }
      // Continue to next API endpoint
    }
  }

  // All endpoints failed
  res.status(502).json({
    error: 'All API endpoints failed',
    details: lastError ? lastError.message : 'Unknown error'
  });
});

// ─── Anthropic-compatible messages endpoint ──────────────────────────────────

router.post('/messages', requireApiKey, async (req, res) => {
  const { model, messages, system, max_tokens, temperature } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: 'model and messages are required' });
  }

  const { modelConfig, apis } = await findModelWithApis(model);
  if (!modelConfig || !modelConfig.active) {
    return res.status(404).json({ error: `Model '${model}' not found or inactive` });
  }

  if (apis.length === 0) {
    return res.status(503).json({ error: `Model '${model}' has no active API endpoints configured` });
  }

  const systemPrompt = [modelConfig.system_prompt, system].filter(Boolean).join('\n\n');
  let lastError = null;

  for (const apiConfig of apis) {
    try {
      const requestBody = {
        model: apiConfig.model_id_provider,
        messages,
        max_tokens: max_tokens || modelConfig.max_tokens || 4096,
        temperature: temperature ?? modelConfig.temperature ?? 0.7
      };
      if (systemPrompt) requestBody.system = systemPrompt;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      let baseUrl = apiConfig.base_url
        .replace(/\/+$/, '')
        .replace(/\/messages\/?$/i, '')
        .replace(/\/chat\/completions\/?$/i, '');

      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiConfig.api_key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Provider returned ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      try {
        db.logUsage({
          model_id: modelConfig.id,
          model_api_id: apiConfig.id,
          api_key_id: req.apiKeyId,
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          endpoint: '/messages',
          status: 'success'
        });
      } catch (e) { /* silent */ }

      return res.json(data);
    } catch (err) {
      lastError = err;
      try {
        db.logUsage({
          model_id: modelConfig.id,
          model_api_id: apiConfig.id,
          api_key_id: req.apiKeyId,
          endpoint: '/messages',
          status: 'error',
          error_message: err.message
        });
      } catch (e) { /* silent */ }
    }
  }

  res.status(502).json({
    error: 'All API endpoints failed',
    details: lastError ? lastError.message : 'Unknown error'
  });
});

// ─── Helper Functions ────────────────────────────────────────────────────────

function buildMessages(userMessages, systemPrompt) {
  const msgs = Array.isArray(userMessages) ? [...userMessages] : [];
  if (systemPrompt) {
    const hasSystem = msgs[0] && msgs[0].role === 'system';
    if (hasSystem) {
      msgs[0].content = systemPrompt + '\n\n' + msgs[0].content;
    } else {
      msgs.unshift({ role: 'system', content: systemPrompt });
    }
  }
  return msgs;
}

async function tryProvider(apiConfig, messages, temperature, max_tokens, modelConfig) {
  // Remove trailing slash and strip common endpoint paths to prevent double-appending
  let baseUrl = apiConfig.base_url
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/messages\/?$/i, '');
  const isAnthropic = baseUrl.includes('anthropic.com') || apiConfig.provider === 'anthropic';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let endpoint, requestBody, headers;

  if (isAnthropic) {
    endpoint = '/messages';
    const msgs = messages.filter(m => m.role !== 'system');
    const systemMsg = messages.find(m => m.role === 'system');

    requestBody = {
      model: apiConfig.model_id_provider,
      max_tokens: max_tokens || modelConfig.max_tokens || 4096,
      messages: msgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    };
    if (systemMsg) requestBody.system = systemMsg.content;

    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiConfig.api_key,
      'anthropic-version': '2023-06-01'
    };
  } else {
    endpoint = '/chat/completions';
    requestBody = {
      model: apiConfig.model_id_provider,
      messages: messages,
      temperature: temperature ?? modelConfig.temperature ?? 0.7,
      max_tokens: max_tokens ?? modelConfig.max_tokens ?? 4096
    };
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiConfig.api_key}`
    };
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });

  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Provider returned ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();

  // Transform Anthropic response to OpenAI format
  if (isAnthropic && data.content) {
    return {
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0
      },
      data: transformAnthropicResponse(data, apiConfig.model_id_provider)
    };
  }

  return {
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
    data
  };
}

function transformAnthropicResponse(anthropicData, modelId) {
  let content = '';
  if (Array.isArray(anthropicData.content)) {
    content = anthropicData.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  } else if (typeof anthropicData.content === 'string') {
    content = anthropicData.content;
  }

  return {
    id: anthropicData.id || `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: anthropicData.stop_reason || 'stop'
    }],
    usage: {
      prompt_tokens: anthropicData.usage?.input_tokens || 0,
      completion_tokens: anthropicData.usage?.output_tokens || 0,
      total_tokens: (anthropicData.usage?.input_tokens || 0) + (anthropicData.usage?.output_tokens || 0)
    }
  };
}

module.exports = router;
