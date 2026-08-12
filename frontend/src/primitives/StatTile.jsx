import React from 'react';

export default function StatTile({ label, value, meta, valueColor }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {meta && <div className="stat-tile-meta">{meta}</div>}
    </div>
  );
}
