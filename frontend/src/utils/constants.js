// Shared constants used across Events, Alerts, Reports, and Widgets

// Maps severity names to CSS badge classes
export const SEVERITY_CLASS = {
  critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info',
  informational: 'info', warning: 'medium', error: 'high', emergency: 'critical',
  debug: 'info', unknown: 'info',
};

// Maps source type names to CSS badge classes
export const SOURCE_CLASS = {
  azure: 'azure', m365: 'm365', fortigate: 'fortigate',
  windows: 'windows', unifi: 'unifi', syslog: 'syslog',
  sentinelone: 'sentinelone', unknown: 'unknown',
};

// Colors for severity values in charts
export const SEVERITY_COLORS = {
  critical: '#f85149', error: '#f85149', high: '#db6d28',
  warning: '#d29922', medium: '#d29922', low: '#3fb950',
  info: '#58a6ff', informational: '#58a6ff', debug: '#8b949e',
};

// Colors for source types in charts
export const SOURCE_COLORS = {
  Azure: '#58a6ff', azure: '#58a6ff',
  M365: '#bc8cff', m365: '#bc8cff',
  FortiGate: '#db6d28', fortigate: '#db6d28',
  Windows: '#79c0ff', windows: '#79c0ff',
  UniFi: '#00d4aa', unifi: '#00d4aa',
  SentinelOne: '#e3b341', sentinelone: '#e3b341',
  Syslog: '#3fb950', syslog: '#3fb950',
  Unknown: '#8b949e', unknown: '#8b949e',
};

// Default color palette for charts
export const CHART_COLORS = ['#00d4aa', '#58a6ff', '#bc8cff', '#db6d28', '#d29922', '#f85149', '#3fb950', '#79c0ff'];

// Shared Recharts tooltip style (Grafana-inspired)
export const tooltipStyle = {
  background: '#1b2028', border: '1px solid #2d3748', borderRadius: 2,
  fontSize: 12, color: '#d1d5db', padding: '6px 10px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};
