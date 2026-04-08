import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { api } from '../api';
import {
  Layers, Maximize2, Minimize2, X, ExternalLink, Shield
} from 'lucide-react';

// ── Color system for sources ──
const KNOWN_COLORS = {
  Azure:       '#58a6ff',
  Entra:       '#58a6ff',
  M365:        '#d29922',
  UniFi:       '#3fb950',
  Meraki:      '#00d4aa',
  FortiGate:   '#db6d28',
  Fortinet:    '#db6d28',
  PaloAlto:    '#f0883e',
  Windows:     '#79c0ff',
  CrowdStrike: '#f85149',
  SentinelOne: '#bc8cff',
  Syslog:      '#bc8cff',
  Okta:        '#6e40c9',
  Duo:         '#3fb950',
  Sophos:      '#e3b341',
  Cisco:       '#00b4d8',
  AWS:         '#ff9800',
  GCP:         '#4285f4',
};

// Maps lowercase DB source_type values → display name (for color lookup + filter labels)
const SOURCE_DISPLAY_NAMES = {
  azure:       'Azure',
  entra:       'Entra',
  m365:        'M365',
  unifi:       'UniFi',
  meraki:      'Meraki',
  fortigate:   'FortiGate',
  fortinet:    'Fortinet',
  paloalto:    'PaloAlto',
  windows:     'Windows',
  crowdstrike: 'CrowdStrike',
  sentinelone: 'SentinelOne',
  syslog:      'Syslog',
  okta:        'Okta',
  duo:         'Duo',
  sophos:      'Sophos',
  cisco:       'Cisco',
  aws:         'AWS',
  gcp:         'GCP',
  rest_api:    'REST API',
};

function sourceDisplayName(source) {
  if (!source) return '';
  return SOURCE_DISPLAY_NAMES[source.toLowerCase()] || source;
}

const FALLBACK_PALETTE = [
  '#00d4aa', '#58a6ff', '#bc8cff', '#db6d28', '#d29922',
  '#f85149', '#3fb950', '#79c0ff', '#6e40c9', '#e3b341',
];
const _dynamicMap = {};
let _nextIdx = 0;
function colorForSource(source) {
  if (!source) return '#8b949e';
  // Try exact match first (handles already-capitalized names)
  if (KNOWN_COLORS[source]) return KNOWN_COLORS[source];
  // Try via display name normalization (handles lowercase DB values like "unifi")
  const display = SOURCE_DISPLAY_NAMES[source.toLowerCase()];
  if (display && KNOWN_COLORS[display]) return KNOWN_COLORS[display];
  if (_dynamicMap[source]) return _dynamicMap[source];
  _dynamicMap[source] = FALLBACK_PALETTE[_nextIdx % FALLBACK_PALETTE.length];
  _nextIdx++;
  return _dynamicMap[source];
}

const STATUS_COLOR = {
  online:  '#3fb950',
  offline: '#f85149',
  alert:   '#d29922',
};

const SEVERITY_COLORS = {
  critical: '#f85149',
  error:    '#f85149',
  high:     '#db6d28',
  warning:  '#d29922',
  medium:   '#d29922',
  low:      '#3fb950',
  info:     '#58a6ff',
  informational: '#58a6ff',
};

const SEVERITY_BG = {
  critical: '#c93c37', error: '#c93c37', high: '#a85620',
  warning: '#a67a1a', medium: '#a67a1a',
  low: '#2d8a3e', info: '#3d7ec7', informational: '#3d7ec7',
};

// ── Major world cities (label markers) ──
const CITY_LABELS = [
  { lat: 40.7128, lng: -74.0060, city: 'New York', size: 0.7 },
  { lat: 34.0522, lng: -118.2437, city: 'Los Angeles', size: 0.6 },
  { lat: 41.8781, lng: -87.6298, city: 'Chicago', size: 0.5 },
  { lat: 47.6062, lng: -122.3321, city: 'Seattle', size: 0.45 },
  { lat: 37.7749, lng: -122.4194, city: 'San Francisco', size: 0.5 },
  { lat: 25.7617, lng: -80.1918, city: 'Miami', size: 0.45 },
  { lat: 38.9072, lng: -77.0369, city: 'Washington DC', size: 0.55 },
  { lat: 51.5074, lng: -0.1278, city: 'London', size: 0.7 },
  { lat: 48.8566, lng: 2.3522, city: 'Paris', size: 0.6 },
  { lat: 52.5200, lng: 13.4050, city: 'Berlin', size: 0.5 },
  { lat: 55.7558, lng: 37.6173, city: 'Moscow', size: 0.6 },
  { lat: 35.6762, lng: 139.6503, city: 'Tokyo', size: 0.7 },
  { lat: 39.9042, lng: 116.4074, city: 'Beijing', size: 0.6 },
  { lat: 1.3521, lng: 103.8198, city: 'Singapore', size: 0.5 },
  { lat: 28.6139, lng: 77.2090, city: 'New Delhi', size: 0.55 },
  { lat: -33.8688, lng: 151.2093, city: 'Sydney', size: 0.55 },
  { lat: -23.5505, lng: -46.6333, city: 'Sao Paulo', size: 0.55 },
  { lat: 25.2048, lng: 55.2708, city: 'Dubai', size: 0.45 },
  { lat: 37.5665, lng: 126.9780, city: 'Seoul', size: 0.5 },
  { lat: 30.0444, lng: 31.2357, city: 'Cairo', size: 0.45 },
  { lat: 43.6532, lng: -79.3832, city: 'Toronto', size: 0.5 },
];

const ROTATION_SPEED = 0.15;

export default function Globe3D() {
  const navigate = useNavigate();
  const globeRef = useRef();
  const containerRef = useRef();
  const [activeSourceFilter, setActiveSourceFilter] = useState('all');
  const [activeSeverityFilter, setActiveSeverityFilter] = useState('all');
  const [allPoints, setAllPoints] = useState([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState([]);

  // Popup state
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [popupAlerts, setPopupAlerts] = useState([]);
  const [popupLoading, setPopupLoading] = useState(false);

  // Auto-rotation
  const rotationRef = useRef({ active: true, angle: -100 });
  const interactionTimer = useRef(null);
  const animFrameRef = useRef(null);
  const savedScrollRef = useRef(0);

  // Fullscreen scroll lock
  useEffect(() => {
    if (fullscreen) {
      savedScrollRef.current = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      requestAnimationFrame(() => window.scrollTo(0, savedScrollRef.current));
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [fullscreen]);

  // Fetch world + US boundaries
  useEffect(() => {
    Promise.all([
      fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json').then(r => r.json()),
      fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(r => r.json()),
    ])
      .then(([worldTopo, usTopo]) => {
        const worldGeo = feature(worldTopo, worldTopo.objects.countries);
        const usGeo = feature(usTopo, usTopo.objects.states);
        const countriesNoUS = worldGeo.features.filter(f => f.id !== '840');
        setCountries([...countriesNoUS, ...usGeo.features]);
      })
      .catch(() => {});
  }, []);

  // Fetch geo points from API — no demo data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.geoPoints('', '');
        if (cancelled) return;
        setAllPoints(data.points || []);
      } catch {
        if (!cancelled) setAllPoints([]);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fullscreen]);

  // Auto-rotation
  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
    }
    function animate() {
      if (rotationRef.current.active && globeRef.current) {
        const pov = globeRef.current.pointOfView();
        rotationRef.current.angle += ROTATION_SPEED;
        globeRef.current.pointOfView({ lng: rotationRef.current.angle, lat: pov.lat, altitude: pov.altitude }, 0);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    }
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [globeReady]);

  const pauseRotation = useCallback(() => {
    rotationRef.current.active = false;
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
  }, []);

  const resumeRotation = useCallback(() => {
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => {
      if (globeRef.current) {
        rotationRef.current.angle = globeRef.current.pointOfView().lng;
      }
      rotationRef.current.active = true;
    }, 3000);
  }, []);

  const handlePointHover = useCallback((point) => {
    if (point) { pauseRotation(); } else { resumeRotation(); }
  }, [pauseRotation, resumeRotation]);

  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true);
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 34, lng: -95, altitude: fullscreen ? 2.0 : 1.5 }, 0);
    }
  }, [fullscreen]);

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    const pov = globeRef.current.pointOfView();
    globeRef.current.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: fullscreen ? 2.0 : 1.5 }, 800);
  }, [fullscreen, globeReady]);

  // ── Client-side filtering by source AND severity ──
  const points = useMemo(() => {
    let filtered = allPoints;
    if (activeSourceFilter !== 'all') {
      filtered = filtered.filter(p => p.source === activeSourceFilter);
    }
    if (activeSeverityFilter !== 'all') {
      filtered = filtered.filter(p => (p.severity || 'info').toLowerCase() === activeSeverityFilter);
    }
    return filtered;
  }, [allPoints, activeSourceFilter, activeSeverityFilter]);

  // Discover source filters from data
  const sourceFilters = useMemo(() => {
    const seen = new Map();
    for (const p of allPoints) {
      seen.set(p.source, (seen.get(p.source) || 0) + 1);
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => ({ id: name, label: sourceDisplayName(name), color: colorForSource(name) }));
  }, [allPoints]);

  // Discover severity filters from data
  const severityFilters = useMemo(() => {
    const seen = new Map();
    for (const p of allPoints) {
      const sev = (p.severity || 'info').toLowerCase();
      seen.set(sev, (seen.get(sev) || 0) + 1);
    }
    const order = ['critical', 'error', 'warning', 'info'];
    return order
      .filter(s => seen.has(s))
      .map(s => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1), color: SEVERITY_COLORS[s], count: seen.get(s) }));
  }, [allPoints]);

  // Stats
  const stats = useMemo(() => {
    const byStatus = { online: 0, offline: 0, alert: 0 };
    const bySeverity = {};
    let total = 0;
    for (const p of points) {
      if (byStatus[p.status] !== undefined) byStatus[p.status]++;
      const sev = (p.severity || 'info').toLowerCase();
      bySeverity[sev] = (bySeverity[sev] || 0) + (p.count || 1);
      total += p.count || 1;
    }
    return { byStatus, bySeverity, totalEvents: total, totalPoints: points.length };
  }, [points]);

  // Point accessors
  const pointColor = useCallback(p => colorForSource(p.source), []);
  const pointAlt = useCallback(p => Math.max(0.01, Math.min(0.08, 0.01 + Math.log2(p.count + 1) * 0.008)), []);
  const pointRadius = useCallback(p => Math.max(0.15, Math.min(0.6, 0.15 + Math.log2(p.count + 1) * 0.1)), []);

  // Location groups for rich tooltips
  const locationGroups = useMemo(() => {
    const groups = new Map();
    for (const p of allPoints) {
      const key = `${Math.round(p.lat * 10) / 10},${Math.round(p.lng * 10) / 10}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    return groups;
  }, [allPoints]);

  const pointLabel = useCallback(p => {
    const key = `${Math.round(p.lat * 10) / 10},${Math.round(p.lng * 10) / 10}`;
    const group = locationGroups.get(key) || [p];

    const bySource = new Map();
    for (const pt of group) {
      if (!bySource.has(pt.source)) bySource.set(pt.source, []);
      bySource.get(pt.source).push(pt);
    }

    let servicesHtml = '';
    for (const [source, pts] of bySource) {
      const sColor = colorForSource(source);
      const devices = pts.map(pt => {
        const name = pt.details?.model || pt.label.split('\u2014').pop()?.trim() || pt.type;
        const stColor = STATUS_COLOR[pt.status] || '#8b949e';
        const sevColor = SEVERITY_COLORS[(pt.severity || 'info').toLowerCase()] || '#58a6ff';
        return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
          <span style="width:5px;height:5px;border-radius:50%;background:${stColor};flex-shrink:0"></span>
          <span style="color:#c9d1d9;font-size:11px">${name}</span>
          <span style="color:${sevColor};font-size:10px;margin-left:auto">${pt.severity || 'info'}</span>
          ${pt.count > 1 ? `<span style="color:#8b949e;font-size:10px">(${pt.count})</span>` : ''}
        </div>`;
      }).join('');

      servicesHtml += `
        <div style="margin-top:5px">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
            <span style="width:7px;height:7px;border-radius:50%;background:${sColor};flex-shrink:0"></span>
            <span style="color:#e6edf3;font-weight:600;font-size:11px">${source}</span>
            <span style="color:#8b949e;font-size:10px">(${pts.length})</span>
          </div>
          <div style="padding-left:12px">${devices}</div>
        </div>
      `;
    }

    const locationName = p.label.split('\u2014')[0].trim();
    return `
      <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:10px 14px;font-size:12px;color:#e6edf3;min-width:200px;max-width:280px;font-family:-apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.4)">
        <div style="font-weight:700;font-size:13px;margin-bottom:2px">${locationName}</div>
        <div style="color:#8b949e;font-size:11px;margin-bottom:4px;border-bottom:1px solid #21262d;padding-bottom:5px">
          ${group.length} event${group.length !== 1 ? 's' : ''} &middot; ${[...bySource.keys()].length} source${[...bySource.keys()].length !== 1 ? 's' : ''}
        </div>
        ${servicesHtml}
        <div style="margin-top:6px;padding-top:5px;border-top:1px solid #21262d;color:#58a6ff;font-size:10px;text-align:center">
          Click to view events
        </div>
      </div>
    `;
  }, [locationGroups]);

  // Click handler — open popup
  const handlePointClick = useCallback(p => {
    setSelectedPoint(p);
    setPopupAlerts([]);
    setPopupLoading(true);
    api.alerts({ source_type: p.source })
      .then(data => {
        const list = Array.isArray(data) ? data : data?.alerts || data?.data || [];
        setPopupAlerts(list.slice(0, 20));
      })
      .catch(() => setPopupAlerts([]))
      .finally(() => setPopupLoading(false));
  }, []);

  const closePopup = useCallback(() => {
    setSelectedPoint(null);
    setPopupAlerts([]);
    setPopupLoading(false);
  }, []);

  const globeMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color('#0a0f18'),
      emissive: new THREE.Color('#040810'),
      emissiveIntensity: 0.3,
      shininess: 10,
    });
  }, []);

  const noData = allPoints.length === 0;

  return (
    <div className={`globe-dashboard ${fullscreen ? 'globe-fullscreen' : ''}`}>
      {/* Source filter bar */}
      <div className="globe-filter-bar">
        <button
          className={`geo-filter-btn ${activeSourceFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSourceFilter('all')}
          style={activeSourceFilter === 'all' ? { borderColor: '#00d4aa', color: '#00d4aa' } : {}}
        >
          <Layers size={13} />
          <span>All Sources</span>
          <span className="geo-filter-count">{allPoints.length}</span>
        </button>
        {sourceFilters.map(f => (
          <button
            key={f.id}
            className={`geo-filter-btn ${activeSourceFilter === f.id ? 'active' : ''}`}
            onClick={() => setActiveSourceFilter(f.id)}
            style={activeSourceFilter === f.id ? { borderColor: f.color, color: f.color } : {}}
          >
            <span className="geo-filter-swatch" style={{ background: f.color }} />
            <span>{f.label}</span>
          </button>
        ))}

        {/* Severity filter separator */}
        {severityFilters.length > 0 && <span className="geo-legend-separator" style={{ margin: '0 4px' }} />}

        {/* Severity filters */}
        <button
          className={`geo-filter-btn ${activeSeverityFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSeverityFilter('all')}
          style={activeSeverityFilter === 'all' ? { borderColor: '#8b949e', color: '#8b949e' } : {}}
        >
          <Shield size={13} />
          <span>All Severity</span>
        </button>
        {severityFilters.map(f => (
          <button
            key={f.id}
            className={`geo-filter-btn ${activeSeverityFilter === f.id ? 'active' : ''}`}
            onClick={() => setActiveSeverityFilter(f.id)}
            style={activeSeverityFilter === f.id ? { borderColor: f.color, color: f.color } : {}}
          >
            <span className="geo-filter-swatch" style={{ background: f.color }} />
            <span>{f.label}</span>
            <span className="geo-filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Status + expand */}
      <div className="globe-status-row">
        <div className="globe-stats">
          <span className="globe-stat"><span className="geo-stat-dot" style={{ background: '#3fb950' }} />{stats.byStatus.online} Online</span>
          <span className="globe-stat"><span className="geo-stat-dot" style={{ background: '#f85149' }} />{stats.byStatus.offline} Offline</span>
          <span className="globe-stat"><span className="geo-stat-dot" style={{ background: '#d29922' }} />{stats.byStatus.alert} Alerts</span>
          <span className="globe-stat-sep" />
          <span className="globe-stat">{stats.totalPoints} locations</span>
          <span className="globe-stat">{stats.totalEvents.toLocaleString()} events</span>
        </div>
        <button
          className="geo-expand-btn"
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? 'Collapse' : 'Expand'}
          style={{ position: 'relative', top: 'auto', left: 'auto' }}
        >
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Globe container */}
      <div
        className="globe-container"
        ref={containerRef}
        onMouseDown={pauseRotation}
        onMouseUp={resumeRotation}
        onTouchStart={pauseRotation}
        onTouchEnd={resumeRotation}
        onWheel={() => { pauseRotation(); resumeRotation(); }}
      >
        {noData && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            color: '#8b949e', textAlign: 'center', zIndex: 10, pointerEvents: 'none',
            background: 'rgba(13,17,23,0.85)', padding: '16px 24px', borderRadius: 10,
            border: '1px solid #21262d'
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No geo data yet</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Enable Azure, UniFi, or other integrations with location data to see events on the globe.
            </div>
          </div>
        )}
        {dimensions.width > 0 && (
          <Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            onGlobeReady={handleGlobeReady}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl=""
            showGlobe={true}
            showAtmosphere={true}
            atmosphereColor="#1a6baa"
            atmosphereAltitude={0.18}

            globeMaterial={globeMaterial}

            polygonsData={countries}
            polygonCapColor={() => 'rgba(10, 20, 40, 0.6)'}
            polygonSideColor={() => 'rgba(20, 40, 80, 0.2)'}
            polygonStrokeColor={() => '#1a3a5c'}
            polygonAltitude={0.005}
            polygonLabel={() => null}

            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor={pointColor}
            pointAltitude={pointAlt}
            pointRadius={pointRadius}
            pointLabel={pointLabel}
            onPointClick={handlePointClick}
            onPointHover={handlePointHover}
            pointsMerge={false}

            labelsData={CITY_LABELS}
            labelLat="lat"
            labelLng="lng"
            labelText="city"
            labelSize={d => d.size * 1.2}
            labelDotRadius={d => d.size * 0.35}
            labelColor={() => 'rgba(180, 200, 220, 0.7)'}
            labelResolution={2}
            labelAltitude={0.007}
            labelDotOrientation={() => 'bottom'}
          />
        )}
      </div>

      {/* Legend */}
      <div className="globe-legend">
        {sourceFilters.map(f => (
          <div key={f.id} className="geo-legend-item">
            <span className="geo-legend-dot" style={{ background: f.color }} />
            <span>{f.label}</span>
          </div>
        ))}
        {sourceFilters.length > 0 && severityFilters.length > 0 && <div className="geo-legend-separator" />}
        {severityFilters.map(f => (
          <div key={f.id} className="geo-legend-item">
            <span className="geo-legend-dot" style={{ background: f.color }} />
            <span>{f.label}</span>
          </div>
        ))}
        <div className="geo-legend-separator" />
        <div className="geo-legend-item">
          <span className="geo-legend-ring" style={{ borderColor: '#3fb950' }} />
          <span>Online</span>
        </div>
        <div className="geo-legend-item">
          <span className="geo-legend-ring" style={{ borderColor: '#f85149' }} />
          <span>Offline</span>
        </div>
        <div className="geo-legend-item">
          <span className="geo-legend-ring geo-legend-pulse" style={{ borderColor: '#d29922' }} />
          <span>Alert</span>
        </div>
      </div>

      {/* Alert popup overlay */}
      {selectedPoint && (
        <div className="globe-popup-overlay" onClick={closePopup}>
          <div className="globe-popup" onClick={e => e.stopPropagation()}>
            <div className="globe-popup-header">
              <div>
                <div className="globe-popup-title">
                  <span className="globe-popup-dot" style={{ background: colorForSource(selectedPoint.source) }} />
                  {selectedPoint.label}
                </div>
                <div className="globe-popup-subtitle">
                  {selectedPoint.source} &middot; {selectedPoint.type} &middot;{' '}
                  <span style={{ color: SEVERITY_COLORS[(selectedPoint.severity || 'info').toLowerCase()] || '#58a6ff' }}>
                    {selectedPoint.severity || 'info'}
                  </span>
                  {' '}&middot;{' '}
                  <span style={{ color: STATUS_COLOR[selectedPoint.status] || '#8b949e' }}>{selectedPoint.status}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <button className="globe-popup-link" onClick={() => { closePopup(); navigate(`/events?source_type=${selectedPoint.source}`); }}>
                  <ExternalLink size={12} /> View All
                </button>
                <button className="globe-popup-close" onClick={closePopup}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="globe-popup-body">
              {popupLoading ? (
                <div className="globe-popup-loading">
                  <div className="loading-spinner" style={{ width: 18, height: 18 }} /> Loading alerts...
                </div>
              ) : popupAlerts.length === 0 ? (
                <div className="globe-popup-empty">No recent alerts for {selectedPoint.source}</div>
              ) : (
                <div className="globe-popup-alerts">
                  {popupAlerts.map((alert, i) => (
                    <div key={alert.id || i} className="globe-popup-alert">
                      <div className="globe-popup-alert-sev" style={{
                        background: SEVERITY_BG[alert.severity?.toLowerCase()] || '#3d7ec7'
                      }} />
                      <div className="globe-popup-alert-content">
                        <div className="globe-popup-alert-name">{alert.rule_name || alert.name || 'Alert'}</div>
                        <div className="globe-popup-alert-meta">
                          {alert.severity || 'info'} &middot;{' '}
                          {alert.timestamp ? new Date(typeof alert.timestamp === 'number' ? alert.timestamp * 1000 : alert.timestamp).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
