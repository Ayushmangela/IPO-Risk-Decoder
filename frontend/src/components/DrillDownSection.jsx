import React from 'react';
import { 
  FileText, AlertCircle, Search, ChevronDown, ChevronUp, CheckCircle2 
} from 'lucide-react';
import { CATEGORY_COLORS } from '../api';

export default function DrillDownSection({
  drillDownTab,
  setDrillDownTab,
  risks,
  litigationCases,
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  expandedRiskId,
  setExpandedRiskId,
  litigationCategoryFilter,
  setLitigationCategoryFilter,
  litigationSearchQuery,
  setLitigationSearchQuery,
  expandedLitigationId,
  setExpandedLitigationId,
  loadingRisks,
  loadingLitigation
}) {
  const categories = ['ALL', 'Financial', 'Legal', 'Regulatory', 'Operational', 'Market', 'Reputational'];
  const litigationCategories = ['ALL', 'Criminal', 'Civil', 'Tax', 'Regulatory', 'Other'];

  const filteredRisks = risks.filter((r) => {
    const matchesCat = categoryFilter === 'ALL' || r.category === categoryFilter;
    const matchesSearch = searchQuery === '' || r.risk_text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredLitigation = litigationCases.filter((item) => {
    const matchesCat = litigationCategoryFilter === 'ALL' || item.category === litigationCategoryFilter;
    const matchesSearch = litigationSearchQuery === '' || item.case_text.toLowerCase().includes(litigationSearchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <section className="section-block">
      {/* Top Main Tab Toggle: Risk Factors vs Litigation Cases */}
      <div className="tab-toggle-container mb-6">
        <button
          className={`tab-toggle-btn ${drillDownTab === 'risks' ? 'active' : ''}`}
          onClick={() => setDrillDownTab('risks')}
        >
          <FileText size={18} />
          Risk Factors ({risks.length})
        </button>
        <button
          className={`tab-toggle-btn ${drillDownTab === 'litigation' ? 'active' : ''}`}
          onClick={() => setDrillDownTab('litigation')}
        >
          <AlertCircle size={18} />
          Litigation Cases ({litigationCases.length})
        </button>
      </div>

      {/* TAB 1: Risk Factors List */}
      {drillDownTab === 'risks' && (
        <>
          <div className="card-header-actions mb-6">
            <div className="filter-chips">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`chip ${categoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search risk disclosures..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="risk-list">
            {filteredRisks.map((item) => {
              const isExpanded = expandedRiskId === item.risk_number;
              const catColor = CATEGORY_COLORS[item.category] || '#94a3b8';

              return (
                <div
                  key={item.risk_number}
                  className={`risk-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setExpandedRiskId(isExpanded ? null : item.risk_number)}
                >
                  <div className="risk-card-header">
                    <div className="risk-badge-group">
                      <span className="badge" style={{ backgroundColor: `${catColor}20`, color: catColor, borderColor: `${catColor}40` }}>
                        {item.category}
                      </span>
                      <span className={`badge badge-score-${item.score}`}>
                        Severity {item.score}/5 ({item.score === 5 ? 'Severe' : item.score === 4 ? 'High' : item.score === 3 ? 'Moderate' : item.score === 2 ? 'Low' : 'Minimal'})
                      </span>
                    </div>

                    <div className="expand-icon">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  <p className="risk-text-snippet">
                    <strong>Risk #{item.risk_number}:</strong> {item.risk_text}
                  </p>

                  {/* Expanded Detail Grid: DDI, Readability & Reasoning */}
                  {isExpanded && (
                    <>
                      {/* Metric Grid: DDI, Materiality, Emphasis, Readability */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-4" onClick={(e) => e.stopPropagation()}>
                        <div style={{ background: '#0f172a', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #334155' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Disclosure Distortion Index
                          </span>
                          <strong style={{ fontSize: '1.1rem', color: item.ddi_score > 30 ? '#f87171' : '#38bdf8' }}>
                            {item.ddi_score > 0 ? `+${item.ddi_score}` : item.ddi_score ?? 'N/A'}
                          </strong>
                        </div>

                        <div style={{ background: '#0f172a', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #334155' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Materiality Score
                          </span>
                          <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>
                            {item.materiality_score ?? 'N/A'} / 100
                          </strong>
                        </div>

                        <div style={{ background: '#0f172a', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #334155' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Emphasis Score
                          </span>
                          <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>
                            {item.emphasis_score ?? 'N/A'} / 100
                          </strong>
                        </div>

                        <div style={{ background: '#0f172a', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #334155' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Flesch Readability Score
                          </span>
                          <strong style={{ fontSize: '1.1rem', color: '#facc15' }}>
                            {item.readability_score ?? 'N/A'} (FRE)
                          </strong>
                        </div>
                      </div>

                      {/* LLM Audit Reasoning */}
                      <div className="risk-reasoning-box">
                        <div className="reasoning-title">
                          <CheckCircle2 size={14} />
                          LLM Audit Reasoning
                        </div>
                        <p>{item.reasoning}</p>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {filteredRisks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                No risk items found matching the selected filter.
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: Litigation Cases List */}
      {drillDownTab === 'litigation' && (
        <>
          <div className="card-header-actions mb-6">
            <div className="filter-chips">
              {litigationCategories.map((cat) => (
                <button
                  key={cat}
                  className={`chip ${litigationCategoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setLitigationCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search litigation proceedings..."
                value={litigationSearchQuery}
                onChange={(e) => setLitigationSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="risk-list">
            {filteredLitigation.map((item) => {
              const isExpanded = expandedLitigationId === item.case_id;
              const isMaterialIndividual = item.party_type === 'Promoter' || item.party_type === 'Director';

              return (
                <div
                  key={item.case_id}
                  className={`risk-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setExpandedLitigationId(isExpanded ? null : item.case_id)}
                  style={{ borderLeft: isMaterialIndividual ? '4px solid #ef4444' : '4px solid #3b82f6' }}
                >
                  <div className="risk-card-header">
                    <div className="risk-badge-group">
                      <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.2)', color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.4)' }}>
                        {item.category}
                      </span>

                      <span className="badge" style={{ background: isMaterialIndividual ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: isMaterialIndividual ? '#f87171' : '#60a5fa', borderColor: isMaterialIndividual ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)' }}>
                        Party: {item.party_type} {isMaterialIndividual ? '(Individual Risk)' : ''}
                      </span>
                    </div>

                    <div className="expand-icon">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  <p className="risk-text-snippet">
                    <strong>Case #{item.case_id}:</strong> {item.case_text}
                  </p>

                  {isExpanded && (
                    <div className="risk-reasoning-box">
                      <div className="reasoning-title">
                        <CheckCircle2 size={14} />
                        LLM Legal Exposure Audit
                      </div>
                      <p>{item.reasoning}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredLitigation.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                No litigation cases found matching the selected filter.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
