export const SEVERITY_LABELS = {
  5: 'Severe',
  4: 'High',
  3: 'Moderate',
  2: 'Low',
  1: 'Minimal',
};

export const SEVERITY_COLOR_VAR = {
  5: 'var(--severity-5)',
  4: 'var(--severity-4)',
  3: 'var(--severity-3)',
  2: 'var(--severity-2)',
  1: 'var(--severity-1)',
};

export const RISK_CATEGORIES = ['Financial', 'Legal', 'Regulatory', 'Operational', 'Market', 'Reputational'];

export const LITIGATION_CATEGORIES = ['Criminal', 'Civil', 'Tax', 'Regulatory/SEBI', 'Other'];

export const PARTY_TYPE_LABELS = {
  company: 'Company',
  director: 'Director',
  promoter: 'Promoter',
};

export function normalizePartyType(value) {
  return (value || '').trim().toLowerCase();
}

/* Chart libraries need literal color values (SVG fill/stroke), mirrored from tokens.css */
export const CHART_COLORS = {
  accent: '#4fa69d',
  positive: '#5fa777',
  warning: '#c78a3d',
  risk: '#c4554a',
  textMuted: '#6c7178',
  textSecondary: '#9ba1ab',
  gridLine: 'rgba(255,255,255,0.07)',
};

export const SEVERITY_COLOR_HEX = {
  5: '#c4554a',
  4: '#c78a3d',
  3: '#a98f4a',
  2: '#6e9c7d',
  1: '#6b8cae',
};
