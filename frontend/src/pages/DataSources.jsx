import { useState, useEffect } from 'react';
import {
  Plus, Terminal, Cloud, Server, FileText, Database as DbIcon,
  CheckCircle, XCircle, Trash2, Edit3, X, Activity, Wifi, WifiOff, Loader
} from 'lucide-react';
import { api } from '../api';

const TYPE_META = {
  syslog:   { icon: <Terminal size={20} />,  color: 'var(--green)',  bg: 'var(--green-muted)',  label: 'Syslog' },
  rest_api: { icon: <Cloud size={20} />,     color: 'var(--purple)', bg: 'var(--purple-muted)', label: 'REST API' },
  webhook:  { icon: <Server size={20} />,    color: 'var(--blue)',   bg: 'var(--blue-muted)',   label: 'Webhook' },
  file_log: { icon: <FileText size={20} />,  color: 'var(--yellow)', bg: 'var(--yellow-muted)', label: 'File / Log' },
  kafka:    { icon: <DbIcon size={20} />,    color: 'var(--orange)', bg: 'var(--orange-muted)', label: 'Kafka' },
};

const STATUS_COLORS = {
  running: 'var(--green)', stopped: 'var(--text-muted)', error: 'var(--red)',
};

// Type-specific default settings
const DEFAULT_SETTINGS = {
  syslog:   { bind_address: '0.0.0.0', udp_port: 5514, tcp_port: 5514, format: 'auto' },
  rest_api: { url: '', auth_type: 'apikey', poll_interval_sec: 60, api_key: '', api_key_header: 'X-API-Key', tenant_id: '', client_id: '', client_secret: '', source_label: '' },
  webhook:  { listen_port: 9090, path: '/webhook', secret: '' },
  file_log: { path: '/var/log/messages', format: 'syslog', tail: true },
  kafka:    { brokers: '', topic: '', group_id: 'outpost', sasl_enabled: false, sasl_username: '', sasl_password: '', ssl: false },
};

export default function DataSources() {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [newType, setNewType] = useState('');
  const [newName, setNewName] = useState('');
  const [newSettings, setNewSettings] = useState({});
  const [editId, setEditId] = useState(null);
  const [health, setHealth] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  // Confirm-delete dialog state
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name, source_label, event_count }

  async function load() {
    try {
      const [data, h] = await Promise.all([api.connectors(), api.health().catch(() => null)]);
      setConnectors(data.connectors || []);
      setHealth(h);
    } catch { setConnectors([]); }
    setLoading(false);
  }

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  function startAdd() {
    setShowAdd(true); setAddStep(1); setNewType(''); setNewName(''); setNewSettings({});
    setTestResult(null); setTesting(false);
  }

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      const result = await api.testConnector(newSettings);
      setTestResult(result);
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    }
    setTesting(false);
  }

  function selectType(type) {
    setNewType(type);
    setNewName(TYPE_META[type]?.label || type);
    setNewSettings({ ...DEFAULT_SETTINGS[type] });
    setAddStep(2);
  }

  async function saveConnector() {
    if (editId) {
      await api.updateConnector({ id: editId, name: newName, type: newType, settings: newSettings });
    } else {
      await api.createConnector({ name: newName, type: newType, enabled: false, settings: newSettings });
    }
    setShowAdd(false); setEditId(null); load();
  }

  function confirmDelete(c) {
    const settings = c.settings || {};
    setDeleteTarget({
      id: c.id,
      name: c.name,
      source_label: settings.source_label || '',
      event_count: c.event_count || 0,
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await api.deleteConnector(deleteTarget.id);
    // Clean up any saved event searches that filter on this source
    const label = deleteTarget.source_label || result?.source_label;
    if (label) {
      try {
        const saved = JSON.parse(localStorage.getItem('outpost_saved_searches') || '[]');
        const filtered = saved.filter(s => s.filters?.source_type !== label);
        localStorage.setItem('outpost_saved_searches', JSON.stringify(filtered));
      } catch {}
    }
    setDeleteTarget(null);
    load();
  }

  function startEdit(c) {
    setEditId(c.id);
    setNewType(c.type);
    setNewName(c.name);
    setNewSettings(c.settings || {});
    setTestResult(null); setTesting(false);
    setShowAdd(true);
    setAddStep(2);
  }

  async function toggleEnabled(c) {
    await api.updateConnector({ id: c.id, enabled: !c.enabled, status: !c.enabled ? 'running' : 'stopped' });
    load();
  }

  if (loading) return (
    <div className="loading"><div className="loading-spinner" /><div>Loading connectors...</div></div>
  );

  const activeCount = connectors.filter(c => c.enabled).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Connectors</h1>
          <div className="subtitle">Manage data source connections and ingestion pipelines</div>
        </div>
        <button className="btn-primary" onClick={startAdd}><Plus size={14} /> Add Connector</button>
      </div>

      <div className="stats-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 24}}>
        <div className="stat-card">
          <div className="label">Active</div>
          <div className="value green">{activeCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total</div>
          <div className="value">{connectors.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Events Today</div>
          <div className="value accent">{(health?.events_stored_today ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 24, width: 400, maxWidth: '90vw',
          }}>
            <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>Delete Connector</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Are you sure you want to delete <strong style={{color:'var(--text-primary)'}}>{deleteTarget.name}</strong>?
            </p>
            {deleteTarget.event_count > 0 && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: 'rgba(248,81,73,0.08)', border: '1px solid var(--red)',
                fontSize: 13, color: 'var(--red)',
              }}>
                This will permanently delete <strong>{deleteTarget.event_count.toLocaleString()}</strong> event{deleteTarget.event_count !== 1 ? 's' : ''} from source <code style={{fontFamily:'var(--mono)'}}>{deleteTarget.source_label || deleteTarget.name}</code>. This cannot be undone.
              </div>
            )}
            {deleteTarget.source_label && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Saved event filters for <code style={{fontFamily:'var(--mono)'}}>{deleteTarget.source_label}</code> will also be removed.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                style={{ background:'var(--red)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:'6px 16px', cursor:'pointer', fontSize:13, fontWeight:600 }}
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showAdd && (
        <div className="connector-modal">
          <div className="connector-modal-header">
            <h3>{editId ? 'Edit Connector' : 'Add Connector'}</h3>
            <button className="btn-icon" onClick={() => { setShowAdd(false); setEditId(null); }}><X size={16} /></button>
          </div>

          {addStep === 1 && (
            <div className="connector-type-grid">
              {Object.entries(TYPE_META).map(([type, meta]) => (
                <button key={type} className="connector-type-card" onClick={() => selectType(type)}>
                  <div className="connector-type-icon" style={{background: meta.bg, color: meta.color}}>
                    {meta.icon}
                  </div>
                  <span>{meta.label}</span>
                </button>
              ))}
            </div>
          )}

          {addStep === 2 && (
            <div className="connector-form">
              <div className="field">
                <label>Connector Name</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>

              {/* Type-specific fields */}
              {newType === 'syslog' && <SyslogForm settings={newSettings} onChange={setNewSettings} />}
              {newType === 'rest_api' && <RestApiForm settings={newSettings} onChange={setNewSettings} />}
              {newType === 'webhook' && <WebhookForm settings={newSettings} onChange={setNewSettings} />}
              {newType === 'file_log' && <FileLogForm settings={newSettings} onChange={setNewSettings} />}
              {newType === 'kafka' && <KafkaForm settings={newSettings} onChange={setNewSettings} />}

              {/* Test connection result */}
              {testResult && (
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: 8, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: testResult.ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                  border: `1px solid ${testResult.ok ? 'var(--green)' : 'var(--red)'}`,
                  color: testResult.ok ? 'var(--green)' : 'var(--red)',
                }}>
                  {testResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div style={{display: 'flex', gap: 8, marginTop: 16}}>
                <button className="btn-primary" onClick={saveConnector}>
                  {editId ? 'Update' : 'Create'} Connector
                </button>
                {newType === 'rest_api' && (
                  <button className="btn-secondary" onClick={handleTest} disabled={testing || !newSettings.url}>
                    {testing ? <><Loader size={14} className="spin" /> Testing...</> : <><Wifi size={14} /> Test Connection</>}
                  </button>
                )}
                {!editId && <button className="btn-secondary" onClick={() => setAddStep(1)}>Back</button>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connector list */}
      {connectors.length === 0 && !showAdd ? (
        <div className="table-container">
          <div className="empty">
            <div className="empty-icon"><Activity size={40} /></div>
            <p style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>No connectors configured</p>
            <p>Click "Add Connector" to set up your first data source.</p>
          </div>
        </div>
      ) : (
        <div style={{display: 'grid', gap: 12}}>
          {connectors.map(c => {
            const meta = TYPE_META[c.type] || TYPE_META.syslog;
            return (
              <div key={c.id} className="integration-card" style={{padding: 16}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-md)',
                      background: meta.bg, color: meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{meta.icon}</div>
                    <div>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                        <span style={{fontSize: 14, fontWeight: 600, color: 'var(--text-primary)'}}>{c.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                          padding: '1px 8px', borderRadius: 10,
                          background: meta.bg, color: meta.color,
                        }}>{meta.label}</span>
                        {c.settings?.source_label && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)',
                            padding: '1px 7px', borderRadius: 10,
                            background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                          }}>{c.settings.source_label}</span>
                        )}
                      </div>
                      <div style={{fontSize: 12, color: 'var(--text-muted)', marginTop: 2}}>
                        Events: <strong style={{color: 'var(--text-primary)', fontFamily: 'var(--mono)'}}>{(c.event_count || 0).toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <span style={{color: STATUS_COLORS[c.status] || 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4}}>
                      {c.status === 'running' ? <Wifi size={14} /> : c.enabled ? <WifiOff size={14} /> : <XCircle size={14} />}
                      {c.status === 'running' ? 'Running' : c.enabled ? 'Pending' : 'Stopped'}
                    </span>
                    <label className="toggle" style={{margin: 0}}>
                      <input type="checkbox" checked={c.enabled} onChange={() => toggleEnabled(c)} />
                      <span className="toggle-slider" />
                    </label>
                    <button className="btn-icon" onClick={() => startEdit(c)} title="Edit"><Edit3 size={14} /></button>
                    <button className="btn-icon danger" onClick={() => confirmDelete(c)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Type-specific config forms ──

function SettingsField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value ?? ''} placeholder={placeholder}
             onChange={e => onChange(type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)} />
    </div>
  );
}

function LocationSection({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
        Location (Globe View)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>Latitude</label>
          <input type="number" step="any" value={settings.latitude ?? ''}
                 placeholder="40.7128"
                 onChange={e => set('latitude', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
        </div>
        <div className="field">
          <label>Longitude</label>
          <input type="number" step="any" value={settings.longitude ?? ''}
                 placeholder="-74.0060"
                 onChange={e => set('longitude', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
        </div>
      </div>
      <SettingsField label="Location Label" value={settings.location_label}
                     onChange={v => set('location_label', v)}
                     placeholder="e.g. New York Office" />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
        If set, events from this connector will appear on the globe at this location.
      </div>
    </div>
  );
}

function SyslogForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <SettingsField label="Bind Address" value={settings.bind_address} onChange={v => set('bind_address', v)} placeholder="0.0.0.0" />
    <SettingsField label="UDP Port" value={settings.udp_port} onChange={v => set('udp_port', v)} type="number" />
    <SettingsField label="TCP Port" value={settings.tcp_port} onChange={v => set('tcp_port', v)} type="number" />
    <div className="field">
      <label>Format</label>
      <select value={settings.format || 'auto'} onChange={e => set('format', e.target.value)}>
        <option value="auto">Auto-detect</option>
        <option value="rfc3164">RFC 3164</option>
        <option value="rfc5424">RFC 5424</option>
      </select>
    </div>
    <LocationSection settings={settings} onChange={onChange} />
  </>);
}

function RestApiForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <SettingsField label="Endpoint URL" value={settings.url} onChange={v => set('url', v)} placeholder="https://api.example.com/events" />
    <div className="field">
      <label>Authentication Type</label>
      <select value={settings.auth_type || 'oauth2'} onChange={e => set('auth_type', e.target.value)}>
        <option value="oauth2">OAuth2 Client Credentials</option>
        <option value="apikey">API Key</option>
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="none">None</option>
      </select>
    </div>
    {settings.auth_type === 'oauth2' && (<>
      <SettingsField label="Tenant ID" value={settings.tenant_id} onChange={v => set('tenant_id', v)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      <SettingsField label="Client ID" value={settings.client_id} onChange={v => set('client_id', v)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      <SettingsField label="Client Secret" value={settings.client_secret} onChange={v => set('client_secret', v)} type="password" />
    </>)}
    {settings.auth_type === 'apikey' && (<>
      <SettingsField label="API Key" value={settings.api_key} onChange={v => set('api_key', v)} type="password" />
      <SettingsField label="Header Name" value={settings.api_key_header || 'X-API-Key'} onChange={v => set('api_key_header', v)} placeholder="X-API-Key" />
    </>)}
    {settings.auth_type === 'bearer' && (
      <SettingsField label="Bearer Token" value={settings.bearer_token} onChange={v => set('bearer_token', v)} type="password" />
    )}
    {settings.auth_type === 'basic' && (<>
      <SettingsField label="Username" value={settings.username} onChange={v => set('username', v)} />
      <SettingsField label="Password" value={settings.password} onChange={v => set('password', v)} type="password" />
    </>)}
    <SettingsField label="Poll Interval (seconds)" value={settings.poll_interval_sec} onChange={v => set('poll_interval_sec', v)} type="number" />
    <SettingsField label="Source Label" value={settings.source_label} onChange={v => set('source_label', v)} placeholder="e.g. unifi, sentinelone, crowdstrike" />
    <LocationSection settings={settings} onChange={onChange} />
  </>);
}

function WebhookForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <SettingsField label="Listen Port" value={settings.listen_port} onChange={v => set('listen_port', v)} type="number" />
    <SettingsField label="Path" value={settings.path} onChange={v => set('path', v)} placeholder="/webhook/source" />
    <SettingsField label="Shared Secret" value={settings.secret} onChange={v => set('secret', v)} type="password" />
  </>);
}

function FileLogForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <SettingsField label="File Path" value={settings.path} onChange={v => set('path', v)} placeholder="/var/log/messages" />
    <div className="field">
      <label>Format</label>
      <select value={settings.format || 'syslog'} onChange={e => set('format', e.target.value)}>
        <option value="syslog">Syslog</option>
        <option value="json">JSON (line-delimited)</option>
        <option value="csv">CSV</option>
      </select>
    </div>
    <div className="field" style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <label style={{marginBottom: 0}}>Tail Mode</label>
      <label className="toggle" style={{margin: 0}}>
        <input type="checkbox" checked={settings.tail ?? true} onChange={e => set('tail', e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  </>);
}

function KafkaForm({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (<>
    <SettingsField label="Bootstrap Brokers" value={settings.brokers} onChange={v => set('brokers', v)} placeholder="broker1:9092,broker2:9092" />
    <SettingsField label="Topic" value={settings.topic} onChange={v => set('topic', v)} placeholder="security-events" />
    <SettingsField label="Consumer Group ID" value={settings.group_id} onChange={v => set('group_id', v)} placeholder="outpost" />
    <div className="field" style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <label style={{marginBottom: 0}}>SASL Authentication</label>
      <label className="toggle" style={{margin: 0}}>
        <input type="checkbox" checked={settings.sasl_enabled ?? false} onChange={e => set('sasl_enabled', e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
    {settings.sasl_enabled && (<>
      <SettingsField label="SASL Username" value={settings.sasl_username} onChange={v => set('sasl_username', v)} />
      <SettingsField label="SASL Password" value={settings.sasl_password} onChange={v => set('sasl_password', v)} type="password" />
    </>)}
    <div className="field" style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <label style={{marginBottom: 0}}>SSL/TLS</label>
      <label className="toggle" style={{margin: 0}}>
        <input type="checkbox" checked={settings.ssl ?? false} onChange={e => set('ssl', e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  </>);
}
