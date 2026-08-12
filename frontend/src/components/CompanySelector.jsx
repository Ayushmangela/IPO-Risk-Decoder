import React from 'react';
import { Building2 } from 'lucide-react';

export default function CompanySelector({ companies, selectedCompanyId, onSelectCompany }) {
  return (
    <section className="section-block mb-8">
      <h2 className="card-title">
        <Building2 size={18} color="#818cf8" />
        Select IPO Prospectus Filing
      </h2>
      <div className="company-selector-grid">
        {companies.map((comp) => {
          const isActive = comp.company_id === selectedCompanyId;
          return (
            <div
              key={comp.company_id}
              id={`company-select-${comp.company_id}`}
              className={`company-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelectCompany(comp.company_id)}
            >
              <h3 className="company-name">{comp.name}</h3>
              <span className="company-sector-badge">{comp.sector}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
