const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'free-api-jwt-secret-change-in-production';

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
}

function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    if (decoded.type !== 'user') {
      return res.status(403).json({ error: 'Invalid token type' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Register ───────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = db.createUser({ email, password, name });
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      api_key: user.api_key
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Login ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = db.verifyUser(email, password);
    if (!user) {
      // Fallback: try Supabase
      try {
        const { supabase } = require('./supabase');
        const hash = require('crypto').createHash('sha256').update(password).digest('hex');
        const { data: sbUser } = await supabase
          .from('users')
          .select('id, email, name, password_hash')
          .eq('email', email)
          .single();
        if (sbUser && sbUser.password_hash === hash) {
          user = { id: sbUser.id, email: sbUser.email, name: sbUser.name };
          try {
            db.execute(
              'INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
              [sbUser.id, sbUser.email, sbUser.password_hash, sbUser.name]
            );
          } catch (e) { /* non-critical */ }
        }
      } catch (e) { /* non-critical */ }
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get current user ───────────────────────────────────────────────────
router.get('/me', requireUser, async (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── User's API Keys ────────────────────────────────────────────────────
router.get('/apikeys', requireUser, async (req, res) => {
  const keys = db.getUserApiKeys(req.user.id);
  res.json(keys);
});

router.post('/apikeys', requireUser, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.createUserApiKey(req.user.id, name);
  res.status(201).json(result);
});

router.delete('/apikeys/:id', requireUser, async (req, res) => {
  db.deleteUserApiKey(req.params.id, req.user.id);
  res.json({ message: 'API key deleted' });
});

module.exports = router;
module.exports.requireUser = requireUser;
