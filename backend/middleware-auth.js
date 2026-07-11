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
        .select('id, name, key, user_id')
        .eq('key', apiKey)
        .eq('active', true)
        .single();

      if (sbKey) {
        // Sync back to SQLite for faster subsequent lookups
        try {
          // Find or create the user in SQLite first
          const { data: sbUser } = await supabase
            .from('users')
            .select('id, email, name')
            .eq('id', sbKey.user_id)
            .single();
          if (sbUser && !db.getUserById(sbKey.id)) {
            // Can't create user without password, but we can still insert the key
          }
          // Insert key directly into SQLite
          const existing = db.validateApiKey(apiKey);
          if (!existing) {
            db.execute(
              'INSERT OR IGNORE INTO api_keys (id, key, name, user_id, active) VALUES (?, ?, ?, ?, 1)',
              [sbKey.id, sbKey.key, sbKey.name, sbKey.user_id]
            );
          }
        } catch (e) { /* non-critical */ }

        keyRecord = db.validateApiKey(apiKey);
        if (!keyRecord) {
          // If sync failed, still allow using the key from Supabase data
          keyRecord = { id: sbKey.id, name: sbKey.name };
        }
      }
    } catch (e) {
      console.log('Supabase API key fallback failed:', e.message);
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
