import React, { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlass, CaretRight, ClipboardText } from '@phosphor-icons/react';
import { SkeletonRows } from '../primitives/Skeleton';
import EmptyState from '../primitives/EmptyState';
import { RISK_CATEGORIES, SEVERITY_LABELS, SEVERITY_COLOR_HEX } from '../constants';

export default function RiskRegister({ risks, loading, focusRiskNumber }) {
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (focusRiskNumber != null) {
      setExpandedId(focusRiskNumber);
      setCategory('ALL');
      setQuery('');
    }
  }, [focusRiskNumber]);

  const filtered = useMemo(() => {
    return risks.filter((r) => {
      const matchesCategory = category === 'ALL' || r.category === category;
      const matchesQuery = !query || r.risk_text.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [risks, category, query]);

  return (
    <div>
      <div className="ledger-toolbar">
        <div className="filter-chips">
          {['ALL', ...RISK_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              className={['filter-chip', category === c ? 'active' : ''].join(' ')}
              onClick={() => setCategory(c)}
            >
              {c === 'ALL' ? 'All categories' : c}
            </button>
          ))}
        </div>
        <label className="search-field">
          <MagnifyingGlass size={15} />
          <input
            placeholder="Search risk text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <SkeletonRows rows={8} rowHeight={60} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardText size={32} />}
          title="No risk factors match these filters"
          description="Try clearing the category filter or search term."
        />
      ) : (
        <>
          <div className="ledger-count">
            {filtered.length} of {risks.length} risk factors
          </div>
          <div className="ledger">
            <div className="ledger-head risk-ledger-head">
              <span>#</span>
              <span>Risk factor</span>
              <span>Category</span>
              <span>Severity</span>
              <span />
            </div>
            {filtered.map((r) => {
              const expanded = expandedId === r.risk_number;
              return (
                <React.Fragment key={r.risk_number}>
                  <div
                    className={['ledger-row', 'risk-ledger-row', expanded ? 'expanded' : ''].join(' ')}
                    onClick={() => setExpandedId(expanded ? null : r.risk_number)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-label={`Risk factor ${r.risk_number}, ${r.category}, ${SEVERITY_LABELS[r.score]} severity`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(expanded ? null : r.risk_number);
                      }
                    }}
                  >
                    <span className="ledger-cell-id tabular">R{r.risk_number}</span>
                    <span className="ledger-cell-text">{r.risk_text}</span>
                    <span className="ledger-cell-badges">
                      <span className="badge">{r.category}</span>
                    </span>
                    <span className="severity-chip" style={{ color: SEVERITY_COLOR_HEX[r.score] }}>
                      <span className="severity-dot" style={{ background: SEVERITY_COLOR_HEX[r.score] }} />
                      {SEVERITY_LABELS[r.score]}
                    </span>
                    <CaretRight size={14} className="ledger-chevron" />
                  </div>
                  {expanded && (
                    <div className="ledger-detail">
                      <div className="ledger-detail-grid">
                        <DetailMetric label="Disclosure distortion" value={r.ddi_score} />
                        <DetailMetric label="Materiality" value={r.materiality_score} />
                        <DetailMetric label="Emphasis" value={r.emphasis_score} />
                        <DetailMetric label="Flesch readability" value={r.readability_score} />
                      </div>
                      <div className="ledger-reasoning">
                        <div className="ledger-reasoning-label">Audit reasoning</div>
                        <div className="ledger-reasoning-body">{r.reasoning}</div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DetailMetric({ label, value }) {
  return (
    <div className="ledger-detail-metric">
      <div className="ledger-detail-metric-label">{label}</div>
      <div className="ledger-detail-metric-value tabular">
        {value === null || value === undefined ? '—' : Number(value).toFixed(1)}
      </div>
    </div>
  );
}
