import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Beaker, Send, Key, RotateCcw, Trash2, AlertCircle, Loader2, Copy, Check, Terminal } from 'lucide-react';

export default function Playground() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(searchParams.get('model') || '');
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    fetch('/api/public/models')
      .then(r => r.json())
      .then(data => setModels(data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const model = searchParams.get('model');
    if (model) setSelectedModel(model);
  }, [searchParams]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedModel || !apiKey) return;

    const userMsg = { role: 'user', content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Request failed');
      }

      const assistantMsg = {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || JSON.stringify(data)
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError('');
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Top Bar */}
      <div style={{
        background: 'var(--canvas)',
        borderBottom: '1px solid var(--hairline)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 500, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}><Beaker size={18} /> Playground</h2>

        <select
          className="form-input"
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          style={{ width: 220, height: 38, fontSize: '0.85rem' }}
        >
          <option value="">Select a model...</option>
          {models.map(m => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 250px', maxWidth: 400 }}>
          <input
            className="form-input"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            style={{ height: 38, fontSize: '0.85rem', flex: 1 }}
          />
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setShowKey(!showKey)}
            style={{ padding: '4px 8px' }}
          >
            {showKey ? '🙈' : '👁️'}
          </button>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={clearChat} disabled={messages.length === 0}>
          Clear
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ padding: '8px 24px', flexShrink: 0 }}>
          <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>
        </div>
      )}

      {/* Chat Messages */}
      <div ref={chatRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            paddingTop: 80,
            color: 'var(--stone)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <h3 style={{ color: 'var(--slate)', marginBottom: 8 }}>Test your models</h3>
            <p style={{ fontSize: '0.9rem', maxWidth: 400, margin: '0 auto' }}>
              Select a model, enter your API key, and start chatting to see how your configured models respond.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '70%',
                padding: '12px 18px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? 'var(--brand-green)' : 'var(--canvas)',
                color: msg.role === 'user' ? 'var(--on-primary)' : 'var(--ink)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--hairline)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 18px',
              borderRadius: '18px 18px 18px 4px',
              background: 'var(--canvas)',
              border: '1px solid var(--hairline)',
              display: 'flex',
              gap: 4
            }}>
              <span className="spinner" style={{ width: 14, height: 14 }} />
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div style={{
        borderTop: '1px solid var(--hairline)',
        padding: '16px 24px',
        background: 'var(--canvas)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 12, maxWidth: 900, margin: '0 auto' }}>
          <textarea
            className="form-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedModel && apiKey ? 'Type a message...' : !selectedModel ? 'Select a model first...' : 'Enter your API key above...'}
            style={{
              flex: 1,
              height: 48,
              minHeight: 48,
              maxHeight: 120,
              resize: 'none',
              paddingTop: 12
            }}
            disabled={!selectedModel || !apiKey || loading}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || !selectedModel || !apiKey || loading}
            style={{ height: 48, width: 48, justifyContent: 'center', padding: 0, flexShrink: 0 }}
          >
            {loading ? <span className="spinner" /> : '➤'}
          </button>
        </div>
        {(!selectedModel || !apiKey) && (
          <p style={{ textAlign: 'center', color: 'var(--stone)', fontSize: '0.75rem', marginTop: 8 }}>
            {!selectedModel ? 'Select a model from the dropdown above' : 'Enter your API key to start testing'}
          </p>
        )}
      </div>
    </div>
  );
}
