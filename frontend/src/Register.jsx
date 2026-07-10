import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, Key, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Save token and show API key
      localStorage.setItem('user_token', data.token);
      setApiKey(data.api_key);
      setSuccess(`Account created! Welcome, ${data.user.name}!`);

      setTimeout(() => navigate('/dashboard'), 3000);
    } catch (err) {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">F</div>
          <h1>Create Account</h1>
          <p>Get your free API key</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {apiKey ? (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--slate)', marginBottom: 12 }}>
              Your API key is:
            </p>
            <div className="key-display">
              <span style={{ flex: 1, fontSize: '0.75rem' }}>{apiKey}</span>
              <button className="copy-btn" onClick={() => {
                navigator.clipboard.writeText(apiKey);
                setSuccess('Copied!');
              }}>Copy</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--stone)', marginTop: 8 }}>
              Save this key! You won't see it again.
            </p>
            <Link to="/dashboard" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
              Go to Dashboard →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your name" required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters" minLength={6} required />
            </div>
            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? <Loader2 size={16} className="spinner" /> : <><UserPlus size={16} /> Create Account</>}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', color: 'var(--slate)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
