import React from 'react';
import { Info } from 'lucide-react';
import { CATEGORY_COLORS } from '../api';

export default function BenchmarkTable({ summaryData }) {
  if (!summaryData?.peer_comparison) return null;

  return (
    <div className="card mb-8">
      <h3 className="card-title">
        <Info size={18} color="#facc15" />
        Cross-Company Benchmark Stats
      </h3>
      
      <div className="peer-notice-box">
        <Info size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Methodology Notice ({summaryData.comparison_mode?.toUpperCase()})</strong>: 
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
            {summaryData.peer_comparison.map((row) => (
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
  );
}
