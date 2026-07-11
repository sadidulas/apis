const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'free-api-jwt-secret-change-in-production';

function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

async function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: No API key provided' });
  }

  const db = require('./db');
  let keyRecord = db.validateApiKey(apiKey);

  // Fallback: try Supabase if not in SQLite (e.g. after Render restart)
  if (!keyRecord) {
    try {
      const { supabase } = require('./supabase');
      const { data: sbKey } = await supabase
        .from('api_keys')
        .select('id, name, key')
        .eq('key', apiKey)
        .eq('active', true)
        .single();

      if (sbKey) {
        // Sync key to SQLite for subsequent requests
        try {
          db.execute(
            'INSERT OR IGNORE INTO api_keys (id, key, name, active) VALUES (?, ?, ?, 1)',
            [sbKey.id, sbKey.key, sbKey.name]
          );
        } catch (e) { /* non-critical */ }
        keyRecord = { id: sbKey.id, name: sbKey.name };
      }
    } catch (e) {
      console.log('Supabase API key fallback failed:', e.message.substring(0, 80));
    }
  }

  if (!keyRecord) {
    return res.status(403).json({ error: 'Forbidden: Invalid or inactive API key' });
  }

  req.apiKeyId = keyRecord.id;
  req.apiKeyName = keyRecord.name;
  next();
}

module.exports = { generateToken, requireAdmin, requireApiKey };
