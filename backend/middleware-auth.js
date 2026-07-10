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

function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: No API key provided' });
  }

  const db = require('../db');
  const keyRecord = db.validateApiKey(apiKey);
  if (!keyRecord) {
    return res.status(403).json({ error: 'Forbidden: Invalid or inactive API key' });
  }

  req.apiKeyId = keyRecord.id;
  req.apiKeyName = keyRecord.name;
  next();
}

module.exports = { generateToken, requireAdmin, requireApiKey };
