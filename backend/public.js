const express = require('express');
const router = express.Router();
const { supabase } = require('./supabase');
const db = require('./db');

// ─── Public: List all active models (no auth required) ────────────────────
router.get('/models', async (req, res) => {
  try {
    // Try Supabase first
    const { data, error } = await supabase
      .from('models')
      .select('id, name, system_prompt, temperature, max_tokens, created_at')
      .eq('active', true)
      .order('name');

    if (!error && data) {
      // Also get model_apis for each
      const modelsWithApis = await Promise.all(data.map(async (model) => {
        const { data: apis } = await supabase
          .from('model_apis')
          .select('id, provider, base_url, model_id_provider, priority')
          .eq('model_id', model.id)
          .eq('active', true)
          .order('priority');

        return {
          ...model,
          apis: apis || [],
          endpoint_count: apis?.length || 0
        };
      }));

      return res.json({
        object: 'list',
        data: modelsWithApis
      });
    }

    // Fallback to SQLite
    const models = db.getActiveModels();
    const enriched = models.map(m => {
      const apis = db.getModelApis(m.id).filter(a => a.active);
      return {
        id: m.id,
        name: m.name,
        system_prompt: m.system_prompt,
        temperature: m.temperature,
        max_tokens: m.max_tokens,
        created_at: m.created_at,
        apis: apis.map(a => ({
          id: a.id,
          provider: a.provider,
          base_url: a.base_url,
          model_id_provider: a.model_id_provider,
          priority: a.priority
        })),
        endpoint_count: apis.length
      };
    });

    res.json({ object: 'list', data: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: Get single model details ─────────────────────────────────────
router.get('/models/:name', async (req, res) => {
  try {
    let data, error;
    try {
      const result = await supabase
        .from('models')
        .select('*')
        .eq('name', req.params.name)
        .eq('active', true)
        .single();
      data = result.data;
      error = result.error;
    } catch (e) {
      data = null;
      error = 'not found';
    }

    if (data) {
      const { data: apis } = await supabase
        .from('model_apis')
        .select('*')
        .eq('model_id', data.id)
        .eq('active', true)
        .order('priority');

      return res.json({ ...data, apis: apis || [] });
    }

    // Fallback to SQLite
    const model = db.getModelByName(req.params.name);
    if (!model || !model.active) {
      return res.status(404).json({ error: 'Model not found' });
    }
    const apis = db.getActiveModelApis(model.id);
    res.json({ ...model, apis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: Search models ────────────────────────────────────────────────
router.get('/models/search/:query', async (req, res) => {
  try {
    const query = req.params.query.toLowerCase();
    const { data, error } = await supabase
      .from('models')
      .select('id, name, system_prompt, created_at')
      .eq('active', true)
      .ilike('name', `%${query}%`)
      .limit(20);

    if (!error && data) {
      return res.json({ object: 'list', data });
    }

    // Fallback: SQLite with LIKE
    const allModels = db.getActiveModels();
    const filtered = allModels.filter(m =>
      m.name.toLowerCase().includes(query) ||
      (m.system_prompt || '').toLowerCase().includes(query)
    );
    res.json({ object: 'list', data: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
