import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Shield, LayoutDashboard, List, Bell, Settings as SettingsIcon, Database } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import DataSources from './pages/DataSources';
import './App.css';

function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const check = () => fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth(null));
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon"><Shield size={18} /></div>
            <div>
              <h1>Outpost</h1>
              <span className="version">SIEM v0.2.0</span>
            </div>
          </div>

          <div className="sidebar-section">Monitor</div>
          <div className="sidebar-nav">
            <NavLink to="/" end><LayoutDashboard size={16} /> Dashboard</NavLink>
            <NavLink to="/events"><List size={16} /> Events</NavLink>
            <NavLink to="/alerts"><Bell size={16} /> Alerts</NavLink>
          </div>

          <div className="sidebar-section">Manage</div>
          <div className="sidebar-nav">
            <NavLink to="/sources"><Database size={16} /> Data Sources</NavLink>
            <NavLink to="/settings"><SettingsIcon size={16} /> Settings</NavLink>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-status">
              <span className={`pulse ${health ? '' : 'error'}`} />
              {health ? 'System Online' : 'Disconnected'}
            </div>
          </div>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/sources" element={<DataSources />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
