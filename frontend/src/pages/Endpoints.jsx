import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Monitor, Search, RefreshCw, ExternalLink,
  Laptop, Server, Shield, Router, Wifi, Database,
  User, HelpCircle, Network,
} from 'lucide-react';
import { api } from '../api';
import { SOURCE_CLASS } from '../utils/constants';
import { formatTs, formatNumber } from '../utils/formatters';

// ── Device type inference ─────────────────────────────────────────────────────
// Infers a human-friendly device category from entity_kind, source_type, and hostname.

const DEVICE_TYPES = {
  User:     { icon: User,        color: '#bc8cff', label: 'Users'     },
  Computer: { icon: Laptop,      color: '#79c0ff', label: 'Computers' },
  Server:   { icon: Server,      color: '#3fb950', label: 'Servers'   },
  Switch:   { icon: Network,     color: '#00d4aa', label: 'Switches'  },
  Router:   { icon: Router,      color: '#58a6ff', label: 'Routers'   },
  Firewall: { icon: Shield,      color: '#db6d28', label: 'Firewalls' },
  AP:       { icon: Wifi,        color: '#e3b341', label: 'APs'       },
  Database: { icon: Database,    color: '#f0883e', label: 'Databases' },
  Cloud:    { icon: Monitor,     color: '#8b949e', label: 'Cloud'     },
  Unknown:  { icon: HelpCircle,  color: '#6e7681', label: 'Other'     },
};

function inferDeviceType(entity, entityKind, sourceType) {
  if (entityKind === 'user') return 'User';

  const st = (sourceType || '').toLowerCase();
  const h  = (entity    || '').toLowerCase();

  // Source-type exact matches take priority
  if (st === 'fortigate')               return 'Firewall';
  if (st === 'azure' || st === 'm365')  return 'Cloud';
  if (st === 'sentinelone')             return 'Computer';
  if (st === 'windows') {
    if (/\b(dc|srv|svr|server|svc)\b/.test(h)) return 'Server';
    return 'Computer';
  }
  if (st === 'unifi') {
    if (/\b(sw|switch|usw)\b/.test(h))       return 'Switch';
    if (/\b(ap|uap|wifi|wlan|wireless)\b/.test(h)) return 'AP';
    return 'Switch'; // most UniFi devices are switches
  }

  // Hostname-pattern heuristics (works for syslog and unknown sources)
  if (/\b(db|database|sql|postgres|mysql|mongo|redis|elastic)\b/.test(h)) return 'Database';
  if (/\b(fw|firewall|pfsense|asa|fortigate)\b/.test(h))                  return 'Firewall';
  if (/\b(rtr|router|gw|gateway)\b/.test(h))                              return 'Router';
  if (/\b(sw|switch|core|dist|acc|stack)\b/.test(h))                      return 'Switch';
  if (/\b(ap|wap|wlan|wifi|wireless|aps)\b/.test(h))                      return 'AP';
  if (/\b(srv|svr|server|dc|nas|vm|esxi|hyper)\b/.test(h))                return 'Server';
  if (/\b(ws|pc|dt|laptop|desktop|workstation|user|client)\b/.test(h))    return 'Computer';

  if (st === 'syslog') return 'Server';
  return 'Unknown';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SeverityBar({ critical, error, warning, info }) {
  const total = critical + error + warning + info;
  if (total === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>;
  const segs = [
    { count: critical, color: '#f85149', label: 'Critical' },
    { count: error,    color: '#db6d28', label: 'Error'    },
    { count: warning,  color: '#d29922', label: 'Warning'  },
    { count: info,     color: '#58a6ff', label: 'Info'     },
  ].filter(s => s.count > 0);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {segs.map(({ count, color, label }) => (
        <span key={label} title={`${label}: ${count}`} style={{
          background: color + '22', color, border: `1px solid ${color}55`,
          borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {count.toLocaleString()}
        </span>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '12px 18px', minWidth: 130,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>
        {(value ?? 0).toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function TypePill({ deviceType, count, active, onClick }) {
  const meta = DEVICE_TYPES[deviceType] || DEVICE_TYPES.Unknown;
  const Icon  = meta.icon;
  const color = meta.color;
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
      cursor: 'pointer', transition: 'all 0.15s',
      border: `1px solid ${active ? color : 'var(--border)'}`,
      background: active ? color + '22' : 'var(--bg-secondary)',
      color: active ? color : 'var(--text-muted)',
    }}>
      <Icon size={12} />
      {meta.label}
      <span style={{
        background: active ? color + '44' : 'var(--bg-tertiary)',
        borderRadius: 10, padding: '0 6px', fontSize: 11,
      }}>{count}</span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Endpoints() {
  const navigate = useNavigate();
  const [endpoints, setEndpoints]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState('All');
  const [lastRefresh, setLastRefresh]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.endpoints();
      setEndpoints(data || []);
      setLastRefresh(Date.now());
    } catch {
      setEndpoints([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  // Annotate each endpoint with its inferred device type
  const annotated = endpoints.map(ep => ({
    ...ep,
    deviceType: inferDeviceType(ep.host, ep.entity_kind, ep.source_type),
  }));

  const now   = Date.now();
  const dayMs = 86400000;

  const activeToday  = annotated.filter(e => now - e.last_seen < dayMs).length;
  const withCritical = annotated.filter(e => e.critical_count > 0).length;

  // Count by device type for pills (only types that appear)
  const typeCounts = annotated.reduce((acc, e) => {
    acc[e.deviceType] = (acc[e.deviceType] || 0) + 1;
    return acc;
  }, {});

  const filtered = annotated.filter(e => {
    if (typeFilter !== 'All' && e.deviceType !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.host.toLowerCase().includes(q) ||
           e.source_type.toLowerCase().includes(q) ||
           e.deviceType.toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Monitor size={20} style={{ color: 'var(--accent)' }} />
          <h2 className="page-title">Endpoints</h2>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}
                title={lastRefresh ? `Last updated ${timeAgo(lastRefresh)}` : ''}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <SummaryCard label="Total"        value={annotated.length} color="var(--accent)" />
        <SummaryCard label="Active (24h)" value={activeToday}      color="#3fb950" />
        <SummaryCard label="With Critical" value={withCritical}    color="#f85149" />
      </div>

      {/* Device type filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* All pill */}
        <button onClick={() => setTypeFilter('All')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.15s',
          border: `1px solid ${typeFilter === 'All' ? 'var(--accent)' : 'var(--border)'}`,
          background: typeFilter === 'All' ? 'var(--accent-muted)' : 'var(--bg-secondary)',
          color: typeFilter === 'All' ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          <Monitor size={12} />
          All
          <span style={{
            background: typeFilter === 'All' ? 'rgba(0,212,170,0.2)' : 'var(--bg-tertiary)',
            borderRadius: 10, padding: '0 6px', fontSize: 11,
          }}>{annotated.length}</span>
        </button>

        {/* One pill per device type that has at least one endpoint */}
        {Object.keys(DEVICE_TYPES).map(dt => {
          const count = typeCounts[dt] || 0;
          if (count === 0) return null;
          return (
            <TypePill key={dt} deviceType={dt} count={count}
                      active={typeFilter === dt}
                      onClick={() => setTypeFilter(typeFilter === dt ? 'All' : dt)} />
          );
        })}
      </div>

      {/* Search */}
      <div className="events-search-row" style={{ marginBottom: 16 }}>
        <div className="search-wrapper" style={{ flex: 1, maxWidth: 420 }}>
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name, source, or device type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
          {filtered.length} endpoint{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {loading && annotated.length === 0 ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Monitor size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>
            {search || typeFilter !== 'All'
              ? 'No endpoints match your filter.'
              : 'No endpoints yet — events with a source_host or user_name will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Device Type</th>
                <th>Source</th>
                <th style={{ textAlign: 'right' }}>Events</th>
                <th>Last Seen</th>
                <th>First Seen</th>
                <th>Severity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(ep => {
                const meta  = DEVICE_TYPES[ep.deviceType] || DEVICE_TYPES.Unknown;
                const Icon  = meta.icon;
                const isUser = ep.entity_kind === 'user';
                return (
                  <tr key={`${ep.entity_kind}:${ep.host}`}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}>
                      {ep.host}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12, color: meta.color, fontWeight: 500,
                      }}>
                        <Icon size={13} />
                        {ep.deviceType}
                      </span>
                    </td>
                    <td>
                      <span className={`badge source ${SOURCE_CLASS[ep.source_type] || 'unknown'}`}>
                        {ep.source_type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13 }}>
                      {formatNumber(ep.event_count)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                        title={formatTs(ep.last_seen)}>
                      {timeAgo(ep.last_seen)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                        title={formatTs(ep.first_seen)}>
                      {timeAgo(ep.first_seen)}
                    </td>
                    <td>
                      <SeverityBar
                        critical={ep.critical_count} error={ep.error_count}
                        warning={ep.warning_count}   info={ep.info_count}
                      />
                    </td>
                    <td>
                      <button className="btn-link"
                              onClick={() => navigate(
                                isUser
                                  ? `/events?user_name=${encodeURIComponent(ep.host)}`
                                  : `/events?source_host=${encodeURIComponent(ep.host)}`
                              )}
                              title="View events">
                        <ExternalLink size={13} /> Events
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
