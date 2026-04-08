import { useState } from 'react';
import { Plus, X, Zap, Filter } from 'lucide-react';
import { api } from '../api';
import { SEVERITY_CLASS } from '../utils/constants';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const RULE_TYPES = ['threshold', 'sequence', 'valuelist'];
const SOURCE_TYPES = ['', 'windows', 'azure', 'm365', 'fortigate', 'unifi', 'syslog'];
const GROUP_BY_OPTIONS = ['src_ip', 'user', 'source_host', 'action', 'category'];
const VALUELIST_FIELDS = ['action', 'src_ip', 'user_name', 'category', 'source_type'];

export default function RuleBuilder({ onCreated }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [ruleType, setRuleType] = useState('threshold');
  const [tags, setTags] = useState('');

  const [sourceType, setSourceType] = useState('');
  const [category, setCategory] = useState('');
  const [action, setAction] = useState('');
  const [fieldMatch, setFieldMatch] = useState('');
  const [fieldValue, setFieldValue] = useState('');

  const [threshold, setThreshold] = useState(5);
  const [windowMin, setWindowMin] = useState(5);
  const [groupBy, setGroupBy] = useState('src_ip');

  const [seqSteps, setSeqSteps] = useState([
    { label: 'Step 1', action: '' },
    { label: 'Step 2', action: '' },
  ]);

  const [vlField, setVlField] = useState('action');
  const [vlValues, setVlValues] = useState('');

  function buildConfig() {
    if (ruleType === 'threshold') {
      return { threshold, window_seconds: windowMin * 60, group_by: groupBy };
    }
    if (ruleType === 'sequence') {
      return {
        window_seconds: windowMin * 60,
        group_by: groupBy,
        steps: seqSteps.filter(s => s.action).map(s => ({
          label: s.label,
          filter: { action: s.action }
        }))
      };
    }
    if (ruleType === 'valuelist') {
      return {
        field: vlField,
        values: vlValues.split('\n').map(v => v.trim()).filter(Boolean)
      };
    }
    return {};
  }

  async function handleCreate() {
    setError('');
    if (!name) { setError('Rule name is required'); return; }

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const config = buildConfig();

    try {
      await api.createRule({
        name, description, severity, type: ruleType,
        source_type: sourceType, category, action,
        field_match: fieldMatch, field_value: fieldValue,
        config, tags: tagList, enabled: true,
      });
      onCreated();
    } catch (e) { setError(e.message); }
  }

  function addSeqStep() {
    setSeqSteps([...seqSteps, { label: `Step ${seqSteps.length + 1}`, action: '' }]);
  }

  function updateSeqStep(idx, key, val) {
    const steps = [...seqSteps];
    steps[idx] = { ...steps[idx], [key]: val };
    setSeqSteps(steps);
  }

  function removeSeqStep(idx) {
    if (seqSteps.length <= 2) return;
    setSeqSteps(seqSteps.filter((_, i) => i !== idx));
  }

  return (
    <div>
      {error && <div className="status-banner error" style={{marginBottom: 16}}>{error}</div>}

      <div className="rule-builder-progress">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`rb-step ${step === s ? 'active' : ''} ${step > s ? 'done' : ''}`}
               onClick={() => s < step && setStep(s)}>
            <span className="rb-step-num">{step > s ? '✓' : s}</span>
            <span className="rb-step-label">
              {s === 1 ? 'Basics' : s === 2 ? 'Filter' : s === 3 ? 'Condition' : 'Review'}
            </span>
          </div>
        ))}
      </div>

      <div className="connector-modal" style={{marginTop: 16}}>
        {step === 1 && (
          <div className="connector-form">
            <h3 style={{marginBottom: 16, color: 'var(--text-primary)'}}>Rule Details</h3>
            <div className="field">
              <label>Rule Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                     placeholder="e.g., Brute Force Detection" autoFocus />
            </div>
            <div className="field">
              <label>Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                     placeholder="What does this rule detect?" />
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
              <div className="field">
                <label>Severity</label>
                <select value={severity} onChange={e => setSeverity(e.target.value)}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Rule Type</label>
                <select value={ruleType} onChange={e => setRuleType(e.target.value)}>
                  {RULE_TYPES.map(t => <option key={t} value={t}>
                    {t === 'threshold' ? 'Threshold (count-based)' :
                     t === 'sequence' ? 'Sequence (ordered events)' :
                     'Value List (known-bad match)'}
                  </option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Tags (comma-separated)</label>
              <input type="text" value={tags} onChange={e => setTags(e.target.value)}
                     placeholder="brute_force, windows, auth" />
            </div>
            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 16}}>
              <button className="btn-primary" onClick={() => { if (!name) { setError('Name required'); return; } setError(''); setStep(2); }}>
                Next: Filter &rarr;
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="connector-form">
            <h3 style={{marginBottom: 16, color: 'var(--text-primary)'}}>
              <Filter size={16} style={{verticalAlign: 'middle'}} /> Event Filter
            </h3>
            <p style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 16}}>
              Define which events this rule should evaluate. Leave blank to match all.
            </p>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
              <div className="field">
                <label>Source Type</label>
                <select value={sourceType} onChange={e => setSourceType(e.target.value)}>
                  <option value="">Any source</option>
                  {SOURCE_TYPES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Category</label>
                <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                       placeholder="e.g., auth, network" />
              </div>
            </div>
            <div className="field">
              <label>Action</label>
              <input type="text" value={action} onChange={e => setAction(e.target.value)}
                     placeholder="e.g., login_failure, account_created" />
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
              <div className="field">
                <label>Custom Field Name</label>
                <input type="text" value={fieldMatch} onChange={e => setFieldMatch(e.target.value)}
                       placeholder="e.g., subtype" />
              </div>
              <div className="field">
                <label>Custom Field Value</label>
                <input type="text" value={fieldValue} onChange={e => setFieldValue(e.target.value)}
                       placeholder="e.g., system" />
              </div>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 16}}>
              <button className="btn-secondary" onClick={() => setStep(1)}>&larr; Back</button>
              <button className="btn-primary" onClick={() => setStep(3)}>Next: Condition &rarr;</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="connector-form">
            <h3 style={{marginBottom: 16, color: 'var(--text-primary)'}}>
              <Zap size={16} style={{verticalAlign: 'middle'}} /> Detection Condition
            </h3>

            {ruleType === 'threshold' && (
              <>
                <p style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 16}}>
                  Alert when N matching events occur within a time window, grouped by a field.
                </p>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12}}>
                  <div className="field">
                    <label>Threshold (count)</label>
                    <input type="number" min={1} value={threshold}
                           onChange={e => setThreshold(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="field">
                    <label>Window (minutes)</label>
                    <input type="number" min={1} value={windowMin}
                           onChange={e => setWindowMin(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="field">
                    <label>Group By</label>
                    <select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                      {GROUP_BY_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: 8,
                  background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-muted)'
                }}>
                  Alert when <strong style={{color: 'var(--accent)'}}>{threshold}</strong> matching events
                  from the same <strong style={{color: 'var(--accent)'}}>{groupBy}</strong> occur
                  within <strong style={{color: 'var(--accent)'}}>{windowMin} minute{windowMin > 1 ? 's' : ''}</strong>.
                </div>
              </>
            )}

            {ruleType === 'sequence' && (
              <>
                <p style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 16}}>
                  Alert when events occur in a specific order within a time window.
                </p>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12}}>
                  <div className="field">
                    <label>Window (minutes)</label>
                    <input type="number" min={1} value={windowMin}
                           onChange={e => setWindowMin(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="field">
                    <label>Group By</label>
                    <select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                      {GROUP_BY_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block'}}>
                  Sequence Steps
                </label>
                {seqSteps.map((s, i) => (
                  <div key={i} style={{display: 'grid', gridTemplateColumns: '120px 1fr 32px', gap: 8, marginBottom: 8}}>
                    <input type="text" value={s.label} onChange={e => updateSeqStep(i, 'label', e.target.value)}
                           placeholder="Step label" style={{fontSize: 12}} />
                    <input type="text" value={s.action} onChange={e => updateSeqStep(i, 'action', e.target.value)}
                           placeholder="Action to match (e.g., login_failure)" style={{fontSize: 12}} />
                    <button className="btn-icon-sm danger" onClick={() => removeSeqStep(i)}
                            disabled={seqSteps.length <= 2}><X size={10} /></button>
                  </div>
                ))}
                <button className="btn-secondary" onClick={addSeqStep} style={{fontSize: 12}}>
                  <Plus size={10} /> Add Step
                </button>
              </>
            )}

            {ruleType === 'valuelist' && (
              <>
                <p style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 16}}>
                  Alert when an event field matches any value in a known-bad list.
                </p>
                <div className="field">
                  <label>Field to Check</label>
                  <select value={vlField} onChange={e => setVlField(e.target.value)}>
                    {VALUELIST_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Values (one per line)</label>
                  <textarea rows={6} value={vlValues} onChange={e => setVlValues(e.target.value)}
                            placeholder={"malicious_action\nsuspicious_login\ndata_export"}
                            style={{
                              width: '100%', fontFamily: 'var(--mono)', fontSize: 12,
                              background: 'var(--bg-primary)', color: 'var(--text-primary)',
                              border: '1px solid var(--border)', borderRadius: 8, padding: 10, resize: 'vertical',
                            }} />
                </div>
              </>
            )}

            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 16}}>
              <button className="btn-secondary" onClick={() => setStep(2)}>&larr; Back</button>
              <button className="btn-primary" onClick={() => setStep(4)}>Next: Review &rarr;</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="connector-form">
            <h3 style={{marginBottom: 16, color: 'var(--text-primary)'}}>Review & Create</h3>

            <div className="rule-review">
              <div className="review-row"><span className="review-label">Name</span><span>{name}</span></div>
              <div className="review-row"><span className="review-label">Description</span><span>{description || '--'}</span></div>
              <div className="review-row">
                <span className="review-label">Severity</span>
                <span className={`badge ${SEVERITY_CLASS[severity]}`}>{severity}</span>
              </div>
              <div className="review-row"><span className="review-label">Type</span><span>{ruleType}</span></div>
              {sourceType && <div className="review-row"><span className="review-label">Source</span><span>{sourceType}</span></div>}
              {action && <div className="review-row"><span className="review-label">Action</span><span>{action}</span></div>}
              {category && <div className="review-row"><span className="review-label">Category</span><span>{category}</span></div>}
              {ruleType === 'threshold' && (
                <div className="review-row">
                  <span className="review-label">Condition</span>
                  <span>{threshold} events in {windowMin}m grouped by {groupBy}</span>
                </div>
              )}
              {ruleType === 'sequence' && (
                <div className="review-row">
                  <span className="review-label">Sequence</span>
                  <span>{seqSteps.filter(s => s.action).map(s => s.label).join(' → ')} within {windowMin}m</span>
                </div>
              )}
              {ruleType === 'valuelist' && (
                <div className="review-row">
                  <span className="review-label">Value List</span>
                  <span>{vlField}: {vlValues.split('\n').filter(Boolean).length} values</span>
                </div>
              )}
              {tags && (
                <div className="review-row">
                  <span className="review-label">Tags</span>
                  <span>{tags}</span>
                </div>
              )}
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 16}}>
              <button className="btn-secondary" onClick={() => setStep(3)}>&larr; Back</button>
              <button className="btn-primary" onClick={handleCreate}>
                <Plus size={14} /> Create Rule
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
