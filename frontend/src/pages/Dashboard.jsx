import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, RefreshCw, Clock } from 'lucide-react';
import WidgetRenderer from '../widgets/WidgetRenderer';
import { DEFAULT_DASHBOARD } from '../widgets/WidgetRegistry';
import { api } from '../api';

function loadDashboard() {
  try {
    const stored = localStorage.getItem('outpost_dashboard');
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_DASHBOARD;
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Dashboard() {
  const navigate    = useNavigate();
  const now         = useNow();
  const [dashboard] = useState(loadDashboard);
  const [widgetData, setWidgetData] = useState({});
  const [error, setError]           = useState(null);
  const [loaded, setLoaded]         = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  async function fetchAll(cancelled = { current: false }) {
    try {
      const data = {};
      const needed = new Set(
        dashboard.widgets.filter(w => w.dataSource !== '_self').map(w => w.dataSource)
      );
      const fetchers = {
        health:     () => api.health(),
        timeline:   () => api.timeline(24),
        sources:    () => api.sources(),
        severity:   () => api.severity(),
        categories: () => api.categories(),
        topIps:     () => api.topIps(8),
        topUsers:   () => api.topUsers(8),
        topActions: () => api.topActions(8),
      };
      await Promise.all([...needed].map(async ds => {
        try { data[ds] = await fetchers[ds]?.(); } catch {}
      }));
      if (!cancelled.current) {
        setWidgetData(data);
        setLoaded(true);
        setError(null);
        setLastRefresh(new Date());
      }
    } catch (e) {
      if (!cancelled.current) setError(e.message);
    }
  }

  useEffect(() => {
    const cancelled = { current: false };
    fetchAll(cancelled);
    const interval = setInterval(() => fetchAll(cancelled), 15000);
    return () => { cancelled.current = true; clearInterval(interval); };
  }, [dashboard.widgets]);

  if (error && !loaded) return (
    <div className="loading">
      <div className="loading-spinner" />
      <div>Connecting to Firewatch backend...</div>
      <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>{error}</div>
    </div>
  );

  if (!loaded && dashboard.widgets.some(w => w.dataSource !== '_self')) return (
    <div className="loading"><div className="loading-spinner" /><div>Loading dashboard...</div></div>
  );

  const sorted = [...dashboard.widgets].sort((a, b) => a.order - b.order);

  return (
    <div className="grafana-dashboard">
      {/* ── Grafana-style toolbar ── */}
      <div className="grafana-toolbar">
        <div className="grafana-toolbar-left">
          <span className="grafana-dash-title">FIREWATCH</span>
          <span className="grafana-dash-subtitle">Security Overview</span>
        </div>
        <div className="grafana-toolbar-right">
          <div className="grafana-time-range">
            <Clock size={12} />
            <span>Last 24 hours</span>
          </div>
          <div className="grafana-time-range">
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <button className="grafana-btn" onClick={() => fetchAll()} title="Refresh">
            <RefreshCw size={13} />
          </button>
          <button className="grafana-btn" onClick={() => navigate('/dashboard/edit')} title="Edit dashboard">
            <Pencil size={13} /> Edit
          </button>
        </div>
      </div>

      {/* ── Widget grid ── */}
      <div className="widget-grid">
        {sorted.map(widget => {
          const isStat     = widget.type === 'stat_card';
          const sizeClass  = `widget-${widget.size || 'half'}`;
          const heightStyle = widget.height ? { height: widget.height, overflow: 'hidden' } : {};

          return (
            <div
              key={widget.id}
              className={`grafana-panel ${isStat ? 'grafana-panel-stat' : ''} ${sizeClass}`}
              style={heightStyle}
            >
              <div className="grafana-panel-header">
                <span className="grafana-panel-title">{widget.title}</span>
              </div>
              <div className="grafana-panel-body">
                <WidgetRenderer
                  type={widget.type}
                  data={widgetData[widget.dataSource]}
                  config={widget}
                />
              </div>
            </div>
          );
        })}
      </div>

      {lastRefresh && (
        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'var(--mono)' }}>
          Last refresh: {lastRefresh.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
