export const WIDGET_TYPES = {
  stat_card: {
    name: 'Stat Counter',
    icon: 'Hash',
    dataSources: ['health'],
    fields: [
      { key: 'field', label: 'Metric', type: 'select',
        options: ['events_stored_today', 'total_events_inserted', 'buffer_usage', 'buffer_drops', 'uptime_ms', 'active_rules', 'alerts_fired'] },
    ],
  },
  area_chart: {
    name: 'Area Chart',
    icon: 'TrendingUp',
    dataSources: ['timeline'],
    fields: [
      { key: 'hours', label: 'Hours', type: 'number', default: 24 },
    ],
  },
  bar_chart: {
    name: 'Bar Chart',
    icon: 'BarChart3',
    dataSources: ['sources', 'severity', 'categories'],
    fields: [],
  },
  pie_chart: {
    name: 'Pie Chart',
    icon: 'PieChart',
    dataSources: ['severity', 'sources', 'categories'],
    fields: [],
  },
  top_list: {
    name: 'Top-N List',
    icon: 'List',
    dataSources: ['topIps', 'topUsers', 'topActions'],
    fields: [
      { key: 'limit', label: 'Max items', type: 'number', default: 8 },
    ],
  },
  geo_map: {
    name: '3D Globe',
    icon: 'Globe',
    dataSources: ['_self'],
    fields: [],
    selfFetch: true,
  },
};

export const DATA_SOURCE_LABELS = {
  health: 'System Health',
  timeline: 'Event Timeline',
  sources: 'Events by Source',
  severity: 'Events by Severity',
  categories: 'Events by Category',
  topIps: 'Top Source IPs',
  topUsers: 'Top Users',
  topActions: 'Top Actions',
  _self: 'Built-in (self-managed)',
};

export const SIZE_OPTIONS = [
  { value: 'full',    label: 'Full Width',  w: 12 },
  { value: 'half',    label: 'Half',        w: 6  },
  { value: 'third',   label: 'Third',       w: 4  },
  { value: 'quarter', label: 'Quarter',     w: 3  },
];

export const SIZE_TO_W = { full: 12, half: 6, third: 4, quarter: 3 };
export const TYPE_DEFAULT_H = { stat_card: 5, geo_map: 18, area_chart: 8, bar_chart: 9, pie_chart: 9, top_list: 9 };

export const DEFAULT_DASHBOARD = {
  id: 'default',
  name: 'Security Overview',
  widgets: [
    { id: 'w1',  type: 'stat_card',  title: 'Events Today',           dataSource: 'health',    params: { field: 'events_stored_today' },      x: 0,  y: 0,  w: 3,  h: 5  },
    { id: 'w2',  type: 'stat_card',  title: 'Total Ingested',         dataSource: 'health',    params: { field: 'total_events_inserted' },     x: 3,  y: 0,  w: 3,  h: 5  },
    { id: 'w3',  type: 'stat_card',  title: 'Alerts Fired',           dataSource: 'health',    params: { field: 'alerts_fired' },              x: 6,  y: 0,  w: 3,  h: 5  },
    { id: 'w4',  type: 'stat_card',  title: 'Active Rules',           dataSource: 'health',    params: { field: 'active_rules' },              x: 9,  y: 0,  w: 3,  h: 5  },
    { id: 'w5',  type: 'geo_map',    title: '3D Globe',               dataSource: '_self',     params: {},                                     x: 0,  y: 5,  w: 12, h: 18 },
    { id: 'w6',  type: 'area_chart', title: 'Event Timeline (24h)',   dataSource: 'timeline',  params: { hours: 24 },                          x: 0,  y: 23, w: 12, h: 9  },
    { id: 'w7',  type: 'pie_chart',  title: 'Events by Severity',     dataSource: 'severity',  params: {},                                     x: 0,  y: 32, w: 6,  h: 10 },
    { id: 'w8',  type: 'bar_chart',  title: 'Events by Source',       dataSource: 'sources',   params: {},                                     x: 6,  y: 32, w: 6,  h: 10 },
    { id: 'w9',  type: 'top_list',   title: 'Top Source IPs',         dataSource: 'topIps',    params: { limit: 8 },                           x: 0,  y: 42, w: 4,  h: 10 },
    { id: 'w10', type: 'top_list',   title: 'Top Users',              dataSource: 'topUsers',  params: { limit: 8 },                           x: 4,  y: 42, w: 4,  h: 10 },
    { id: 'w11', type: 'top_list',   title: 'Top Actions',            dataSource: 'topActions',params: { limit: 8 },                           x: 8,  y: 42, w: 4,  h: 10 },
  ],
};

// Migrate old localStorage format (size/height/order) to new (x/y/w/h)
export function migrateDashboard(dashboard) {
  if (!dashboard?.widgets?.length) return dashboard;
  if (dashboard.widgets[0].x !== undefined) return dashboard; // already migrated

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
