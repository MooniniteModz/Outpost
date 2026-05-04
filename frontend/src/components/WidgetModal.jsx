import { useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { WIDGET_TYPES, WIDGET_CATEGORIES, DATA_SOURCE_LABELS, SIZE_OPTIONS } from '../widgets/WidgetRegistry';

// ─── SVG preview thumbnails for each chart type ──────────────────────────────

const PREVIEWS = {
  area_chart: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 34 C10 30 15 22 22 20 C30 18 35 28 42 16 C49 4 56 12 62 10 C69 8 74 14 80 12 L80 46 L0 46Z"
        fill="#73bf69" fillOpacity="0.35"/>
      <path d="M0 34 C10 30 15 22 22 20 C30 18 35 28 42 16 C49 4 56 12 62 10 C69 8 74 14 80 12"
        stroke="#73bf69" strokeWidth="2" fill="none"/>
      <line x1="0" y1="42" x2="80" y2="42" stroke="#1e2840" strokeWidth="0.5"/>
    </svg>
  ),
  line_chart: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 34 L16 26 L32 30 L48 14 L64 20 L80 10"
        stroke="#58a6ff" strokeWidth="2" fill="none"/>
      {[[0,34],[16,26],[32,30],[48,14],[64,20],[80,10]].map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#58a6ff" stroke="#0a1628" strokeWidth="1.5"/>
      ))}
    </svg>
  ),
  bar_chart: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4"  width="58" height="7" rx="2" fill="#f85149" opacity="0.9"/>
      <rect x="0" y="15" width="44" height="7" rx="2" fill="#db6d28" opacity="0.9"/>
      <rect x="0" y="26" width="50" height="7" rx="2" fill="#d29922" opacity="0.9"/>
      <rect x="0" y="37" width="28" height="7" rx="2" fill="#3fb950" opacity="0.9"/>
    </svg>
  ),
  vertical_bar: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4"  y="14" width="13" height="30" rx="2" fill="#58a6ff" opacity="0.9"/>
      <rect x="21" y="22" width="13" height="22" rx="2" fill="#00d4aa" opacity="0.9"/>
      <rect x="38" y="4"  width="13" height="40" rx="2" fill="#bc8cff" opacity="0.9"/>
      <rect x="55" y="18" width="13" height="26" rx="2" fill="#db6d28" opacity="0.9"/>
      <line x1="0" y1="44" x2="80" y2="44" stroke="#1e2840" strokeWidth="0.5"/>
    </svg>
  ),
  pie_chart: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="23" r="16" stroke="#f85149" strokeWidth="9" fill="none"
        strokeDasharray="25 76" strokeDashoffset="22"/>
      <circle cx="40" cy="23" r="16" stroke="#db6d28" strokeWidth="9" fill="none"
        strokeDasharray="22 79" strokeDashoffset="-3"/>
      <circle cx="40" cy="23" r="16" stroke="#3fb950" strokeWidth="9" fill="none"
        strokeDasharray="29 72" strokeDashoffset="-25"/>
      <circle cx="40" cy="23" r="16" stroke="#58a6ff" strokeWidth="9" fill="none"
        strokeDasharray="24 77" strokeDashoffset="-54"/>
      <circle cx="40" cy="23" r="9.5" fill="#0a1628"/>
    </svg>
  ),
  stat_card: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="40" y="28" textAnchor="middle" fill="#00d4aa" fontSize="22" fontWeight="800" fontFamily="monospace">42K</text>
      <text x="40" y="40" textAnchor="middle" fill="#4a5568" fontSize="8" fontFamily="sans-serif">EVENTS TODAY</text>
    </svg>
  ),
  gauge: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 40 A 26 26 0 0 1 66 40" stroke="#1e2840" strokeWidth="8" strokeLinecap="round" fill="none"/>
      <path d="M14 40 A 26 26 0 0 1 53 17" stroke="#00d4aa" strokeWidth="8" strokeLinecap="round" fill="none"/>
      <text x="40" y="37" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="800" fontFamily="monospace">72%</text>
    </svg>
  ),
  top_list: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="4" y="13" fill="#4a5568" fontSize="7" fontFamily="monospace" fontWeight="700">1</text>
      <rect x="13" y="5"  width="52" height="7" rx="2" fill="#5a8dee" opacity="0.8"/>
      <text x="4" y="27" fill="#4a5568" fontSize="7" fontFamily="monospace" fontWeight="700">2</text>
      <rect x="13" y="19" width="38" height="7" rx="2" fill="#5a8dee" opacity="0.6"/>
      <text x="4" y="41" fill="#4a5568" fontSize="7" fontFamily="monospace" fontWeight="700">3</text>
      <rect x="13" y="33" width="26" height="7" rx="2" fill="#5a8dee" opacity="0.4"/>
    </svg>
  ),
  alert_feed: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4"  width="3" height="11" rx="1.5" fill="#f85149"/>
      <rect x="9" y="6"  width="62" height="5"  rx="2" fill="#1e2840"/>
      <rect x="9" y="12" width="38" height="3"  rx="1.5" fill="#2a3148"/>
      <rect x="2" y="19" width="3" height="11" rx="1.5" fill="#db6d28"/>
      <rect x="9" y="21" width="52" height="5"  rx="2" fill="#1e2840"/>
      <rect x="9" y="27" width="32" height="3"  rx="1.5" fill="#2a3148"/>
      <rect x="2" y="34" width="3" height="11" rx="1.5" fill="#d29922"/>
      <rect x="9" y="36" width="58" height="5"  rx="2" fill="#1e2840"/>
      <rect x="9" y="42" width="44" height="3"  rx="1.5" fill="#2a3148"/>
    </svg>
  ),
  geo_map: (
    <svg viewBox="0 0 80 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="23" r="18" fill="#0a1628" stroke="#1e2840" strokeWidth="1.5"/>
      <ellipse cx="40" cy="23" rx="8"  ry="18" stroke="#1e2840" strokeWidth="1"/>
      <line x1="22" y1="23" x2="58" y2="23" stroke="#1e2840" strokeWidth="1"/>
      <line x1="23" y1="15" x2="57" y2="15" stroke="#1e2840" strokeWidth="0.5"/>
      <line x1="23" y1="31" x2="57" y2="31" stroke="#1e2840" strokeWidth="0.5"/>
      <circle cx="34" cy="18" r="2.5" fill="#f85149"/>
      <circle cx="52" cy="27" r="2"   fill="#00d4aa"/>
      <circle cx="28" cy="30" r="1.5" fill="#58a6ff"/>
      <circle cx="46" cy="14" r="1.5" fill="#db6d28"/>
    </svg>
  ),
};

// ─── Size selector visual bars ────────────────────────────────────────────────

const SIZE_VISUALS = {
  full:    { bars: [12], label: 'Full Width' },
  half:    { bars: [6, 6], label: 'Half' },
  third:   { bars: [4, 4, 4], label: 'Third' },
  quarter: { bars: [3, 3, 3, 3], label: 'Quarter' },
};

function SizePreview({ value, selected, onClick }) {
  const visual = SIZE_VISUALS[value];
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 8px', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', background: selected ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        transition: 'all 0.12s',
      }}
    >
      <div style={{ display: 'flex', gap: 2, width: 48, height: 14 }}>
        {visual.bars.map((w, i) => (
          <div key={i} style={{
            flex: w, height: '100%', borderRadius: 2,
            background: selected ? 'var(--accent)' : '#2a3148',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text-muted)' }}>
        {visual.label}
      </span>
    </button>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function WidgetModal({
  isEdit,
  addType, addTitle, addDataSource, addSize, addParams,
  setAddType, setAddTitle, setAddDataSource, setAddSize, setAddParams,
  onConfirm, onClose, onSelectType,
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [step, setStep] = useState(isEdit ? 'configure' : 'browse');

  function handleSelectType(type) {
    onSelectType(type);
    setStep('configure');
  }

  function handleBack() {
    setStep('browse');
    setAddType('');
  }

  const isSelfFetch = addType && WIDGET_TYPES[addType]?.selfFetch;
  const fields      = addType ? (WIDGET_TYPES[addType]?.fields || []) : [];
  const dataSources = addType ? (WIDGET_TYPES[addType]?.dataSources || []) : [];

  const filteredTypes = Object.entries(WIDGET_TYPES).filter(([, meta]) =>
    activeCategory === 'all' || meta.category === activeCategory
  );

  return (
    <div className="chart-lib-overlay" onClick={onClose}>
      <div className="chart-lib-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="chart-lib-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 'configure' && !isEdit && (
              <button className="btn-icon" onClick={handleBack} title="Back to library">
                <ArrowLeft size={14} />
              </button>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {step === 'browse'
                  ? 'Chart Library'
                  : isEdit
                    ? `Edit — ${WIDGET_TYPES[addType]?.name}`
                    : `Configure — ${WIDGET_TYPES[addType]?.name}`}
              </div>
              {step === 'browse' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                  {Object.keys(WIDGET_TYPES).length} chart types available
                </div>
              )}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="chart-lib-body">

          {/* Category sidebar */}
          <div className="chart-lib-sidebar">
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0 4px', marginBottom: 6 }}>
              Category
            </div>
            {WIDGET_CATEGORIES.map(cat => {
              const count = cat.id === 'all'
                ? Object.keys(WIDGET_TYPES).length
                : Object.values(WIDGET_TYPES).filter(t => t.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  className={`chart-lib-cat${activeCategory === cat.id ? ' active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span style={{ flex: 1 }}>{cat.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: activeCategory === cat.id ? 'var(--accent)' : 'var(--text-muted)',
                    background: activeCategory === cat.id ? 'var(--accent-muted)' : 'var(--bg-canvas)',
                    padding: '1px 6px', borderRadius: 10,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Content area */}
          <div className="chart-lib-content">

            {step === 'browse' ? (
              <div className="chart-lib-grid">
                {filteredTypes.map(([type, meta]) => (
                  <button
                    key={type}
                    className="chart-lib-card"
                    onClick={() => handleSelectType(type)}
                  >
                    <div className="chart-lib-preview">
                      {PREVIEWS[type] || <div style={{ color: '#4a5568', fontSize: 10 }}>{meta.name}</div>}
                    </div>
                    <div className="chart-lib-card-info">
                      <div className="chart-lib-card-name">{meta.name}</div>
                      <div className="chart-lib-card-desc">{meta.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="chart-lib-config">

                {/* Selected type recap */}
                {!isEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
                    <div className="chart-lib-preview" style={{ width: 64, height: 38, borderRadius: 6, border: '1px solid var(--border-muted)', flexShrink: 0 }}>
                      {PREVIEWS[addType]}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{WIDGET_TYPES[addType]?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{WIDGET_TYPES[addType]?.description}</div>
                    </div>
                  </div>
                )}

                {/* Title */}
                <div className="chart-lib-field">
                  <label>Widget Title</label>
                  <input
                    type="text"
                    value={addTitle}
                    onChange={e => setAddTitle(e.target.value)}
                    placeholder="Enter a title…"
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                  />
                </div>

                {/* Data source */}
                {!isSelfFetch && dataSources.length > 0 && (
                  <div className="chart-lib-field">
                    <label>Data Source</label>
                    <select
                      value={addDataSource}
                      onChange={e => setAddDataSource(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                    >
                      {dataSources.map(ds => (
                        <option key={ds} value={ds}>{DATA_SOURCE_LABELS[ds] || ds}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Type-specific fields */}
                {fields.map(f => (
                  <div className="chart-lib-field" key={f.key}>
                    <label>{f.label}</label>
                    {f.type === 'select' ? (
                      <select
                        value={addParams[f.key] ?? f.default ?? ''}
                        onChange={e => setAddParams({ ...addParams, [f.key]: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                      >
                        {f.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type || 'text'}
                        value={addParams[f.key] ?? f.default ?? ''}
                        onChange={e => setAddParams({ ...addParams, [f.key]: f.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                      />
                    )}
                  </div>
                ))}

                {/* Size picker */}
                <div className="chart-lib-field">
                  <label>Width</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {SIZE_OPTIONS.map(s => (
                      <SizePreview
                        key={s.value}
                        value={s.value}
                        selected={addSize === s.value}
                        onClick={() => setAddSize(s.value)}
                      />
                    ))}
                  </div>
                </div>

                {/* Confirm */}
                <div style={{ marginTop: 24 }}>
                  <button className="btn-primary" onClick={onConfirm} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                    {isEdit ? 'Update Widget' : 'Add to Dashboard'}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
