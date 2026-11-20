import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './auth.jsx';
import { loadConfig, isConfigured } from './config.js';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

function Message({ title, children }) {
  return (
    <div className="max-w-xl mx-auto mt-16 card">
      <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-600">{children}</p>
    </div>
  );
}

loadConfig()
  .then(async () => {
    if (!isConfigured()) {
      root.render(
        <Message title="Setup required">
          Edit <code>client/public/config.json</code> with your Azure app <strong>clientId</strong> and{' '}
          <strong>tenantId</strong>, then redeploy. See SETUP.md.
        </Message>
      );
      return;
    }
    const { default: App } = await import('./App.jsx');
    root.render(
      <React.StrictMode>
        <AuthProvider>
          <App />
        </AuthProvider>
      </React.StrictMode>
    );
  })
  .catch(err => root.render(<Message title="Configuration error">{err.message}</Message>));
