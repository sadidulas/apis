import React from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🔌',
    title: 'Unified API Gateway',
    desc: 'One endpoint for all providers. Connect OpenAI, Anthropic, or any compatible API through a single, consistent interface.'
  },
  {
    icon: '🔄',
    title: 'Auto-Failover',
    desc: 'Add multiple API keys per model. If one endpoint fails, requests automatically route to the next backup — zero downtime.'
  },
  {
    icon: '🧠',
    title: 'Custom AI Models',
    desc: 'Create your own named models with custom system prompts, temperature, and token limits. Your configuration, your rules.'
  },
  {
    icon: '🔑',
    title: 'API Key Management',
    desc: 'Generate usage keys for your users. Control access, track consumption, and revoke keys from one dashboard.'
  },
  {
    icon: '📊',
    title: 'Usage Analytics',
    desc: 'Real-time dashboards showing request volume, token consumption, model popularity, and error rates.'
  },
  {
    icon: '🚀',
    title: 'Free to Deploy',
    desc: 'Deploy on Render free tier. One-click setup. No credit card required for your own AI proxy infrastructure.'
  }
];

const codeSnippet = `curl https://free-api.onrender.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: fk-your-api-key" \\
  -d '{
    "model": "my-gpt4",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`;

export default function Home() {
  return (
    <div className="page">
      {/* Hero Band */}
      <section className="hero-band">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">⚡ Now with auto-failover</div>
            <h1>One API Gateway.<br />Unlimited AI Potential.</h1>
            <p>
              Connect multiple AI providers through a single endpoint with automatic failover.
              Add your own API keys, create custom models, and monitor everything.
            </p>
            <div className="hero-actions">
              <Link to="/admin/login" className="btn btn-on-dark">
                Get Started Free →
              </Link>
              <Link to="/docs" className="btn btn-secondary-on-dark">
                Read the Docs
              </Link>
            </div>

            {/* Code mockup */}
            <div style={{ marginTop: 48, textAlign: 'left' }}>
              <div className="code-mockup">
                <span className="comment"># One curl to rule them all</span>{'\n'}
                {codeSnippet.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && '\n'}
                    {line}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Everything You Need</h2>
            <p>Powerful features for managing AI endpoints at scale</p>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="section section-dark">
        <div className="container">
          <div style={{
            background: 'var(--brand-teal-deep)',
            borderRadius: 'var(--radius-lg)',
            padding: '64px 48px',
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: 36,
              fontWeight: 500,
              color: 'var(--on-dark)',
              letterSpacing: '-0.5px',
              marginBottom: 12
            }}>
              Ready to deploy?
            </h2>
            <p style={{ color: 'var(--on-dark-muted)', marginBottom: 24, fontSize: '1rem' }}>
              Set up your own Free API instance — connect providers, create models, generate keys.
            </p>
            <Link to="/admin/login" className="btn btn-on-dark">
              Go to Admin Panel →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
