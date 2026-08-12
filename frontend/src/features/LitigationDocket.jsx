import React, { useMemo, useState } from 'react';
import { MagnifyingGlass, CaretRight, Gavel, WarningCircle } from '@phosphor-icons/react';
import { SkeletonRows } from '../primitives/Skeleton';
import EmptyState from '../primitives/EmptyState';
import StatTile from '../primitives/StatTile';
import Surface, { PanelHeading } from '../primitives/Surface';
import CategoryBarChart from '../composed/CategoryBarChart';
import { LITIGATION_CATEGORIES, PARTY_TYPE_LABELS, normalizePartyType } from '../constants';

export default function LitigationDocket({ cases, summary, loading }) {
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const matchesCategory = category === 'ALL' || c.category === category;
      const matchesQuery = !query || c.case_text.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [cases, category, query]);

  const breakdown = summary?.party_type_breakdown || {};
  const companyCount = breakdown.company ?? 0;
  const directorCount = breakdown.director ?? 0;
  const promoterCount = breakdown.promoter ?? 0;
  const hasGovernanceRisk = Boolean(summary?.has_director_or_promoter_litigation);

  return (
    <div>
      {hasGovernanceRisk && (
        <div className="governance-banner">
          <WarningCircle size={22} className="governance-banner-icon" weight="fill" />
          <div>
            <div className="governance-banner-title">Material governance risk</div>
            <div className="governance-banner-desc">
              This filing discloses litigation naming an individual director or promoter, not only the company —
              a materially different risk profile than corporate-only litigation.
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="litigation-summary-row">
          <StatTile label="Total cases on file" value={summary.total_cases} />
          <StatTile label="Against the company" value={companyCount} />
          <StatTile
            label="Against directors"
            value={directorCount}
            valueColor={directorCount > 0 ? 'var(--risk)' : undefined}
          />
          <StatTile
            label="Against promoters"
            value={promoterCount}
            valueColor={promoterCount > 0 ? 'var(--risk)' : undefined}
          />
        </div>
      )}

      {summary?.category_counts && (
        <Surface style={{ marginBottom: 'var(--space-6)' }}>
          <PanelHeading title="Cases by legal category" />
          <div className="chart-shell">
            <CategoryBarChart categoryCounts={summary.category_counts} />
          </div>
        </Surface>
      )}

      <div className="ledger-toolbar">
        <div className="filter-chips">
          {['ALL', ...LITIGATION_CATEGORIES].map((c) => (
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
          <input placeholder="Search case text…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {loading ? (
        <SkeletonRows rows={6} rowHeight={60} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Gavel size={32} />}
          title="No litigation cases match these filters"
          description="Try clearing the category filter or search term."
        />
      ) : (
        <>
          <div className="ledger-count">
            {filtered.length} of {cases.length} cases
          </div>
          <div className="ledger">
            <div className="ledger-head lit-ledger-head">
              <span>#</span>
              <span>Case</span>
              <span>Category</span>
              <span>Named party</span>
              <span />
            </div>
            {filtered.map((c) => {
              const expanded = expandedId === c.case_id;
              const party = normalizePartyType(c.party_type);
              return (
                <React.Fragment key={c.case_id}>
                  <div
                    className={['ledger-row', 'lit-ledger-row', expanded ? 'expanded' : ''].join(' ')}
                    onClick={() => setExpandedId(expanded ? null : c.case_id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-label={`Litigation case ${c.case_id}, ${c.category}, named party ${PARTY_TYPE_LABELS[party] || c.party_type}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(expanded ? null : c.case_id);
                      }
                    }}
                  >
                    <span className="ledger-cell-id tabular">L{c.case_id}</span>
                    <span className="ledger-cell-text">{c.case_text}</span>
                    <span className="ledger-cell-badges">
                      <span className="badge">{c.category}</span>
                    </span>
                    <span
                      className={['badge', party !== 'company' ? 'badge-risk' : ''].join(' ')}
                    >
                      {PARTY_TYPE_LABELS[party] || c.party_type}
                    </span>
                    <CaretRight size={14} className="ledger-chevron" />
                  </div>
                  {expanded && (
                    <div className="ledger-detail">
                      <div className="ledger-reasoning" style={{ marginTop: 'var(--space-4)' }}>
                        <div className="ledger-reasoning-label">Legal exposure assessment</div>
                        <div className="ledger-reasoning-body">{c.reasoning}</div>
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
