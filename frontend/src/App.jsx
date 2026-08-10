import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { 
  Building2, AlertTriangle, ShieldAlert, BarChart3, ChevronDown, ChevronUp, Search, Info, CheckCircle2 
} from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000';

const CATEGORY_COLORS = {
  Financial: '#3b82f6',
  Legal: '#a855f7',
  Regulatory: '#ec4899',
  Operational: '#f59e0b',
  Market: '#10b981',
  Reputational: '#06b6d4',
};

const SEVERITY_COLORS = {
  5: '#ef4444', // Severe
  4: '#f97316', // High
  3: '#eab308', // Moderate
  2: '#10b981', // Low
  1: '#06b6d4', // Minimal
};

export default function App() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [risks, setRisks] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRisks, setLoadingRisks] = useState(false);
  
  // Drill-down filters & expansion
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRiskId, setExpandedRiskId] = useState(null);

  // 1. Fetch Companies on Load
  useEffect(() => {
    fetch(`${API_BASE_URL}/companies`)
      .then((res) => res.json())
      .then((data) => {
        setCompanies(data);
        if (data.length > 0) {
          setSelectedCompanyId(data[0].company_id);
        }
      })
      .catch((err) => console.error('Error fetching companies:', err));
  }, []);

  // 2. Fetch Summary & Risks when selectedCompanyId changes
  useEffect(() => {
    if (!selectedCompanyId) return;

    setLoadingSummary(true);
    setLoadingRisks(true);
    setCategoryFilter('ALL');
    setSearchQuery('');
    setExpandedRiskId(null);

    // Fetch Summary
    fetch(`${API_BASE_URL}/companies/${selectedCompanyId}/summary`)
      .then((res) => res.json())
      .then((data) => {
        setSummaryData(data);
        setLoadingSummary(false);
      })
      .catch((err) => {
        console.error('Error fetching summary:', err);
        setLoadingSummary(false);
      });

    // Fetch Risks
    fetch(`${API_BASE_URL}/companies/${selectedCompanyId}/risks`)
      .then((res) => res.json())
      .then((data) => {
        setRisks(data);
        setLoadingRisks(false);
      })
      .catch((err) => {
        console.error('Error fetching risks:', err);
        setLoadingRisks(false);
      });
  }, [selectedCompanyId]);

  const selectedCompany = companies.find((c) => c.company_id === selectedCompanyId);

  // Prepare Chart Data
  const categoryChartData = summaryData?.category_counts
    ? Object.entries(summaryData.category_counts).map(([cat, count]) => ({
        category: cat,
        count,
        fill: CATEGORY_COLORS[cat] || '#6366f1',
      }))
    : [];

  const severityCounts = risks.reduce((acc, r) => {
    acc[r.score] = (acc[r.score] || 0) + 1;
    return acc;
  }, {});

  const severityChartData = [5, 4, 3, 2, 1]
    .filter((score) => severityCounts[score] > 0)
    .map((score) => ({
      name: `Score ${score} (${score === 5 ? 'Severe' : score === 4 ? 'High' : score === 3 ? 'Moderate' : 'Low'})`,
      value: severityCounts[score],
      fill: SEVERITY_COLORS[score],
    }));

  // Filter Risks
  const filteredRisks = risks.filter((r) => {
    const matchesCat = categoryFilter === 'ALL' || r.category.toUpperCase() === categoryFilter.toUpperCase();
    const matchesSearch =
      r.risk_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reasoning.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="app-layout">
      {/* Header Bar */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-group">
            <div className="logo-badge">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="app-title">IPO Prospectus Risk Decoder</h1>
              <p className="app-subtitle">LLM Risk Factor Analysis & Cross-Company Benchmarking</p>
            </div>
          </div>
        </div>
      </header>

      <main className="main-container">
        {/* SECTION 1: Company Selector */}
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
                  onClick={() => setSelectedCompanyId(comp.company_id)}
                >
                  <h3 className="company-name">{comp.name}</h3>
                  <span className="company-sector-badge">{comp.sector}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: Company Dashboard & Charts */}
        {selectedCompany && summaryData && (
          <section className="section-block mb-8">
            <div className="metrics-row">
              <div className="metric-card">
                <div className="metric-icon-box">
                  <Building2 size={24} color="#a5b4fc" />
                </div>
                <div>
                  <div className="metric-val">{selectedCompany.name}</div>
                  <div className="metric-lbl">Company | {selectedCompany.sector} Sector</div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-box">
                  <AlertTriangle size={24} color="#fcd34d" />
                </div>
                <div>
                  <div className="metric-val">{summaryData.total_risks}</div>
                  <div className="metric-lbl">Total Scored Risk Items</div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-box">
                  <BarChart3 size={24} color="#f87171" />
                </div>
                <div>
                  <div className="metric-val">{summaryData.average_severity} / 5.0</div>
                  <div className="metric-lbl">Average Severity Score</div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="charts-grid">
              {/* Chart 1: Category Breakdown */}
              <div className="card">
                <h3 className="card-title">
                  <BarChart3 size={18} color="#818cf8" />
                  Category Breakdown Count
                </h3>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="category" stroke="#94a3b8" fontSize={12} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Severity Distribution */}
              <div className="card">
                <h3 className="card-title">
                  <AlertTriangle size={18} color="#fb923c" />
                  Severity Score Distribution (1–5 Rubric)
                </h3>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {severityChartData.map((entry, index) => (
                          <Cell key={`cell-pie-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                      />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Peer Comparison Table */}
            <div className="card mb-8">
              <h3 className="card-title">
                <Info size={18} color="#facc15" />
                Cross-Company Benchmark Stats
              </h3>
              
              <div className="peer-notice-box">
                <Info size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Methodology Notice ({summaryData.comparison_mode.toUpperCase()})</strong>: 
                  {summaryData.comparison_notice}
                </div>
              </div>

              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Risk Category</th>
                      <th>Company Risk Count</th>
                      <th>Company Risk %</th>
                      <th>All-Company Avg %</th>
                      <th>Difference (% Points)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.peer_comparison?.map((row) => (
                      <tr key={row.category}>
                        <td>
                          <span style={{ color: CATEGORY_COLORS[row.category] || '#fff', fontWeight: 700 }}>
                            {row.category}
                          </span>
                        </td>
                        <td>{row.count}</td>
                        <td>{row.company_pct}%</td>
                        <td>{row.all_company_avg_pct}%</td>
                        <td>
                          <span
                            className={`diff-tag ${
                              row.difference > 0
                                ? 'diff-positive'
                                : row.difference < 0
                                ? 'diff-negative'
                                : 'diff-neutral'
                            }`}
                          >
                            {row.difference > 0 ? `+${row.difference}%` : `${row.difference}%`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: Risk Factor Drill-Down */}
        <section className="section-block">
          <div className="card">
            <h2 className="card-title">
              <AlertTriangle size={18} color="#a5b4fc" />
              Risk Factors Drill-Down ({filteredRisks.length} Items)
            </h2>

            <div className="risk-filters">
              {/* Category Filter Tabs */}
              <div className="category-tabs">
                <button
                  id="category-filter-all"
                  className={`tab-btn ${categoryFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('ALL')}
                >
                  All Categories ({risks.length})
                </button>
                {['Financial', 'Regulatory', 'Legal', 'Operational', 'Market', 'Reputational'].map((cat) => (
                  <button
                    key={cat}
                    id={`category-filter-${cat.toLowerCase()}`}
                    className={`tab-btn ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <input
                type="text"
                id="search-input"
                className="search-input"
                placeholder="Search risk text or reasoning..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Risk List */}
            <div className="risk-list">
              {filteredRisks.map((risk) => {
                const isExpanded = expandedRiskId === risk.risk_number;
                return (
                  <div
                    key={risk.risk_number}
                    id={`risk-item-${risk.risk_number}`}
                    className="risk-card"
                    onClick={() => setExpandedRiskId(isExpanded ? null : risk.risk_number)}
                  >
                    <div className="risk-card-header">
                      <div className="risk-badge-group">
                        <span className="badge badge-cat">{risk.category}</span>
                        <span className={`badge badge-score-${risk.score}`}>
                          Severity {risk.score}/5 ({risk.score === 5 ? 'Severe' : risk.score === 4 ? 'High' : risk.score === 3 ? 'Moderate' : 'Low'})
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8' }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    <p className="risk-snippet">
                      <strong>Risk #{risk.risk_number}:</strong> {risk.risk_text}
                    </p>

                    {/* LLM Reasoning Field (Expanded) */}
                    {isExpanded && (
                      <div className="risk-reasoning-box">
                        <div className="reasoning-title">
                          <CheckCircle2 size={14} />
                          LLM Audit Reasoning
                        </div>
                        <p>{risk.reasoning}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredRisks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  No risk factors found matching the selected filter.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
