import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, GitFork } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        {/* Brand */}
        <div className="footer-brand-section">
          <div className="footer-brand-name">
            <span className="yellow-dot" />
            Free API
          </div>
          <p className="footer-brand-desc">
            Unified AI Endpoints. Built with the help of sadidul mehal.
            Connect multiple AI providers through a single endpoint
            with automatic failover.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="https://github.com/sadidulas/apis" target="_blank" rel="noreferrer" className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--on-dark)', borderRadius: 'var(--radius-full)', padding: '8px 16px', fontSize: 'var(--text-caption)' }}>
              <GitFork size={14} /> GitHub
            </a>
          </div>
        </div>

        {/* Product */}
        <div className="footer-col">
          <h4>Product</h4>
          <Link to="/models">Models</Link>
          <Link to="/playground">Playground</Link>
          <Link to="/docs">Documentation</Link>
          <Link to="/admin/login">Admin Panel</Link>
        </div>

        {/* Resources */}
        <div className="footer-col">
          <h4>Resources</h4>
          <Link to="/docs">API Reference</Link>
          <Link to="/playground">API Playground</Link>
          <Link to="/models">Browse Models</Link>
        </div>

        {/* Company */}
        <div className="footer-col">
          <h4>Company</h4>
          <a href="https://github.com/sadidulas/apis" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://render.com" target="_blank" rel="noreferrer">Render</a>
        </div>

        {/* Plans */}
        <div className="footer-col">
          <h4>Plans</h4>
          <Link to="/admin/login">Get Started</Link>
          <Link to="/login">Sign In</Link>
          <Link to="/register">Register</Link>
        </div>

        {/* Support */}
        <div className="footer-col">
          <h4>Support</h4>
          <a href="https://github.com/sadidulas/apis/issues" target="_blank" rel="noreferrer">Report Issue</a>
          <a href="https://github.com/sadidulas/apis/discussions" target="_blank" rel="noreferrer">Discussions</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>&copy; {new Date().getFullYear()} Free API. Built with the help of sadidul mehal.</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <a href="https://github.com/sadidulas/apis" target="_blank" rel="noreferrer"><GitFork size={16} /></a>
        </span>
      </div>
    </footer>
  );
}
