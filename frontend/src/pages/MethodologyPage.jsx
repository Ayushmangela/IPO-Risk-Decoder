import React from 'react';
import { 
  BookOpen, CheckSquare, Award, FileText, ShieldAlert, Scale, Info, CheckCircle2, XCircle 
} from 'lucide-react';
import { STATIC_METHODOLOGY_DATA } from '../api';

export default function MethodologyPage({ data }) {
  const mData = data || STATIC_METHODOLOGY_DATA;

  return (
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
              {mData.rubric?.scale?.map((item) => (
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
              {mData.validation_benchmark?.models_evaluated?.map((m) => (
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
              <li><strong>Emphasis Score ($E_i \in [0, 100]$)</strong>: Weighted sum (0.50 × Position + 0.30 × Header + 0.20 × Length).</li>
              <li><strong>Buried Risk Flag Threshold</strong>: Risks with <strong>DDI &gt; +30.0</strong> are flagged as <em>Buried Important Risks</em> (high financial materiality placed with low narrative emphasis).</li>
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
              {mData.limitations_notice?.title}
            </h4>
            <p style={{ color: '#fef08a', lineHeight: 1.5 }}>
              {mData.limitations_notice?.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
