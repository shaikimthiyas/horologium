-- ============================================================================
-- HOROLOGIUM ENTERPRISE DATABASE MIGRATION 002
-- Target Engine: PostgreSQL 16+ with TimescaleDB Extension
-- Schema: Developer API Key Governance, Tenant RPM Quotas & Daily Usage Metrics
-- ============================================================================

-- 1. API Keys Registry Table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    tier VARCHAR(32) NOT NULL DEFAULT 'starter', -- starter, pro, partner
    rate_limit_rpm INT NOT NULL DEFAULT 180,
    allowed_origins TEXT DEFAULT '*',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_email);

-- 2. Daily API Key Usage Metrics Table
CREATE TABLE IF NOT EXISTS api_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_count INT NOT NULL DEFAULT 1,
    last_endpoint VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_key_date UNIQUE(key_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_metrics(recorded_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage_metrics(key_id);
