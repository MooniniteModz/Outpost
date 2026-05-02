import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, AreaChart, Area, Legend,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import Globe3D from '../components/Globe3D';
import { SEVERITY_COLORS, SOURCE_COLORS, CHART_COLORS } from '../utils/constants';
import { formatTime, formatNumber, formatUptime } from '../utils/formatters';

// Grafana-style shared config
const GRID_COLOR   = '#1f2535';
const AXIS_COLOR   = '#5a6478';
const AXIS_STYLE   = { fontSize: 10, fill: '#9da5b4', fontFamily: 'var(--mono)' };
const TOOLTIP_STYLE = {
  background: '#1b2028',
  border: '1px solid #2d3748',
  borderRadius: 2,
  fontSize: 12,
  color: '#d1d5db',
  padding: '6px 10px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};
const CURSOR_STYLE = { stroke: '#5a6478', strokeWidth: 1, strokeDasharray: '3 3' };

export default function WidgetRenderer({ type, data, config }) {
  if (type === 'geo_map') return <GeoMapRenderer config={config} />;
  if (!data) return <div className="empty" style={{padding: 20}}>Loading...</div>;

  switch (type) {
    case 'stat_card':  return <StatRenderer data={data} config={config} />;
    case 'area_chart': return <AreaChartRenderer data={data} />;
    case 'bar_chart':  return <BarChartRenderer data={data} config={config} />;
    case 'pie_chart':  return <PieChartRenderer data={data} config={config} />;
    case 'top_list':   return <TopListRenderer data={data} config={config} />;
    default:           return <div className="empty">Unknown widget type</div>;
  }
}

function GeoMapRenderer({ config }) {
  const height = config?.height || 520;
  return (
    <div style={{ height: height - 40, display: 'flex', flexDirection: 'column' }}>
      <Globe3D />
    </div>
  );
}

function StatRenderer({ data, config }) {
  const field   = config?.params?.field || 'events_stored_today';
  const value   = data[field] ?? 0;
  const display = field === 'uptime_ms' ? formatUptime(value) : formatNumber(value);
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)' }}>
        {display}
      </div>
    </div>
  );
}

function AreaChartRenderer({ data }) {
  const navigate = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const chartData = data.map(([time, count]) => ({ time, count }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
        onClick={(e) => {
          if (e?.activePayload?.[0]) {
            const t = e.activePayload[0].payload.time;
            navigate(`/events?start=${t}&end=${t + 3600000}`);
          }
        }}
        style={{ cursor: 'crosshair' }}
      >
        <defs>
          <linearGradient id="grafanaArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#73bf69" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#73bf69" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 0" />
        <XAxis
          dataKey="time"
          tickFormatter={formatTime}
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          dy={4}
        />
        <YAxis
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          dx={-4}
          width={38}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#9da5b4', marginBottom: 4 }}
          itemStyle={{ color: '#73bf69' }}
          labelFormatter={formatTime}
          cursor={CURSOR_STYLE}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#73bf69"
          strokeWidth={1.5}
          fill="url(#grafanaArea)"
          dot={false}
          activeDot={{ r: 3, fill: '#73bf69', stroke: '#1b2028', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function dedupeByName(rows) {
  const merged = new Map();
  for (const [name, value] of rows) {
    const key = name.toLowerCase();
    merged.set(key, { name: key, value: (merged.get(key)?.value ?? 0) + value });
  }
  return [...merged.values()].sort((a, b) => b.value - a.value);
}

function BarChartRenderer({ data, config }) {
  const navigate  = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;

  const chartData = dedupeByName(data);
  const colors    = config?.dataSource === 'sources' ? SOURCE_COLORS : SEVERITY_COLORS;
  const filterKey = config?.dataSource === 'sources' ? 'source_type' : 'severity';
  const total     = chartData.reduce((s, d) => s + d.value, 0) || 1;
  const max       = Math.max(...chartData.map(d => d.value)) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
      {chartData.map((entry, i) => {
        const color = colors[entry.name] || colors[entry.name?.toLowerCase()] || CHART_COLORS[i % CHART_COLORS.length];
        const pct   = Math.round((entry.value / total) * 100);
        const barW  = (entry.value / max) * 100;

        return (
          <div
            key={entry.name}
            onClick={() => navigate(`/events?${filterKey}=${entry.name}`)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}
            title={`${entry.name}: ${entry.value.toLocaleString()} (${pct}%)`}
          >
            {/* Label row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 1, background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ color: '#c9d1d9', fontFamily: 'var(--mono)', textTransform: 'capitalize' }}>{entry.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5a6478' }}>
                <span style={{ color: '#9da5b4', fontFamily: 'var(--mono)', fontWeight: 600 }}>{entry.value.toLocaleString()}</span>
                <span style={{ width: 32, textAlign: 'right', fontFamily: 'var(--mono)' }}>{pct}%</span>
              </div>
            </div>
            {/* Bar gauge track */}
            <div style={{ height: 4, background: '#1f2535', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${barW}%`,
                background: `linear-gradient(90deg, ${color}99 0%, ${color} 100%)`,
                borderRadius: 2,
                transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: `0 0 6px ${color}55`,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PieChartRenderer({ data, config }) {
  const navigate  = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const chartData = data.map(([name, value]) => ({ name, value }));
  const colors    = config?.dataSource === 'sources' ? SOURCE_COLORS : SEVERITY_COLORS;
  const filterKey = config?.dataSource === 'sources' ? 'source_type' : 'severity';
  const total     = chartData.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
      {/* Donut */}
      <ResponsiveContainer width="45%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%" cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            strokeWidth={0}
            style={{ cursor: 'pointer' }}
            onClick={(_, index) => navigate(`/events?${filterKey}=${chartData[index].name}`)}
            labelLine={false}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={colors[entry.name] || colors[entry.name?.toLowerCase()] || CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.9}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: '#d1d5db' }}
            cursor={false}
            formatter={(value) => [value.toLocaleString(), '']}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend with values */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', minHeight: 0 }}>
        {chartData.map((entry, i) => {
          const color = colors[entry.name] || colors[entry.name?.toLowerCase()] || CHART_COLORS[i % CHART_COLORS.length];
          const pct   = Math.round((entry.value / total) * 100);
          return (
            <div
              key={entry.name}
              onClick={() => navigate(`/events?${filterKey}=${entry.name}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '2px 4px', borderRadius: 2, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1f2535'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 8, height: 8, borderRadius: 1, background: color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: '#c9d1d9', fontFamily: 'var(--mono)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
              <span style={{ fontSize: 11, color: '#9da5b4', fontFamily: 'var(--mono)', fontWeight: 600 }}>{entry.value.toLocaleString()}</span>
              <span style={{ fontSize: 10, color: '#5a6478', fontFamily: 'var(--mono)', width: 28, textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopListRenderer({ data, config }) {
  const navigate  = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const filterKey = config?.dataSource === 'topIps'   ? 'src_ip'
    : config?.dataSource === 'topUsers'  ? 'user_name' : 'action';

  const max = data[0]?.[1] || 1;

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, height: '100%', overflowY: 'auto' }}>
      {data.map(([name, count]) => (
        <li
          key={name}
          onClick={() => navigate(`/events?${filterKey}=${name}`)}
          style={{ padding: '4px 0', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--mono)' }}>
            <span style={{ color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{name}</span>
            <span style={{ color: '#9da5b4' }}>{count}</span>
          </div>
          <div style={{ height: 3, background: GRID_COLOR, borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: '#5a8dee', borderRadius: 1, transition: 'width 0.3s' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
