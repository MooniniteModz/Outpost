# Kallix SIEM

**A self-hosted Threat Intelligence Platform built in C++20 with a React frontend.**

Kallix ingests logs from syslog/CEF, cloud APIs (Microsoft 365, Azure Monitor), HTTP endpoints, and HEC-compatible forwarders. Events are normalized into a common schema, evaluated against a real-time detection engine, and stored in PostgreSQL. The React frontend provides a live 3D geospatial globe, customizable dashboards, full-text event search, and a connector wizard for adding new data sources without touching config files.

---

## Quick Install (Ubuntu)

The fastest way to get running is the one-command installer. It handles all dependencies, builds both the backend and frontend, configures PostgreSQL, creates a system user, and installs a systemd service.

```bash
git clone https://github.com/your-org/kallix.git
cd kallix
sudo ./install.sh
```

The script walks you through an interactive setup wizard — no manual config editing required.

**Supported:** Ubuntu 20.04, 22.04, 24.04 (x86_64, aarch64)

---

## Manual Setup

### Prerequisites

| Requirement | Version |
|---|---|
| GCC or Clang | GCC 12+ / Clang 15+ (C++20) |
| CMake | 3.20+ |
| PostgreSQL | 14+ |
| Node.js | 18+ |
| OpenSSL dev headers | `libssl-dev` |
| libpq dev headers | `libpq-dev` |

All C++ library dependencies (nlohmann/json, spdlog, yaml-cpp, cpp-httplib, GoogleTest) are fetched automatically by CMake FetchContent — no manual installs required.

### 1. Database

```bash
sudo -u postgres psql -c "CREATE USER kallix WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE kallix OWNER kallix;"
```

The schema (tables, indexes) is created automatically on first run.

### 2. Environment variables

Secrets are never stored in config files. Set these before starting the backend:

```bash
# Required
export PGPASSWORD=yourpassword
export KALLIX_ADMIN_PASS=your_admin_password   # min 12 chars, used on first run only

# Optional — SMTP (password reset emails)
export KALLIX_SMTP_USERNAME=apikey
export KALLIX_SMTP_PASSWORD=your_smtp_key

# Optional — Azure Monitor
export KALLIX_AZURE_TENANT_ID=...
export KALLIX_AZURE_CLIENT_ID=...
export KALLIX_AZURE_CLIENT_SECRET=...
export KALLIX_AZURE_SUBSCRIPTION_ID=...

# Optional — Microsoft 365
export KALLIX_M365_TENANT_ID=...
export KALLIX_M365_CLIENT_ID=...
export KALLIX_M365_CLIENT_SECRET=...

# API
export OUTPOST_CORS_ORIGIN=http://localhost:3000
```

Copy `.env.example` to `.env` as a reference. The actual `.env` is gitignored.

### 3. Build the backend

```bash
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DOUTPOST_BUILD_TESTS=OFF
make -j$(nproc)
cd ..
```

### 4. Build the frontend

```bash
cd frontend
npm install
npm run build   # production build → frontend/dist/
# or
npm run dev     # dev server on :3000 with hot reload
```

### 5. Run

```bash
# Backend (reads config/outpost.yaml, credentials from env vars)
./build/outpost config/outpost.yaml

# Frontend dev server (separate terminal)
cd frontend && npm run dev
```

Open `http://localhost:3000`. Log in with the admin credentials you set in `KALLIX_ADMIN_PASS`.

---

## Architecture

```
 ┌─────────────────────────────────────────────────────────────┐
 │                      Ingestion Layer                        │
 │                                                             │
 │   Syslog UDP/TCP :5514   HEC :8080/services/collector       │
 │   HTTP Poller ──────────── M365 / Azure OAuth2 polling      │
 │   Connector Manager ─────── REST API / Kafka connectors     │
 └───────────────────────────────┬─────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Lock-free Ring Buffer  │  wait-free MPSC, bounded
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Parser Workers (N)   │  FortiGate · Windows · M365
                    │                         │  Azure · UniFi · CEF · Syslog
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      Rule Engine        │  threshold / sequence /
                    │   (evaluate per event)  │  value-list / anomaly
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │       PostgreSQL        │  events · alerts · users
                    │                         │  sessions · connectors
                    │                         │  custom rules · geo data
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      REST API           │  cpp-httplib · :8080
                    │   Bearer token auth     │  rate limiting · RBAC
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    React Frontend       │  Vite · Recharts · Three.js
                    │         :3000           │  Globe · Dashboard · Events
                    └─────────────────────────┘
```

---

## Configuration

Non-secret settings live in `config/outpost.yaml`. Secrets are always loaded from environment variables — never stored in the config file.

```yaml
syslog:
  bind_address: 0.0.0.0
  udp_port: 5514
  tcp_port: 5514

postgres:
  host: localhost
  port: 5432
  database: kallix
  user: kallix
  password: ""        # → PGPASSWORD env var

api:
  bind_address: 0.0.0.0
  port: 8080
  cors_origin: ""     # → OUTPOST_CORS_ORIGIN env var

smtp:
  enabled: false
  host: smtp.sendgrid.net
  port: 465
  from: noreply@kallix.local
  from_name: Kallix SIEM
  use_ssl: true
  username: ""        # → KALLIX_SMTP_USERNAME env var
  password: ""        # → KALLIX_SMTP_PASSWORD env var

auth:
  default_admin_user: admin
  default_admin_pass: ""   # → KALLIX_ADMIN_PASS env var (first run only)
  session_ttl_hours: 24

workers:
  parser_threads: 2

logging:
  level: info
  file: ""
```

---

## Adding Data Sources

All integrations are managed through the **Connectors** page in the UI — no YAML editing needed after initial setup.

### Supported connector types

| Category | Sources |
|---|---|
| **Syslog / CEF** | FortiGate, Palo Alto, Cisco ASA/FTD, Check Point, SentinelOne, CrowdStrike, Sophos XG, UniFi, generic CEF |
| **REST API** | SentinelOne, Tenable, generic REST with API key or bearer auth |
| **HEC Push** | Splunk Universal Forwarder, Cribl, any HEC-compatible forwarder |
| **Microsoft Cloud** | Azure Monitor Activity Log, Microsoft 365 audit logs (Exchange, SharePoint, Teams, Entra ID) |
| **Kafka / Event Hub** | Apache Kafka, Azure Event Hub (Kafka-compatible endpoint) |
| **SNMP** | v2c / v3 trap receiver *(coming soon)* |

### Microsoft 365 / Azure Monitor

Azure and M365 use dedicated OAuth2 pollers, not the generic connector manager. Configure them through the Connectors wizard or directly via environment variables:

**Azure Portal setup:**
1. Entra ID → App Registrations → New Registration
2. Note the **Tenant ID** and **Application (client) ID**
3. Certificates & Secrets → New client secret → copy value
4. IAM → Add role assignment → **Monitoring Reader** (subscription scope)
5. For sign-in logs: Entra ID → Roles → **Security Reader**

**M365 setup:**
1. Entra ID → App Registrations → New Registration
2. API Permissions → Add → Office 365 Management APIs → `ActivityFeed.Read`
3. Grant admin consent
4. Note Tenant ID, Client ID, create a client secret

### Syslog / CEF forwarding

Point your device's syslog output at:
- **Host:** your Kallix server IP
- **Port:** `5514`
- **Protocol:** UDP or TCP
- **Format:** CEF or raw syslog (auto-detected)

### HEC (Splunk-compatible)

```
URL:    http://your-kallix-host:8080/services/collector
Token:  see Connectors → HEC Token (auto-generated on first run)
```

---

## Detection Rules

Rules live in `config/rules/` as YAML files. Three built-in rule types are supported, plus custom rules created through the web UI.

### Threshold — fire when N events match within a time window

```yaml
- id: WIN-BF-001
  name: Windows RDP Brute Force
  severity: high
  type: threshold
  filter:
    source_type: windows
    action: login_failure
  condition:
    threshold: 15
    window: 5m
    group_by: src_ip
```

### Sequence — fire when events occur in a defined order

```yaml
- id: WIN-SEQ-001
  name: Credential Abuse Chain
  severity: critical
  type: sequence
  filter:
    source_type: windows
  condition:
    window: 10m
    group_by: user
    steps:
      - label: Explicit credential use
        filter: { action: explicit_credential_login }
      - label: Account creation
        filter: { action: account_created }
```

### Value List — fire when a field matches a known-bad value

```yaml
- id: AZ-RG-DEL-001
  name: Azure Resource Group Deletion
  severity: critical
  type: valuelist
  filter:
    source_type: azure
  condition:
    field: action
    values:
      - resourcegroups_delete
```

Custom rules created in the UI are stored in PostgreSQL and evaluated identically to YAML rules at runtime.

---

## Security

Kallix is designed to be hardened out of the box for self-hosted deployments.

| Control | Implementation |
|---|---|
| Authentication | Bearer token sessions, bcrypt password hashing via OpenSSL |
| Session management | Cryptographically random tokens (`RAND_bytes`), configurable TTL, full invalidation on logout and password reset |
| Rate limiting | Per-key lockout on login and password reset endpoints |
| Password reset | Tokens stored as SHA-256 hashes only, single-use, 1-hour expiry |
| Role-based access | `admin` / `analyst` / `viewer` roles enforced per route |
| Secrets | Never in config files — all loaded from environment variables |
| HTTP security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy`, `Permissions-Policy` |
| CORS | Restricted to configured origin; wildcard `*` triggers startup warning |
| Input validation | Bounded pagination (`limit` ≤ 1000), clamped time ranges |
| systemd hardening | `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, dedicated no-login system user |

For production deployments, add HTTPS via Nginx + Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Project Structure

```
kallix/
├── install.sh                  One-command installer for Ubuntu
├── .env.example                Reference for all required environment variables
├── config/
│   ├── outpost.yaml            Runtime configuration (no secrets)
│   └── rules/                  Built-in detection rules (YAML)
├── src/
│   ├── api/                    REST API server + route handlers (cpp-httplib)
│   │   ├── server.cpp          Core lifecycle, middleware, CORS, security headers
│   │   ├── routes_auth.cpp     Login, logout, password reset
│   │   ├── routes_events.cpp   Event query + alert routes
│   │   ├── routes_rules.cpp    Rule CRUD
│   │   ├── routes_stats.cpp    Health, stats, timeline, reports
│   │   ├── routes_connectors.cpp  Connector management + integrations
│   │   ├── routes_users.cpp    User management (admin)
│   │   └── routes_hec.cpp      Splunk-compatible HEC endpoint
│   ├── auth/                   Password hashing, session tokens, SMTP
│   ├── common/                 Event struct, logger, utilities
│   ├── ingestion/              Syslog listener, HTTP poller, connector manager, ring buffer
│   ├── parser/                 FortiGate, Windows, M365, Azure, UniFi, CEF, Syslog parsers
│   ├── rules/                  Rule engine, rule types, YAML loader
│   └── storage/                PostgreSQL engine, alerts, auth, connectors, geo, retention
├── frontend/
│   ├── src/
│   │   ├── pages/              Dashboard, DashboardBuilder, Events, Alerts,
│   │   │                       Reports, Rules, DataSources, Settings
│   │   ├── components/         Globe3D, WidgetModal, RuleBuilder, EditRuleModal
│   │   ├── widgets/            WidgetRenderer (stat, area, bar, pie, top list, geo map)
│   │   └── utils/              Formatters, colour constants
│   └── public/
│       └── Images/             Kallix brand assets
└── tests/                      Google Test suite (ring buffer, parsers, storage, rules)
```

---

## API Reference

All endpoints require a `Bearer <token>` header except `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/hec/*`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Authenticate — returns session token + expiry |
| POST | `/api/auth/logout` | Invalidate current session |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Complete password reset with token |
| GET | `/api/health` | System health, buffer stats, uptime |
| GET | `/api/events` | Query events — `start`, `end`, `q`, `limit`, `offset`, filter fields |
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts/acknowledge` | Acknowledge alert by ID |
| POST | `/api/alerts/close` | Close alert by ID |
| GET | `/api/rules` | List all rules (built-in + custom) |
| POST | `/api/rules` | Create custom rule |
| PUT | `/api/rules` | Update custom rule |
| DELETE | `/api/rules` | Delete custom rule |
| GET | `/api/stats` | Aggregate counts and KPIs |
| GET | `/api/stats/timeline` | Event volume over time (`?hours=24`) |
| GET | `/api/stats/sources` | Event count by source type |
| GET | `/api/stats/severity` | Event count by severity |
| GET | `/api/stats/categories` | Event count by category |
| GET | `/api/stats/top-ips` | Top source IPs (`?limit=10`) |
| GET | `/api/stats/top-users` | Top users by event count |
| GET | `/api/stats/top-actions` | Top event actions |
| GET | `/api/reports/summary` | Full report: KPIs, distributions, timelines, recent alerts |
| GET | `/api/geo/points` | Geolocation points for 3D globe |
| GET | `/api/connectors` | List configured connectors |
| POST | `/api/connectors` | Create connector |
| PUT | `/api/connectors/:id` | Update connector |
| DELETE | `/api/connectors/:id` | Delete connector |
| POST | `/api/connectors/test` | Test connector credentials |
| GET | `/api/integrations` | Get M365 / Azure Monitor config |
| POST | `/api/integrations` | Update M365 / Azure Monitor config |
| GET | `/api/users` | List users (admin) |
| POST | `/api/users` | Create user (admin) |
| PUT | `/api/users/:id` | Update user (admin) |
| DELETE | `/api/users/:id` | Delete user (admin) |
| POST | `/services/collector` | HEC event ingestion (Splunk-compatible) |

---

## Dependencies

**C++ — fetched automatically via CMake FetchContent**

| Library | Purpose |
|---|---|
| [nlohmann/json](https://github.com/nlohmann/json) v3.11.3 | JSON parsing |
| [spdlog](https://github.com/gabime/spdlog) v1.14.1 | Structured logging |
| [yaml-cpp](https://github.com/jbeder/yaml-cpp) v0.8.0 | YAML config and rule files |
| [cpp-httplib](https://github.com/yhirose/cpp-httplib) v0.20.1 | HTTP server + client with TLS |
| [GoogleTest](https://github.com/google/googletest) v1.14.0 | Unit testing |

**System libraries (installed by `install.sh` or manually)**

- `libssl-dev` — OpenSSL (TLS, password hashing, token generation)
- `libpq-dev` — PostgreSQL C client

**Frontend**

- React 18, Vite, Recharts, react-globe.gl (Three.js), lucide-react

---

## Running Tests

```bash
cmake -S . -B build -DOUTPOST_BUILD_TESTS=ON
cmake --build build -j$(nproc)
cd build && ctest --output-on-failure
```

---

## Service Management

After installing with `install.sh`:

```bash
systemctl status kallix        # check status
systemctl restart kallix       # restart
journalctl -u kallix -f        # live logs
journalctl -u kallix -n 100    # last 100 lines

# Edit secrets without touching config
nano /etc/kallix/kallix.env
systemctl restart kallix
```

---

## License

MIT
