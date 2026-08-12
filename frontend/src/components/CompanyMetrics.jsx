import React from 'react';
import { Building2, AlertTriangle, BarChart3 } from 'lucide-react';

export default function CompanyMetrics({ selectedCompany, summaryData }) {
  if (!selectedCompany || !summaryData) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="card stat-card-highlight">
        <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
          <Building2 size={24} />
        </div>
        <div>
          <h3 className="stat-label">{selectedCompany.name}</h3>
          <p className="stat-subtext">Company | {selectedCompany.sector} Sector</p>
        </div>
      </div>

      <div className="card stat-card-highlight">
        <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
          <AlertTriangle size={24} />
        </div>
        <div>
          <h3 className="stat-value">{summaryData.total_risks}</h3>
          <p className="stat-subtext">Total Scored Risk Items</p>
        </div>
      </div>

      <div className="card stat-card-highlight">
        <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
          <BarChart3 size={24} />
        </div>
        <div>
          <h3 className="stat-value">
            {summaryData.avg_severity} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ 5.0</span>
          </h3>
          <p className="stat-subtext">Average Severity Score</p>
        </div>
      </div>
    </div>
  );
}
