import { useState } from 'react';
import {
  Shield, Zap, List, BookOpen, Edit3, Trash2,
  Eye, EyeOff, Filter
} from 'lucide-react';
import { api } from '../api';
import { SEVERITY_CLASS } from '../utils/constants';
import EditRuleModal from './EditRuleModal';

const TYPE_ICONS = {
  threshold: <Zap size={14} />,
  sequence: <List size={14} />,
  valuelist: <Shield size={14} />,
  anomaly: <BookOpen size={14} />,
};

export default function ActiveRules({ rules, onReload, setSuccess }) {
  const [filter, setFilter] = useState('all');
  const [editRule, setEditRule] = useState(null);
  const [error, setError] = useState('');

  async function handleToggle(rule) {
    if (rule.source === 'builtin') return;
    try {
      await api.updateRule({ ...rule, enabled: !rule.enabled });
      setSuccess(rule.enabled ? `"${rule.name}" disabled` : `"${rule.name}" enabled`);
      onReload();
    } catch (e) { setError(e.message); }
  }

  async function handleDelete(rule) {
    if (rule.source === 'builtin') return;
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await api.deleteRule(rule.id);
      setSuccess(`"${rule.name}" deleted`);
      onReload();
    } catch (e) { setError(e.message); }
  }

  const filtered = rules.filter(r => {
    if (filter === 'builtin') return r.source === 'builtin';
    if (filter === 'custom') return r.source === 'custom';
    if (filter === 'enabled') return r.enabled;
    if (filter === 'disabled') return !r.enabled;
    return true;
  });

  const builtinCount = rules.filter(r => r.source === 'builtin').length;
  const customCount = rules.filter(r => r.source === 'custom').length;

  return (
    <div>
      {error && <div className="status-banner error">{error}</div>}

      <div className="filter-row" style={{marginBottom: 16}}>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Rules ({rules.length})</option>
          <option value="builtin">Built-in ({builtinCount})</option>
          <option value="custom">Custom ({customCount})</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {editRule && (
        <EditRuleModal
          rule={editRule}
          onClose={() => setEditRule(null)}
          onSaved={() => { setEditRule(null); onReload(); setSuccess('Rule updated'); }}
        />
      )}

      <div style={{display: 'grid', gap: 10}}>
        {filtered.map(rule => (
          <div key={rule.id} className="integration-card" style={{padding: 14}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0}}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0,
                  background: 'var(--accent-subtle)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {TYPE_ICONS[rule.type] || <Shield size={14} />}
                </div>
                <div style={{minWidth: 0}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                    <span style={{fontSize: 14, fontWeight: 600, color: 'var(--text-primary)'}}>{rule.name}</span>
                    <span className={`badge ${SEVERITY_CLASS[rule.severity?.toLowerCase()] || 'info'}`}>
                      {rule.severity}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      padding: '1px 6px', borderRadius: 8,
                      background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                    }}>
                      {rule.type}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 8,
                      background: rule.source === 'custom' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      color: rule.source === 'custom' ? 'var(--accent)' : 'var(--text-muted)',
                    }}>
                      {rule.source === 'custom' ? 'Custom' : 'Built-in'}
                    </span>
                  </div>
                  <div style={{fontSize: 12, color: 'var(--text-muted)', marginTop: 2}}>{rule.description}</div>
                  {rule.filter?.source_type && (
                    <div style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 2}}>
                      <Filter size={10} style={{verticalAlign: 'middle'}} /> Source: {rule.filter.source_type}
                      {rule.filter.action && ` | Action: ${rule.filter.action}`}
                      {rule.filter.category && ` | Category: ${rule.filter.category}`}
                    </div>
                  )}
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0}}>
                {rule.source === 'custom' && (
                  <>
                    <button className="btn-icon-sm" title="Edit" onClick={() => setEditRule(rule)}>
                      <Edit3 size={12} />
                    </button>
                    <button className="btn-icon-sm danger" title="Delete" onClick={() => handleDelete(rule)}>
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
                <button
                  className={`btn-icon-sm ${!rule.enabled ? 'danger' : ''}`}
                  title={rule.enabled ? 'Disable' : 'Enable'}
                  onClick={() => handleToggle(rule)}
                  disabled={rule.source === 'builtin'}
                  style={{opacity: rule.source === 'builtin' ? 0.4 : 1}}
                >
                  {rule.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <span className={`pulse`}
                  style={{width: 8, height: 8, borderRadius: '50%',
                    background: rule.enabled ? 'var(--green)' : 'var(--text-muted)'}} />
              </div>
            </div>
            {rule.tags?.length > 0 && (
              <div style={{display: 'flex', gap: 4, marginTop: 8, marginLeft: 48, flexWrap: 'wrap'}}>
                {rule.tags.map(tag => (
                  <span key={tag} style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 10,
                    background: 'var(--blue-muted)', color: 'var(--blue)',
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="table-container"><div className="empty">No rules match filter</div></div>
        )}
      </div>
    </div>
  );
}
