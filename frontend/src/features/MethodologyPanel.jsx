import React from 'react';
import { CheckCircle, XCircle, Info, ShieldWarning, Scales, ListChecks, ChartBar } from '@phosphor-icons/react';
import Surface, { PanelHeading } from '../primitives/Surface';
import { STATIC_METHODOLOGY_DATA } from '../api';
import { SEVERITY_COLOR_HEX } from '../constants';

export default function MethodologyPanel({ data }) {
  const m = data || STATIC_METHODOLOGY_DATA;

  return (
    <div className="methodology-stack">
      <Surface>
        <PanelHeading
          title="Severity scoring rubric"
          subtitle="Human-labeled ground truth reference used to validate every LLM scoring output"
        />
        <table className="methodology-table">
          <thead>
            <tr>
              <th>Score</th>
              <th>Label</th>
              <th>Operational definition</th>
            </tr>
          </thead>
          <tbody>
            {m.rubric?.scale?.map((item) => (
              <tr key={item.score}>
                <td>
                  <span className="severity-chip" style={{ color: SEVERITY_COLOR_HEX[item.score] }}>
                    <span className="severity-dot" style={{ background: SEVERITY_COLOR_HEX[item.score] }} />
                    {item.score}
                  </span>
                </td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.label}</td>
                <td>{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      <Surface>
        <PanelHeading
          title="Model validation benchmark"
          subtitle="Local vs. cloud model, evaluated against a 100-sample human-annotated baseline"
        />
        <table className="methodology-table">
          <thead>
            <tr>
              <th>Backend</th>
              <th>Model</th>
              <th>Category match</th>
              <th>Severity within ±1</th>
              <th>Result</th>
              <th>Audit decision</th>
            </tr>
          </thead>
          <tbody>
            {m.validation_benchmark?.models_evaluated?.map((mm) => (
              <tr key={mm.model_name}>
                <td>{mm.backend}</td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{mm.model_name}</td>
                <td className="tabular" style={{ color: mm.category_match_pct >= 80 ? 'var(--positive)' : 'var(--risk)' }}>
                  {mm.category_match_pct}%
                </td>
                <td className="tabular" style={{ color: mm.severity_within_pm1_pct >= 80 ? 'var(--positive)' : 'var(--risk)' }}>
                  {mm.severity_within_pm1_pct}%
                </td>
                <td>
                  {mm.status === 'PASSED' ? (
                    <span className="badge badge-positive">
                      <CheckCircle size={12} /> Passed
                    </span>
                  ) : (
                    <span className="badge badge-risk">
                      <XCircle size={12} /> Failed
                    </span>
                  )}
                </td>
                <td>{mm.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      <Surface>
        <PanelHeading title="Algorithmic scoring formulas" subtitle="Zero-LLM deterministic audit modules" />
        <div className="methodology-grid">
          <div className="methodology-card">
            <div className="methodology-card-title">
              <ShieldWarning size={16} color="var(--accent)" /> Disclosure Distortion Index (DDI)
            </div>
            <div className="formula-block">DDI = Materiality Score − Emphasis Score</div>
            <ul>
              <li>Materiality (0–100): quantifies stated figures — percentages, ₹ amounts, ratios — plus magnitude bonuses.</li>
              <li>Emphasis (0–100): weighted sum of position (50%), header prominence (30%), and length (20%).</li>
              <li>Buried risk threshold: DDI &gt; +30.0 flags a risk as materially important but under-emphasized.</li>
            </ul>
          </div>
          <div className="methodology-card">
            <div className="methodology-card-title">
              <Scales size={16} color="var(--accent)" /> Obfuscation hypothesis test
            </div>
            <div className="formula-block">Spearman ρ — Flesch readability vs. severity (1–5)</div>
            <ul>
              <li>Zomato: ρ = +0.2485, p = 0.0477 — significant; severe risks use clearer prose.</li>
              <li>Paytm: ρ = +0.2016, p = 0.0711 — borderline, not significant.</li>
              <li>Lohia Corp: ρ = +0.0984, p = 0.3643 — not significant.</li>
              <li>Combined (232 risks): ρ = +0.1826, p = 0.0053 — significant, contradicts the obfuscation hypothesis.</li>
            </ul>
          </div>
          <div className="methodology-card">
            <div className="methodology-card-title">
              <ListChecks size={16} color="var(--accent)" /> Shadow ledger engine
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
              Cross-checks total revenue, PAT/loss, and total debt between the risk-factor text and the primary
              summary financial tables.
            </p>
            <ul>
              <li>Only compares figures matching in fiscal year, accounting scope, and defined metric.</li>
              <li>Non-equivalent metrics are labeled "not directly comparable," not forced into a match.</li>
              <li>Confirmed match: Lohia Corp's ₹413.00M corporate guarantee (p.323, Note 36) against Risk #9, 0.0% difference.</li>
            </ul>
          </div>
          <div className="methodology-card">
            <div className="methodology-card-title">
              <ChartBar size={16} color="var(--accent)" /> Use of proceeds &amp; promoter structure
            </div>
            <ul>
              <li>Fund allocation parsed directly from "Objects of the Offer" tables. Lohia Corp is a 100% offer-for-sale with ₹0 fresh issue proceeds.</li>
              <li>Promoter structure extracted from cover-page and capital-structure disclosures — flags professionally managed issuers (Paytm, Zomato) versus traditional promoter groups (Lohia Corp).</li>
            </ul>
          </div>
        </div>
      </Surface>

      <div className="methodology-notice">
        <Info size={20} className="methodology-notice-icon" />
        <div>
          <div className="methodology-notice-title">{m.limitations_notice?.title}</div>
          <div className="methodology-notice-desc">{m.limitations_notice?.description}</div>
        </div>
      </div>
    </div>
  );
}
