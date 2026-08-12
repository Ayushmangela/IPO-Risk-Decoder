import React from 'react';

/** Visualizes a +/- percentage-point difference against a fixed scale, centered at zero. */
export default function DeltaBar({ value, scale = 15 }) {
  const clamped = Math.max(-scale, Math.min(scale, value));
  const pct = (Math.abs(clamped) / scale) * 50;
  const isPositive = value >= 0;
  const color = isPositive ? 'var(--risk)' : 'var(--positive)';

  return (
    <div className="delta-bar-row">
      <span className="delta-bar-label tabular" style={{ color }}>
        {value > 0 ? '+' : ''}
        {value.toFixed(1)}
      </span>
      <div className="delta-bar-track">
        <div
          className="delta-bar-fill"
          style={{
            left: isPositive ? '50%' : `${50 - pct}%`,
            width: `${pct}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
