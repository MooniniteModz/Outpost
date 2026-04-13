import { useState, useEffect } from 'react';
import {
  Plus, Terminal, Cloud, Server, Database as DbIcon,
  CheckCircle, XCircle, Trash2, Edit3, Activity, Wifi, WifiOff,
  Loader, ChevronRight, ChevronLeft, Info, Radio, Zap
} from 'lucide-react';
import { api } from '../api';

// ── Integration catalog ──────────────────────────────────────────────────────

const CATALOG = [
  {
    id: 'microsoft',
    label: 'Microsoft Cloud',
    description: 'Azure Monitor, Entra ID sign-in logs, and Microsoft 365 audit logs using dedicated high-fidelity pollers.',
    color: '#00a4ef',
    Icon: Cloud,
    products: [
      {
        id: 'azure_monitor',
        name: 'Azure Monitor', vendor: 'Microsoft',
        description: 'Activity Logs and Entra ID sign-in events with geolocation',
        type: 'azure_monitor', source_label: 'azure',
        defaults: { enabled: true, tenant_id: '', client_id: '', client_secret: '', subscription_id: '', poll_interval_sec: 60 },
        instructions: 'Azure Portal → Entra ID → App Registrations → New Registration\n• Note the Tenant ID and Application (client) ID\n• Certificates & Secrets → New client secret → copy value\n• IAM → Add role assignment → Monitoring Reader (subscription scope)\n• For sign-in logs: Entra ID → Roles → Security Reader',
      },
      {
        id: 'm365',
        name: 'Microsoft 365', vendor: 'Microsoft',
        description: 'Office 365 audit logs — Exchange, SharePoint, Teams, Azure AD',
        type: 'm365', source_label: 'm365',
        defaults: { enabled: true, tenant_id: '', client_id: '', client_secret: '', poll_interval_sec: 60 },
        instructions: 'Azure Portal → App Registrations → your app → API Permissions\n• Add: Office 365 Management APIs → ActivityFeed.Read (Application)\n• Grant admin consent\n• Certificates & Secrets → New client secret → copy value',
      },
    ],
  },
  {
    id: 'cef_syslog',
    label: 'Syslog / CEF',
    description: 'Receive events pushed by security devices over syslog. Supports CEF, RFC 3164, and RFC 5424.',
    color: '#3fb950',
    Icon: Terminal,
    products: [
      { id: 'fortigate',      name: 'FortiGate',          vendor: 'Fortinet',       description: 'Firewall, IPS, and UTM events',               type: 'syslog', source_label: 'fortigate',    defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'FortiGate → Log & Report → Log Settings → Remote Logging\n• Server IP: [your-outpost-ip]  Port: 5514  Protocol: UDP' },
      { id: 'sentinelone_cef',name: 'SentinelOne',        vendor: 'SentinelOne',    description: 'EDR detections via CEF syslog',               type: 'syslog', source_label: 'sentinelone', defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'SentinelOne → Settings → Integrations → Syslog\n• Host: [your-outpost-ip]  Port: 5514  Format: CEF' },
      { id: 'paloalto_cef',   name: 'Palo Alto Networks', vendor: 'Palo Alto',      description: 'NGFW and Prisma Access via CEF',              type: 'syslog', source_label: 'paloalto',    defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'Device → Server Profiles → Syslog → Add\n• IP: [your-outpost-ip]  Port: 5514  Format: CEF' },
      { id: 'cisco_cef',      name: 'Cisco ASA / FTD',   vendor: 'Cisco',           description: 'Cisco firewall and threat defense',           type: 'syslog', source_label: 'cisco',        defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'ASA: logging host [interface] [your-outpost-ip] udp/5514\nFTD: FMC → Platform Settings → Syslog → Syslog Servers' },
      { id: 'checkpoint_cef', name: 'Check Point',        vendor: 'Check Point',    description: 'Gateway logs via CEF syslog',                 type: 'syslog', source_label: 'checkpoint',   defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'SmartConsole → Logs & Monitor → External Log Servers\n• Add [your-outpost-ip]:5514  Format: CEF' },
      { id: 'sophos_cef',     name: 'Sophos XG / XGS',   vendor: 'Sophos',          description: 'Sophos firewall events',                      type: 'syslog', source_label: 'sophos',       defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'System Services → Log Settings → Add syslog server\n• [your-outpost-ip]  Port: 5514  Facility: LOCAL0' },
      { id: 'crowdstrike_cef',name: 'CrowdStrike',        vendor: 'CrowdStrike',     description: 'Falcon detections via CEF streaming',         type: 'syslog', source_label: 'crowdstrike',  defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'Support → API Clients → SIEM Connector\n• Destination: [your-outpost-ip]:5514  Format: CEF' },
      { id: 'unifi_syslog',   name: 'UniFi',              vendor: 'Ubiquiti',        description: 'Network and security events',                 type: 'syslog', source_label: 'unifi',        defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'Settings → System → Remote Logging\n• Syslog Host: [your-outpost-ip]  Port: 5514' },
      { id: 'generic_cef',    name: 'Generic Syslog/CEF', vendor: null,              description: 'Any CEF-compatible device',                   type: 'syslog', source_label: '',             defaults: { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' }, instructions: 'Point your device syslog output to:\n• Host: [your-outpost-ip]  Port: 5514  Protocol: UDP or TCP' },
    ],
  },
  {
    id: 'rest_api',
    label: 'REST API / API Key',
    description: 'Poll security APIs on a schedule using API keys, Bearer tokens, or OAuth2.',
    color: '#58a6ff',
    Icon: Zap,
    products: [
      { id: 'sentinelone_api', name: 'SentinelOne',   vendor: 'SentinelOne', description: 'Threats & alerts via REST API',          type: 'rest_api', source_label: 'sentinelone', defaults: { url: 'https://YOUR_CONSOLE.sentinelone.net/web/api/v2.1/threats', auth_type: 'apikey', api_key_header: 'Authorization', api_key: 'ApiToken ', poll_interval_sec: 60 }, instructions: 'Settings → Users → Service Users → Create\n• Role: Viewer  Copy the API Token\n• Prefix token value with: ApiToken <your-token>' },
      { id: 'crowdstrike_api', name: 'CrowdStrike',   vendor: 'CrowdStrike', description: 'Falcon detections via OAuth2 API',       type: 'rest_api', source_label: 'crowdstrike', defaults: { url: 'https://api.crowdstrike.com/detects/queries/detects/v1', auth_type: 'oauth2', client_id: '', client_secret: '', poll_interval_sec: 60 }, instructions: 'Support → API Clients → Create\n• Scope: Detections Read\n• Copy Client ID and Client Secret below' },
      { id: 'okta_api',        name: 'Okta',           vendor: 'Okta',        description: 'Identity events from Okta System Log',   type: 'rest_api', source_label: 'okta',        defaults: { url: 'https://YOUR_ORG.okta.com/api/v1/logs', auth_type: 'apikey', api_key_header: 'Authorization', api_key: 'SSWS ', poll_interval_sec: 60 }, instructions: 'Security → API → Tokens → Create\n• Role: Read-Only Admin\n• Prefix token: SSWS <your-token>' },
      { id: 'duo_api',         name: 'Duo Security',   vendor: 'Duo',         description: 'MFA authentication log events',          type: 'rest_api', source_label: 'duo',         defaults: { url: 'https://api-XXXXXXXX.duosecurity.com/admin/v2/logs/authentication', auth_type: 'basic', username: '', password: '', poll_interval_sec: 120 }, instructions: 'Admin Panel → Applications → Admin API\n• Integration Key = username\n• Secret Key = password' },
      { id: 'generic_api',     name: 'Generic REST API', vendor: null,        description: 'Any REST API endpoint',                  type: 'rest_api', source_label: '',             defaults: { url: '', auth_type: 'apikey', api_key: '', api_key_header: 'X-API-Key', poll_interval_sec: 60 }, instructions: 'Enter the endpoint URL and authentication method.\nOutpost will poll on the configured interval.' },
    ],
  },
  {
    id: 'hec',
    label: 'HEC Push',
    description: 'Accept events pushed by forwarders using the Splunk-compatible HTTP Event Collector protocol.',
    color: '#d29922',
    Icon: Server,
    products: [
      { id: 'hec_universal', name: 'HEC Forwarder', vendor: null, description: 'Splunk UF, Cribl, or any HEC-compatible forwarder', type: 'hec', source_label: '', defaults: {}, instructions: 'HEC is always on at port 8080.\n• URL: http://[outpost-ip]:8080/services/collector\n• Token: see Settings → HEC Token\n• Content-Type: application/json' },
    ],
  },
  {
    id: 'snmp',
    label: 'SNMP Traps',
    description: 'Receive SNMP v2c/v3 trap notifications from network devices.',
    color: '#bc8cff',
    Icon: Radio,
    products: [
      { id: 'snmp_v2c', name: 'SNMP v2c', vendor: null, description: 'Community string authentication', type: 'snmp', source_label: 'snmp', defaults: { version: 'v2c', port: 162, community: 'public' }, instructions: 'Send SNMP traps to [your-outpost-ip]:162\n• Version: 2c  Community: public', comingSoon: true },
      { id: 'snmp_v3',  name: 'SNMP v3',  vendor: null, description: 'User-based security model',       type: 'snmp', source_label: 'snmp', defaults: { version: 'v3',  port: 162 },                       instructions: 'Send SNMP v3 traps to [your-outpost-ip]:162',                            comingSoon: true },
    ],
  },
  {
    id: 'kafka',
    label: 'Kafka / Event Hub',
    description: 'Consume security events from Apache Kafka topics or Azure Event Hub.',
    color: '#db6d28',
    Icon: DbIcon,
    products: [
      { id: 'kafka_generic',   name: 'Apache Kafka',     vendor: null,        description: 'Consume from any Kafka topic',             type: 'kafka', source_label: '',      defaults: { brokers: '', topic: 'security-events', group_id: 'outpost', sasl_enabled: false, ssl: false }, instructions: 'Provide bootstrap brokers and topic name.' },
      { id: 'kafka_azure_hub', name: 'Azure Event Hub',  vendor: 'Microsoft', description: 'Azure Event Hub via Kafka-compatible endpoint', type: 'kafka', source_label: 'azure', defaults: { brokers: 'YOUR_NAMESPACE.servicebus.windows.net:9093', topic: '', group_id: 'outpost', sasl_enabled: true, sasl_username: '$ConnectionString', sasl_password: '', ssl: true }, instructions: 'Event Hub Namespace → Shared Access Policies\n• Copy the connection string as SASL Password' },
    ],
  },
];

const TYPE_DISPLAY = {
  syslog:        { label: 'Syslog',        color: '#3fb950' },
  rest_api:      { label: 'REST API',      color: '#58a6ff' },
  webhook:       { label: 'Webhook',       color: '#58a6ff' },
  file_log:      { label: 'File Log',      color: '#d29922' },
  kafka:         { label: 'Kafka',         color: '#db6d28' },
  hec:           { label: 'HEC',           color: '#d29922' },
  snmp:          { label: 'SNMP',          color: '#bc8cff' },
  azure_monitor: { label: 'Azure Monitor', color: '#00a4ef' },
  m365:          { label: 'Microsoft 365', color: '#00a4ef' },
};

const STATUS_COLORS = { running: 'var(--green)', stopped: 'var(--text-muted)', error: 'var(--red)' };

// Finds the catalog product entry for a saved connector
function findProduct(type, sourceLabel) {
  for (const cat of CATALOG) {
    const p = cat.products.find(p => p.type === type && (p.source_label === sourceLabel || (!sourceLabel && !p.source_label)));
    if (p) return { cat, prod: p };
  }
  return null;
}

function VendorBadge({ name, color, size = 40 }) {
  const initials = (name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.25, flexShrink: 0, background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>
      {initials}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DataSources() {
  const [connectors, setConnectors]       = useState([]);
  const [legacyIntegrations, setLegacy]   = useState(null); // { azure: {...}, m365: {...} }
  const [health, setHealth]               = useState(null);
  const [loading, setLoading]             = useState(true);

  // Wizard
  const [step, setStep]                   = useState(0);
  const [selectedCat, setSelectedCat]     = useState(null);
  const [selectedProd, setSelectedProd]   = useState(null);
  const [connName, setConnName]           = useState('');
  const [settings, setSettings]           = useState({});
  const [editId, setEditId]               = useState(null);   // connector DB id (null for legacy)
  const [editLegacyKey, setEditLegacyKey] = useState(null);   // 'azure' | 'm365' | null

  // Test / save
  const [testResult, setTestResult]       = useState(null);
  const [testing, setTesting]             = useState(false);
  const [saving, setSaving]               = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget]   = useState(null);

  async function load() {
    try {
      const [data, h, integs] = await Promise.all([
        api.connectors(),
        api.health().catch(() => null),
        api.integrations().catch(() => null),
      ]);
      setConnectors(data.connectors || []);
      setHealth(h);
      setLegacy(integs);
    } catch { setConnectors([]); }
    setLoading(false);
  }

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  // ── Wizard navigation ──
  function startAdd() {
    setStep(1); setSelectedCat(null); setSelectedProd(null);
    setConnName(''); setSettings({}); setEditId(null); setEditLegacyKey(null); setTestResult(null);
  }

  function selectCategory(cat) { setSelectedCat(cat); setStep(2); }

  function selectProduct(prod) {
    setSelectedProd(prod);
    const name = prod.vendor ? `${prod.vendor} ${prod.name}` : prod.name;
    setConnName(name);
    setSettings({ ...prod.defaults });
    setTestResult(null);
    setStep(3);
  }

  // Edit a connector DB entry
  function startEditConnector(c) {
    const found = findProduct(c.type, c.settings?.source_label || '');
    setSelectedCat(found?.cat || null);
    setSelectedProd(found?.prod || { type: c.type, defaults: {}, instructions: '', name: c.type });
    setEditId(c.id);
    setEditLegacyKey(null);
    setConnName(c.name);
    setSettings(c.settings || {});
    setTestResult(null);
    setStep(3);
  }

  // Edit a legacy integration (azure / m365)
  function startEditLegacy(key) {
    const catEntry = CATALOG.find(c => c.id === 'microsoft');
    const prodEntry = catEntry?.products.find(p => p.id === key || p.type === key);
    setSelectedCat(catEntry || null);
    setSelectedProd(prodEntry || { type: key, defaults: {}, instructions: '', name: key });
    setEditId(null);
    setEditLegacyKey(key);
    setConnName(key === 'azure_monitor' || key === 'azure' ? 'Azure Monitor' : 'Microsoft 365');
    setSettings({ ...(legacyIntegrations?.[key === 'azure_monitor' ? 'azure' : key] || {}) });
    setTestResult(null);
    setStep(3);
  }

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    const type = selectedProd?.type;
    try {
      if (type === 'azure_monitor' || type === 'm365') {
        // Legacy dedicated poller — save via integrations API
        const key = type === 'azure_monitor' ? 'azure' : 'm365';
        const existing = legacyIntegrations || {};
        await api.saveIntegrations({
          azure: key === 'azure' ? settings : (existing.azure || {}),
          m365:  key === 'm365'  ? settings : (existing.m365  || {}),
        });
      } else if (editId) {
        await api.updateConnector({ id: editId, name: connName, type, settings });
      } else {
        await api.createConnector({ name: connName, type, enabled: true, settings });
      }
      setStep(0); setEditId(null); setEditLegacyKey(null); load();
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    }
    setSaving(false);
  }

  // ── Test connection ──
  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      const r = await api.testConnector(settings);
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    }
    setTesting(false);
  }

  // ── Delete ──
  function confirmDelete(c) {
    setDeleteTarget({ id: c.id, name: c.name, source_label: c.settings?.source_label || '', event_count: c.event_count || 0 });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await api.deleteConnector(deleteTarget.id);
    const label = deleteTarget.source_label || result?.source_label;
    if (label) {
      try {
        const saved = JSON.parse(localStorage.getItem('outpost_saved_searches') || '[]');
        localStorage.setItem('outpost_saved_searches', JSON.stringify(saved.filter(s => s.filters?.source_type !== label)));
      } catch {}
    }
    setDeleteTarget(null); load();
  }

  async function toggleEnabled(c) {
    await api.updateConnector({ id: c.id, enabled: !c.enabled, status: !c.enabled ? 'running' : 'stopped' });
    load();
  }

  async function toggleLegacy(key) {
    const legacyKey = key === 'azure_monitor' ? 'azure' : key;
    const updated = { ...(legacyIntegrations || {}) };
    updated[legacyKey] = { ...(updated[legacyKey] || {}), enabled: !updated[legacyKey]?.enabled };
    await api.saveIntegrations({ azure: updated.azure || {}, m365: updated.m365 || {} });
    load();
  }

  if (loading) return <div className="loading"><div className="loading-spinner" /><div>Loading...</div></div>;

  // ── Counts ──
  const activeConnectors = connectors.filter(c => c.enabled).length;
  const activeLegacy = [legacyIntegrations?.azure, legacyIntegrations?.m365].filter(i => i?.enabled).length;
  const totalActive = activeConnectors + activeLegacy;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Integrations</h1>
          <div className="subtitle">Configure data sources — Microsoft Cloud, Syslog/CEF, REST API, HEC, SNMP, and Kafka</div>
        </div>
        {step === 0 && <button className="btn-primary" onClick={startAdd}><Plus size={14} /> Add Integration</button>}
      </div>

      {/* Stats */}
      {step === 0 && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginBottom: 24 }}>
          <div className="stat-card"><div className="label">Active</div><div className="value green">{totalActive}</div></div>
          <div className="stat-card"><div className="label">Total</div><div className="value">{connectors.length + (legacyIntegrations ? 2 : 0)}</div></div>
          <div className="stat-card"><div className="label">Events Today</div><div className="value accent">{(health?.events_stored_today ?? 0).toLocaleString()}</div></div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: 420, maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: 8 }}>Delete Integration</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong>?</p>
            {deleteTarget.event_count > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(248,81,73,0.08)', border: '1px solid var(--red)', fontSize: 13, color: 'var(--red)' }}>
                Permanently deletes <strong>{deleteTarget.event_count.toLocaleString()}</strong> events from <code style={{ fontFamily: 'var(--mono)' }}>{deleteTarget.source_label || deleteTarget.name}</code>.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Category ── */}
      {step === 1 && (
        <div>
          <WizardNav step={1} onBack={() => setStep(0)} label="Choose integration type" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
            {CATALOG.map(cat => (
              <button key={cat.id} onClick={() => selectCategory(cat)}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s,background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: cat.color + '22', border: `1px solid ${cat.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color, flexShrink: 0 }}><cat.Icon size={20} /></div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: cat.color, marginTop: 2 }}>{cat.products.length} source{cat.products.length !== 1 ? 's' : ''}</div>
                  </div>
                  <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{cat.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Product ── */}
      {step === 2 && selectedCat && (
        <div>
          <WizardNav step={2} onBack={() => setStep(1)} label="Choose product" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: selectedCat.color + '22', border: `1px solid ${selectedCat.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedCat.color }}><selectedCat.Icon size={16} /></div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedCat.label}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
            {selectedCat.products.map(prod => (
              <button key={prod.id} onClick={() => !prod.comingSoon && selectProduct(prod)} disabled={prod.comingSoon}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, textAlign: 'left', cursor: prod.comingSoon ? 'not-allowed' : 'pointer', opacity: prod.comingSoon ? 0.5 : 1, transition: 'border-color 0.15s' }}
                onMouseEnter={e => { if (!prod.comingSoon) e.currentTarget.style.borderColor = selectedCat.color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <VendorBadge name={prod.name} color={selectedCat.color} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.name}</div>
                    {prod.vendor && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{prod.vendor}</div>}
                  </div>
                  {prod.comingSoon && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Soon</span>}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{prod.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Configure ── */}
      {step === 3 && selectedProd && (
        <div>
          <WizardNav step={3} onBack={() => setStep(editId || editLegacyKey ? 0 : 2)} label={editId || editLegacyKey ? 'Edit integration' : 'Configure'} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 20, alignItems: 'start' }}>

            {/* Form */}
            <div className="settings-section" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <VendorBadge name={selectedProd.name} color={selectedCat?.color || '#58a6ff'} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedProd.name}</div>
                  {selectedProd.vendor && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedProd.vendor}</div>}
                </div>
              </div>

              {selectedProd.type !== 'azure_monitor' && selectedProd.type !== 'm365' && selectedProd.type !== 'hec' && (
                <div className="field"><label>Integration Name</label><input type="text" value={connName} onChange={e => setConnName(e.target.value)} placeholder="e.g. HQ FortiGate" /></div>
              )}

              {selectedProd.type === 'azure_monitor' && <AzureMonitorForm settings={settings} onChange={setSettings} />}
              {selectedProd.type === 'm365'           && <M365Form          settings={settings} onChange={setSettings} />}
              {selectedProd.type === 'syslog'         && <SyslogForm        settings={settings} onChange={setSettings} />}
              {selectedProd.type === 'rest_api'       && <RestApiForm       settings={settings} onChange={setSettings} />}
              {selectedProd.type === 'kafka'          && <KafkaForm         settings={settings} onChange={setSettings} />}
              {selectedProd.type === 'hec'            && <HecInfo />}
              {selectedProd.type === 'snmp'           && <SnmpForm          settings={settings} onChange={setSettings} />}

              {testResult && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: testResult.ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)', border: `1px solid ${testResult.ok ? 'var(--green)' : 'var(--red)'}`, color: testResult.ok ? 'var(--green)' : 'var(--red)' }}>
                  {testResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader size={14} className="spin" /> Saving…</> : editId || editLegacyKey ? 'Update Integration' : 'Add Integration'}
                </button>
                {selectedProd.type === 'rest_api' && (
                  <button className="btn-secondary" onClick={handleTest} disabled={testing || !settings.url}>
                    {testing ? <><Loader size={14} className="spin" /> Testing…</> : <><Wifi size={14} /> Test Connection</>}
                  </button>
                )}
              </div>
            </div>

            {/* Instructions */}
            {selectedProd.instructions && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, position: 'sticky', top: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--blue)', fontSize: 13, fontWeight: 600 }}><Info size={15} /> Setup Instructions</div>
                <pre style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>{selectedProd.instructions}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Connector list ── */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* System ingestion points */}
          <Section title="System Ingestion Points" subtitle="Always-on built-in listeners">
            <ConnectorCard
              name="Syslog Listener"
              typeLabel="Syslog / CEF"
              typeColor="#3fb950"
              statusLabel="Running"
              statusColor="var(--green)"
              meta={`UDP ${health?.syslog_udp_port || 5514} / TCP ${health?.syslog_tcp_port || 5514} · CEF + RFC3164/5424`}
              onEdit={() => {
                const cat = CATALOG.find(c => c.id === 'cef_syslog');
                const prod = cat.products.find(p => p.id === 'generic_cef');
                setSelectedCat(cat); setSelectedProd(prod);
                setConnName('Syslog Listener'); setSettings(prod.defaults); setEditId(null); setEditLegacyKey('syslog_system'); setStep(3);
              }}
            />
            <ConnectorCard
              name="HEC Endpoint"
              typeLabel="HEC Push"
              typeColor="#d29922"
              statusLabel="Running"
              statusColor="var(--green)"
              meta={`http://[host]:8080/services/collector · Splunk-compatible`}
              onEdit={() => {
                const cat = CATALOG.find(c => c.id === 'hec');
                const prod = cat.products[0];
                setSelectedCat(cat); setSelectedProd(prod);
                setConnName('HEC Endpoint'); setSettings({}); setEditId(null); setEditLegacyKey('hec_system'); setStep(3);
              }}
            />
          </Section>

          {/* Legacy Microsoft integrations */}
          {legacyIntegrations && (
            <Section title="Microsoft Cloud" subtitle="Dedicated high-fidelity pollers">
              {[
                { key: 'azure', label: 'Azure Monitor', desc: 'Activity Logs + Entra ID sign-in events', color: '#00a4ef', events: legacyIntegrations.azure?.events_collected },
                { key: 'm365',  label: 'Microsoft 365', desc: 'Exchange, SharePoint, Teams, Azure AD logs', color: '#00a4ef', events: legacyIntegrations.m365?.events_collected },
              ].map(({ key, label, desc, color, events }) => {
                const cfg = legacyIntegrations[key] || {};
                const isEnabled = !!cfg.enabled;
                const isConfigured = !!(cfg.tenant_id && cfg.client_id);
                return (
                  <ConnectorCard
                    key={key}
                    name={label}
                    typeLabel={key === 'azure' ? 'Azure Monitor' : 'Microsoft 365'}
                    typeColor={color}
                    statusLabel={isEnabled ? (isConfigured ? 'Running' : 'Needs config') : 'Disabled'}
                    statusColor={isEnabled && isConfigured ? 'var(--green)' : isEnabled ? 'var(--yellow)' : 'var(--text-muted)'}
                    meta={isConfigured ? `Tenant: ${cfg.tenant_id?.slice(0, 8)}…  Poll: ${cfg.poll_interval_sec || 60}s` : desc}
                    eventCount={events}
                    enabled={isEnabled}
                    onToggle={() => toggleLegacy(key === 'azure' ? 'azure_monitor' : 'm365')}
                    onEdit={() => startEditLegacy(key === 'azure' ? 'azure_monitor' : 'm365')}
                  />
                );
              })}
            </Section>
          )}

          {/* Connector DB entries */}
          {connectors.length > 0 && (
            <Section title="Active Connectors" subtitle="Configured integrations">
              {connectors.map(c => {
                const disp = TYPE_DISPLAY[c.type] || { label: c.type, color: 'var(--text-muted)' };
                return (
                  <ConnectorCard
                    key={c.id}
                    name={c.name}
                    typeLabel={disp.label}
                    typeColor={disp.color}
                    statusLabel={c.status === 'running' ? 'Running' : c.enabled ? 'Pending' : 'Stopped'}
                    statusColor={STATUS_COLORS[c.status] || 'var(--text-muted)'}
                    meta={c.settings?.source_label || c.settings?.url || ''}
                    eventCount={c.event_count}
                    enabled={c.enabled}
                    onToggle={() => toggleEnabled(c)}
                    onEdit={() => startEditConnector(c)}
                    onDelete={() => confirmDelete(c)}
                  />
                );
              })}
            </Section>
          )}

          {connectors.length === 0 && !legacyIntegrations && (
            <div className="table-container">
              <div className="empty">
                <div className="empty-icon"><Activity size={40} /></div>
                <p style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>No integrations configured</p>
                <p>Click "Add Integration" to connect your first data source.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function WizardNav({ step, onBack, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={onBack}><ChevronLeft size={14} /> Back</button>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Step {step} of 3 — {label}</span>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  );
}

function ConnectorCard({ name, typeLabel, typeColor, statusLabel, statusColor, meta, eventCount, enabled, onToggle, onEdit, onDelete }) {
  return (
    <div className="integration-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <VendorBadge name={name} color={typeColor} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '1px 7px', borderRadius: 10, background: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44` }}>{typeLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
            {meta && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{meta}</span>}
            {eventCount !== undefined && <span>Events: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--mono)' }}>{Number(eventCount).toLocaleString()}</strong></span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ color: statusColor, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            {statusLabel === 'Running' ? <Wifi size={12} /> : <WifiOff size={12} />} {statusLabel}
          </span>
          {onToggle && (
            <label className="toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={!!enabled} onChange={onToggle} />
              <span className="toggle-slider" />
            </label>
          )}
          {onEdit && <button className="btn-icon" onClick={onEdit} title="Edit settings"><Edit3 size={13} /></button>}
          {onDelete && <button className="btn-icon danger" onClick={onDelete} title="Delete"><Trash2 size={13} /></button>}
        </div>
      </div>
    </div>
  );
}

// ── Config forms ──────────────────────────────────────────────────────────────

function Field({ label, children, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function TInput({ label, value, onChange, type = 'text', placeholder = '', hint }) {
  return (
    <Field label={label} hint={hint}>
      <input type={type} value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value)} />
    </Field>
  );
}

function LocationSection({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Location (Globe)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="Latitude"><input type="number" step="any" value={settings.latitude ?? ''} placeholder="40.7128" onChange={e => set('latitude', e.target.value === '' ? undefined : parseFloat(e.target.value))} /></Field>
        <Field label="Longitude"><input type="number" step="any" value={settings.longitude ?? ''} placeholder="-74.0060" onChange={e => set('longitude', e.target.value === '' ? undefined : parseFloat(e.target.value))} /></Field>
      </div>
      <TInput label="Location Label" value={settings.location_label} onChange={v => set('location_label', v)} placeholder="e.g. New York Office" />
    </div>
  );
}

function AzureMonitorForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Enable Azure Monitor polling</span>
      <label className="toggle" style={{ margin: 0 }}>
        <input type="checkbox" checked={!!settings.enabled} onChange={e => set('enabled', e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
    <TInput label="Tenant ID"       value={settings.tenant_id}       onChange={v => set('tenant_id', v)}       placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
    <TInput label="Client ID"       value={settings.client_id}       onChange={v => set('client_id', v)}       placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
    <TInput label="Client Secret"   value={settings.client_secret}   onChange={v => set('client_secret', v)}   type="password" placeholder="Enter client secret" />
    <TInput label="Subscription ID" value={settings.subscription_id} onChange={v => set('subscription_id', v)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" hint="Required for Activity Log. Leave blank for sign-in logs only." />
    <TInput label="Poll Interval (seconds)" value={settings.poll_interval_sec} onChange={v => set('poll_interval_sec', v)} type="number" />
  </>);
}

function M365Form({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Enable Microsoft 365 polling</span>
      <label className="toggle" style={{ margin: 0 }}>
        <input type="checkbox" checked={!!settings.enabled} onChange={e => set('enabled', e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
    <TInput label="Tenant ID"     value={settings.tenant_id}     onChange={v => set('tenant_id', v)}     placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
    <TInput label="Client ID"     value={settings.client_id}     onChange={v => set('client_id', v)}     placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
    <TInput label="Client Secret" value={settings.client_secret} onChange={v => set('client_secret', v)} type="password" placeholder="Enter client secret" />
    <TInput label="Poll Interval (seconds)" value={settings.poll_interval_sec} onChange={v => set('poll_interval_sec', v)} type="number" />
  </>);
}

function SyslogForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <TInput label="Bind Address" value={settings.bind_address} onChange={v => set('bind_address', v)} placeholder="0.0.0.0" />
    <TInput label="UDP Port"     value={settings.udp_port}     onChange={v => set('udp_port', v)}     type="number" />
    <TInput label="TCP Port"     value={settings.tcp_port}     onChange={v => set('tcp_port', v)}     type="number" />
    <Field label="Format">
      <select value={settings.format || 'auto'} onChange={e => set('format', e.target.value)}>
        <option value="auto">Auto-detect</option>
        <option value="cef">CEF (Common Event Format)</option>
        <option value="rfc3164">RFC 3164</option>
        <option value="rfc5424">RFC 5424</option>
      </select>
    </Field>
    <TInput label="Source Label" value={settings.source_label} onChange={v => set('source_label', v)} placeholder="e.g. fortigate, sentinelone" />
    <LocationSection settings={settings} onChange={onChange} />
  </>);
}

function RestApiForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <TInput label="Endpoint URL" value={settings.url} onChange={v => set('url', v)} placeholder="https://api.example.com/events" />
    <Field label="Authentication">
      <select value={settings.auth_type || 'apikey'} onChange={e => set('auth_type', e.target.value)}>
        <option value="apikey">API Key</option>
        <option value="bearer">Bearer Token</option>
        <option value="oauth2">OAuth2 Client Credentials</option>
        <option value="basic">Basic Auth</option>
        <option value="none">None</option>
      </select>
    </Field>
    {settings.auth_type === 'apikey' && (<>
      <TInput label="API Key"     value={settings.api_key}        onChange={v => set('api_key', v)}        type="password" />
      <TInput label="Header Name" value={settings.api_key_header} onChange={v => set('api_key_header', v)} placeholder="X-API-Key" />
    </>)}
    {settings.auth_type === 'bearer' && <TInput label="Bearer Token" value={settings.bearer_token} onChange={v => set('bearer_token', v)} type="password" />}
    {settings.auth_type === 'oauth2' && (<>
      <TInput label="Tenant ID"     value={settings.tenant_id}     onChange={v => set('tenant_id', v)}     placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      <TInput label="Client ID"     value={settings.client_id}     onChange={v => set('client_id', v)}     placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      <TInput label="Client Secret" value={settings.client_secret} onChange={v => set('client_secret', v)} type="password" />
    </>)}
    {settings.auth_type === 'basic' && (<>
      <TInput label="Username" value={settings.username} onChange={v => set('username', v)} />
      <TInput label="Password" value={settings.password} onChange={v => set('password', v)} type="password" />
    </>)}
    <TInput label="Poll Interval (seconds)" value={settings.poll_interval_sec} onChange={v => set('poll_interval_sec', v)} type="number" />
    <TInput label="Source Label" value={settings.source_label} onChange={v => set('source_label', v)} placeholder="e.g. sentinelone, crowdstrike" />
    <LocationSection settings={settings} onChange={onChange} />
  </>);
}

function KafkaForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <TInput label="Bootstrap Brokers" value={settings.brokers}  onChange={v => set('brokers', v)}  placeholder="broker1:9092,broker2:9092" />
    <TInput label="Topic"             value={settings.topic}    onChange={v => set('topic', v)}    placeholder="security-events" />
    <TInput label="Consumer Group"    value={settings.group_id} onChange={v => set('group_id', v)} placeholder="outpost" />
    <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ marginBottom: 0 }}>SASL Auth</label>
      <label className="toggle" style={{ margin: 0 }}><input type="checkbox" checked={settings.sasl_enabled ?? false} onChange={e => set('sasl_enabled', e.target.checked)} /><span className="toggle-slider" /></label>
    </div>
    {settings.sasl_enabled && (<>
      <TInput label="SASL Username" value={settings.sasl_username} onChange={v => set('sasl_username', v)} />
      <TInput label="SASL Password" value={settings.sasl_password} onChange={v => set('sasl_password', v)} type="password" />
    </>)}
    <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ marginBottom: 0 }}>SSL / TLS</label>
      <label className="toggle" style={{ margin: 0 }}><input type="checkbox" checked={settings.ssl ?? false} onChange={e => set('ssl', e.target.checked)} /><span className="toggle-slider" /></label>
    </div>
    <TInput label="Source Label" value={settings.source_label} onChange={v => set('source_label', v)} placeholder="e.g. azure, kafka" />
  </>);
}

function SnmpForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <Field label="SNMP Version">
      <select value={settings.version || 'v2c'} onChange={e => set('version', e.target.value)}>
        <option value="v2c">v2c (Community String)</option>
        <option value="v3">v3 (User-Based Security)</option>
      </select>
    </Field>
    <TInput label="Trap Port" value={settings.port} onChange={v => set('port', v)} type="number" placeholder="162" />
    {settings.version !== 'v3' && <TInput label="Community String" value={settings.community} onChange={v => set('community', v)} placeholder="public" />}
    {settings.version === 'v3' && (<>
      <TInput label="Username"            value={settings.username}   onChange={v => set('username', v)} />
      <Field label="Auth Protocol"><select value={settings.auth_protocol || 'SHA'} onChange={e => set('auth_protocol', e.target.value)}><option value="SHA">SHA</option><option value="MD5">MD5</option></select></Field>
      <TInput label="Auth Passphrase"     value={settings.auth_pass}  onChange={v => set('auth_pass', v)}  type="password" />
      <Field label="Privacy Protocol"><select value={settings.priv_protocol || 'AES'} onChange={e => set('priv_protocol', e.target.value)}><option value="AES">AES</option><option value="DES">DES</option></select></Field>
      <TInput label="Privacy Passphrase"  value={settings.priv_pass}  onChange={v => set('priv_pass', v)}  type="password" />
    </>)}
  </>);
}

function HecInfo() {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 8, background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.3)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
      <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>HEC is always on</strong>
      Point your forwarder to <code style={{ fontFamily: 'var(--mono)', color: 'var(--blue)' }}>http://[outpost-ip]:8080/services/collector</code>.
      The token is shown in <strong>Settings → HEC Token</strong>.
    </div>
  );
}

