const express = require('express');
const router = express.Router();
const db = require('./db');
const { generateToken, requireAdmin } = require('./middleware-auth');
const { supabase } = require('./supabase');

// ─── Supabase sync helpers (best-effort, non-blocking) ──────────────────────

async function syncModelToSupabase(model) {
  if (!supabase) return;
  try {
    const { data: existing } = await supabase
      .from('models')
      .select('id')
      .eq('name', model.name)
      .single();
    if (existing) {
      await supabase.from('models').update({
        system_prompt: model.system_prompt || '',
        temperature: model.temperature ?? 0.7,
        max_tokens: model.max_tokens ?? 4096,
        active: model.active !== undefined ? model.active : true,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id);
    } else {
      await supabase.from('models').insert({
        name: model.name,
        system_prompt: model.system_prompt || '',
        temperature: model.temperature ?? 0.7,
        max_tokens: model.max_tokens ?? 4096,
        active: true
      });
    }
  } catch (e) {
    console.log('Supabase model sync (non-critical):', e.message);
  }
}

async function syncDeleteModelToSupabase(name) {
  if (!supabase) return;
  try {
    await supabase.from('models').update({ active: false }).eq('name', name);
  } catch (e) {
    console.log('Supabase model delete sync (non-critical):', e.message);
  }
}

async function syncModelApiToSupabase(modelName, apiData) {
  if (!supabase) return;
  try {
    const { data: model } = await supabase
      .from('models')
      .select('id')
      .eq('name', modelName)
      .single();
    if (!model) return;
    await supabase.from('model_apis').insert({
      model_id: model.id,
      provider: apiData.provider || 'custom',
      base_url: apiData.base_url,
      api_key: apiData.api_key,
      model_id_provider: apiData.model_id_provider,
      priority: apiData.priority ?? 0
    });
  } catch (e) {
    console.log('Supabase API sync (non-critical):', e.message);
  }
}

async function syncDeleteModelApiToSupabase(modelName, baseUrl, modelIdProvider) {
  if (!supabase) return;
  try {
    const { data: model } = await supabase
      .from('models')
      .select('id')
      .eq('name', modelName)
      .single();
    if (!model) return;
    const { data: apis } = await supabase
      .from('model_apis')
      .select('id')
      .eq('model_id', model.id)
      .eq('base_url', baseUrl)
      .eq('model_id_provider', modelIdProvider);
    if (apis && apis.length > 0) {
      await supabase.from('model_apis').delete().eq('id', apis[0].id);
    }
  } catch (e) {
    console.log('Supabase API delete sync (non-critical):', e.message);
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.verifyAdmin(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user.username);
  res.json({ token, username: user.username, email: user.email });
});

// ─── Admin Profile ───────────────────────────────────────────────────────────

router.get('/profile', requireAdmin, (req, res) => {
  const admin = db.getAdminProfile(req.admin.username);
  res.json(admin || { username: req.admin.username, email: '' });
});

router.put('/profile', requireAdmin, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  db.updateAdminProfile(req.admin.username, email);
  res.json({ message: 'Profile updated', email });
});

router.put('/password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const success = db.updateAdminPassword(req.admin.username, currentPassword, newPassword);
  if (!success) return res.status(401).json({ error: 'Current password is incorrect' });
  res.json({ message: 'Password updated successfully' });
});

// ─── Models CRUD ─────────────────────────────────────────────────────────────

router.get('/models', requireAdmin, (req, res) => {
  const models = db.getAllModels();
  // Attach APIs to each model
  const enriched = models.map(m => ({
    ...m,
    apis: db.getModelApis(m.id).map(a => ({
      ...a,
      api_key: a.api_key ? a.api_key.substring(0, 8) + '...' + a.api_key.slice(-4) : null
    }))
  }));
  res.json(enriched);
});

router.post('/models', requireAdmin, async (req, res) => {
  const { name, system_prompt, temperature, max_tokens, apis } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Model name is required' });
  }

  try {
    const id = db.createModel({ name, system_prompt, temperature, max_tokens });

    // Add initial APIs if provided
    if (Array.isArray(apis)) {
      for (let i = 0; i < apis.length; i++) {
        const api = apis[i];
        if (api.base_url && api.api_key && api.model_id_provider) {
          db.addModelApi({
            model_id: id,
            provider: api.provider || 'custom',
            base_url: api.base_url,
            api_key: api.api_key,
            model_id_provider: api.model_id_provider,
            priority: i
          });
        }
      }
    }

    // Sync to Supabase for persistence across restarts
    await syncModelToSupabase({ name, system_prompt, temperature, max_tokens, active: true });
    if (Array.isArray(apis)) {
      for (const api of apis) {
        if (api.base_url && api.api_key && api.model_id_provider) {
          await syncModelApiToSupabase(name, api);
        }
      }
    }

    res.status(201).json({ id, message: 'Model created successfully' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A model with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/models/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const model = db.getModelById(id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  const allowed = ['name', 'system_prompt', 'temperature', 'max_tokens', 'active'];
  const fields = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields[key] = req.body[key];
    }
  }

  try {
    db.updateModel(id, fields);
    // Sync to Supabase
    const updated = db.getModelById(id);
    await syncModelToSupabase(updated);
    res.json({ message: 'Model updated successfully' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A model with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/models/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const model = db.getModelById(id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  db.deleteModel(id);
  await syncDeleteModelToSupabase(model.name);
  res.json({ message: 'Model deleted successfully' });
});

// ─── Model APIs (backup endpoints) ───────────────────────────────────────────

router.get('/models/:id/apis', requireAdmin, (req, res) => {
  const apis = db.getModelApis(req.params.id);
  const safe = apis.map(a => ({
    ...a,
    api_key: a.api_key ? a.api_key.substring(0, 8) + '...' + a.api_key.slice(-4) : null
  }));
  res.json(safe);
});

router.post('/models/:id/apis', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const model = db.getModelById(id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  const { provider, base_url, api_key, model_id_provider, priority } = req.body;
  if (!base_url || !api_key || !model_id_provider) {
    return res.status(400).json({ error: 'base_url, api_key, and model_id_provider are required' });
  }

  try {
    const apiId = db.addModelApi({ model_id: parseInt(id), provider, base_url, api_key, model_id_provider, priority });
    // Sync to Supabase
    await syncModelApiToSupabase(model.name, { provider, base_url, api_key, model_id_provider, priority });
    res.status(201).json({ id: apiId, message: 'API endpoint added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/models/:id/apis/:apiId', requireAdmin, async (req, res) => {
  const allowed = ['provider', 'base_url', 'api_key', 'model_id_provider', 'priority', 'active'];
  const fields = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  const oldApi = db.getModelApi(parseInt(req.params.apiId));
  db.updateModelApi(req.params.apiId, fields);
  // Sync to Supabase (IDs differ between SQLite and Supabase, so match by model_name + base_url)
  const model = db.getModelById(parseInt(req.params.id));
  if (model && oldApi) {
    try {
      const { data: sbModel } = await supabase
        .from('models').select('id').eq('name', model.name).single();
      if (sbModel) {
        await supabase.from('model_apis')
          .update(fields)
          .eq('model_id', sbModel.id)
          .eq('base_url', oldApi.base_url)
          .eq('model_id_provider', oldApi.model_id_provider);
      }
    } catch (e) {
      console.log('Supabase API update sync (non-critical):', e.message);
    }
  }
  res.json({ message: 'API endpoint updated successfully' });
});

router.delete('/models/:id/apis/:apiId', requireAdmin, async (req, res) => {
  const model = db.getModelById(parseInt(req.params.id));
  const oldApi = model ? db.getModelApi(parseInt(req.params.apiId)) : null;
  db.deleteModelApi(req.params.apiId);
  // Sync to Supabase
  if (model && oldApi) {
    await syncDeleteModelApiToSupabase(model.name, oldApi.base_url, oldApi.model_id_provider);
  }
  res.json({ message: 'API endpoint deleted successfully' });
});

// ─── API Keys Management ─────────────────────────────────────────────────────

router.get('/apikeys', requireAdmin, (req, res) => {
  const keys = db.getAllApiKeys();
  res.json(keys);
});

router.post('/apikeys', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const result = db.createApiKey(name);
  res.status(201).json(result);
});

router.delete('/apikeys/:id', requireAdmin, (req, res) => {
  db.deleteApiKey(req.params.id);
  res.json({ message: 'API key deleted successfully' });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', requireAdmin, (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const stats = db.getUsageStats(days);
  const byModel = db.getUsageByModel(days);
  const daily = db.getUsageDaily(days);
  const errors = db.getRecentErrors(5);
  const modelCount = db.getModelCount();
  const keyCount = db.getApiKeyCount();
  const apiCount = db.getTotalModelApis();
  res.json({ ...stats, byModel, daily, errors, modelCount, keyCount, apiCount });
});

module.exports = router;
