import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle } from 'lucide-react';

const SEVERITY_CLASS = {
  critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info',
  informational: 'info', warning: 'medium', error: 'high', unknown: 'info',
};

function formatTs(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetch('/api/alerts').then(r => {
          if (!r.ok) throw new Error('Backend unavailable');
          return r.json();
        });
        if (!cancelled) { setAlerts(data.alerts || []); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (error && !alerts.length) return (
    <div className="loading">
      <div className="loading-spinner" />
      <div>Connecting...</div>
    </div>
  );

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <div>Loading alerts...</div>
    </div>
  );

  const unacked = alerts.filter(a => !a.acknowledged).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Alerts</h1>
          <div className="subtitle">
            {alerts.length > 0
              ? `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}, ${unacked} unacknowledged`
              : 'Detection rule alerts appear here'}
          </div>
        </div>
      </div>

      <div className="table-container">
        {alerts.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Bell size={40} /></div>
            <p style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>No alerts triggered yet</p>
            <p>Alerts will appear here when detection rules fire against incoming events.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Rule</th>
                <th>Severity</th>
                <th>Description</th>
                <th>Events</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.alert_id}>
                  <td className="time-cell">{formatTs(a.created_at)}</td>
                  <td style={{color: 'var(--text-primary)', fontWeight: 500}}>{a.rule_name}</td>
                  <td>
                    <span className={`badge ${SEVERITY_CLASS[a.severity?.toLowerCase()] || 'info'}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td style={{maxWidth: 350}}>{a.description}</td>
                  <td className="mono">{a.event_ids?.length || 0}</td>
                  <td>
                    {a.acknowledged
                      ? <span style={{color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4}}>
                          <CheckCircle size={14} /> Acked
                        </span>
                      : <span style={{color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 4}}>
                          <AlertTriangle size={14} /> Open
                        </span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
