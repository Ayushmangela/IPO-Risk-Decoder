import React from 'react';

export default function Surface({ focused = false, pad = true, className = '', children, ...rest }) {
  const cls = [focused ? 'surface-focused' : 'surface', pad ? 'surface-pad' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeading({ title, subtitle, action }) {
  return (
    <div className="panel-heading">
      <div>
        <div className="panel-title">{title}</div>
        {subtitle && <div className="panel-subtitle">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
