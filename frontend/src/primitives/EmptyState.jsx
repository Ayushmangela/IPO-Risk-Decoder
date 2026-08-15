import React from 'react';

/**
 * `tone="error"` distinguishes "something broke" from "nothing here yet".
 * They read identically otherwise, which makes a failed request look like
 * an empty dataset — a meaningful difference when the user is deciding
 * whether to retry or move on.
 */
export default function EmptyState({ icon, title, description, tone = 'neutral' }) {
  const isError = tone === 'error';
  return (
    <div
      className={['empty-state', isError ? 'empty-state-error' : ''].filter(Boolean).join(' ')}
      role={isError ? 'alert' : undefined}
    >
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
    </div>
  );
}
