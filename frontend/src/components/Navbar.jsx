import React from 'react';
import { ShieldAlert, LayoutDashboard, BookOpen } from 'lucide-react';

export default function Navbar({ activeScreen, onNavigate }) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-group">
          <div className="logo-badge">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 className="app-title">IPO Prospectus Risk Decoder</h1>
            <p className="app-subtitle">LLM Risk Factor Analysis & Model Validation Suite</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            id="nav-tab-dashboard"
            className={`tab-btn ${activeScreen === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
          >
            <LayoutDashboard size={16} />
            Dashboard & Risks
          </button>
          <button
            id="nav-tab-methodology"
            className={`tab-btn ${activeScreen === 'methodology' ? 'active' : ''}`}
            onClick={() => onNavigate('methodology')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
          >
            <BookOpen size={16} />
            Methodology & Audit
          </button>
        </div>
      </div>
    </header>
  );
}
