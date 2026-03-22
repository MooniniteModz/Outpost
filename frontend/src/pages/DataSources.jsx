import { useState, useEffect } from 'react';
import {
  Cloud, Shield, Server, Monitor, Terminal,
  CheckCircle, XCircle, RefreshCw, ExternalLink, Activity
} from 'lucide-react';
import { api } from '../api';

const SOURCES = [
  {
    id: 'syslog',
    name: 'Syslog',
    icon: <Terminal size={20} />,
    desc: 'UDP/TCP syslog listener for network devices, servers, and applications.',
    type: 'listener',
    color: 'var(--green)',
    bgColor: 'var(--green-muted)',
    details: 'Listening on ports 5514 (UDP/TCP). Supports RFC 3164 and RFC 5424 formats.',
  },
  {
    id: 'fortigate',
    name: 'FortiGate',
    icon: <Shield size={20} />,
    desc: 'Fortinet FortiGate firewall logs via syslog key-value format.',
    type: 'parser',
    color: 'var(--orange)',
    bgColor: 'var(--orange-muted)',
    details: 'Parses FortiGate KV-format logs with traffic, UTM, and event subtypes.',
  },
  {
    id: 'windows',
    name: 'Windows Events',
    icon: <Monitor size={20} />,
    desc: 'Windows Security/System event logs forwarded via syslog (XML format).',
    type: 'parser',
    color: '#79c0ff',
    bgColor: 'var(--blue-muted)',
    details: 'Supports EventIDs 4624, 4625, 4648, 4672, 4720, 4732, 7045, 1102, and more.',
  },
  {
    id: 'm365',
    name: 'Microsoft 365',
    icon: <Cloud size={20} />,
    desc: 'Office 365 Management Activity API for Azure AD, Exchange, SharePoint, and Teams audit logs.',
    type: 'api',
    color: 'var(--purple)',
    bgColor: 'var(--purple-muted)',
    configKey: 'm365',
    details: 'Polls Azure AD, Exchange, SharePoint, and General content types via OAuth2.',
  },
  {
    id: 'azure',
    name: 'Azure Monitor',
    icon: <Server size={20} />,
    desc: 'Azure Activity Log API for management plane events (VM changes, NSG rules, role assignments).',
    type: 'api',
    color: 'var(--blue)',
    bgColor: 'var(--blue-muted)',
    configKey: 'azure',
    details: 'Queries Azure Resource Manager activity logs with time-windowed polling.',
  },
];

export default function DataSources() {
  const [health, setHealth] = useState(null);
  const [sources, setSources] = useState([]);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [h, src, integ] = await Promise.all([
          api.health(),
          api.sources().catch(() => []),
          fetch('/api/integrations').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (cancelled) return;
        setHealth(h);
        setSources(src);
        setIntegrations(integ);
      } catch {}
      if (!cancelled) setLoading(false);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) return (
    <div className="loading"><div className="loading-spinner" /><div>Loading data sources...</div></div>
  );

  // Build count map from sources
  const countMap = {};
  if (Array.isArray(sources)) {
    sources.forEach(([name, count]) => { countMap[name?.toLowerCase()] = count; });
  }

  function getStatus(source) {
    if (source.type === 'api') {
      const cfg = integrations?.[source.configKey];
      if (!cfg) return { label: 'Not configured', ok: false };
      if (cfg.enabled) return { label: 'Active', ok: true };
      return { label: 'Disabled', ok: false };
    }
    // Listeners and parsers are always active when backend is running
    return health ? { label: 'Active', ok: true } : { label: 'Offline', ok: false };
  }

  function getEventCount(source) {
    if (source.type === 'api' && integrations?.[source.configKey]) {
      return integrations[source.configKey].events_collected ?? 0;
    }
    return countMap[source.id] || countMap[source.name?.toLowerCase()] || 0;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Data Sources</h1>
          <div className="subtitle">Manage and monitor all ingestion sources</div>
        </div>
        <a href="/settings" className="btn-secondary">
          <Activity size={14} /> Configure Integrations
        </a>
      </div>

      <div className="stats-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 24}}>
        <div className="stat-card">
          <div className="label">Active Sources</div>
          <div className="value green">{SOURCES.filter(s => getStatus(s).ok).length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Sources</div>
          <div className="value">{SOURCES.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Events Today</div>
          <div className="value accent">{(health?.events_stored_today ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <div style={{display: 'grid', gap: 12}}>
        {SOURCES.map(source => {
          const status = getStatus(source);
          const eventCount = getEventCount(source);
          return (
            <div key={source.id} className="integration-card" style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'flex-start', gap: 16}}>
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 'var(--radius-md)',
                  background: source.bgColor, color: source.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {source.icon}
                </div>

                {/* Content */}
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                      <h3 style={{fontSize: 15, fontWeight: 600, color: 'var(--text-primary)'}}>{source.name}</h3>
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        padding: '2px 8px', borderRadius: 10,
                        background: source.type === 'api' ? 'var(--purple-muted)' : source.type === 'listener' ? 'var(--green-muted)' : 'var(--blue-muted)',
                        color: source.type === 'api' ? 'var(--purple)' : source.type === 'listener' ? 'var(--green)' : 'var(--blue)',
                      }}>
                        {source.type}
                      </span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 13}}>
                      {status.ok
                        ? <><CheckCircle size={14} style={{color: 'var(--green)'}} /><span style={{color: 'var(--green)'}}>{status.label}</span></>
                        : <><XCircle size={14} style={{color: 'var(--text-muted)'}} /><span style={{color: 'var(--text-muted)'}}>{status.label}</span></>
                      }
                    </div>
                  </div>

                  <p style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5}}>
                    {source.desc}
                  </p>

                  <div style={{display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-muted)'}}>
                    <span>Events: <strong style={{color: 'var(--text-primary)', fontFamily: 'var(--mono)'}}>{eventCount.toLocaleString()}</strong></span>
                    <span>{source.details}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
