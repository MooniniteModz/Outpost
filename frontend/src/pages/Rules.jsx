import { useState, useEffect } from 'react';
import { Eye, Settings, CheckCircle } from 'lucide-react';
import { api } from '../api';
import ActiveRules from '../components/ActiveRules';
import RuleBuilder from '../components/RuleBuilder';

export default function Rules() {
  const [tab, setTab] = useState('active');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');

  async function loadRules() {
    try {
      const data = await api.rules();
      setRules(data.rules || []);
    } catch { setRules([]); }
    setLoading(false);
  }

  useEffect(() => { loadRules(); }, []);

  if (loading) return (
    <div className="loading"><div className="loading-spinner" /><div>Loading rules...</div></div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Detection Rules</h1>
          <div className="subtitle">{rules.length} rule{rules.length !== 1 ? 's' : ''} loaded</div>
        </div>
      </div>

      {success && <div className="status-banner success"><CheckCircle size={16} /> {success}</div>}

      <div className="filter-tabs" style={{marginBottom: 20}}>
        <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>
          <Eye size={14} /> Active Rules
        </button>
        <button className={tab === 'builder' ? 'active' : ''} onClick={() => setTab('builder')}>
          <Settings size={14} /> Rule Builder
        </button>
      </div>

      {tab === 'active' && (
        <ActiveRules rules={rules} onReload={loadRules} setSuccess={setSuccess} />
      )}
      {tab === 'builder' && (
        <RuleBuilder onCreated={() => { loadRules(); setTab('active'); setSuccess('Rule created successfully'); }} />
      )}
    </div>
  );
}
