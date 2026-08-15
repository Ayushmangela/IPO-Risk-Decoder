import React from 'react';
import { SEVERITY_COLOR_HEX } from '../constants';
import { formatSeverity } from '../utils';
import { useCountUp } from '../motion';

/**
 * The single dominant element on Overview: what risk level did this filing get,
 * and why. Everything else on the page is supporting detail.
 *
 * Verdict bands mirror backend/card_generator.py's SEVERITY_BUCKETS so the
 * shareable card and the dashboard never disagree about what "3.2 out of 5"
 * is called.
 */
const VERDICT_BANDS = [
  { min: 4.5, label: 'Severe', score: 5 },
  { min: 3.5, label: 'High', score: 4 },
  { min: 2.5, label: 'Moderate', score: 3 },
  { min: 1.5, label: 'Low', score: 2 },
  { min: 0, label: 'Minimal', score: 1 },
];

function verdictFor(avgSeverity) {
  const band = VERDICT_BANDS.find((b) => avgSeverity >= b.min) || VERDICT_BANDS[VERDICT_BANDS.length - 1];
  return { label: band.label, color: SEVERITY_COLOR_HEX[band.score] };
}

/** Proportional severity bar — encodes the distribution as shape, not just a number. */
function SeveritySpread({ risks }) {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  risks.forEach((r) => {
    if (counts[r.score] !== undefined) counts[r.score] += 1;
  });
  const total = risks.length;
  if (!total) return null;

  return (
    <div className="verdict-spread" role="img" aria-label={severitySpreadLabel(counts, total)}>
      {[5, 4, 3, 2, 1].map((score) => {
        const pct = (counts[score] / total) * 100;
        if (pct === 0) return null;
        return (
          <span
            key={score}
            className="verdict-spread-seg"
            style={{ width: `${pct}%`, background: SEVERITY_COLOR_HEX[score] }}
          />
        );
      })}
    </div>
  );
}

function severitySpreadLabel(counts, total) {
  return [5, 4, 3, 2, 1]
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} of ${total} at severity ${s}`)
    .join(', ');
}

export default function RiskVerdict({ companyName, sector, averageSeverity, totalRisks, risks, buriedCount }) {
  const { label, color } = verdictFor(averageSeverity);
  const scoreRef = useCountUp(averageSeverity, formatSeverity);

  return (
    <section className="risk-verdict" aria-labelledby="verdict-heading">
      <div className="verdict-primary">
        <div className="verdict-eyebrow">Overall disclosed risk</div>
        <div className="verdict-score-row">
          {/* Screen readers get the settled value immediately; the count-up is
              a visual-only cue that this figure just changed. */}
          <span
            ref={scoreRef}
            className="verdict-score tabular"
            style={{ color }}
            aria-label={`${formatSeverity(averageSeverity)} out of 5`}
          >
            {formatSeverity(averageSeverity)}
          </span>
          <span className="verdict-denominator" aria-hidden="true">/ 5</span>
        </div>
        <div id="verdict-heading" className="verdict-label" style={{ color }}>
          {label} risk profile
        </div>
        <div className="verdict-basis">
          Mean severity across {totalRisks} disclosed risk factors
          {buriedCount ? `, ${buriedCount} flagged as buried` : ''}
        </div>
      </div>

      <div className="verdict-secondary">
        <div className="verdict-company">
          <div className="verdict-company-name">{companyName}</div>
          {sector && <div className="verdict-company-sector">{sector}</div>}
        </div>
        <div className="verdict-spread-block">
          <div className="verdict-spread-label">Severity distribution</div>
          <SeveritySpread risks={risks} />
          <div className="verdict-spread-legend">
            <span>Severe</span>
            <span>Minimal</span>
          </div>
        </div>
      </div>
    </section>
  );
}
