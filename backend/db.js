const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'free-api.db');
let db = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let row;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function execute(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  stmt.run();
  const changes = db.getRowsModified();
  stmt.free();
  save();
  return { changes };
}

function insert(sql, params = []) {
  execute(sql, params);
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row ? row.id : null;
}

function save() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('DB save error:', e.message);
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }
  createTables();
  seedAdmin();
  return db;
}

function createTables() {
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
}

function seedAdmin() {
  const existing = queryOne('SELECT id FROM admin_users WHERE username = ?', ['admin']);
  if (!existing) {
    const hash = crypto.createHash('sha256').update('sadidulmehal').digest('hex');
    insert('INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)',
      ['admin', 'admin@admin.com', hash]);
  }
}

// ─── Models ───────────────────────────────────────────────────────────────────

function getAllModels() {
  return queryAll('SELECT * FROM models ORDER BY created_at DESC');
}

function getActiveModels() {
  return queryAll("SELECT id, name, system_prompt FROM models WHERE active = 1");
}

function getModelById(id) {
  return queryOne('SELECT * FROM models WHERE id = ?', [id]);
}

function getModelByName(name) {
  return queryOne('SELECT * FROM models WHERE name = ?', [name]);
}

function createModel({ name, system_prompt, temperature, max_tokens }) {
  return insert(
    'INSERT INTO models (name, system_prompt, temperature, max_tokens) VALUES (?, ?, ?, ?)',
    [name, system_prompt || '', temperature || 0.7, max_tokens || 4096]
  );
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
  execute(`UPDATE models SET ${sets.join(', ')} WHERE id = ?`, vals);
  return true;
}

function deleteModel(id) {
  execute('DELETE FROM model_apis WHERE model_id = ?', [id]);
  execute('DELETE FROM models WHERE id = ?', [id]);
}

// ─── Model APIs (backup endpoints) ───────────────────────────────────────────

function getModelApis(modelId) {
  return queryAll('SELECT * FROM model_apis WHERE model_id = ? ORDER BY priority ASC', [modelId]);
}

function getActiveModelApis(modelId) {
  return queryAll('SELECT * FROM model_apis WHERE model_id = ? AND active = 1 ORDER BY priority ASC', [modelId]);
}

function addModelApi({ model_id, provider, base_url, api_key, model_id_provider, priority }) {
  const row = queryOne(
    'SELECT COALESCE(MAX(priority), -1) + 1 as next FROM model_apis WHERE model_id = ?', [model_id]
  );
  const maxPriority = row ? row.next : 0;
  return insert(
    'INSERT INTO model_apis (model_id, provider, base_url, api_key, model_id_provider, priority) VALUES (?, ?, ?, ?, ?, ?)',
    [model_id, provider, base_url, api_key, model_id_provider, priority ?? maxPriority]
  );
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
  execute(`UPDATE model_apis SET ${sets.join(', ')} WHERE id = ?`, vals);
  return true;
}

function deleteModelApi(id) {
  execute('DELETE FROM model_apis WHERE id = ?', [id]);
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

function generateApiKey() {
  return 'fk-' + crypto.randomBytes(24).toString('hex');
}

function getAllApiKeys() {
  return queryAll('SELECT * FROM api_keys ORDER BY created_at DESC');
}

function createApiKey(name) {
  const key = generateApiKey();
  execute('INSERT INTO api_keys (key, name) VALUES (?, ?)', [key, name]);
  return { key, name };
}

function deleteApiKey(id) {
  execute('DELETE FROM api_keys WHERE id = ?', [id]);
}

function validateApiKey(key) {
  return queryOne('SELECT id, name FROM api_keys WHERE key = ? AND active = 1', [key]);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyAdmin(username, password) {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return queryOne(
    'SELECT id, username, email FROM admin_users WHERE username = ? AND password_hash = ?',
    [username, hash]
  );
}

function updateAdminProfile(username, email) {
  execute('UPDATE admin_users SET email = ? WHERE username = ?', [email, username]);
}

function updateAdminPassword(username, currentPassword, newPassword) {
  const user = verifyAdmin(username, currentPassword);
  if (!user) return false;
  const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  execute('UPDATE admin_users SET password_hash = ? WHERE username = ?', [newHash, username]);
  return true;
}

// ─── Users (public registration) ──────────────────────────────────────────────

function createUser({ email, password, name }) {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const userId = insert('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [email, hash, name]);
  const key = generateApiKey();
  execute('INSERT INTO api_keys (key, name, user_id) VALUES (?, ?, ?)',
    [key, 'Default Key', userId]);
  return { id: userId, email, name, api_key: key };
}

function verifyUser(email, password) {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return queryOne(
    'SELECT id, email, name FROM users WHERE email = ? AND password_hash = ?',
    [email, hash]
  );
}

function getUserById(id) {
  return queryOne('SELECT id, email, name, created_at FROM users WHERE id = ?', [id]);
}

function getUserByEmail(email) {
  return queryOne('SELECT id FROM users WHERE email = ?', [email]);
}

function getUserApiKeys(userId) {
  return queryAll(
    'SELECT id, key, name, active, last_used, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
}

function createUserApiKey(userId, name) {
  const key = generateApiKey();
  execute('INSERT INTO api_keys (key, name, user_id) VALUES (?, ?, ?)', [key, name, userId]);
  return { key, name };
}

function deleteUserApiKey(keyId, userId) {
  execute('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [keyId, userId]);
}

// ─── Usage ────────────────────────────────────────────────────────────────────

function logUsage({ model_id, model_api_id, api_key_id, prompt_tokens, completion_tokens, endpoint, status, error_message }) {
  execute(
    `INSERT INTO usage_logs (model_id, model_api_id, api_key_id, prompt_tokens, completion_tokens, endpoint, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [model_id || null, model_api_id || null, api_key_id || null,
     prompt_tokens || 0, completion_tokens || 0, endpoint || '',
     status || 'success', error_message || null]
  );
}

function getUsageStats(days = 7) {
  return queryOne(
    `SELECT COUNT(*) as total_requests,
            COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
            COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens
     FROM usage_logs
     WHERE created_at >= datetime('now', '-' || ? || ' days')`,
    [days]
  );
}

function getUsageByModel(days = 7) {
  return queryAll(
    `SELECT m.name as model_name, COUNT(*) as requests,
            COALESCE(SUM(u.prompt_tokens + u.completion_tokens), 0) as tokens
     FROM usage_logs u
     LEFT JOIN models m ON u.model_id = m.id
     WHERE u.created_at >= datetime('now', '-' || ? || ' days')
     GROUP BY u.model_id
     ORDER BY requests DESC`,
    [days]
  );
}

function getUsageDaily(days = 14) {
  return queryAll(
    `SELECT date(created_at) as day, COUNT(*) as requests,
            COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens
     FROM usage_logs
     WHERE created_at >= datetime('now', '-' || ? || ' days')
     GROUP BY date(created_at)
     ORDER BY day ASC`,
    [days]
  );
}

function getRecentErrors(limit = 10) {
  return queryAll(
    `SELECT u.*, m.name as model_name
     FROM usage_logs u
     LEFT JOIN models m ON u.model_id = m.id
     WHERE u.status = 'error'
     ORDER BY u.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

function getModelCount() {
  const row = queryOne('SELECT COUNT(*) as count FROM models WHERE active = 1');
  return row ? row.count : 0;
}

function getApiKeyCount() {
  const row = queryOne('SELECT COUNT(*) as count FROM api_keys WHERE active = 1');
  return row ? row.count : 0;
}

function getTotalModelApis() {
  const row = queryOne('SELECT COUNT(*) as count FROM model_apis');
  return row ? row.count : 0;
}

function getAdminProfile(username) {
  return queryOne('SELECT username, email FROM admin_users WHERE username = ?', [username]);
}

module.exports = {
  init,
  queryOne,
  queryAll,
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
  deleteUserApiKey,
  getAdminProfile
};
