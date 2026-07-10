import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Grid3X3, Brain, MessageSquare, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

const providers = ['all', 'openai', 'anthropic', 'custom'];
const providerLabels = { openai: 'OpenAI', anthropic: 'Anthropic', custom: 'Custom' };

export default function Models() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/public/models')
      .then(r => r.json())
      .then(data => {
        setModels(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = models.filter(m => {
    const matchesSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.system_prompt || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' ||
      m.apis?.some(a => a.provider === filter);
    return matchesSearch && matchesFilter;
  });

  const providerTag = (provider) => {
    const cls = provider === 'openai' ? 'tag-green' : provider === 'anthropic' ? 'tag-purple' : 'tag-orange';
    return <span className={`tag ${cls}`} style={{ textTransform: 'none', letterSpacing: 0 }}>{providerLabels[provider] || provider}</span>;
  };

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero-band">
        <div className="container">
          <div className="hero-content">
            <div className="hero-tag"><Grid3X3 size={14} /> Browse Models</div>
            <h1 style={{ fontSize: 48 }}>AI Models Hub</h1>
            <p className="hero-subtitle">Discover available AI models and test them instantly</p>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        {/* Search + Filter Bar */}
        <div className="card" style={{ marginBottom: 24, padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="form-group" style={{ flex: '1 1 300px', marginBottom: 0, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--steel)' }} />
              <input
                className="form-input"
                type="search"
                placeholder="Search models by name or description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {providers.map(p => (
                <button
                  key={p}
                  className={`pill-tab ${filter === p ? 'active' : ''}`}
                  onClick={() => setFilter(p)}
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  {p === 'all' ? 'All' : providerLabels[p] || p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} className="spinner" /></div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p>{search ? 'No models match your search.' : 'No models available yet. Check back later!'}</p>
            </div>
          </div>
        ) : (
          <div className="features-grid">
            {filtered.map(m => (
              <div className="feature-card" key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ fontSize: '1.05rem' }}>{m.name}</h3>
                  <span className="badge-popular" style={{ fontSize: '0.7rem' }}>
                    {m.endpoint_count || m.apis?.length || 0} endpoint{(m.endpoint_count || m.apis?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>

                {m.system_prompt && (
                  <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 12, flex: 1 }}>
                    {m.system_prompt.substring(0, 150)}
                    {m.system_prompt.length > 150 ? '...' : ''}
                  </p>
                )}

                {/* Provider tags */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                  {m.apis?.map((a, i) => (
                    <React.Fragment key={i}>
                      {providerTag(a.provider)}
                    </React.Fragment>
                  ))}
                  {(!m.apis || m.apis.length === 0) && (
                    <span className="tag" style={{ background: 'var(--surface)', color: 'var(--stone)' }}>No endpoints</span>
                  )}
                </div>

                <Link
                  to={`/playground?model=${encodeURIComponent(m.name)}`}
                  className="btn btn-primary btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                >
                  <MessageSquare size={14} /> Try in Playground <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
