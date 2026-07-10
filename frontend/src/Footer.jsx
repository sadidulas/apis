import React from 'react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          <strong style={{ color: 'var(--on-dark)' }}>Free API</strong> &mdash; Unified AI Endpoints. 
          Built with the <a href="https://mongodb.com" target="_blank" rel="noreferrer">MongoDB</a> spirit.
        </p>
      </div>
    </footer>
  );
}
