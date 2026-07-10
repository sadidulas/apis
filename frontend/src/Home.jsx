import React from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Shuffle, Brain, KeyRound, BarChart3, Rocket,
  ArrowRight, Terminal, ShieldCheck
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Unified API Gateway',
    desc: 'One endpoint for all providers. Connect OpenAI, Anthropic, or any compatible API through a single, consistent interface.',
    color: 'yellow'
  },
  {
    icon: Shuffle,
    title: 'Auto-Failover',
    desc: 'Add multiple API keys per model. If one endpoint fails, requests automatically route to the next backup — zero downtime.',
    color: 'coral'
  },
  {
    icon: Brain,
    title: 'Custom AI Models',
    desc: 'Create your own named models with custom system prompts, temperature, and token limits. Your configuration, your rules.',
    color: 'teal'
  },
  {
    icon: KeyRound,
    title: 'API Key Management',
    desc: 'Generate usage keys for your users. Control access, track consumption, and revoke keys from one dashboard.',
    color: 'rose'
  },
  {
    icon: BarChart3,
    title: 'Usage Analytics',
    desc: 'Real-time dashboards showing request volume, token consumption, model popularity, and error rates.',
    color: 'yellow'
  },
  {
    icon: Rocket,
    title: 'Free to Deploy',
    desc: 'Deploy on Render free tier. One-click setup. No credit card required for your own AI proxy infrastructure.',
    color: 'coral'
  }
];

const colorClasses = {
  yellow: 'feature-card-yellow',
  coral: 'feature-card-coral',
  teal: 'feature-card-teal',
  rose: 'feature-card-rose'
};

const codeSnippet = `curl https://free-apis-b1hi.onrender.com/api/v1/chat/completions \\
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
      {/* Hero — Miro-style white canvas with bold typography */}
      <section className="hero-band">
        <div className="container">
          <div className="hero-content">
            <div className="hero-tag">
              <Zap size={14} />
              Now with auto-failover
            </div>
            <h1>One API Gateway.<br />Unlimited AI Potential.</h1>
            <p className="hero-subtitle">
              Connect multiple AI providers through a single endpoint with automatic failover.
              Add your own API keys, create custom models, and monitor everything.
            </p>
            <div className="hero-actions">
              <Link to="/admin/login" className="btn btn-primary">
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link to="/docs" className="btn btn-secondary">
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

      {/* Pastel Feature Cards — Miro-style colored cards */}
      <section className="section section-dark">
        <div className="container">
          <div className="section-header">
            <h2>Everything You Need</h2>
            <p>Powerful features for managing AI endpoints at scale</p>
          </div>
          <div className="features-grid">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div className={`feature-card ${colorClasses[f.color]}`} key={i}>
                  <div className="feature-icon">
                    <Icon size={22} />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dark CTA Banner */}
      <section className="section">
        <div className="container">
          <div className="cta-banner-dark">
            <h2>Ready to deploy?</h2>
            <p>Set up your own Free API instance — connect providers, create models, generate keys.</p>
            <Link to="/admin/login" className="btn btn-on-dark">
              Go to Admin Panel <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
