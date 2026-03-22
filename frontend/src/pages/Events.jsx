import { useState, useEffect, useCallback, Fragment } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api';

const SEVERITY_CLASS = {
  critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info',
  informational: 'info', warning: 'medium', error: 'high', emergency: 'critical',
  debug: 'info', unknown: 'info',
};

const SOURCE_CLASS = {
  azure: 'azure', m365: 'm365', fortigate: 'fortigate',
  windows: 'windows', syslog: 'syslog', unknown: 'unknown',
};

function formatTs(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function prettyRaw(raw) {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

const PAGE_SIZE = 50;

export default function Events() {
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset };
      if (searchTerm) params.q = searchTerm;
      const data = await api.events(params);
      setEvents(data.events || []);
      setTotal(data.count || 0);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, [searchTerm, offset]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e) {
    e.preventDefault();
    setSearchTerm(query);
    setOffset(0);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Events</h1>
          <div className="subtitle">Browse and search security events across all sources</div>
        </div>
      </div>

      <div className="table-container">
        <form className="table-toolbar" onSubmit={handleSearch}>
          <Search size={14} style={{color: 'var(--text-muted)', flexShrink: 0}} />
          <input
            type="text"
            placeholder="Search events (full-text across all fields)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-search">Search</button>
        </form>

        {loading ? (
          <div className="loading"><div className="loading-spinner" /><div>Loading events...</div></div>
        ) : events.length === 0 ? (
          <div className="empty">No events found{searchTerm ? ` matching "${searchTerm}"` : ''}</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{width: 28}}></th>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>Src IP</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <Fragment key={e.event_id}>
                    <tr className="clickable" onClick={() => setExpanded(expanded === e.event_id ? null : e.event_id)}>
                      <td style={{padding: '8px 4px 8px 12px', color: 'var(--text-muted)'}}>
                        {expanded === e.event_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="time-cell">{formatTs(e.timestamp)}</td>
                      <td>
                        <span className={`source-badge ${SOURCE_CLASS[e.source_type?.toLowerCase()] || 'unknown'}`}>
                          {e.source_type}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${SEVERITY_CLASS[e.severity?.toLowerCase()] || 'info'}`}>
                          {e.severity}
                        </span>
                      </td>
                      <td>{e.category}</td>
                      <td style={{maxWidth: 200}}>{e.action}</td>
                      <td className="mono">{e.src_ip}</td>
                      <td style={{maxWidth: 180}}>{e.user_name}</td>
                    </tr>
                    {expanded === e.event_id && (
                      <tr>
                        <td colSpan={8} style={{padding: 0}}>
                          <div className="expanded-row">{prettyRaw(e.raw)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <span className="page-info">
                Showing {offset + 1}&ndash;{offset + events.length}
                {searchTerm && <> matching &ldquo;{searchTerm}&rdquo;</>}
              </span>
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Previous
              </button>
              <button disabled={events.length < PAGE_SIZE} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
