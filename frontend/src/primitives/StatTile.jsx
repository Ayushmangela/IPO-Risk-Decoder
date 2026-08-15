import React from 'react';
import { useCountUp } from '../motion';

/**
 * `value` may be a number (counted up) or a pre-formatted string / em-dash
 * placeholder (rendered as-is). Counting only applies to plain numbers so a
 * "—" for missing data never animates from zero, which would imply a real
 * measured value of 0.
 */
export default function StatTile({ label, value, meta, valueColor }) {
  const isNumeric = typeof value === 'number' && Number.isFinite(value);
  const countRef = useCountUp(isNumeric ? value : NaN, (v) => String(Math.round(v)));

  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div
        className="stat-tile-value"
        style={valueColor ? { color: valueColor } : undefined}
        ref={isNumeric ? countRef : undefined}
      >
        {value}
      </div>
      {meta && <div className="stat-tile-meta">{meta}</div>}
    </div>
  );
}
