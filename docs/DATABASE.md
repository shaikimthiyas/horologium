# ⬡ HOROLOGIUM: DATABASE ARCHITECTURE & TELEMETRY PERSISTENCE
**System Classification:** Hybrid Persistence Engine & Time-Series Hypertable Specification
**Calibre Specification:** Calibre-01
**Lead Architect:** Shaik Imthiyas
**Status:** Canonical Database Specification

---

## 1. Dual-Engine Architecture Overview

Horologium implements a **hybrid dual-engine persistence layer** tailored for low-latency operational queries and high-volume time-series chronometry telemetry:

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOROLOGIUM APPLICATION LAYER                 │
└────────────────┬───────────────────────────────┬────────────────┘
                 │                               │
                 ▼                               ▼
┌─────────────────────────────────┐ ┌─────────────────────────────┐
│  EMBEDDED LOCAL ENGINE (SQLite) │ │ ENTERPRISE CLUSTER (Pg16)   │
│  - node:sqlite (DatabaseSync)   │ │ - PostgreSQL 16 + Timescale │
│  - Write-Ahead Logging (WAL)    │ │ - Connection Pooling (pg)   │
│  - Zero External Dependencies   │ │ - Partitioned Hypertables   │
│  - Single-binary Deployments    │ │ - Columnar Compression      │
│  - In-Memory Test Isolation     │ │ - Continuous Aggregates     │
└─────────────────────────────────┘ └─────────────────────────────┘
```

1. **Standalone / Edge Mode (Default):** Runs an embedded high-performance SQLite engine via `node:sqlite` in WAL mode (`server/data/horologium.db`). Zero external database servers required.
2. **Enterprise Cluster Mode:** Enabled automatically when `DATABASE_URL` is set to a PostgreSQL connection URI (`postgres://...`). Uses PostgreSQL 16 with the **TimescaleDB** extension for terabyte-scale NTP telemetry.
3. **Test Isolation:** In test and CI environments (`NODE_ENV === 'test'` or `CI=true`), the system automatically isolates into `:memory:` mode or an in-memory fallback to prevent disk locking across parallel test runners.

---

## 2. Embedded SQLite Schema (Core Data Model)

Stored at `server/data/horologium.db`:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Operators & Authenticated Users
CREATE TABLE IF NOT EXISTS operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    callsign TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT DEFAULT 'operator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pinned Stations & Preferred Timezones
CREATE TABLE IF NOT EXISTS pinned_stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    tz TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Transmissions & Inquiry Inboxes
CREATE TABLE IF NOT EXISTS transmissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transmitter_name TEXT NOT NULL,
    return_frequency TEXT NOT NULL,
    payload TEXT NOT NULL,
    ip_address TEXT,
    status TEXT DEFAULT 'acknowledged',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Internal Telemetry Audit Logs
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Enterprise API Key Registry
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT UNIQUE NOT NULL,       -- SHA-256 of raw hlg_live_* key
    key_prefix TEXT NOT NULL,            -- Public prefix (e.g. hlg_live_8f3a9b)
    tenant_name TEXT NOT NULL,           -- Organization or project name
    tenant_email TEXT NOT NULL,          -- Provisioning developer email
    allowed_domains TEXT DEFAULT '*',    -- CORS domain scope
    tier TEXT DEFAULT 'partner',         -- 'starter' | 'partner' | 'enterprise'
    rate_limit_rpm INTEGER DEFAULT 1200, -- Rate limit per minute
    requests_today INTEGER DEFAULT 0,    -- Daily usage counter
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. API Performance & Latency Telemetry
CREATE TABLE IF NOT EXISTS api_usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id INTEGER,
    endpoint TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. TimescaleDB Time-Series Engine (Enterprise Cluster)

In high-throughput enterprise deployments, clock skew samples and NTP jitter packets are streamed into TimescaleDB hypertables (`server/db/migrations/001_timescaledb_init.sql`).

### 3.1 Partitioned Clock Drift Hypertable
```sql
CREATE TABLE IF NOT EXISTS clock_drift_telemetry (
    recorded_at TIMESTAMPTZ NOT NULL,
    client_id UUID NOT NULL,
    client_ip INET,
    client_skew_ms DOUBLE PRECISION NOT NULL,
    round_trip_latency_ms DOUBLE PRECISION NOT NULL,
    ntp_server VARCHAR(128) NOT NULL,
    ntp_stratum INT NOT NULL DEFAULT 1,
    solar_declination_deg DOUBLE PRECISION,
    subsolar_longitude_deg DOUBLE PRECISION
);

-- Partition into 1-day temporal chunks
SELECT create_hypertable(
    'clock_drift_telemetry',
    'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);
```

### 3.2 Columnar Compression Policy
Chunks older than 7 days are automatically compressed into columnar storage, reducing disk consumption by up to 92%:
```sql
ALTER TABLE clock_drift_telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'client_id, ntp_server',
    timescaledb.compress_orderby = 'recorded_at DESC'
);

SELECT add_compression_policy('clock_drift_telemetry', INTERVAL '7 days', if_not_exists => TRUE);
```

### 3.3 Automated Data Retention (TTL)
Raw time-series samples older than 90 days are purged automatically without table locks:
```sql
SELECT add_retention_policy('clock_drift_telemetry', INTERVAL '90 days', if_not_exists => TRUE);
```

### 3.4 Continuous Aggregates (Hourly SLA Summary)
Pre-computed materialized views maintain real-time performance analytics:
```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_clock_drift_summary
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', recorded_at) AS bucket,
    ntp_server,
    COUNT(*) AS total_probes,
    AVG(client_skew_ms) AS avg_skew_ms,
    MAX(client_skew_ms) AS max_skew_ms,
    MIN(client_skew_ms) AS min_skew_ms,
    AVG(round_trip_latency_ms) AS avg_latency_ms
FROM clock_drift_telemetry
GROUP BY bucket, ntp_server;

SELECT add_continuous_aggregate_policy('hourly_clock_drift_summary',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists => TRUE
);
```

---

## 4. Database Maintenance & Backup Operations

Horologium includes a dedicated backup controller ([server/db/backup.js](file:///D:/01_PROJECTS/ACTIVE/Horologium/server/db/backup.js)):

1. **Point-In-Time Snapshots:** Executes `PRAGMA wal_checkpoint(TRUNCATE)` to flush write-ahead logs, followed by an atomic filesystem copy of `horologium.db` into `server/data/backups/`.
2. **Snapshot Retention:** Keeps the 7 most recent backups; older snapshot files are automatically pruned to preserve disk capacity.
3. **Protected Admin Endpoints:**
   - `POST /api/admin/backup`: Triggers an immediate point-in-time snapshot.
   - `GET /api/admin/backups`: Returns metadata and file sizes of existing backups.

