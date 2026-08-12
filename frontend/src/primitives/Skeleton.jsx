import React from 'react';

export default function Skeleton({ width = '100%', height = 14, radius, style, className = '' }) {
  return (
    <div
      className={['skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

export function SkeletonRows({ rows = 5, rowHeight = 56 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={rowHeight} radius="var(--radius-md)" />
      ))}
    </div>
  );
}
