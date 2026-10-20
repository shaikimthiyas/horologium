-- ============================================================================
-- HOROLOGIUM ENTERPRISE DATABASE MIGRATION 001
-- Target Engine: PostgreSQL 16+ with TimescaleDB Extension
-- Schema: High-Volume Temporal Telemetry, Multi-Tenant Workspaces & Drift Hypertables
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- 2. Organizations & Multi-Tenant Workspaces
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    plan_tier VARCHAR(32) DEFAULT 'enterprise',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Operators & RBAC Credentials
CREATE TABLE IF NOT EXISTS operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    callsign VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'operator', -- commander, operator, auditor
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operators_callsign ON operators(callsign);
CREATE INDEX IF NOT EXISTS idx_operators_org ON operators(org_id);

-- 4. Pinned Telemetry Stations
CREATE TABLE IF NOT EXISTS pinned_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
    city VARCHAR(128) NOT NULL,
    country VARCHAR(128) NOT NULL,
    tz_identifier VARCHAR(64) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pins_operator ON pinned_stations(operator_id);
CREATE INDEX IF NOT EXISTS idx_pins_tz ON pinned_stations(tz_identifier);

-- 5. Transmissions & Inquiries Log
CREATE TABLE IF NOT EXISTS transmissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    transmitter_name VARCHAR(128) NOT NULL,
    return_frequency VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    ip_address INET,
    status VARCHAR(32) DEFAULT 'acknowledged',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. High-Volume Clock Drift & NTP Telemetry (TimescaleDB Hypertable)
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

-- Convert to TimescaleDB Hypertable partitioned by recorded_at in 1-day chunks
SELECT create_hypertable(
    'clock_drift_telemetry',
    'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Columnar Compression: Compress chunks older than 7 days, segment by client_id
ALTER TABLE clock_drift_telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'client_id, ntp_server',
    timescaledb.compress_orderby = 'recorded_at DESC'
);

SELECT add_compression_policy('clock_drift_telemetry', INTERVAL '7 days', if_not_exists => TRUE);

-- Automated Data Retention Policy: Drop raw telemetry older than 90 days
SELECT add_retention_policy('clock_drift_telemetry', INTERVAL '90 days', if_not_exists => TRUE);

-- 7. Continuous Aggregate View: Hourly Clock Drift & SLA Summary
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
GROUP BY bucket, ntp_server
WITH NO DATA;

-- Refresh continuous aggregate policy (every 30 minutes for past 2 hours to now)
SELECT add_continuous_aggregate_policy('hourly_clock_drift_summary',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists => TRUE
);
