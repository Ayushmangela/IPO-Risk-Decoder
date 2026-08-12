import React from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import Skeleton from '../primitives/Skeleton';
import DeltaBar from '../composed/DeltaBar';

export default function BenchmarksPanel({ summaryData, loading }) {
  if (loading || !summaryData) {
    return <Skeleton height={340} radius="var(--radius-md)" />;
  }

  const rows = summaryData.peer_comparison || [];

  return (
    <div>
      <div className="benchmark-caveat">
        <WarningCircle size={20} className="benchmark-caveat-icon" weight="fill" />
        <div>
          <div className="benchmark-caveat-title">Not a same-sector benchmark</div>
          <div className="benchmark-caveat-desc">{summaryData.comparison_notice}</div>
        </div>
      </div>

      <div className="benchmark-table">
        <div className="benchmark-row benchmark-head">
          <span>Category</span>
          <span>Count</span>
          <span>Company %</span>
          <span>Cross-company avg</span>
          <span>Difference</span>
        </div>
        {rows.map((r) => (
          <div className="benchmark-row" key={r.category}>
            <span className="benchmark-category">{r.category}</span>
            <span className="benchmark-val tabular">{r.count}</span>
            <span className="benchmark-val tabular">{r.company_pct.toFixed(1)}%</span>
            <span className="benchmark-val tabular">{r.all_company_avg_pct.toFixed(1)}%</span>
            <DeltaBar value={r.difference} />
          </div>
        ))}
      </div>
    </div>
  );
}
