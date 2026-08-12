import React from 'react';
import { EyeOff, AlertCircle, BookOpen, ShieldAlert } from 'lucide-react';
import { CATEGORY_COLORS } from '../api';

export default function DisclosureQualitySection({ summaryData, outliersData }) {
  if (!summaryData) return null;

  const obf = summaryData.obfuscation || {};
  const ddi = summaryData.ddi || {};

  return (
    <div className="card mb-8" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)', borderColor: '#334155' }}>
      <h3 className="card-title mb-6" style={{ fontSize: '1.15rem' }}>
        <EyeOff size={20} color="#a855f7" />
        Disclosure Quality & Algorithmic Distortion Analysis
      </h3>

      {/* Obfuscation Spearman Result Banner */}
      <div className="obfuscation-banner mb-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <BookOpen size={18} color="#818cf8" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
              Obfuscation Test Result (Spearman Rank Correlation)
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Severity and readability showed <strong>{obf.interpretation || 'N/A'}</strong> (p = {obf.p_value}, Spearman ρ = {obf.spearman_correlation}).
            </p>
          </div>
        </div>
        <div className="stat-pill" style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', fontWeight: 600, fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: '20px' }}>
          Spearman ρ: {obf.spearman_correlation} | p = {obf.p_value}
        </div>
      </div>

      {/* DDI Summary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card" style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div className="metric-label" style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <BookOpen size={14} color="#38bdf8" /> Avg Materiality Score
          </div>
          <div className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
            {ddi.avg_materiality || 0} / 100
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Financial numbers & metrics stated
          </div>
        </div>

        <div className="metric-card" style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div className="metric-label" style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <BarChart3Icon size={14} color="#818cf8" /> Avg Emphasis Score
          </div>
          <div className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
            {ddi.avg_emphasis || 0} / 100
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Header, position & word count allocation
          </div>
        </div>

        <div className="metric-card" style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div className="metric-label" style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={14} color="#f59e0b" /> Avg Distortion Index (DDI)
          </div>
          <div className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: (ddi.avg_ddi || 0) > 0 ? '#f87171' : '#38bdf8', marginTop: '0.25rem' }}>
            {ddi.avg_ddi > 0 ? `+${ddi.avg_ddi}` : ddi.avg_ddi || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Materiality minus Emphasis gap
          </div>
        </div>

        <div className="metric-card" style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div className="metric-label" style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <EyeOff size={14} color="#ef4444" /> Buried Risks Flagged
          </div>
          <div className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444', marginTop: '0.25rem' }}>
            {ddi.buried_risk_count || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            High materiality with low emphasis (DDI &gt; +30)
          </div>
        </div>
      </div>

      {/* Top Buried Important Risks Callout Grid */}
      {outliersData?.ddi_outliers && outliersData.ddi_outliers.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.25rem' }}>
            <AlertCircle size={16} /> Top Buried Important Risks Callout
          </h4>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
            Disclosures flagged with high financial materiality but placed with low visual or positional emphasis in the DRHP filing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {outliersData.ddi_outliers.slice(0, 3).map((outlier) => (
              <div key={outlier.risk_number} className="ddi-outlier-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="badge" style={{ background: CATEGORY_COLORS[outlier.category] + '22', color: CATEGORY_COLORS[outlier.category], border: `1px solid ${CATEGORY_COLORS[outlier.category]}44` }}>
                    {outlier.category}
                  </span>
                  <span className="ddi-score-badge">
                    DDI Score: +{outlier.ddi_score}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.4, margin: '0 0 0.75rem 0' }}>
                  <strong>Risk #{outlier.risk_number}:</strong> "{outlier.risk_snippet}"
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '0.5rem' }}>
                  <span>Severity: <strong>{outlier.score}/5</strong></span>
                  <span>Materiality: <strong>{outlier.materiality_score}</strong></span>
                  <span>Emphasis: <strong>{outlier.emphasis_score}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BarChart3Icon(props) {
  return <ShieldAlert {...props} />;
}
