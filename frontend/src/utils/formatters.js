// Shared formatting utilities

// Format epoch ms to "Mar 24 10:36:24 PM"
export function formatTs(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Format epoch ms to "10:36 PM"
export function formatTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format epoch ms to "Mar 24"
export function formatDate(ms) {
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Format large numbers: 1500 -> "1.5K", 2000000 -> "2.0M"
export function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return (n ?? 0).toLocaleString();
}

// Format ms duration to "2d 5h", "3h 12m", or "45s"
export function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// Pretty-print raw JSON string
export function prettyRaw(raw) {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}
