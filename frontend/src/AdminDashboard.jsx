import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';

const API = '/api/admin';

function useApi() {
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
  });
  const handleResponse = async (res) => {
    const data = await res.json();
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
      throw new Error('Session expired');
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };
  const get = (url) => fetch(url, { headers: getHeaders() }).then(handleResponse);
  const post = (url, body) => fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse);
  const put = (url, body) => fetch(url, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse);
  const del = (url) => fetch(url, { method: 'DELETE', headers: getHeaders() }).then(handleResponse);
  return { get, post, put, del };
}

function Toaster({ message, onClose }) {
  useEffect(() => { if (message) { const t = setTimeout(onClose, 2000); return () => clearTimeout(t); } }, [message, onClose]);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function AnalyticsDashboard() {
  const api = useApi();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get(`${API}/stats?days=14`);
      setStats(data);
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;

  const maxDailyRequests = Math.max(...(stats.daily || []).map(d => d.requests), 1);
  const maxDailyTokens = Math.max(...(stats.daily || []).map(d => d.tokens), 1);

  return (
    <>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>📊 Analytics Dashboard</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.modelCount}</div>
          <div className="stat-label">Active Models</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.apiCount || 0}</div>
          <div className="stat-label">API Endpoints</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.keyCount}</div>
          <div className="stat-label">Active Keys</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(stats.total_requests || 0).toLocaleString()}</div>
          <div className="stat-label">Requests (14d)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(stats.total_tokens || 0).toLocaleString()}</div>
          <div className="stat-label">Tokens (14d)</div>
        </div>
      </div>

      {/* Daily Request Chart */}
      {stats.daily && stats.daily.length > 0 && (
        <div className="chart-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Daily Requests</h3>
            <span style={{ color: 'var(--steel)', fontSize: '0.75rem', fontWeight: 600 }}>Last 14 days</span>
          </div>
          <div className="bar-chart">
            {stats.daily.map((d, i) => (
              <div className="bar-item" key={i}>
                <div className="bar-value">{d.requests}</div>
                <div
                  className="bar-fill"
                  style={{ height: `${Math.max((d.requests / maxDailyRequests) * 100, 4)}%` }}
                  title={`${d.day}: ${d.requests} requests`}
                />
                <div className="bar-label">
                  {d.day ? d.day.substring(5) : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage by Model */}
      {stats.byModel && stats.byModel.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>Usage by Model</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Model</th><th>Requests</th><th>Tokens</th></tr>
              </thead>
              <tbody>
                {stats.byModel.map((row, i) => (
                  <tr key={i}>
                    <td><strong>{row.model_name || 'Unknown'}</strong></td>
                    <td>{row.requests}</td>
                    <td>{(row.tokens || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {stats.errors && stats.errors.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Recent Errors</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Model</th><th>Error</th><th>Time</th></tr>
              </thead>
              <tbody>
                {stats.errors.map((e, i) => (
                  <tr key={i}>
                    <td>{e.model_name || 'Unknown'}</td>
                    <td style={{ color: 'var(--accent-pink)', fontSize: '0.8rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.error_message || 'Unknown error'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--stone)' }}>
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!stats.byModel || stats.byModel.length === 0) && (
        <div className="card">
          <div className="empty-state">
            <p>No usage data yet. Configure models and start using the API!</p>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODELS MANAGER  (with multi-API support)
// ═══════════════════════════════════════════════════════════════════════════
function ModelsManager() {
  const api = useApi();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showApiForm, setShowApiForm] = useState(null); // model id for adding API
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get(`${API}/models`);
      setModels(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this model and all its API endpoints?')) return;
    try { await api.del(`${API}/models/${id}`); load(); setToast('Model deleted'); } catch (err) { alert(err.message); }
  };

  const handleToggle = async (id, current) => {
    try { await api.put(`${API}/models/${id}`, { active: current ? 0 : 1 }); load(); } catch (err) { alert(err.message); }
  };

  const handleDeleteApi = async (modelId, apiId) => {
    if (!confirm('Remove this API endpoint?')) return;
    try { await api.del(`${API}/models/${modelId}/apis/${apiId}`); load(); setToast('API endpoint removed'); } catch (err) { alert(err.message); }
  };

  const handleToggleApi = async (modelId, apiId, current) => {
    try { await api.put(`${API}/models/${modelId}/apis/${apiId}`, { active: current ? 0 : 1 }); load(); } catch (err) { alert(err.message); }
  };

  const providerTag = (provider) => {
    const cls = provider === 'openai' ? 'tag-green' : provider === 'anthropic' ? 'tag-purple' : 'tag-orange';
    return <span className={`tag ${cls}`}>{provider}</span>;
  };

  if (loading && models.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>🧠 AI Models</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          + New Model
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      <Toaster message={toast} onClose={() => setToast('')} />

      {showForm && (
        <ModelForm
          model={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}

      {showApiForm && (
        <ApiFormModal
          modelId={showApiForm}
          modelName={models.find(m => m.id === showApiForm)?.name}
          onClose={() => setShowApiForm(null)}
          onSaved={() => { setShowApiForm(null); load(); }}
        />
      )}

      {models.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>No models configured yet.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>Add Your First Model</button>
          </div>
        </div>
      ) : (
        models.map(model => (
          <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }} key={model.id}>
            {/* Model Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid var(--hairline-soft)',
              background: 'var(--surface)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <strong style={{ fontSize: '1rem' }}>{model.name}</strong>
                <span className={`tag ${model.active ? 'tag-active' : 'tag-inactive'}`}>
                  {model.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={`toggle ${model.active ? 'active' : ''}`}
                  onClick={() => handleToggle(model.id, model.active)} title="Toggle model" />
                <button className="btn btn-outline btn-xs" onClick={() => { setEditing(model); setShowForm(true); }}>Edit</button>
                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(model.id)}>Delete</button>
              </div>
            </div>

            {/* System Prompt */}
            {model.system_prompt && (
              <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--hairline-soft)' }}>
                <span style={{ color: 'var(--steel)', fontSize: '0.75rem', fontWeight: 600 }}>SYSTEM PROMPT: </span>
                <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{model.system_prompt.substring(0, 120)}{model.system_prompt.length > 120 ? '...' : ''}</span>
              </div>
            )}

            {/* API Endpoints */}
            <div style={{ padding: '12px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  API Endpoints ({model.apis?.length || 0})
                </span>
                <button className="btn btn-primary btn-xs" onClick={() => setShowApiForm(model.id)}>
                  + Add Endpoint
                </button>
              </div>

              {(!model.apis || model.apis.length === 0) ? (
                <div style={{ color: 'var(--stone)', fontSize: '0.85rem', padding: '8px 0' }}>
                  No endpoints. Add at least one to make this model usable.
                </div>
              ) : (
                <div className="table-wrap">
                  <table style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Priority</th>
                        <th>Provider</th>
                        <th>Base URL</th>
                        <th>Model ID</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.apis.map(api => (
                        <tr key={api.id}>
                          <td>
                            <span className="badge">{api.priority + 1}</span>
                          </td>
                          <td>{providerTag(api.provider)}</td>
                          <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {api.base_url}
                          </td>
                          <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{api.model_id_provider}</td>
                          <td>
                            <button className={`toggle ${api.active ? 'active' : ''}`} style={{ width: 36, height: 20 }}
                              onClick={() => handleToggleApi(model.id, api.id, api.active)} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-danger btn-xs" onClick={() => handleDeleteApi(model.id, api.id)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODEL FORM (Create / Edit)
// ═══════════════════════════════════════════════════════════════════════════
function ModelForm({ model, onClose, onSaved }) {
  const api = useApi();
  const [form, setForm] = useState({
    name: model?.name || '',
    system_prompt: model?.system_prompt || '',
    temperature: model?.temperature ?? 0.7,
    max_tokens: model?.max_tokens ?? 4096,
    apis: model?.apis?.length ? model.apis.map(a => ({
      provider: a.provider || 'custom',
      base_url: a.base_url || '',
      api_key: '',
      model_id_provider: a.model_id_provider || ''
    })) : [{ provider: 'custom', base_url: '', api_key: '', model_id_provider: '' }]
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('settings');

  const providers = [
    { value: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1' },
    { value: 'anthropic', label: 'Anthropic', url: 'https://api.anthropic.com/v1' },
    { value: 'custom', label: 'Custom (OpenAI-compatible)', url: '' }
  ];

  const updateApi = (index, field, value) => {
    const apis = [...form.apis];
    apis[index] = { ...apis[index], [field]: value };
    if (field === 'provider') {
      const p = providers.find(x => x.value === value);
      if (p?.url) apis[index].base_url = p.url;
    }
    setForm(f => ({ ...f, apis }));
  };

  const addApiRow = () => {
    setForm(f => ({ ...f, apis: [...f.apis, { provider: 'custom', base_url: '', api_key: '', model_id_provider: '' }] }));
  };

  const removeApiRow = (index) => {
    if (form.apis.length <= 1) return;
    setForm(f => ({ ...f, apis: f.apis.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (model) {
        const updates = {};
        if (form.name !== model.name) updates.name = form.name;
        if (form.system_prompt !== model.system_prompt) updates.system_prompt = form.system_prompt;
        if (form.temperature !== model.temperature) updates.temperature = form.temperature;
        if (form.max_tokens !== model.max_tokens) updates.max_tokens = form.max_tokens;
        if (Object.keys(updates).length > 0) await api.put(`${API}/models/${model.id}`, updates);
      } else {
        // Filter out empty APIs
        const validApis = form.apis.filter(a => a.base_url && a.api_key && a.model_id_provider);
        await api.post(`${API}/models`, { ...form, apis: validApis });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <h2>{model ? 'Edit Model' : 'Create New Model'}</h2>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="pill-tabs">
          <button className={`pill-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
            Model Settings
          </button>
          <button className={`pill-tab ${tab === 'apis' ? 'active' : ''}`} onClick={() => setTab('apis')}>
            API Endpoints {form.apis.length > 0 && `(${form.apis.length})`}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'settings' && (
            <>
              <div className="form-group">
                <label>Model Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="my-custom-model" required />
                <small>Users will use this name in the <code>model</code> field</small>
              </div>
              <div className="form-group">
                <label>System Prompt</label>
                <textarea className="form-textarea" value={form.system_prompt}
                  onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                  placeholder="You are a helpful assistant..." rows={4} />
                <small>This prompt is automatically injected into every conversation</small>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Temperature</label>
                  <input className="form-input" type="number" step="0.1" min="0" max="2"
                    value={form.temperature}
                    onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0.7 }))} />
                </div>
                <div className="form-group">
                  <label>Max Tokens</label>
                  <input className="form-input" type="number" min="1" step="1"
                    value={form.max_tokens}
                    onChange={e => setForm(f => ({ ...f, max_tokens: parseInt(e.target.value) || 4096 }))} />
                </div>
              </div>
            </>
          )}

          {tab === 'apis' && (
            <>
              <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: 16 }}>
                Add one or more API endpoints. If the first fails, the next one is tried automatically.
              </p>

              {form.apis.map((api, i) => (
                <div key={i} style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  marginBottom: 12,
                  border: '1px solid var(--hairline-soft)',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--steel)' }}>
                      Endpoint #{i + 1}
                      {i === 0 && <span className="badge" style={{ marginLeft: 8, fontSize: '0.65rem' }}>Primary</span>}
                      {i > 0 && <span className="badge-popular" style={{ marginLeft: 8, fontSize: '0.65rem' }}>Fallback</span>}
                    </span>
                    {form.apis.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-xs" style={{ color: 'var(--accent-pink)' }}
                        onClick={() => removeApiRow(i)}>Remove</button>
                    )}
                  </div>

                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label>Provider</label>
                      <select className="form-select" value={api.provider}
                        onChange={e => updateApi(i, 'provider', e.target.value)}>
                        {providers.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label>Base URL *</label>
                      <input className="form-input" value={api.base_url}
                        onChange={e => updateApi(i, 'base_url', e.target.value)}
                        placeholder="https://api.openai.com/v1" required />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>API Key *</label>
                      <input className="form-input" value={api.api_key} type="password"
                        onChange={e => updateApi(i, 'api_key', e.target.value)}
                        placeholder={model ? 'sk-... (leave blank to keep)' : 'sk-...'}
                        required={!model} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Model ID *</label>
                      <input className="form-input" value={api.model_id_provider}
                        onChange={e => updateApi(i, 'model_id_provider', e.target.value)}
                        placeholder="gpt-4, claude-3-opus, etc." required />
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" className="btn btn-secondary btn-sm" onClick={addApiRow}>
                + Add Backup Endpoint
              </button>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : model ? 'Update Model' : 'Create Model'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD API ENDPOINT MODAL
// ═══════════════════════════════════════════════════════════════════════════
function ApiFormModal({ modelId, modelName, onClose, onSaved }) {
  const api = useApi();
  const [form, setForm] = useState({
    provider: 'custom',
    base_url: '',
    api_key: '',
    model_id_provider: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const providers = [
    { value: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1' },
    { value: 'anthropic', label: 'Anthropic', url: 'https://api.anthropic.com/v1' },
    { value: 'custom', label: 'Custom', url: '' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post(`${API}/models/${modelId}/apis`, form);
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Add API Endpoint — {modelName}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Provider</label>
            <select className="form-select" value={form.provider}
              onChange={e => { const p = providers.find(x => x.value === e.target.value); setForm(f => ({ ...f, provider: e.target.value, base_url: p?.url || f.base_url })); }}>
              {providers.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Base URL *</label>
            <input className="form-input" value={form.base_url}
              onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))}
              placeholder="https://api.openai.com/v1" required />
          </div>
          <div className="form-group">
            <label>API Key *</label>
            <input className="form-input" value={form.api_key} type="password"
              onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
              placeholder="sk-..." required />
          </div>
          <div className="form-group">
            <label>Model ID *</label>
            <input className="form-input" value={form.model_id_provider}
              onChange={e => setForm(f => ({ ...f, model_id_provider: e.target.value }))}
              placeholder="gpt-4, claude-3-opus, etc." required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Add Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// API KEYS MANAGER
// ═══════════════════════════════════════════════════════════════════════════
function ApiKeysManager() {
  const api = useApi();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try { setLoading(true); const data = await api.get(`${API}/apikeys`); setKeys(data); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try { const result = await api.post(`${API}/apikeys`, { name: newKeyName }); setNewKey(result.key); setNewKeyName(''); load(); }
    catch (err) { alert('Failed: ' + err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    try { await api.del(`${API}/apikeys/${id}`); load(); setToast('API key deleted'); } catch (err) { alert(err.message); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => { setToast('Copied!'); setTimeout(() => setToast(''), 2000); });
  };

  if (loading && keys.length === 0) return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>🔑 API Keys</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <Toaster message={toast} onClose={() => setToast('')} />

      {newKey && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <strong>New API Key Created!</strong> Copy it now — you won't see it again.
          <div className="key-display" style={{ marginTop: 8 }}>
            <span style={{ flex: 1 }}>{newKey}</span>
            <button className="copy-btn" onClick={() => copyToClipboard(newKey)}>Copy</button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Key Name</label>
            <input className="form-input" value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="e.g. Production App" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newKeyName.trim()}>
            Generate Key
          </button>
        </div>
      </div>

      {keys.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No API keys generated yet.</p></div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>API Key</th><th>Created</th><th>Last Used</th><th>Status</th><th style={{textAlign:'right'}}>Actions</th></tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td><strong>{k.name}</strong></td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: 'var(--steel)' }}>{k.key.substring(0, 12)}...</code>
                      <button className="copy-btn" style={{ marginLeft: 8, padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => copyToClipboard(k.key)}>Copy</button>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--stone)' }}>{new Date(k.created_at).toLocaleDateString()}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--stone)' }}>{k.last_used ? new Date(k.last_used).toLocaleDateString() : 'Never'}</td>
                    <td><span className={`tag ${k.active ? 'tag-active' : 'tag-inactive'}`}>{k.active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-danger btn-xs" onClick={() => handleDelete(k.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN SETTINGS (Email + Password)
// ═══════════════════════════════════════════════════════════════════════════
function AdminSettings() {
  const api = useApi();
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailError, setEmailError] = useState('');
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`${API}/profile`).then(d => {
      setProfile(d);
      setEmail(d.email || '');
    }).catch(() => {});
  }, []);

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailMsg('');
    setEmailError('');
    setSaving(true);
    try {
      await api.put(`${API}/profile`, { email });
      setEmailMsg('Email updated!');
      setTimeout(() => setEmailMsg(''), 3000);
    } catch (err) {
      setEmailError(err.message);
    } finally { setSaving(false); }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwMsg('');
    setPwError('');
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('New passwords do not match');
      return;
    }
    if (pwForm.newPw.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await api.put(`${API}/password`, { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      setPwMsg('Password updated!');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => setPwMsg(''), 3000);
    } catch (err) {
      setPwError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>⚙️ Admin Settings</h2>

      {/* Email */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Admin Email</h3></div>
        {emailMsg && <div className="alert alert-success">{emailMsg}</div>}
        {emailError && <div className="alert alert-error">{emailError}</div>}
        <form onSubmit={handleUpdateEmail}>
          <div className="form-group">
            <label>Username</label>
            <input className="form-input" value={profile?.username || 'admin'} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="admin@admin.com" required />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <span className="spinner" /> : 'Update Email'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="card">
        <div className="card-header"><h3>Change Password</h3></div>
        {pwMsg && <div className="alert alert-success">{pwMsg}</div>}
        {pwError && <div className="alert alert-error">{pwError}</div>}
        <form onSubmit={handleUpdatePassword}>
          <div className="form-group">
            <label>Current Password</label>
            <input className="form-input" type="password" value={pwForm.current}
              onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input className="form-input" type="password" value={pwForm.newPw}
              onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} minLength={6} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input className="form-input" type="password" value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} minLength={6} required />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <span className="spinner" /> : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN LAYOUT
// ═══════════════════════════════════════════════════════════════════════════
function AdminLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login');
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        <NavLink to="/admin" end>📊 Analytics</NavLink>
        <NavLink to="/admin/models">🧠 Models</NavLink>
        <NavLink to="/admin/keys">🔑 API Keys</NavLink>
        <NavLink to="/admin/settings">⚙️ Settings</NavLink>
        <hr />
        <a href="/docs" target="_blank" rel="noreferrer">📖 Docs</a>
        <button onClick={handleLogout}>🚪 Logout</button>
      </div>
      <div className="admin-content">
        <Routes>
          <Route index element={<AnalyticsDashboard />} />
          <Route path="models" element={<ModelsManager />} />
          <Route path="keys" element={<ApiKeysManager />} />
          <Route path="settings" element={<AdminSettings />} />
        </Routes>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route path="/*" element={<AdminLayout />} />
    </Routes>
  );
}
