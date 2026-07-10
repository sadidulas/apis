const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Supabase (non-blocking)
const { initTables } = require('./supabase');
initTables().catch(e => console.log('Supabase init note:', e.message));

// API Routes
const adminRoutes = require('./admin');
const apiRoutes = require('./api');
const publicRoutes = require('./public');
const authRoutes = require('./auth');

app.use('/api/admin', adminRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Free API', version: '1.0.0' });
});

// Serve frontend in production
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Free API server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/login`);
  console.log(`API docs: http://localhost:${PORT}/docs`);
  console.log(`Models: http://localhost:${PORT}/models`);
  console.log(`Playground: http://localhost:${PORT}/playground`);
});
