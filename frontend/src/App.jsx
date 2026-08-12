import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { 
  Building2, AlertTriangle, ShieldAlert, BarChart3, ChevronDown, ChevronUp, Search, Info, CheckCircle2,
  BookOpen, CheckSquare, XCircle, Award, LayoutDashboard, FileText, AlertCircle, EyeOff, Scale
} from 'lucide-react';

const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://127.0.0.1:8000'
  : '';


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
  const [activeScreen, setActiveScreen] = useState(() => {
    return (typeof window !== 'undefined' && window.location.pathname.startsWith('/methodology'))
      ? 'methodology'
      : 'dashboard';
  });
  
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [outliersData, setOutliersData] = useState(null);
  const [risks, setRisks] = useState([]);
  const [litigationCases, setLitigationCases] = useState([]);
  const [methodologyData, setMethodologyData] = useState(null);
  
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [loadingLitigation, setLoadingLitigation] = useState(false);
  
  // Drill-down filter & tab states
  const [drillDownTab, setDrillDownTab] = useState('risks'); // 'risks' | 'litigation'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRiskId, setExpandedRiskId] = useState(null);

  const [litigationCategoryFilter, setLitigationCategoryFilter] = useState('ALL');
  const [litigationSearchQuery, setLitigationSearchQuery] = useState('');
  const [expandedLitigationId, setExpandedLitigationId] = useState(null);

  const navigateTo = (screen) => {
    setActiveScreen(screen);
    const targetPath = screen === 'methodology' ? '/methodology' : '/';
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ screen }, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        if (window.location.pathname.startsWith('/methodology')) {
          setActiveScreen('methodology');
        } else {
          setActiveScreen('dashboard');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1. Fetch Companies & Methodology on Load
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

    fetch(`${API_BASE_URL}/api/methodology`)
      .then((res) => res.json())
      .then((data) => setMethodologyData(data))
      .catch((err) => console.error('Error fetching methodology:', err));
  }, []);

  // 2. Fetch Summary, Outliers, Risks & Litigation when selectedCompanyId changes
  useEffect(() => {
    if (!selectedCompanyId) return;

    setLoadingSummary(true);
    setLoadingRisks(true);
    setLoadingLitigation(true);
    setCategoryFilter('ALL');
    setLitigationCategoryFilter('ALL');
    setSearchQuery('');
    setLitigationSearchQuery('');
    setExpandedRiskId(null);
    setExpandedLitigationId(null);

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

    // Fetch Outliers (DDI & Obfuscation)
    fetch(`${API_BASE_URL}/companies/${selectedCompanyId}/outliers`)
      .then((res) => res.json())
      .then((data) => setOutliersData(data))
      .catch((err) => console.error('Error fetching outliers:', err));

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

    // Fetch Litigation Cases
    fetch(`${API_BASE_URL}/companies/${selectedCompanyId}/litigation`)
      .then((res) => res.json())
      .then((data) => {
        setLitigationCases(data);
        setLoadingLitigation(false);
      })
      .catch((err) => {
        console.error('Error fetching litigation cases:', err);
        setLoadingLitigation(false);
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

  // Filter Litigation Cases
  const filteredLitigation = litigationCases.filter((c) => {
    const matchesCat =
      litigationCategoryFilter === 'ALL' ||
      c.category.toUpperCase() === litigationCategoryFilter.toUpperCase();
    const matchesSearch =
      c.case_text.toLowerCase().includes(litigationSearchQuery.toLowerCase()) ||
      c.reasoning.toLowerCase().includes(litigationSearchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Top 3 DDI Outliers
  const topDdiOutliers = outliersData?.ddi_outliers ? outliersData.ddi_outliers.slice(0, 3) : [];


  return (
    <div className="app-layout">
      {/* Top Header Bar */}
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
              onClick={() => navigateTo('dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
            >
              <LayoutDashboard size={16} />
              Dashboard & Risks
            </button>
            <button
              id="nav-tab-methodology"
              className={`tab-btn ${activeScreen === 'methodology' ? 'active' : ''}`}
              onClick={() => navigateTo('methodology')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
            >
              <BookOpen size={16} />
              Methodology & Audit
            </button>
          </div>
        </div>
      </header>

      <main className="main-container">
        {/* SCREEN 1: Dashboard & Risk Drill-Down */}
        {activeScreen === 'dashboard' && (
          <>
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
                {/* 1. Industry Context Card */}
                {summaryData.industry_summary && (
                  <div className="industry-context-card">
                    <div className="industry-header">
                      <div className="industry-title-group">
                        <BookOpen size={20} />
                        <span>Industry Context & Sector Overview</span>
                      </div>
                      <span className="company-sector-badge">{selectedCompany.sector} Sector</span>
                    </div>
                    <p className="industry-text-body">{summaryData.industry_summary}</p>
                  </div>
                )}

                {/* Metrics Row */}
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

                {/* 2. Disclosure Quality Section (DDI & Obfuscation Test) */}
                {(summaryData.obfuscation || summaryData.ddi) && (
                  <div className="disclosure-quality-card">
                    <h3 className="card-title">
                      <EyeOff size={18} color="#a855f7" />
                      Disclosure Quality & Algorithmic Distortion Analysis
                    </h3>

                    {/* Obfuscation Test Callout */}
                    {summaryData.obfuscation && (
                      <div className="obfuscation-box">
                        <div>
                          <div className="obfuscation-title">
                            <BookOpen size={16} color="#818cf8" />
                            Obfuscation Test Result (Spearman Rank Correlation)
                          </div>
                          <p className="obfuscation-desc">
                            Severity and readability showed{' '}
                            <strong>
                              {summaryData.obfuscation.p_value < 0.05
                                ? 'a statistically significant correlation'
                                : 'no statistically significant correlation'}
                            </strong>{' '}
                            ({summaryData.obfuscation.interpretation}, p = {summaryData.obfuscation.p_value}, Spearman ρ = {summaryData.obfuscation.spearman_correlation}).
                          </p>
                        </div>
                        <div className="obfuscation-stat-badge">
                          Spearman ρ: {summaryData.obfuscation.spearman_correlation} | p = {summaryData.obfuscation.p_value}
                        </div>
                      </div>
                    )}

                    {/* DDI Summary Metrics Row */}
                    {summaryData.ddi && (
                      <div className="metrics-row mb-8">
                        <div className="metric-card">
                          <div className="metric-icon-box">
                            <FileText size={22} color="#38bdf8" />
                          </div>
                          <div>
                            <div className="metric-val">{summaryData.ddi.avg_materiality} / 100</div>
                            <div className="metric-lbl">Avg Materiality Score</div>
                          </div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-icon-box">
                            <BarChart3 size={22} color="#c084fc" />
                          </div>
                          <div>
                            <div className="metric-val">{summaryData.ddi.avg_emphasis} / 100</div>
                            <div className="metric-lbl">Avg Emphasis Score</div>
                          </div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-icon-box">
                            <AlertCircle size={22} color="#f87171" />
                          </div>
                          <div>
                            <div className="metric-val" style={{ color: summaryData.ddi.avg_ddi > 0 ? '#f87171' : '#cbd5e1' }}>
                              {summaryData.ddi.avg_ddi > 0 ? `+${summaryData.ddi.avg_ddi}` : summaryData.ddi.avg_ddi}
                            </div>
                            <div className="metric-lbl">Avg Distortion Index (DDI)</div>
                          </div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-icon-box">
                            <EyeOff size={22} color="#ef4444" />
                          </div>
                          <div>
                            <div className="metric-val" style={{ color: '#f87171' }}>{summaryData.ddi.buried_risk_count}</div>
                            <div className="metric-lbl">Buried Risks Flagged (DDI &gt; +30)</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Buried Risks Callout (Top 3 DDI Outliers) */}
                    {topDdiOutliers.length > 0 && (
                      <div>
                        <div className="buried-risks-header">
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <AlertTriangle size={16} />
                            Top Buried Important Risks Callout
                          </h4>
                          <p className="buried-risks-subtext">
                            Disclosures flagged with high financial materiality but placed with low visual or positional emphasis in the DRHP filing.
                          </p>
                        </div>

                        <div className="buried-risks-grid">
                          {topDdiOutliers.map((item) => (
                            <div key={item.risk_number} className="buried-risk-card">
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <span className="badge badge-cat">{item.category}</span>
                                  <span className="ddi-badge-positive">DDI Score: +{item.ddi_score}</span>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.45 }}>
                                  <strong>Risk #{item.risk_number}:</strong> "{item.risk_snippet}"
                                </p>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                                <span>Severity: <strong>{item.score}/5</strong></span>
                                <span>Materiality: <strong style={{ color: '#38bdf8' }}>{item.materiality_score}</strong></span>
                                <span>Emphasis: <strong style={{ color: '#c084fc' }}>{item.emphasis_score}</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Litigation Load Section */}
                {summaryData.litigation_summary && (
                  <div className="litigation-load-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 className="card-title" style={{ margin: 0 }}>
                        <ShieldAlert size={18} color="#ef4444" />
                        Litigation Load & Legal Exposure ({summaryData.litigation_summary.total_cases} Total Cases Disclosed)
                      </h3>
                      <span className="badge badge-score-4">
                        {summaryData.litigation_summary.total_cases} Pending Case Disclosures
                      </span>
                    </div>

                    {/* Director / Promoter Warning Flag */}
                    {summaryData.litigation_summary.has_director_or_promoter_litigation && (
                      <div className="director-warning-banner">
                        <AlertTriangle size={18} />
                        <div>
                          <strong>⚠️ Director / Promoter Named in Litigation</strong>: One or more legal proceedings individually name company Directors or Promoters, representing heightened personal and managerial risk exposure.
                        </div>
                      </div>
                    )}

                    <div className="litigation-grid">
                      {/* Subcard 1: Party Type Breakdown */}
                      <div className="lit-subcard">
                        <div className="lit-subcard-title">
                          <Building2 size={14} /> Party Type Exposure
                        </div>
                        <div className="party-pills-row">
                          <span className="party-pill party-pill-company">
                            Company: {summaryData.litigation_summary.party_type_breakdown.company || 0}
                          </span>
                          <span className="party-pill party-pill-director">
                            Director: {summaryData.litigation_summary.party_type_breakdown.director || 0}
                          </span>
                          <span className="party-pill party-pill-promoter">
                            Promoter: {summaryData.litigation_summary.party_type_breakdown.promoter || 0}
                          </span>
                        </div>
                      </div>

                      {/* Subcard 2: Category Breakdown */}
                      <div className="lit-subcard">
                        <div className="lit-subcard-title">
                          <FileText size={14} /> Category Breakdown
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                            Criminal: {summaryData.litigation_summary.criminal_count}
                          </span>
                          <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                            Civil: {summaryData.litigation_summary.civil_count}
                          </span>
                          <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>
                            Tax: {summaryData.litigation_summary.tax_count}
                          </span>
                          <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6' }}>
                            Regulatory/SEBI: {summaryData.litigation_summary.regulatory_count}
                          </span>
                          <span className="badge" style={{ background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' }}>
                            Other: {summaryData.litigation_summary.other_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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

            {/* SECTION 3: Drill-Down Section (Risk Factors vs Litigation Cases) */}
            <section className="section-block">
              <div className="card">
                {/* Drill-down Sub-Tab Navigation Header */}
                <div className="drilldown-tab-group">
                  <button
                    id="drilldown-tab-risks"
                    className={`drill-tab-btn ${drillDownTab === 'risks' ? 'active' : ''}`}
                    onClick={() => setDrillDownTab('risks')}
                  >
                    <AlertTriangle size={16} />
                    Risk Factors ({filteredRisks.length} Items)
                  </button>
                  <button
                    id="drilldown-tab-litigation"
                    className={`drill-tab-btn ${drillDownTab === 'litigation' ? 'active' : ''}`}
                    onClick={() => setDrillDownTab('litigation')}
                  >
                    <FileText size={16} />
                    Litigation Cases ({filteredLitigation.length} Items)
                  </button>
                </div>

                {/* TAB 1: RISK FACTORS DRILL DOWN */}
                {drillDownTab === 'risks' && (
                  <>
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

                            {/* Expanded Detail View */}
                            {isExpanded && (
                              <div>
                                {/* Expanded Metrics Grid (DDI & Readability) */}
                                <div className="expanded-metrics-grid">
                                  <div className="metric-mini-box">
                                    <div className="metric-mini-lbl">Disclosure Distortion Index</div>
                                    <div className="metric-mini-val" style={{ color: risk.ddi_score > 30 ? '#f87171' : '#a5b4fc' }}>
                                      {risk.ddi_score > 0 ? `+${risk.ddi_score}` : risk.ddi_score}
                                    </div>
                                  </div>
                                  <div className="metric-mini-box">
                                    <div className="metric-mini-lbl">Materiality Score</div>
                                    <div className="metric-mini-val" style={{ color: '#38bdf8' }}>
                                      {risk.materiality_score} / 100
                                    </div>
                                  </div>
                                  <div className="metric-mini-box">
                                    <div className="metric-mini-lbl">Emphasis Score</div>
                                    <div className="metric-mini-val" style={{ color: '#c084fc' }}>
                                      {risk.emphasis_score} / 100
                                    </div>
                                  </div>
                                  <div className="metric-mini-box">
                                    <div className="metric-mini-lbl">Flesch Readability Score</div>
                                    <div className="metric-mini-val" style={{ color: '#facc15' }}>
                                      {risk.readability_score} (FRE)
                                    </div>
                                  </div>
                                </div>

                                {/* LLM Reasoning Box */}
                                <div className="risk-reasoning-box">
                                  <div className="reasoning-title">
                                    <CheckCircle2 size={14} />
                                    LLM Audit Reasoning
                                  </div>
                                  <p>{risk.reasoning}</p>
                                </div>
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
                  </>
                )}

                {/* TAB 2: LITIGATION CASES DRILL DOWN */}
                {drillDownTab === 'litigation' && (
                  <>
                    <div className="risk-filters">
                      {/* Category Filter Tabs for Litigation */}
                      <div className="category-tabs">
                        {['ALL', 'Criminal', 'Civil', 'Tax', 'Regulatory/SEBI', 'Other'].map((cat) => (
                          <button
                            key={cat}
                            id={`lit-cat-filter-${cat.toLowerCase().replace('/', '-')}`}
                            className={`tab-btn ${litigationCategoryFilter === cat ? 'active' : ''}`}
                            onClick={() => setLitigationCategoryFilter(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Search Bar for Litigation */}
                      <input
                        type="text"
                        id="litigation-search-input"
                        className="search-input"
                        placeholder="Search litigation case text or reasoning..."
                        value={litigationSearchQuery}
                        onChange={(e) => setLitigationSearchQuery(e.target.value)}
                      />
                    </div>

                    {/* Litigation Cases List */}
                    <div className="risk-list">
                      {filteredLitigation.map((item) => {
                        const isExpanded = expandedLitigationId === item.case_id;
                        return (
                          <div
                            key={item.case_id}
                            id={`litigation-item-${item.case_id}`}
                            className="risk-card"
                            onClick={() => setExpandedLitigationId(isExpanded ? null : item.case_id)}
                          >
                            <div className="risk-card-header">
                              <div className="risk-badge-group">
                                <span className={`party-pill party-pill-${item.party_type.toLowerCase()}`}>
                                  {item.party_type.toUpperCase()}
                                </span>
                                <span className="badge badge-cat">{item.category}</span>
                              </div>
                              <div style={{ color: '#94a3b8' }}>
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </div>
                            </div>

                            <p className="risk-snippet">
                              <strong>Case #{item.case_id}:</strong> {item.case_text}
                            </p>

                            {/* LLM Reasoning Field for Litigation (Expanded) */}
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
              </div>
            </section>
          </>
        )}

        {/* SCREEN 2: Methodology & Audit */}
        {activeScreen === 'methodology' && methodologyData && (
          <section className="section-block">
            <h2 className="card-title mb-8" style={{ fontSize: '1.4rem' }}>
              <BookOpen size={22} color="#818cf8" />
              Project Methodology & Model Validation Audit
            </h2>

            {/* Sub-section 1: Severity Rubric */}
            <div className="card mb-8">
              <h3 className="card-title">
                <CheckSquare size={18} color="#6366f1" />
                Human-Labeled Severity Scoring Rubric (Ground Truth Reference)
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '1rem' }}>
                All LLM scoring outputs are validated against a 100-sample human-annotated baseline using the following rubric.
              </p>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Score</th>
                      <th>Label</th>
                      <th>Operational Definition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methodologyData.rubric?.scale?.map((item) => (
                      <tr key={item.score}>
                        <td>
                          <span className={`badge badge-score-${item.score}`}>
                            Score {item.score}
                          </span>
                        </td>
                        <td><strong>{item.label}</strong></td>
                        <td style={{ color: '#cbd5e1' }}>{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-section 2: Validation Benchmark Comparison */}
            <div className="card mb-8">
              <h3 className="card-title">
                <Award size={18} color="#34d399" />
                LLM Model Validation Benchmark (Local vs Cloud Model)
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '1rem' }}>
                Per project design guidelines, local models must be rigorously benchmarked against human-labeled ground truth (100 risks) before deployment.
              </p>
              
              <div className="data-table-wrapper mb-8">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Model Backend</th>
                      <th>Model Identity</th>
                      <th>Category Match %</th>
                      <th>Severity Within ±1</th>
                      <th>Validation Result</th>
                      <th>Audit Decision / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methodologyData.validation_benchmark?.models_evaluated?.map((m) => (
                      <tr key={m.model_name}>
                        <td><span className="badge badge-cat">{m.backend}</span></td>
                        <td><strong>{m.model_name}</strong></td>
                        <td>
                          <span style={{ color: m.category_match_pct >= 80 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                            {m.category_match_pct}%
                          </span>
                        </td>
                        <td>
                          <span style={{ color: m.severity_within_pm1_pct >= 80 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                            {m.severity_within_pm1_pct}%
                          </span>
                        </td>
                        <td>
                          {m.status === 'PASSED' ? (
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                              <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                              PASSED (DEPLOYED)
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                              <XCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                              FAILED (REJECTED)
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{m.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-section 3: Algorithmic Feature Methodologies */}
            <div className="card mb-8">
              <h3 className="card-title">
                <FileText size={18} color="#a855f7" />
                Algorithmic Scoring & Audit Formulas (Zero LLM Deterministic Modules)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* DDI Card */}
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #334155' }}>
                  <h4 style={{ color: '#c084fc', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={16} /> 1. Disclosure Distortion Index (DDI)
                  </h4>
                  <div style={{ fontFamily: 'monospace', background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: '6px', color: '#38bdf8', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                    DDI_i = MaterialityScore_i - EmphasisScore_i
                  </div>
                  <ul style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                    <li><strong>Materiality Score ($M_i \in [0, 100]$)</strong>: Quantifies stated numbers (percentages, ₹ amounts, ratio metrics) + magnitude bonuses.</li>
                    <li><strong>Emphasis Score ($E_i \in [0, 100]$)</strong>: Weighted sum ($0.50 \times \text{Position} + 0.30 \times \text{Header} + 0.20 \times \text{Length}$).</li>
                    <li><strong>Buried Risk Flag Threshold</strong>: Risks with <strong>$\text{DDI} &gt; +30.0$</strong> are flagged as <em>Buried Important Risks</em> (high financial materiality placed with low narrative emphasis).</li>
                  </ul>
                </div>

                {/* Obfuscation Test Card */}
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #334155' }}>
                  <h4 style={{ color: '#38bdf8', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Scale size={16} /> 2. Obfuscation Hypothesis Test
                  </h4>
                  <div style={{ fontFamily: 'monospace', background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: '6px', color: '#a7f3d0', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                    Spearman Rank Correlation (ρ) [Flesch Readability vs Severity (1-5)]
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                    <p style={{ marginBottom: '0.5rem' }}><strong>Per-Company Empirical Results</strong>:</p>
                    <ul style={{ paddingLeft: '1rem', listStyleType: 'disc' }}>
                      <li><strong>Zomato</strong>: $\rho = +0.2485, p = 0.0477$ (Statistically Significant) — severe risks use clearer prose.</li>
                      <li><strong>Paytm</strong>: $\rho = +0.2016, p = 0.0711$ (Borderline / Not Significant at $p &lt; 0.05$).</li>
                      <li><strong>Lohia Corp</strong>: $\rho = +0.0984, p = 0.3643$ (Not Statistically Significant).</li>
                      <li><strong>Combined Dataset (232 risks)</strong>: $\rho = +0.1826, p = 0.0053$ (Statistically Significant) — <em>contradicts obfuscation hypothesis</em>.</li>
                    </ul>
                  </div>
                </div>

                {/* Shadow Ledger Card */}
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #334155' }}>
                  <h4 style={{ color: '#facc15', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckSquare size={16} /> 3. Shadow Ledger Engine
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '0.5rem' }}>
                    Cross-checks 3 core figures (<strong>Total Revenue, PAT/Loss, Total Debt/Borrowings</strong>) between Risk Factors text and primary Summary Financial Tables.
                  </p>
                  <div style={{ background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: '#fef08a' }}>
                    <strong>Strict Equivalence Audit Rules</strong>: Figures are only compared if they match in Fiscal Year, Accounting Scope (Standalone vs Consolidated), and Defined Metric. Non-equivalent metrics (e.g. Sanctioned Limits vs Balance Sheet Carrying Debt) are explicitly labeled <em>"Not Directly Comparable"</em> rather than forced into a match/mismatch.<br />
                    <em style={{ color: '#34d399' }}>Confirmed Exact Match Example: Lohia Corp corporate guarantee (₹413.00M on P.323 Note 36 matched Risk #9 claim, 0.0% diff).</em>
                  </div>
                </div>

                {/* Use of Proceeds & Promoter Flag Card */}
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #334155' }}>
                  <h4 style={{ color: '#34d399', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={16} /> 4. Use of Proceeds & Promoter Structure
                  </h4>
                  <ul style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                    <li><strong>Use of Proceeds Breakdown</strong>: Extracted directly from <em>Objects of the Offer</em> fund allocation tables (organic/inorganic growth, capex, general corporate). Note: Lohia Corp is a 100% Offer for Sale (OFS) with ₹0 fresh issue proceeds.</li>
                    <li><strong>Promoter Structure Flag</strong>: Extracted from explicit DRHP cover page & Capital Structure disclosures. Flags professionally managed companies without identifiable promoters (e.g. Paytm, Zomato) vs traditional promoter groups (e.g. Lohia Corp: Raj Kumar Lohia, Gaurav Lohia, Ritu Lohia).</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Sub-section 4: Dataset Limitation Notice */}
            <div className="card">
              <h3 className="card-title">
                <Info size={18} color="#facc15" />
                Dataset & Scope Limitation Notice
              </h3>
              <div className="peer-notice-box" style={{ margin: 0 }}>
                <Info size={20} style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#facc15' }}>
                    {methodologyData.limitations_notice?.title}
                  </h4>
                  <p style={{ color: '#fef08a', lineHeight: 1.5 }}>
                    {methodologyData.limitations_notice?.description}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
