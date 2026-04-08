import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api';
import { SEVERITY_CLASS } from '../utils/constants';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export default function EditRuleModal({ rule, onClose, onSaved }) {
  const [name, setName] = useState(rule.name);
  const [description, setDescription] = useState(rule.description || '');
  const [severity, setSeverity] = useState(rule.severity || 'medium');
  const [enabled, setEnabled] = useState(rule.enabled);
  const [error, setError] = useState('');

  async function handleSave() {
    try {
      await api.updateRule({ ...rule, name, description, severity, enabled });
      onSaved();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="connector-modal" style={{marginBottom: 16}}>
      <div className="connector-modal-header">
        <h3>Edit Rule: {rule.name}</h3>
        <button className="btn-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="connector-form">
        {error && <div className="status-banner error" style={{marginBottom: 12}}>{error}</div>}
        <div className="field">
          <label>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Description</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
          <div className="field">
            <label>Severity</label>
            <select value={severity} onChange={e => setSeverity(e.target.value)}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={enabled ? 'enabled' : 'disabled'} onChange={e => setEnabled(e.target.value === 'enabled')}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
        <div style={{display: 'flex', gap: 8, marginTop: 12}}>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
