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

/* Recharts renders SVG <text>, which doesn't inherit the CSS font stack —
   numeric axes must be told to use the mono face explicitly or they fall
   back to the default sans and stop aligning with every other figure. */
export const CHART_FONT_MONO = "'IBM Plex Mono', 'SF Mono', Menlo, monospace";

/* Chart libraries need literal color values (SVG fill/stroke), mirrored from tokens.css */
export const CHART_COLORS = {
  accent: '#4c6fff',
  positive: '#4caf7d',
  warning: '#e0b430',
  risk: '#f2545b',
  textMuted: '#5f6570',
  textSecondary: '#9ba0ac',
  gridLine: 'rgba(255,255,255,0.08)',
};

export const SEVERITY_COLOR_HEX = {
  5: '#f2545b',
  4: '#f2994a',
  3: '#e0b430',
  2: '#4caf7d',
  1: '#5d7a9e',
};

/* Recharts' Tooltip takes an inline style object, not a className, so its
   surface can't come from CSS. Defined once here (rather than duplicated in
   every chart) so all tooltips stay identical — mirrors --bg-focused /
   --border-emphasis / --text-primary / --radius-md. */
export const CHART_TOOLTIP_STYLE = {
  background: '#1d2029',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 4,
  fontSize: 12,
  color: '#edeef2',
};
