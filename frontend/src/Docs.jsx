import React from 'react';

const curlChat = `curl https://free-api.onrender.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: fk-your-api-key" \\
  -d '{
    "model": "my-custom-model",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ]
  }'`;

const curlModels = `curl https://free-api.onrender.com/api/v1/models \\
  -H "x-api-key: fk-your-api-key"`;

const nodeCode = `const response = await fetch('https://free-api.onrender.com/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'fk-your-api-key'
  },
  body: JSON.stringify({
    model: 'my-custom-model',
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  })
});
const data = await response.json();
console.log(data.choices[0].message.content);`;

const pythonCode = `import requests

response = requests.post(
    'https://free-api.onrender.com/api/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'x-api-key': 'fk-your-api-key'
    },
    json={
        'model': 'my-custom-model',
        'messages': [
            {'role': 'user', 'content': 'Hello!'}
        ]
    }
)
data = response.json()
print(data['choices'][0]['message']['content'])`;

const responseExample = `{
  "id": "chatcmpl-123456",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "gpt-4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "The capital of France is Paris."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 7,
    "total_tokens": 32
  }
}`;

export default function Docs() {
  return (
    <div className="page">
      {/* Hero */}
      <section className="hero-band" style={{ padding: '48px 0' }}>
        <div className="container">
          <div className="hero-content">
            <h1 style={{ fontSize: 48 }}>API Documentation</h1>
            <p>Everything you need to integrate with Free API</p>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 48, paddingBottom: 48 }}>
        {/* Overview */}
        <div className="docs-section">
          <h2>Overview</h2>
          <p>
            Free API provides a unified gateway to multiple AI providers. 
            Admins configure models with API keys and system prompts. 
            Users call any configured model through a single OpenAI-compatible endpoint.
          </p>
          <div className="alert alert-info">
            Models support <strong>automatic failover</strong> — if the primary API endpoint fails,
            requests are routed to the next available backup endpoint.
          </div>
        </div>

        {/* Authentication */}
        <div className="docs-section">
          <h2>Authentication</h2>
          <p>All API requests require an API key in the <code>x-api-key</code> header:</p>
          <div className="code-block">
            x-api-key: fk-your-api-key
          </div>
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            Get your API key from the Admin Dashboard → API Keys section.
          </div>
        </div>

        {/* Endpoints */}
        <div className="docs-section">
          <h2>Endpoints</h2>

          <h3>List Available Models</h3>
          <div className="code-block">GET /api/v1/models</div>
          <div className="code-block">
            <span className="comment"># List all models you can use</span>{'\n'}
            {curlModels}
          </div>

          <h3>Chat Completions (OpenAI-compatible)</h3>
          <div className="code-block">POST /api/v1/chat/completions</div>
          <p>Use this endpoint with any model configured in the admin panel.</p>
          <div className="code-block">
            <span className="comment"># Chat with a model</span>{'\n'}
            {curlChat}
          </div>

          <h3>Anthropic-compatible Messages</h3>
          <div className="code-block">POST /api/v1/messages</div>
          <p>For Anthropic-style integration with Claude models.</p>
          <div className="code-block">
            <span className="comment"># Anthropic-style request</span>{'\n'}
            {`curl https://free-api.onrender.com/api/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: fk-your-api-key" \\
  -d '{
    "model": "my-claude",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 1000
  }'`}
          </div>
        </div>

        {/* Model Names */}
        <div className="docs-section">
          <h2>Model Names</h2>
          <p>
            The <code>model</code> field should contain the name assigned by the admin,
            not the provider's internal model ID. For example:
          </p>
          <div className="alert alert-success">
            Admin creates a model named <code>"my-gpt4"</code> pointing to OpenAI's gpt-4 → 
            you use <code>"model": "my-gpt4"</code>.
          </div>
          <p>List all available models:</p>
          <div className="code-block">GET /api/v1/models</div>
        </div>

        {/* Code Examples */}
        <div className="docs-section">
          <h2>Code Examples</h2>

          <h3>Node.js / JavaScript</h3>
          <div className="code-block">{nodeCode}</div>

          <h3>Python</h3>
          <div className="code-block">{pythonCode}</div>
        </div>

        {/* Response */}
        <div className="docs-section">
          <h2>Response Format</h2>
          <p>Returns standard OpenAI-compatible response:</p>
          <div className="code-block">{responseExample}</div>
        </div>

        {/* Failover */}
        <div className="docs-section">
          <h2>Automatic Failover</h2>
          <p>
            If a model has multiple API endpoints configured, Free API automatically tries 
            them in priority order. If the primary endpoint fails (timeout, auth error, 
            rate limit), the request is routed to the first backup, then the second, and so on.
          </p>
          <p>
            This provides high availability without any client-side changes. 
            Monitor failures in the admin Analytics dashboard.
          </p>
        </div>

        {/* System Prompts */}
        <div className="docs-section">
          <h2>System Prompts</h2>
          <p>
            Each model has an optional default system prompt configured by the admin. 
            This is automatically prepended to every conversation. 
            Users can override it by including a <code>system</code> message.
          </p>
        </div>

        {/* Limits */}
        <div className="docs-section">
          <h2>Limits</h2>
          <ul>
            <li>Supported Content-Type: application/json</li>
            <li>Max request size: 10MB</li>
            <li>Request timeout: 60 seconds per endpoint attempt</li>
            <li>Rate limits depend on the underlying provider</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
