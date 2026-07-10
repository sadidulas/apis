import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [toast, setToast] = useState('');

  const token = localStorage.getItem('user_token');
  const api = {
    get: async (url) => {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) { localStorage.removeItem('user_token'); navigate('/login'); throw new Error('Session expired'); }
      if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
      return res.json();
    },
    post: async (url, body) => {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.status === 401) { localStorage.removeItem('user_token'); navigate('/login'); throw new Error('Session expired'); }
      if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
      return res.json();
    },
    del: async (url) => {
      const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) { localStorage.removeItem('user_token'); navigate('/login'); throw new Error('Session expired'); }
      if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
      return res.json();
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    Promise.all([
      api.get('/api/auth/me'),
      api.get('/api/auth/apikeys')
    ]).then(([userData, keysData]) => {
      setUser(userData);
      setKeys(keysData);
      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const result = await api.post('/api/auth/apikeys', { name: newKeyName });
      setNewKey(result.key);
      setNewKeyName('');
      const keysData = await api.get('/api/auth/apikeys');
      setKeys(keysData);
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    try {
      await api.del(`/api/auth/apikeys/${id}`);
      setKeys(prev => prev.filter(k => k.id !== id));
      setToast('API key deleted');
      setTimeout(() => setToast(''), 2000);
    } catch (err) { alert(err.message); }
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setToast(label || 'Copied!');
    setTimeout(() => setToast(''), 2000);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><span className="spinner" /></div>;
  if (error) return <div className="login-page"><div className="alert alert-error">{error}</div></div>;

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero-band" style={{ padding: '40px 0' }}>
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">👤 My Dashboard</div>
            <h1 style={{ fontSize: 40 }}>Welcome, {user?.name}</h1>
            <p style={{ fontSize: '1rem' }}>{user?.email} &mdash; Manage your API keys</p>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        {toast && <div className="toast">{toast}</div>}

        {/* Quick Start */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3>🚀 Quick Start</h3>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--slate)', lineHeight: 1.7 }}>
            <p>Use your API key to call any model:</p>
            <div className="code-block" style={{ margin: '8px 0' }}>{`
curl https://free-apis-b1hi.onrender.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{"model": "model-name", "messages": [{"role": "user", "content": "Hello!"}]}'
`}</div>
            <p>
              Browse available models in the <a href="/models">Models Hub</a> or
              test them in the <a href="/playground">Playground</a>.
            </p>
          </div>
        </div>

        {/* New Key Display */}
        {newKey && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            <strong>New API Key Created!</strong> Copy it now — you won't see it again.
            <div className="key-display" style={{ marginTop: 8 }}>
              <span style={{ flex: 1, fontSize: '0.78rem' }}>{newKey}</span>
              <button className="copy-btn" onClick={() => copy(newKey)}>Copy</button>
            </div>
          </div>
        )}

        {/* Create Key */}
        <div className="card" style={{ marginBottom: 24, padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>New Key Name</label>
              <input className="form-input" value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="e.g. My App" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newKeyName.trim()}>
              + Generate Key
            </button>
          </div>
        </div>

        {/* Keys List */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>🔑 My API Keys</h3>

        {keys.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p>You don't have any API keys yet.</p>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>API Key</th>
                    <th>Created</th>
                    <th>Last Used</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map(k => (
                    <tr key={k.id}>
                      <td><strong>{k.name}</strong></td>
                      <td>
                        <code style={{ fontSize: '0.78rem', color: 'var(--steel)' }}>{k.key.substring(0, 14)}...</code>
                        <button className="copy-btn" style={{ marginLeft: 6, padding: '2px 6px', fontSize: '0.7rem' }}
                          onClick={() => copy(k.key, 'Copied!')}>Copy</button>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--stone)' }}>
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--stone)' }}>
                        {k.last_used ? new Date(k.last_used).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        <span className={`tag ${k.active ? 'tag-active' : 'tag-inactive'}`}>
                          {k.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDelete(k.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
