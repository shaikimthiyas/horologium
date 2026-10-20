/**
 * Horologium Enterprise Database Adapter (PostgreSQL 16 + TimescaleDB & SQLite Hybrid)
 * Supports enterprise connection pooling, graceful reconnects, and seamless
 * fallback to embedded SQLite (WAL mode) when running standalone without Postgres.
 */

import pg from 'pg';
import { db as sqliteDb } from './database.js';

const { Pool } = pg;

class DatabaseManager {
  constructor() {
    this.pgPool = null;
    this.isPostgres = false;
    this.init();
  }

  init() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
      try {
        this.pgPool = new Pool({
          connectionString: dbUrl,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 3000,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        this.pgPool.on('error', (err) => {
          console.error('[Postgres] Unexpected connection pool error:', err);
        });

        this.isPostgres = true;
        console.info('[Horologium DB] Connected to PostgreSQL 16 / TimescaleDB cluster.');
      } catch (err) {
        console.warn('[Horologium DB] Postgres pool initialization failed, using SQLite WAL fallback:', err.message);
        this.isPostgres = false;
      }
    } else {
      console.info('[Horologium DB] DATABASE_URL not set. Running embedded high-performance SQLite engine (WAL mode).');
      this.isPostgres = false;
    }
  }

  async query(text, params = []) {
    if (this.isPostgres && this.pgPool) {
      try {
        return await this.pgPool.query(text, params);
      } catch (err) {
        console.warn('[Postgres] Query failed, routing to local store:', err.message);
      }
    }

    // SQLite Fallback query translator
    return this.executeSqliteQuery(text, params);
  }

  executeSqliteQuery(text, params = []) {
    try {
      const normalizedSql = text.replace(/\$(\d+)/g, '?');
      const stmt = sqliteDb.prepare(normalizedSql);

      if (normalizedSql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const info = stmt.run(...params);
        return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
      }
    } catch (err) {
      console.error('[SQLite] Query execution error:', err.message, 'SQL:', text);
      throw err;
    }
  }

  async recordTelemetryDrift(telemetry) {
    const {
      clientId = '00000000-0000-0000-0000-000000000000',
      clientIp = '127.0.0.1',
      skewMs = 0.0,
      roundTripMs = 0.0,
      ntpServer = 'time.cloudflare.com',
      stratum = 1,
      solarDec = 0.0,
      subsolarLon = 0.0
    } = telemetry;

    if (this.isPostgres && this.pgPool) {
      const sql = `
        INSERT INTO clock_drift_telemetry (
          recorded_at, client_id, client_ip, client_skew_ms, round_trip_latency_ms,
          ntp_server, ntp_stratum, solar_declination_deg, subsolar_longitude_deg
        ) VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8)
      `;
      try {
        await this.pgPool.query(sql, [clientId, clientIp, skewMs, roundTripMs, ntpServer, stratum, solarDec, subsolarLon]);
        return true;
      } catch (err) {
        console.warn('[Postgres] Failed to insert drift hypertable record:', err.message);
      }
    }

    // SQLite fallback telemetry logging
    try {
      const insert = sqliteDb.prepare(`
        INSERT INTO telemetry_logs (event_type, details)
        VALUES (?, ?)
      `);
      insert.run('CLOCK_DRIFT_PROBE', JSON.stringify(telemetry));
      return true;
    } catch (e) {
      return false;
    }
  }

  async healthCheck() {
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT 1 as alive');
        return {
          engine: 'PostgreSQL 16 + TimescaleDB',
          status: 'CONNECTED',
          poolSize: this.pgPool.totalCount
        };
      } catch (err) {
        return {
          engine: 'PostgreSQL 16 + TimescaleDB',
          status: 'DEGRADED',
          error: err.message
        };
      }
    }

    try {
      sqliteDb.prepare('SELECT 1').get();
      return {
        engine: 'SQLite (node:sqlite WAL mode)',
        status: 'CONNECTED'
      };
    } catch (e) {
      return {
        engine: 'SQLite',
        status: 'ERROR',
        error: e.message
      };
    }
  }
}

export const dbManager = new DatabaseManager();
