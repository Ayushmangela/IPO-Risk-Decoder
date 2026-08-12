import React from 'react';

export default function IconButton({ icon, active = false, label, onClick, ...rest }) {
  return (
    <button
      type="button"
      className={['icon-btn', active ? 'active' : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-label={label}
      title={label}
      {...rest}
    >
      {icon}
    </button>
  );
}
