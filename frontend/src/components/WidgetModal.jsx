import { X } from 'lucide-react';
import { WIDGET_TYPES, DATA_SOURCE_LABELS, SIZE_OPTIONS } from '../widgets/WidgetRegistry';

export default function WidgetModal({
  isEdit, addType, addTitle, addDataSource, addSize, addParams,
  setAddType, setAddTitle, setAddDataSource, setAddSize, setAddParams,
  onConfirm, onClose, onSelectType
}) {
  const isSelfFetch = (type) => WIDGET_TYPES[type]?.selfFetch;

  return (
    <div className="connector-modal" style={{marginBottom: 16}}>
      <div className="connector-modal-header">
        <h3>{isEdit ? 'Edit Widget' : 'Add Widget'}</h3>
        <button className="btn-icon" onClick={onClose}><X size={16} /></button>
      </div>

      {!addType ? (
        <div className="connector-type-grid">
          {Object.entries(WIDGET_TYPES).map(([type, meta]) => (
            <button key={type} className="connector-type-card" onClick={() => onSelectType(type)}>
              <span>{meta.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="connector-form">
          <div className="field">
            <label>Title</label>
            <input type="text" value={addTitle} onChange={e => setAddTitle(e.target.value)} />
          </div>
          {!isSelfFetch(addType) && (
            <div className="field">
              <label>Data Source</label>
              <select value={addDataSource} onChange={e => setAddDataSource(e.target.value)}>
                {WIDGET_TYPES[addType]?.dataSources?.map(ds => (
                  <option key={ds} value={ds}>{DATA_SOURCE_LABELS[ds] || ds}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Size</label>
            <select value={addSize} onChange={e => setAddSize(e.target.value)}>
              {SIZE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {WIDGET_TYPES[addType]?.fields?.map(f => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              {f.type === 'select' ? (
                <select value={addParams[f.key] || ''} onChange={e => setAddParams({...addParams, [f.key]: e.target.value})}>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type || 'text'} value={addParams[f.key] ?? ''}
                       onChange={e => setAddParams({...addParams, [f.key]: f.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value})} />
              )}
            </div>
          ))}
          <div style={{display: 'flex', gap: 8, marginTop: 12}}>
            <button className="btn-primary" onClick={onConfirm}>
              {isEdit ? 'Update' : 'Add'} Widget
            </button>
            {!isEdit && <button className="btn-secondary" onClick={() => setAddType('')}>Back</button>}
          </div>
        </div>
      )}
    </div>
  );
}
