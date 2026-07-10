const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'free-api.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb();
  }
  return db;
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      system_prompt TEXT DEFAULT '',
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS model_apis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL,
      provider TEXT NOT NULL DEFAULT 'custom',
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model_id_provider TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      user_id INTEGER,
      active INTEGER DEFAULT 1,
      last_used TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER,
      model_api_id INTEGER,
      api_key_id INTEGER,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      endpoint TEXT,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Create default admin if not exists
  const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
  if (!adminExists) {
    const defaultPassword = 'sadidulmehal';
    const hash = crypto.createHash('sha256').update(defaultPassword).digest('hex');
    db.prepare('INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)').run('admin', 'admin@admin.com', hash);
  }
}

// ─── Models ───────────────────────────────────────────────────────────────────

function getAllModels() {
  return getDb().prepare('SELECT * FROM models ORDER BY created_at DESC').all();
}

function getActiveModels() {
  return getDb().prepare('SELECT id, name, system_prompt FROM models WHERE active = 1').all();
}

function getModelById(id) {
  return getDb().prepare('SELECT * FROM models WHERE id = ?').get(id);
}

function getModelByName(name) {
  return getDb().prepare('SELECT * FROM models WHERE name = ?').get(name);
}

function createModel({ name, system_prompt, temperature, max_tokens }) {
  const stmt = getDb().prepare(`
    INSERT INTO models (name, system_prompt, temperature, max_tokens)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(name, system_prompt || '', temperature || 0.7, max_tokens || 4096);
  return result.lastInsertRowid;
}

function updateModel(id, fields) {
  const allowed = ['name', 'system_prompt', 'temperature', 'max_tokens', 'active'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(fields[key]);
    }
  }
  if (sets.length === 0) return false;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  getDb().prepare(`UPDATE models SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return true;
}

function deleteModel(id) {
  getDb().prepare('DELETE FROM model_apis WHERE model_id = ?').run(id);
  getDb().prepare('DELETE FROM models WHERE id = ?').run(id);
}

// ─── Model APIs (backup endpoints) ───────────────────────────────────────────

function getModelApis(modelId) {
  return getDb().prepare(
    'SELECT * FROM model_apis WHERE model_id = ? ORDER BY priority ASC'
  ).all(modelId);
}

function getActiveModelApis(modelId) {
  return getDb().prepare(
    'SELECT * FROM model_apis WHERE model_id = ? AND active = 1 ORDER BY priority ASC'
  ).all(modelId);
}

function addModelApi({ model_id, provider, base_url, api_key, model_id_provider, priority }) {
  const maxPriority = getDb().prepare(
    'SELECT COALESCE(MAX(priority), -1) + 1 as next FROM model_apis WHERE model_id = ?'
  ).get(model_id).next;

  const stmt = getDb().prepare(`
    INSERT INTO model_apis (model_id, provider, base_url, api_key, model_id_provider, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(model_id, provider, base_url, api_key, model_id_provider, priority ?? maxPriority);
  return result.lastInsertRowid;
}

function updateModelApi(id, fields) {
  const allowed = ['provider', 'base_url', 'api_key', 'model_id_provider', 'priority', 'active'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(fields[key]);
    }
  }
  if (sets.length === 0) return false;
  vals.push(id);
  getDb().prepare(`UPDATE model_apis SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return true;
}

function deleteModelApi(id) {
  getDb().prepare('DELETE FROM model_apis WHERE id = ?').run(id);
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

function generateApiKey() {
  return 'fk-' + crypto.randomBytes(24).toString('hex');
}

function getAllApiKeys() {
  return getDb().prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all();
}

function createApiKey(name) {
  const key = generateApiKey();
  getDb().prepare('INSERT INTO api_keys (key, name) VALUES (?, ?)').run(key, name);
  return { key, name };
}

function deleteApiKey(id) {
  getDb().prepare('DELETE FROM api_keys WHERE id = ?').run(id);
}

function validateApiKey(key) {
  return getDb().prepare('SELECT id, name FROM api_keys WHERE key = ? AND active = 1').get(key);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyAdmin(username, password) {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return getDb().prepare(
    'SELECT id, username, email FROM admin_users WHERE username = ? AND password_hash = ?'
  ).get(username, hash);
}

function updateAdminProfile(username, email) {
  getDb().prepare('UPDATE admin_users SET email = ? WHERE username = ?').run(email, username);
}

function updateAdminPassword(username, currentPassword, newPassword) {
  const user = verifyAdmin(username, currentPassword);
  if (!user) return false;
  const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  getDb().prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(newHash, username);
  return true;
}

// ─── Users (public registration) ──────────────────────────────────────────────

function createUser({ email, password, name }) {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const stmt = getDb().prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)');
  const result = stmt.run(email, hash, name);
  // Auto-generate an API key for the new user
  const key = generateApiKey();
  getDb().prepare('INSERT INTO api_keys (key, name, user_id) VALUES (?, ?, ?)').run(key, 'Default Key', result.lastInsertRowid);
  return { id: result.lastInsertRowid, email, name, api_key: key };
}

function verifyUser(email, password) {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return getDb().prepare('SELECT id, email, name FROM users WHERE email = ? AND password_hash = ?').get(email, hash);
}

function getUserById(id) {
  return getDb().prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(id);
}

function getUserByEmail(email) {
  return getDb().prepare('SELECT id FROM users WHERE email = ?').get(email);
}

function getUserApiKeys(userId) {
  return getDb().prepare('SELECT id, key, name, active, last_used, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function createUserApiKey(userId, name) {
  const key = generateApiKey();
  getDb().prepare('INSERT INTO api_keys (key, name, user_id) VALUES (?, ?, ?)').run(key, name, userId);
  return { key, name };
}

function deleteUserApiKey(keyId, userId) {
  getDb().prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(keyId, userId);
}

// ─── Usage ────────────────────────────────────────────────────────────────────

function logUsage({ model_id, model_api_id, api_key_id, prompt_tokens, completion_tokens, endpoint, status, error_message }) {
  getDb().prepare(`
    INSERT INTO usage_logs (model_id, model_api_id, api_key_id, prompt_tokens, completion_tokens, endpoint, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    model_id || null,
    model_api_id || null,
    api_key_id || null,
    prompt_tokens || 0,
    completion_tokens || 0,
    endpoint || '',
    status || 'success',
    error_message || null
  );
}

function getUsageStats(days = 7) {
  return getDb().prepare(`
    SELECT 
      COUNT(*) as total_requests,
      COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
      COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens
    FROM usage_logs 
    WHERE created_at >= datetime('now', '-' || ? || ' days')
  `).get(days);
}

function getUsageByModel(days = 7) {
  return getDb().prepare(`
    SELECT m.name as model_name, COUNT(*) as requests, COALESCE(SUM(u.prompt_tokens + u.completion_tokens), 0) as tokens
    FROM usage_logs u
    LEFT JOIN models m ON u.model_id = m.id
    WHERE u.created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY u.model_id
    ORDER BY requests DESC
  `).all(days);
}

function getUsageDaily(days = 14) {
  return getDb().prepare(`
    SELECT date(created_at) as day, 
           COUNT(*) as requests, 
           COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens
    FROM usage_logs 
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(days);
}

function getRecentErrors(limit = 10) {
  return getDb().prepare(`
    SELECT u.*, m.name as model_name
    FROM usage_logs u
    LEFT JOIN models m ON u.model_id = m.id
    WHERE u.status = 'error'
    ORDER BY u.created_at DESC
    LIMIT ?
  `).all(limit);
}

function getModelCount() {
  return getDb().prepare('SELECT COUNT(*) as count FROM models WHERE active = 1').get().count;
}

function getApiKeyCount() {
  return getDb().prepare('SELECT COUNT(*) as count FROM api_keys WHERE active = 1').get().count;
}

function getTotalModelApis() {
  return getDb().prepare('SELECT COUNT(*) as count FROM model_apis').get().count;
}

module.exports = {
  getDb,
  getAllModels,
  getActiveModels,
  getModelById,
  getModelByName,
  createModel,
  updateModel,
  deleteModel,
  getModelApis,
  getActiveModelApis,
  addModelApi,
  updateModelApi,
  deleteModelApi,
  getAllApiKeys,
  createApiKey,
  deleteApiKey,
  validateApiKey,
  verifyAdmin,
  logUsage,
  getUsageStats,
  getUsageByModel,
  getUsageDaily,
  getRecentErrors,
  getModelCount,
  getApiKeyCount,
  getTotalModelApis,
  updateAdminProfile,
  updateAdminPassword,
  createUser,
  verifyUser,
  getUserById,
  getUserByEmail,
  getUserApiKeys,
  createUserApiKey,
  deleteUserApiKey
};
