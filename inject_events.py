#!/usr/bin/env python3
"""Inject realistic demo events into Kallix SIEM via HEC endpoint."""

import json, random, time, urllib.request, urllib.error
from datetime import datetime, timezone

HEC_URL   = "http://127.0.0.1:8888/api/hec/v1"
HEC_TOKEN = "4a5cba2e-f3fe-4643-8a7d-8628427b6128"
NOW       = int(time.time())
H24       = 86400   # seconds in 24 hours

# ── Geo locations for globe coverage ──────────────────────────────────────────
CITIES = [
    ("New York",       "United States",    40.7128,  -74.0060),
    ("Los Angeles",    "United States",    34.0522, -118.2437),
    ("Chicago",        "United States",    41.8781,  -87.6298),
    ("Toronto",        "Canada",           43.6532,  -79.3832),
    ("Mexico City",    "Mexico",           19.4326,  -99.1332),
    ("São Paulo",      "Brazil",          -23.5505,  -46.6333),
    ("Buenos Aires",   "Argentina",       -34.6037,  -58.3816),
    ("London",         "United Kingdom",   51.5074,   -0.1278),
    ("Paris",          "France",           48.8566,    2.3522),
    ("Berlin",         "Germany",          52.5200,   13.4050),
    ("Amsterdam",      "Netherlands",      52.3676,    4.9041),
    ("Madrid",         "Spain",            40.4168,   -3.7038),
    ("Warsaw",         "Poland",           52.2297,   21.0122),
    ("Kyiv",           "Ukraine",          50.4501,   30.5234),
    ("Moscow",         "Russia",           55.7558,   37.6173),
    ("Istanbul",       "Turkey",           41.0082,   28.9784),
    ("Tehran",         "Iran",             35.6892,   51.3890),
    ("Dubai",          "UAE",              25.2048,   55.2708),
    ("Mumbai",         "India",            19.0760,   72.8777),
    ("Bangalore",      "India",            12.9716,   77.5946),
    ("Delhi",          "India",            28.6139,   77.2090),
    ("Beijing",        "China",            39.9042,  116.4074),
    ("Shanghai",       "China",            31.2304,  121.4737),
    ("Hong Kong",      "China",            22.3193,  114.1694),
    ("Seoul",          "South Korea",      37.5665,  126.9780),
    ("Tokyo",          "Japan",            35.6762,  139.6503),
    ("Singapore",      "Singapore",         1.3521,  103.8198),
    ("Sydney",         "Australia",       -33.8688,  151.2093),
    ("Melbourne",      "Australia",       -37.8136,  144.9631),
    ("Lagos",          "Nigeria",           6.5244,    3.3792),
    ("Nairobi",        "Kenya",            -1.2921,   36.8219),
    ("Johannesburg",   "South Africa",    -26.2041,   28.0473),
    ("Cairo",          "Egypt",            30.0444,   31.2357),
    ("Casablanca",     "Morocco",          33.5731,   -7.5898),
]

# ── Source types and their typical data ───────────────────────────────────────
SOURCE_TYPES = ["azure", "fortigate", "windows", "m365", "unifi", "syslog",
                "cef", "okta", "crowdstrike", "sentinelone"]

USERS = [
    "alice@kallix.cloud", "bob.chen@kallix.cloud", "carol.smith@kallix.cloud",
    "dave@kallix.cloud",  "eve.jones@kallix.cloud", "frank@kallix.cloud",
    "grace.lee@kallix.cloud", "henry@kallix.cloud", "iris@kallix.cloud",
    "jill.wu@kallix.cloud", "kevin@kallix.cloud",  "linda@kallix.cloud",
    "mike.taylor@kallix.cloud", "nancy@kallix.cloud", "oscar@kallix.cloud",
]

INTERNAL_IPS = [
    "10.0.1.10", "10.0.1.20", "10.0.1.30", "10.0.2.5",  "10.0.2.15",
    "192.168.1.100", "192.168.1.101", "192.168.1.200", "192.168.10.50",
    "172.16.0.10",   "172.16.0.20",   "172.16.1.5",
]

EXTERNAL_IPS = [
    "185.220.101.42",  "91.108.4.200",   "203.0.113.88",   "198.51.100.14",
    "45.142.212.100",  "77.83.246.12",   "194.165.16.76",  "179.43.143.10",
    "185.156.73.55",   "92.63.196.30",   "5.188.206.14",   "80.82.77.139",
    "141.98.80.135",   "198.235.24.230", "104.21.50.33",   "162.247.74.200",
    "23.129.64.214",   "51.83.255.80",   "109.201.133.40", "46.161.27.155",
]

RESOURCES = [
    "SharePoint", "OneDrive", "Exchange", "Teams", "Azure Portal",
    "AWS Console", "VPN Gateway", "Domain Controller", "File Server",
    "HR Database", "Finance App", "CRM System", "Dev Repository",
    "Mail Server", "Web Proxy", "Firewall Console", "EDR Console",
    "C:\\Windows\\System32\\lsass.exe", "C:\\Users\\Public\\malware.exe",
    "/etc/passwd", "/etc/shadow", "/var/log/auth.log",
]

HOSTNAMES = [
    "DESKTOP-A1B2C3", "LAPTOP-X7Y8Z9", "WS-FINANCE-01", "WS-DEV-04",
    "SRV-DC-01", "SRV-FILE-02", "SRV-WEB-03", "SRV-DB-01",
    "fw-01.int", "sw-core-01", "ap-lobby-01", "vpn-gw-01",
    "macbook-alice", "macbook-bob", "LINUX-DEV-05",
]

# ── Actions per category ───────────────────────────────────────────────────────
ACTIONS = {
    "auth":     ["login_success", "login_failure", "logout", "password_change",
                 "mfa_success", "mfa_failure", "account_lockout", "privilege_escalation",
                 "new_device_login", "impossible_travel"],
    "network":  ["allow", "deny", "drop", "connection_established", "connection_reset",
                 "port_scan", "dns_query", "vpn_connect", "vpn_disconnect",
                 "bandwidth_spike", "lateral_movement"],
    "endpoint": ["process_create", "file_create", "file_delete", "file_modify",
                 "registry_change", "dll_load", "malware_detected", "threat_blocked",
                 "usb_insert", "script_exec", "memory_injection"],
    "cloud":    ["resource_created", "resource_deleted", "policy_change",
                 "data_export", "permission_grant", "permission_revoke",
                 "storage_access", "compute_start", "compute_stop", "config_change"],
    "system":   ["service_start", "service_stop", "config_change", "user_added",
                 "user_deleted", "group_change", "audit_log_cleared",
                 "time_change", "software_install", "patch_applied"],
}

SEVERITY_WEIGHTS = {
    "info":     40,
    "notice":   25,
    "warning":  20,
    "error":    10,
    "critical":  5,
}

def weighted_choice(d):
    keys = list(d.keys())
    weights = list(d.values())
    return random.choices(keys, weights=weights)[0]

def rand_city():
    return random.choice(CITIES)

def make_event(ts_offset_range=(0, H24), force_severity=None, force_category=None,
               force_src_ip=None, force_user=None, force_source_type=None):
    city, country, lat, lon = rand_city()
    category    = force_category or random.choice(list(ACTIONS.keys()))
    severity    = force_severity or weighted_choice(SEVERITY_WEIGHTS)
    action      = random.choice(ACTIONS[category])
    source_type = force_source_type or random.choice(SOURCE_TYPES)
    src_ip      = force_src_ip or random.choice(EXTERNAL_IPS + INTERNAL_IPS)
    dst_ip      = random.choice(INTERNAL_IPS)
    user        = force_user or (random.choice(USERS) if category in ("auth","cloud","endpoint") else "")
    host        = random.choice(HOSTNAMES)
    resource    = random.choice(RESOURCES)
    ts          = NOW - random.randint(*ts_offset_range)

    outcome = "success"
    if "failure" in action or "deny" in action or "drop" in action or \
       "block" in action or "lockout" in action or "malware" in action:
        outcome = "failure"

    event = {
        "source_type":  source_type,
        "severity":     severity,
        "category":     category,
        "action":       action,
        "outcome":      outcome,
        "src_ip":       src_ip,
        "dst_ip":       dst_ip,
        "src_port":     random.randint(1024, 65535),
        "dst_port":     random.choice([22, 80, 443, 445, 3389, 8080, 3306, 1433, 5432]),
        "source_host":  host,
        "user_name":    user,
        "resource":     resource,
        "message":  f"{action.replace('_',' ').title()} from {city}",
        # Top-level geo fields so the parser worker and geo SQL both find them
        "latitude":  lat,
        "longitude": lon,
        "city":      city,
        "country":   country
    }

    return {
        "time":       ts,
        "host":       host,
        "source":     source_type,
        "sourcetype": source_type,
        "event":      event,
    }

def send_batch(events):
    body = "\n".join(json.dumps(e) for e in events).encode()
    req  = urllib.request.Request(
        HEC_URL,
        data=body,
        headers={
            "Authorization":  f"Splunk {HEC_TOKEN}",
            "Content-Type":   "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# ── Build event list ───────────────────────────────────────────────────────────
events = []

# 1. Broad baseline — 350 events spread over 24h, all source types, all geos
for _ in range(350):
    events.append(make_event(ts_offset_range=(0, H24)))

# 2. Auth-heavy spike (last 2h) — drives login charts
for _ in range(60):
    events.append(make_event(ts_offset_range=(0, 7200), force_category="auth"))

# 3. Brute-force cluster — same attacker IP, many failures → triggers alerts
BRUTE_IP = "185.220.101.42"
for _ in range(40):
    events.append(make_event(
        ts_offset_range=(0, 3600),
        force_severity="warning",
        force_category="auth",
        force_src_ip=BRUTE_IP,
    ))

# 4. Critical threat wave — malware + lateral movement
for _ in range(25):
    events.append(make_event(
        ts_offset_range=(0, 7200),
        force_severity=random.choice(["error", "critical"]),
        force_category=random.choice(["endpoint", "network"]),
    ))

# 5. Cloud activity from multiple global regions
for _ in range(40):
    events.append(make_event(
        ts_offset_range=(0, H24),
        force_category="cloud",
        force_source_type=random.choice(["azure", "m365", "okta"]),
    ))

# 6. Network denies from threat IPs — globe arcs
for ip in EXTERNAL_IPS:
    for _ in range(4):
        events.append(make_event(
            ts_offset_range=(0, H24),
            force_category="network",
            force_src_ip=ip,
            force_severity=random.choice(["notice", "warning"]),
        ))

# 7. Per-source-type coverage — ensure all 10 show up in charts
for st in SOURCE_TYPES:
    for _ in range(15):
        events.append(make_event(
            ts_offset_range=(0, H24),
            force_source_type=st,
        ))

# 8. Critical single events — will be prominent in alerts list
CRITICAL_SCENARIOS = [
    ("auth",     "impossible_travel",    "critical", "alice@kallix.cloud"),
    ("auth",     "privilege_escalation", "critical", "bob.chen@kallix.cloud"),
    ("endpoint", "malware_detected",     "critical", "carol.smith@kallix.cloud"),
    ("endpoint", "memory_injection",     "critical", "dave@kallix.cloud"),
    ("auth",     "account_lockout",      "error",    "eve.jones@kallix.cloud"),
    ("network",  "lateral_movement",     "critical", ""),
    ("cloud",    "audit_log_cleared",    "critical", "frank@kallix.cloud"),
    ("system",   "audit_log_cleared",    "critical", ""),
    ("auth",     "new_device_login",     "warning",  "grace.lee@kallix.cloud"),
    ("cloud",    "permission_grant",     "warning",  "henry@kallix.cloud"),
]
for cat, act, sev, usr in CRITICAL_SCENARIOS:
    e = make_event(ts_offset_range=(0, 1800), force_category=cat,
                   force_severity=sev, force_user=usr or None)
    e["event"]["action"]  = act
    e["event"]["outcome"] = "success" if "success" in act else "failure"
    events.append(e)

# Shuffle so timeline spread looks natural
random.shuffle(events)

# ── Send in batches of 50 ──────────────────────────────────────────────────────
BATCH = 50
total, ok, fail = len(events), 0, 0
print(f"Injecting {total} events in batches of {BATCH}...")

for i in range(0, total, BATCH):
    chunk = events[i:i+BATCH]
    for attempt in range(6):   # retry until we hit the right process
        status, body = send_batch(chunk)
        if status == 200:
            ok += len(chunk)
            print(f"  [{i+len(chunk):>4}/{total}] OK")
            break
        if attempt < 5:
            continue           # immediately retry — round-robin will route differently
    else:
        fail += len(chunk)
        print(f"  [{i+len(chunk):>4}/{total}] FAIL after 6 tries: {body[:60]}")

print(f"\nDone — {ok} accepted, {fail} failed.")
