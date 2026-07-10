const express = require('express');
const router = express.Router();
const db = require('./db');
const { generateToken, requireAdmin } = require('./middleware-auth');

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

router.post('/models', requireAdmin, (req, res) => {
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

    res.status(201).json({ id, message: 'Model created successfully' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A model with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/models/:id', requireAdmin, (req, res) => {
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
    res.json({ message: 'Model updated successfully' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A model with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/models/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const model = db.getModelById(id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  db.deleteModel(id);
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

router.post('/models/:id/apis', requireAdmin, (req, res) => {
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
    res.status(201).json({ id: apiId, message: 'API endpoint added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/models/:id/apis/:apiId', requireAdmin, (req, res) => {
  const allowed = ['provider', 'base_url', 'api_key', 'model_id_provider', 'priority', 'active'];
  const fields = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  db.updateModelApi(req.params.apiId, fields);
  res.json({ message: 'API endpoint updated successfully' });
});

router.delete('/models/:id/apis/:apiId', requireAdmin, (req, res) => {
  db.deleteModelApi(req.params.apiId);
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
