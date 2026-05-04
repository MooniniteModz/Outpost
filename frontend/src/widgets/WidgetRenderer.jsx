import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, AreaChart, Area, Label,
  LineChart, Line, BarChart, Bar,
  RadialBarChart, RadialBar,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import Globe3D from '../components/Globe3D';
import { SEVERITY_COLORS, SOURCE_COLORS, CHART_COLORS } from '../utils/constants';
import { formatTime, formatNumber, formatUptime } from '../utils/formatters';

const GRID_COLOR   = '#1e2840';
const AXIS_STYLE   = { fontSize: 10, fill: '#6b7280', fontFamily: 'var(--mono)' };
const TOOLTIP_STYLE = {
  background: '#13161f',
  border: '1px solid #2a3148',
  borderRadius: 8,
  fontSize: 12,
  color: '#e6edf3',
  padding: '8px 12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
};
const CURSOR_STYLE = { stroke: '#2a3148', strokeWidth: 1 };

export default function WidgetRenderer({ type, data, config }) {
  if (type === 'geo_map') return <GeoMapRenderer config={config} />;
  if (!data) return <div className="empty" style={{ padding: 20 }}>Loading…</div>;

  switch (type) {
    case 'stat_card':    return <StatRenderer data={data} config={config} />;
    case 'area_chart':   return <AreaChartRenderer data={data} />;
    case 'line_chart':   return <LineChartRenderer data={data} />;
    case 'bar_chart':    return <BarChartRenderer data={data} config={config} />;
    case 'vertical_bar': return <VerticalBarRenderer data={data} config={config} />;
    case 'pie_chart':    return <PieChartRenderer data={data} config={config} />;
    case 'gauge':        return <GaugeRenderer data={data} config={config} />;
    case 'top_list':     return <TopListRenderer data={data} config={config} />;
    case 'alert_feed':   return <AlertFeedRenderer data={data} config={config} />;
    default:             return <div className="empty">Unknown widget type</div>;
  }
}

// ─── Geo ────────────────────────────────────────────────────────────────────

function GeoMapRenderer({ config }) {
  const height = config?.height || 520;
  return (
    <div style={{ height: height - 40, display: 'flex', flexDirection: 'column' }}>
      <Globe3D />
    </div>
  );
}

// ─── Single Value ────────────────────────────────────────────────────────────

function StatRenderer({ data, config }) {
  const field   = config?.params?.field || 'events_stored_today';
  const value   = data[field] ?? 0;
  const display = field === 'uptime_ms' ? formatUptime(value) : formatNumber(value);
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{
        fontSize: 44, fontWeight: 800,
        color: 'var(--accent)',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'var(--mono)',
        letterSpacing: '-1.5px',
        lineHeight: 1,
      }}>
        {display}
      </div>
    </div>
  );
}

function GaugeRenderer({ data, config }) {
  if (!data) return <div className="empty">No data</div>;
  const field = config?.params?.field || 'buffer_usage';
  const max   = parseFloat(config?.params?.max) || 100;
  const raw   = data[field] ?? 0;
  const pct   = Math.min(100, Math.round((raw / max) * 100));
  const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#00d4aa';
  const gaugeData = [{ name: field, value: pct, fill: color }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: '100%', height: '75%', minHeight: 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="85%"
            innerRadius="60%" outerRadius="95%"
            startAngle={180} endAngle={0}
            data={gaugeData}
            barSize={14}
          >
            <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#1e2840' }} isAnimationActive={false} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ textAlign: 'center', marginTop: -8 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color, fontFamily: 'var(--mono)', letterSpacing: '-1px', lineHeight: 1 }}>
          {pct}%
        </div>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>
          {field.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );
}

// ─── Time Series ─────────────────────────────────────────────────────────────

function AreaChartRenderer({ data }) {
  const navigate = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const chartData = data.map(([time, count]) => ({ time, count }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
        onClick={e => {
          if (e?.activePayload?.[0]) {
            const t = e.activePayload[0].payload.time;
            navigate(`/events?start=${t}&end=${t + 3600000}`);
          }
        }}
        style={{ cursor: 'crosshair' }}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#73bf69" stopOpacity={0.45} />
            <stop offset="85%" stopColor="#73bf69" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="time" tickFormatter={formatTime} tick={AXIS_STYLE} axisLine={false} tickLine={false} dy={4} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} dx={-4} width={38} />
        <Tooltip contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#9da5b4', marginBottom: 4, fontSize: 11 }}
          itemStyle={{ color: '#73bf69', fontWeight: 600 }}
          labelFormatter={formatTime} cursor={CURSOR_STYLE} />
        <Area type="monotone" dataKey="count" stroke="#73bf69" strokeWidth={2}
          fill="url(#areaFill)" dot={false}
          activeDot={{ r: 4, fill: '#73bf69', stroke: '#0d1117', strokeWidth: 2 }}
          isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function LineChartRenderer({ data }) {
  const navigate = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const chartData = data.map(([time, count]) => ({ time, count }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
        onClick={e => {
          if (e?.activePayload?.[0]) {
            const t = e.activePayload[0].payload.time;
            navigate(`/events?start=${t}&end=${t + 3600000}`);
          }
        }}
        style={{ cursor: 'crosshair' }}
      >
        <CartesianGrid vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="time" tickFormatter={formatTime} tick={AXIS_STYLE} axisLine={false} tickLine={false} dy={4} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} dx={-4} width={38} />
        <Tooltip contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#9da5b4', marginBottom: 4, fontSize: 11 }}
          itemStyle={{ color: '#58a6ff', fontWeight: 600 }}
          labelFormatter={formatTime} cursor={CURSOR_STYLE} />
        <Line type="monotone" dataKey="count" stroke="#58a6ff" strokeWidth={2}
          dot={{ r: 3, fill: '#58a6ff', stroke: '#0d1117', strokeWidth: 1.5 }}
          activeDot={{ r: 5, fill: '#58a6ff', stroke: '#0d1117', strokeWidth: 2 }}
          isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Distribution ─────────────────────────────────────────────────────────────

function dedupeByName(rows) {
  const merged = new Map();
  for (const [name, value] of rows) {
    const key = name.toLowerCase();
    merged.set(key, { name: key, value: (merged.get(key)?.value ?? 0) + value });
  }
  return [...merged.values()].sort((a, b) => b.value - a.value);
}

function getColor(entry, i, colors) {
  return colors[entry.name] || colors[entry.name?.toLowerCase()] || CHART_COLORS[i % CHART_COLORS.length];
}

function colorsForSource(dataSource) {
  if (dataSource === 'sources') return SOURCE_COLORS;
  if (dataSource === 'severity') return SEVERITY_COLORS;
  return {};
}

function filterKeyForSource(dataSource) {
  const map = {
    sources: 'source_type', severity: 'severity', categories: 'category',
    topIps: 'src_ip', topUsers: 'user_name', topActions: 'action',
  };
  return map[dataSource] || 'source_type';
}

function BarChartRenderer({ data, config }) {
  const navigate = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const chartData = dedupeByName(data);
  const colors    = colorsForSource(config?.dataSource);
  const filterKey = filterKeyForSource(config?.dataSource);
  const total     = chartData.reduce((s, d) => s + d.value, 0) || 1;
  const max       = Math.max(...chartData.map(d => d.value)) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 0' }}>
      {chartData.map((entry, i) => {
        const color = getColor(entry, i, colors);
        const pct   = Math.round((entry.value / total) * 100);
        const barW  = (entry.value / max) * 100;
        return (
          <div key={entry.name} onClick={() => navigate(`/events?${filterKey}=${entry.name}`)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
            title={`${entry.name}: ${entry.value.toLocaleString()} (${pct}%)`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}77` }} />
                <span style={{ color: '#c9d1d9', textTransform: 'capitalize' }}>{entry.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#e6edf3', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12 }}>{entry.value.toLocaleString()}</span>
                <span style={{ color: '#4a5568', fontFamily: 'var(--mono)', fontSize: 10, width: 28, textAlign: 'right' }}>{pct}%</span>
              </div>
            </div>
            <div style={{ height: 5, background: GRID_COLOR, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${barW}%`, background: color, borderRadius: 3, opacity: 0.88, transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VerticalBarRenderer({ data, config }) {
  const navigate  = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const limit     = config?.params?.limit || 8;
  const chartData = dedupeByName(data).slice(0, limit);
  const colors    = colorsForSource(config?.dataSource);
  const filterKey = filterKeyForSource(config?.dataSource);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 28 }}>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="name" tick={{ ...AXIS_STYLE, fontSize: 9 }} axisLine={false} tickLine={false}
          interval={0} angle={-30} textAnchor="end" height={44} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={38} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={22} isAnimationActive={false}
          onClick={d => navigate(`/events?${filterKey}=${d.name}`)} style={{ cursor: 'pointer' }}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getColor(entry, i, colors)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartRenderer({ data, config }) {
  const navigate  = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const chartData = data.map(([name, value]) => ({ name, value }));
  const colors    = colorsForSource(config?.dataSource);
  const filterKey = filterKeyForSource(config?.dataSource);
  const total     = chartData.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
      <ResponsiveContainer width="45%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name"
            cx="50%" cy="50%" innerRadius="50%" outerRadius="80%"
            paddingAngle={2} strokeWidth={0} style={{ cursor: 'pointer' }}
            onClick={(_, i) => navigate(`/events?${filterKey}=${chartData[i].name}`)}
            isAnimationActive={false}>
            {chartData.map((entry, i) => <Cell key={i} fill={getColor(entry, i, colors)} />)}
            <Label
              content={({ viewBox }) => {
                const { cx, cy } = viewBox;
                return (
                  <g>
                    <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
                      fill="#e6edf3" fontSize={15} fontWeight={800} fontFamily="var(--mono)">
                      {formatNumber(total)}
                    </text>
                    <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
                      fill="#6b7280" fontSize={9}>
                      TOTAL
                    </text>
                  </g>
                );
              }}
              position="center"
            />
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#d1d5db' }}
            cursor={false} formatter={v => [v.toLocaleString(), '']} />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', minHeight: 0 }}>
        {chartData.map((entry, i) => {
          const color = getColor(entry, i, colors);
          const pct   = Math.round((entry.value / total) * 100);
          return (
            <div key={entry.name} onClick={() => navigate(`/events?${filterKey}=${entry.name}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 6px', borderRadius: 6, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a2035'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 4px ${color}88` }} />
              <span style={{ flex: 1, fontSize: 11, color: '#c9d1d9', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
              <span style={{ fontSize: 12, color: '#e6edf3', fontFamily: 'var(--mono)', fontWeight: 700 }}>{entry.value.toLocaleString()}</span>
              <span style={{ fontSize: 10, color: '#4a5568', fontFamily: 'var(--mono)', width: 26, textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lists ────────────────────────────────────────────────────────────────────

function TopListRenderer({ data, config }) {
  const navigate  = useNavigate();
  if (!Array.isArray(data) || data.length === 0) return <div className="empty">No data</div>;
  const filterKey = filterKeyForSource(config?.dataSource);
  const max = data[0]?.[1] || 1;

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, height: '100%', overflowY: 'auto' }}>
      {data.map(([name, count], idx) => (
        <li key={name} onClick={() => navigate(`/events?${filterKey}=${name}`)}
          style={{ padding: '5px 2px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
              <span style={{ fontSize: 10, color: '#3d4a5e', fontFamily: 'var(--mono)', fontWeight: 700, width: 14, flexShrink: 0 }}>{idx + 1}</span>
              <span style={{ color: '#c9d1d9', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            </div>
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, background: 'var(--accent-subtle)', padding: '1px 7px', borderRadius: 10, flexShrink: 0, marginLeft: 8 }}>
              {count.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 4, background: GRID_COLOR, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: '#5a8dee', borderRadius: 2, opacity: 0.75 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AlertFeedRenderer({ data, config }) {
  const navigate = useNavigate();
  const alerts   = data?.alerts || (Array.isArray(data) ? data : []);
  const limit    = config?.params?.limit || 10;
  const visible  = alerts.slice(0, limit);

  if (visible.length === 0) return <div className="empty">No recent alerts</div>;

  return (
    <div style={{ overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {visible.map(alert => {
        const sevColor = SEVERITY_COLORS[alert.severity?.toLowerCase()] || '#8b949e';
        return (
          <div key={alert.alert_id}
            onClick={() => navigate('/alerts')}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', background: '#0d1117', border: '1px solid #1e2840', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = sevColor + '66'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2840'}>
            <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: sevColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#e6edf3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {alert.rule_name}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                {alert.group_key && <span style={{ fontFamily: 'var(--mono)', marginRight: 6 }}>{alert.group_key}</span>}
                {new Date(alert.created_at).toLocaleTimeString()}
              </div>
            </div>
            <span style={{ fontSize: 10, color: sevColor, background: sevColor + '22', padding: '1px 6px', borderRadius: 8, flexShrink: 0, fontWeight: 600, textTransform: 'uppercase' }}>
              {alert.severity}
            </span>
          </div>
        );
      })}
    </div>
  );
}
