import { useState, useEffect } from 'react';
import { Save, RefreshCw, Cloud, Shield, CheckCircle } from 'lucide-react';

const EMPTY = { enabled: false, tenant_id: '', client_id: '', client_secret: '', poll_interval_sec: 60 };

export default function Settings() {
  const [m365, setM365] = useState({ ...EMPTY });
  const [azure, setAzure] = useState({ ...EMPTY, subscription_id: '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/integrations').then(r => r.json()).then(data => {
      if (data.m365) setM365(prev => ({ ...prev, ...data.m365 }));
      if (data.azure) setAzure(prev => ({ ...prev, ...data.azure }));
      setStatus(data); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true); setStatus(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ m365, azure }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = await fetch('/api/integrations').then(r => r.json());
        setStatus({ ...updated, saved: true });
      } else { setStatus({ error: data.error || 'Save failed' }); }
    } catch (e) { setStatus({ error: e.message }); }
    setSaving(false);
  }

  if (loading) return <div className="loading"><div className="loading-spinner" /><div>Loading settings...</div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="subtitle">Configure API integrations and data source credentials</div>
        </div>
      </div>

      {status?.saved && (
        <div className="status-banner success">
          <CheckCircle size={16} /> Configuration saved and applied successfully.
        </div>
      )}
      {status?.error && (
        <div className="status-banner error">Error: {status.error}</div>
      )}

      <div className="settings-grid">
        <IntegrationCard
          title="Microsoft 365"
          icon={<Cloud size={20} />}
          description="Office 365 Management Activity API — pulls audit logs from Azure AD, Exchange, SharePoint, and General."
          config={m365}
          onChange={setM365}
          eventsCollected={status?.m365?.events_collected}
          fields={[
            { key: 'tenant_id', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
            { key: 'client_id', label: 'Client ID (App Registration)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
            { key: 'client_secret', label: 'Client Secret', placeholder: 'Enter client secret', type: 'password' },
            { key: 'poll_interval_sec', label: 'Poll Interval (seconds)', type: 'number' },
          ]}
        />
        <IntegrationCard
          title="Azure Monitor"
          icon={<Shield size={20} />}
          description="Azure Monitor Activity Log API — pulls management plane events from your Azure subscription."
          config={azure}
          onChange={setAzure}
          eventsCollected={status?.azure?.events_collected}
          fields={[
            { key: 'tenant_id', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
            { key: 'client_id', label: 'Client ID (App Registration)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
            { key: 'client_secret', label: 'Client Secret', placeholder: 'Enter client secret', type: 'password' },
            { key: 'subscription_id', label: 'Subscription ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
            { key: 'poll_interval_sec', label: 'Poll Interval (seconds)', type: 'number' },
          ]}
        />
      </div>

      <div className="settings-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving
            ? <><RefreshCw size={14} className="spin" /> Saving...</>
            : <><Save size={14} /> Save & Apply</>
          }
        </button>
      </div>
    </div>
  );
}

function IntegrationCard({ title, icon, description, config, onChange, eventsCollected, fields }) {
  function update(key, value) {
    onChange(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="integration-card">
      <div className="integration-header">
        <div className="integration-title">
          {icon}
          <h3>{title}</h3>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={config.enabled} onChange={e => update('enabled', e.target.checked)} />
          <span className="toggle-slider" />
          <span className="toggle-label">{config.enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      <p className="integration-desc">{description}</p>

      {eventsCollected !== undefined && (
        <div className="integration-status">
          Events collected this session: <strong>{eventsCollected}</strong>
        </div>
      )}

      <div className={`integration-fields ${!config.enabled ? 'fields-disabled' : ''}`}>
        {fields.map(f => (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <input
              type={f.type || 'text'}
              placeholder={f.placeholder || ''}
              value={config[f.key] ?? ''}
              onChange={e => update(f.key, f.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
              disabled={!config.enabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
