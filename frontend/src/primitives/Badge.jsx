import React from 'react';

const TONE_CLASS = {
  neutral: '',
  accent: 'badge-accent',
  positive: 'badge-positive',
  warning: 'badge-warning',
  risk: 'badge-risk',
};

export default function Badge({ tone = 'neutral', dotColor, children, className = '' }) {
  return (
    <span className={['badge', TONE_CLASS[tone] || '', className].filter(Boolean).join(' ')}>
      {dotColor && <span className="badge-dot" style={{ background: dotColor }} />}
      {children}
    </span>
  );
}
