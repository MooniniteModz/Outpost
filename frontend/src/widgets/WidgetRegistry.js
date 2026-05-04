export const WIDGET_CATEGORIES = [
  { id: 'all',          label: 'All Charts' },
  { id: 'timeseries',   label: 'Time Series' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'singlevalue',  label: 'Single Value' },
  { id: 'lists',        label: 'Lists & Feeds' },
  { id: 'geo',          label: 'Geo' },
];

export const WIDGET_TYPES = {
  area_chart: {
    name: 'Area Chart',
    description: 'Filled time-series trend',
    category: 'timeseries',
    dataSources: ['timeline', 'timeline_7d'],
    fields: [],
  },
  line_chart: {
    name: 'Line Chart',
    description: 'Time-series with data point markers',
    category: 'timeseries',
    dataSources: ['timeline', 'timeline_7d'],
    fields: [],
  },
  bar_chart: {
    name: 'Bar Chart',
    description: 'Horizontal comparison bars with inline gauges',
    category: 'distribution',
    dataSources: ['sources', 'severity', 'categories'],
    fields: [],
  },
  vertical_bar: {
    name: 'Column Chart',
    description: 'Vertical bar chart for category comparison',
    category: 'distribution',
    dataSources: ['sources', 'severity', 'categories', 'topIps', 'topUsers', 'topActions'],
    fields: [
      { key: 'limit', label: 'Max columns', type: 'number', default: 8 },
    ],
  },
  pie_chart: {
    name: 'Donut Chart',
    description: 'Proportional distribution with center total',
    category: 'distribution',
    dataSources: ['severity', 'sources', 'categories'],
    fields: [],
  },
  stat_card: {
    name: 'Stat Counter',
    description: 'Single large bold metric value',
    category: 'singlevalue',
    dataSources: ['health'],
    fields: [
      { key: 'field', label: 'Metric', type: 'select', default: 'events_stored_today',
        options: ['events_stored_today', 'total_events_inserted', 'buffer_usage', 'buffer_drops', 'uptime_ms', 'active_rules', 'alerts_fired'] },
    ],
  },
  gauge: {
    name: 'Gauge',
    description: 'Radial arc showing metric vs maximum',
    category: 'singlevalue',
    dataSources: ['health'],
    fields: [
      { key: 'field', label: 'Metric', type: 'select', default: 'buffer_usage',
        options: ['buffer_usage', 'buffer_drops', 'alerts_fired', 'active_rules', 'events_stored_today'] },
      { key: 'max', label: 'Max value', type: 'number', default: 100 },
    ],
  },
  top_list: {
    name: 'Top-N List',
    description: 'Ranked list with inline progress bars',
    category: 'lists',
    dataSources: ['topIps', 'topUsers', 'topActions'],
    fields: [
      { key: 'limit', label: 'Max items', type: 'number', default: 8 },
    ],
  },
  alert_feed: {
    name: 'Alert Feed',
    description: 'Scrolling feed of recent alerts by severity',
    category: 'lists',
    dataSources: ['alerts'],
    fields: [
      { key: 'limit', label: 'Max alerts', type: 'number', default: 10 },
    ],
  },
  geo_map: {
    name: '3D Globe',
    description: 'Interactive 3D globe with live event points',
    category: 'geo',
    dataSources: ['_self'],
    fields: [],
    selfFetch: true,
  },
};

export const DATA_SOURCE_LABELS = {
  health:      'System Health',
  timeline:    'Event Timeline (24h)',
  timeline_7d: 'Event Timeline (7 days)',
  sources:     'Events by Source',
  severity:    'Events by Severity',
  categories:  'Events by Category',
  topIps:      'Top Source IPs',
  topUsers:    'Top Users',
  topActions:  'Top Actions',
  alerts:      'Recent Alerts',
  _self:       'Built-in (self-managed)',
};

export const SIZE_OPTIONS = [
  { value: 'full',    label: 'Full',    sublabel: '12 cols', w: 12 },
  { value: 'half',    label: 'Half',    sublabel: '6 cols',  w: 6  },
  { value: 'third',   label: 'Third',   sublabel: '4 cols',  w: 4  },
  { value: 'quarter', label: 'Quarter', sublabel: '3 cols',  w: 3  },
];

export const SIZE_TO_W = { full: 12, half: 6, third: 4, quarter: 3 };
export const TYPE_DEFAULT_H = {
  stat_card: 5, geo_map: 18,
  area_chart: 8, line_chart: 8,
  bar_chart: 9, vertical_bar: 9,
  pie_chart: 9, gauge: 9,
  top_list: 9, alert_feed: 10,
};

export const DEFAULT_DASHBOARD = {
  id: 'default',
  name: 'Security Overview',
  widgets: [
    { id: 'w1',  type: 'stat_card',  title: 'Events Today',         dataSource: 'health',    params: { field: 'events_stored_today' },      x: 0,  y: 0,  w: 3,  h: 5  },
    { id: 'w2',  type: 'stat_card',  title: 'Total Ingested',       dataSource: 'health',    params: { field: 'total_events_inserted' },     x: 3,  y: 0,  w: 3,  h: 5  },
    { id: 'w3',  type: 'stat_card',  title: 'Alerts Fired',         dataSource: 'health',    params: { field: 'alerts_fired' },              x: 6,  y: 0,  w: 3,  h: 5  },
    { id: 'w4',  type: 'stat_card',  title: 'Active Rules',         dataSource: 'health',    params: { field: 'active_rules' },              x: 9,  y: 0,  w: 3,  h: 5  },
    { id: 'w5',  type: 'geo_map',    title: '3D Globe',             dataSource: '_self',     params: {},                                     x: 0,  y: 5,  w: 12, h: 18 },
    { id: 'w6',  type: 'area_chart', title: 'Event Timeline (24h)', dataSource: 'timeline',  params: {},                                     x: 0,  y: 23, w: 12, h: 9  },
    { id: 'w7',  type: 'pie_chart',  title: 'Events by Severity',   dataSource: 'severity',  params: {},                                     x: 0,  y: 32, w: 6,  h: 10 },
    { id: 'w8',  type: 'bar_chart',  title: 'Events by Source',     dataSource: 'sources',   params: {},                                     x: 6,  y: 32, w: 6,  h: 10 },
    { id: 'w9',  type: 'top_list',   title: 'Top Source IPs',       dataSource: 'topIps',    params: { limit: 8 },                           x: 0,  y: 42, w: 4,  h: 10 },
    { id: 'w10', type: 'top_list',   title: 'Top Users',            dataSource: 'topUsers',  params: { limit: 8 },                           x: 4,  y: 42, w: 4,  h: 10 },
    { id: 'w11', type: 'top_list',   title: 'Top Actions',          dataSource: 'topActions',params: { limit: 8 },                           x: 8,  y: 42, w: 4,  h: 10 },
  ],
};

export function migrateDashboard(dashboard) {
  if (!dashboard?.widgets?.length) return dashboard;
  if (dashboard.widgets[0].x !== undefined) return dashboard;

  const sizeToW = { full: 12, half: 6, third: 4, quarter: 3 };
  const typeToH = TYPE_DEFAULT_H;
  const sorted = [...dashboard.widgets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let curX = 0, curY = 0, rowH = 0;

  const widgets = sorted.map(w => {
    const width  = sizeToW[w.size] || 6;
    const height = w.height ? Math.max(4, Math.round(w.height / 34)) : (typeToH[w.type] || 8);
    if (curX + width > 12) { curY += rowH; curX = 0; rowH = 0; }
    const out = { ...w, x: curX, y: curY, w: width, h: height };
    curX += width;
    rowH = Math.max(rowH, height);
    return out;
  });

  return { ...dashboard, widgets };
}
