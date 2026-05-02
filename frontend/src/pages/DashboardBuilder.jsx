import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, ArrowLeft, X, Settings } from 'lucide-react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import WidgetRenderer from '../widgets/WidgetRenderer';
import WidgetModal from '../components/WidgetModal';
import {
  WIDGET_TYPES,
  SIZE_TO_W, TYPE_DEFAULT_H, DEFAULT_DASHBOARD, migrateDashboard,
} from '../widgets/WidgetRegistry';
import { api } from '../api';

const RGL = WidthProvider(GridLayout);

function loadDashboard() {
  try {
    const stored = localStorage.getItem('kallix_dashboard');
    if (stored) return migrateDashboard(JSON.parse(stored));
  } catch {}
  return DEFAULT_DASHBOARD;
}

function saveDashboard(dashboard) {
  localStorage.setItem('kallix_dashboard', JSON.stringify(dashboard));
}

let widgetIdCounter = Date.now();
function newWidgetId() { return `w_${widgetIdCounter++}`; }

function getBottomY(widgets) {
  if (!widgets.length) return 0;
  return Math.max(...widgets.map(w => (w.y ?? 0) + (w.h ?? 8)));
}

function wToSize(w) {
  if (w >= 12) return 'full';
  if (w >= 6)  return 'half';
  if (w >= 4)  return 'third';
  return 'quarter';
}

export default function DashboardBuilder() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(loadDashboard);
  const [widgetData, setWidgetData] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editWidget, setEditWidget] = useState(null);

  const [addType, setAddType]           = useState('');
  const [addTitle, setAddTitle]         = useState('');
  const [addDataSource, setAddDataSource] = useState('');
  const [addSize, setAddSize]           = useState('half');
  const [addParams, setAddParams]       = useState({});

  useEffect(() => {
    async function fetchAll() {
      const data = {};
      const needed = new Set(
        dashboard.widgets.filter(w => w.dataSource !== '_self').map(w => w.dataSource)
      );
      const fetchers = {
        health:     () => api.health(),
        timeline:   () => api.timeline(24),
        sources:    () => api.sources(),
        severity:   () => api.severity(),
        categories: () => api.categories(),
        topIps:     () => api.topIps(10),
        topUsers:   () => api.topUsers(10),
        topActions: () => api.topActions(10),
      };
      await Promise.all([...needed].map(async ds => {
        try { data[ds] = await fetchers[ds]?.(); } catch {}
      }));
      setWidgetData(data);
    }
    fetchAll();
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, [dashboard.widgets.length]);

  function handleSave() {
    saveDashboard(dashboard);
    navigate('/');
  }

  function handleReset() {
    setDashboard(DEFAULT_DASHBOARD);
    saveDashboard(DEFAULT_DASHBOARD);
  }

  function handleLayoutChange(newLayout) {
    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => {
        const item = newLayout.find(l => l.i === w.id);
        if (!item) return w;
        return { ...w, x: item.x, y: item.y, w: item.w, h: item.h };
      }),
    }));
  }

  function removeWidget(id) {
    setDashboard(prev => ({ ...prev, widgets: prev.widgets.filter(w => w.id !== id) }));
  }

  function openAdd() {
    setAddType(''); setAddTitle(''); setAddDataSource(''); setAddSize('half'); setAddParams({});
    setEditWidget(null);
    setShowAddModal(true);
  }

  function openEdit(widget, idx) {
    setAddType(widget.type);
    setAddTitle(widget.title);
    setAddDataSource(widget.dataSource);
    setAddSize(wToSize(widget.w ?? 6));
    setAddParams(widget.params || {});
    setEditWidget(idx);
    setShowAddModal(true);
  }

  function selectType(type) {
    setAddType(type);
    setAddTitle(WIDGET_TYPES[type]?.name || type);
    const ds = WIDGET_TYPES[type]?.dataSources;
    setAddDataSource(ds?.[0] || '');
    if (type === 'geo_map') setAddSize('full');
    const params = {};
    WIDGET_TYPES[type]?.fields?.forEach(f => { params[f.key] = f.default ?? ''; });
    setAddParams(params);
  }

  function confirmAdd() {
    if (!addType || !addTitle) return;
    const isNew = editWidget === null;
    const existing = isNew ? null : dashboard.widgets[editWidget];
    const newW = SIZE_TO_W[addSize] || 6;

    const widget = {
      id:         isNew ? newWidgetId() : existing.id,
      type:       addType,
      title:      addTitle,
      dataSource: addDataSource,
      params:     addParams,
      x: isNew ? 0                           : existing.x,
      y: isNew ? getBottomY(dashboard.widgets) : existing.y,
      w: newW,
      h: isNew ? (TYPE_DEFAULT_H[addType] || 8) : existing.h,
    };

    const widgets = isNew
      ? [...dashboard.widgets, widget]
      : dashboard.widgets.map((w, i) => i === editWidget ? widget : w);

    setDashboard({ ...dashboard, widgets });
    setShowAddModal(false);
  }

  const layout = dashboard.widgets.map(w => ({
    i: w.id, x: w.x ?? 0, y: w.y ?? 0, w: w.w ?? 6, h: w.h ?? 8,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customize Dashboard</h1>
          <div className="subtitle">Drag to reorder · Drag edges to resize · Drop anywhere</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => navigate('/')}><ArrowLeft size={14} /> Back</button>
          <button className="btn-secondary" onClick={handleReset}>Reset Default</button>
          <button className="btn-primary" onClick={handleSave}><Save size={14} /> Save & View</button>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn-secondary" onClick={openAdd}><Plus size={14} /> Add Widget</button>
      </div>

      {showAddModal && (
        <WidgetModal
          isEdit={editWidget !== null}
          addType={addType} addTitle={addTitle} addDataSource={addDataSource}
          addSize={addSize} addParams={addParams}
          setAddType={setAddType} setAddTitle={setAddTitle} setAddDataSource={setAddDataSource}
          setAddSize={setAddSize} setAddParams={setAddParams}
          onConfirm={confirmAdd}
          onClose={() => setShowAddModal(false)}
          onSelectType={selectType}
        />
      )}

      <RGL
        layout={layout}
        cols={12}
        rowHeight={34}
        margin={[4, 4]}
        draggableHandle=".widget-drag-handle"
        onLayoutChange={handleLayoutChange}
        className="rgl-builder"
      >
        {dashboard.widgets.map((widget, idx) => (
          <div key={widget.id} className="grafana-panel widget-card">
            <div className="grafana-panel-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div className="widget-drag-handle" title="Drag to move">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none"/>
                    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/>
                    <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none"/>
                    <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none"/>
                    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/>
                    <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                </div>
                <span className="grafana-panel-title">{widget.title}</span>
                <span className="widget-size-badge">{widget.w}×{widget.h}</span>
              </div>
              <div className="widget-actions" style={{ opacity: 1, flexShrink: 0 }}>
                <button className="btn-icon-sm" onClick={() => openEdit(widget, idx)} title="Edit"><Settings size={12} /></button>
                <button className="btn-icon-sm danger" onClick={() => removeWidget(widget.id)} title="Remove"><X size={12} /></button>
              </div>
            </div>
            <div className="grafana-panel-body">
              <WidgetRenderer type={widget.type} data={widgetData[widget.dataSource]} config={widget} />
            </div>
          </div>
        ))}
      </RGL>

      {dashboard.widgets.length === 0 && (
        <div className="table-container">
          <div className="empty">
            <p>Dashboard is empty. Click "Add Widget" to get started.</p>
          </div>
        </div>
      )}
    </div>
  );
}
