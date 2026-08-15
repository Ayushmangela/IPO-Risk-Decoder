import React from 'react';
import { Buildings, ChartLineUp, ArrowUpRight } from '@phosphor-icons/react';
import Surface, { PanelHeading } from '../primitives/Surface';
import StatTile from '../primitives/StatTile';
import Skeleton from '../primitives/Skeleton';
import { extractFigures } from '../utils';
import SeverityDonut from '../composed/SeverityDonut';
import CategoryBarChart from '../composed/CategoryBarChart';
import RiskVerdict from '../composed/RiskVerdict';
import { useStaggerEntrance } from '../motion';

export default function OverviewPanel({ selectedCompany, summaryData, outliersData, risks, loading, onJumpToRisk }) {
  // Must run before the loading early-return — hooks can't be called
  // conditionally. Keyed on company so switching filings replays the
  // entrance rather than silently swapping numbers in place.
  const gridRef = useStaggerEntrance(
    loading || !summaryData ? null : selectedCompany?.company_id
  );

  if (loading || !summaryData) {
    return (
      <div className="overview-grid">
        {/* Skeleton mirrors the real layout's hierarchy — hero block first,
            then the supporting tiles — so the handoff to loaded content
            doesn't reflow the page. */}
        <Skeleton height={168} radius="var(--radius-md)" />
        <div className="metric-row">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={92} radius="var(--radius-md)" />
          ))}
        </div>
        <Skeleton height={220} radius="var(--radius-md)" />
      </div>
    );
  }

  const ddi = summaryData.ddi;
  const obfuscation = summaryData.obfuscation;
  const litigation = summaryData.litigation_summary;
  const figures = extractFigures(summaryData.industry_summary);
  const buried = (outliersData?.ddi_outliers || []).slice(0, 3);

  return (
    <div className="overview-grid" ref={gridRef}>
      <RiskVerdict
        companyName={selectedCompany?.name}
        sector={selectedCompany?.sector}
        averageSeverity={summaryData.average_severity}
        totalRisks={summaryData.total_risks}
        risks={risks}
        buriedCount={ddi?.buried_risk_count}
      />

      {/* Average severity intentionally absent — it's the hero above. Repeating
          it here as a peer tile is what flattened the old hierarchy. */}
      <div className="metric-row">
        <StatTile label="Total risks identified" value={summaryData.total_risks} />
        <StatTile
          label="Buried risks flagged"
          value={ddi?.buried_risk_count ?? '—'}
          meta={ddi ? 'DDI > +30.0' : undefined}
          valueColor={ddi?.buried_risk_count ? 'var(--risk)' : 'var(--positive)'}
        />
        <StatTile label="Litigation cases on file" value={litigation?.total_cases ?? '—'} />
      </div>

      {obfuscation && (
        <div className="obfuscation-banner">
          <div className="obfuscation-copy">
            <strong>Obfuscation test:</strong> {obfuscation.interpretation}
          </div>
          <span className="obfuscation-stat tabular">
            ρ = {obfuscation.spearman_correlation.toFixed(3)}, p = {obfuscation.p_value.toFixed(4)}
          </span>
        </div>
      )}

      <div className="overview-split">
        <Surface>
          <PanelHeading
            title="Industry context"
            subtitle={selectedCompany?.sector}
            action={<Buildings size={18} color="var(--text-muted)" />}
          />
          {figures.length > 0 && (
            <div className="industry-callout">
              {figures.map((f, i) => (
                <div className="industry-figure" key={i}>
                  <div className="industry-figure-value tabular">{f}</div>
                  <div className="industry-figure-label">Cited figure</div>
                </div>
              ))}
            </div>
          )}
          <p className="industry-body">{summaryData.industry_summary}</p>
          <span className="industry-source-tag">Issuer-disclosed industry narrative, as stated in the DRHP.</span>
        </Surface>

        <Surface>
          <PanelHeading title="Severity distribution" action={<ChartLineUp size={18} color="var(--text-muted)" />} />
          <div className="chart-shell">
            <SeverityDonut risks={risks} />
          </div>
        </Surface>
      </div>

      <Surface>
        <PanelHeading title="Risk factors by category" />
        <div className="chart-shell">
          <CategoryBarChart categoryCounts={summaryData.category_counts} />
        </div>
      </Surface>

      {buried.length > 0 && (
        <Surface>
          <PanelHeading
            title="Top buried important risks"
            subtitle="High materiality, low narrative emphasis — Disclosure Distortion Index above threshold"
          />
          <div className="highlight-grid">
            {buried.map((b) => (
              <div
                className="highlight-card"
                key={b.risk_number}
                onClick={() => onJumpToRisk(b.risk_number)}
                role="button"
                tabIndex={0}
                aria-label={`Open risk ${b.risk_number} in Risk Register`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onJumpToRisk(b.risk_number);
                  }
                }}
              >
                <div className="highlight-card-top">
                  <span className="badge">{b.category}</span>
                  <span className="highlight-ddi tabular">DDI +{b.ddi_score.toFixed(1)}</span>
                </div>
                <div className="highlight-snippet">{b.risk_snippet}</div>
                <span className="highlight-link">
                  Open in Risk Register <ArrowUpRight size={13} />
                </span>
              </div>
            ))}
          </div>
        </Surface>
      )}
    </div>
  );
}
