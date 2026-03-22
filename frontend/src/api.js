const BASE = '/api';

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  health:      () => fetchJson('/health'),
  stats:       () => fetchJson('/stats'),
  sources:     () => fetchJson('/stats/sources'),
  severity:    () => fetchJson('/stats/severity'),
  categories:  () => fetchJson('/stats/categories'),
  topIps:      (limit = 10) => fetchJson(`/stats/top-ips?limit=${limit}`),
  topUsers:    (limit = 10) => fetchJson(`/stats/top-users?limit=${limit}`),
  topActions:  (limit = 10) => fetchJson(`/stats/top-actions?limit=${limit}`),
  timeline:    (hours = 24) => fetchJson(`/stats/timeline?hours=${hours}`),
  events:      (params = {}) => {
    const q = new URLSearchParams();
    if (params.start)  q.set('start', params.start);
    if (params.end)    q.set('end', params.end);
    if (params.q)      q.set('q', params.q);
    if (params.limit)  q.set('limit', params.limit);
    if (params.offset) q.set('offset', params.offset);
    return fetchJson(`/events?${q.toString()}`);
  },
};
