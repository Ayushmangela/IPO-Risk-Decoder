import React from 'react';
import { Fingerprint, MagnifyingGlass } from '@phosphor-icons/react';

export default function AppShell({
  companies,
  selectedCompanyId,
  onSelectCompany,
  selectedCompany,
  views,
  activeView,
  onNavigate,
  onOpenPalette,
  children,
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-identity">
            <span className="topbar-company-name">
              {selectedCompany ? selectedCompany.name : 'Disclosure Terminal'}
            </span>
            <span className="topbar-company-sector">
              {selectedCompany ? selectedCompany.sector : 'IPO prospectus risk audit'}
            </span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="company-switch" role="tablist" aria-label="Select company">
            {companies.map((c) => (
              <button
                key={c.company_id}
                type="button"
                role="tab"
                aria-selected={c.company_id === selectedCompanyId}
                className={['company-switch-item', c.company_id === selectedCompanyId ? 'active' : ''].join(' ')}
                onClick={() => onSelectCompany(c.company_id)}
              >
                {shortName(c.name)}
              </button>
            ))}
          </div>
          <button type="button" className="cmdk-trigger" onClick={onOpenPalette}>
            <MagnifyingGlass size={14} />
            Jump to…
            <span className="cmdk-kbd">⌘K</span>
          </button>
        </div>
      </header>

      <nav className="rail" aria-label="Primary">
        <div className="rail-mark">
          <Fingerprint size={19} weight="bold" />
        </div>
        <div className="rail-nav">
          {views.map((v) => (
            <IconButtonNav key={v.id} view={v} active={v.id === activeView} onClick={() => onNavigate(v.id)} />
          ))}
        </div>
      </nav>

      <main className="main-outlet">{children}</main>
    </div>
  );
}

function IconButtonNav({ view, active, onClick }) {
  return (
    <button
      type="button"
      className={['rail-item', active ? 'active' : ''].join(' ')}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={view.label}
    >
      {view.icon}
      <span className="rail-item-label">{view.short}</span>
    </button>
  );
}

function shortName(fullName) {
  const match = fullName.match(/^([^(]+)/);
  const base = (match ? match[1] : fullName).trim();
  return base.length > 18 ? `${base.slice(0, 16)}…` : base;
}
