import React, { useEffect, useState } from 'react';

export default function App() {
  const [apiStatus, setApiStatus] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setApiStatus({ loading: false, data, error: null }))
      .catch((err) => setApiStatus({ loading: false, data: null, error: err.message }));
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">IPO Prospectus Risk Decoder</h1>
        <p className="subtitle">Extracted DRHP Risk Factors, Rubric Validation & Peer Benchmarking</p>
      </header>

      <main>
        <div className="card">
          <div className="status-badge">
            <span className="status-dot"></span>
            System Status Scaffold
          </div>
          <h2>Backend Connection</h2>
          {apiStatus.loading && <p style={{ color: 'var(--text-muted)' }}>Connecting to FastAPI backend...</p>}
          {apiStatus.error && <p style={{ color: '#ef4444' }}>Backend Connection Error: {apiStatus.error}</p>}
          {apiStatus.data && (
            <div style={{ marginTop: '1rem' }}>
              <p><strong>Status:</strong> {apiStatus.data.status}</p>
              <p><strong>Database:</strong> {apiStatus.data.database}</p>
              <p><strong>API Version:</strong> {apiStatus.data.version}</p>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Scaffold Ready</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            The folder structure, configuration, backend endpoints, and frontend app are initialized.
            Next phase: PDF Risk Factor section extraction script.
          </p>
        </div>
      </main>
    </div>
  );
}
