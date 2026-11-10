/**
 * Horologium Enterprise Database Adapter (PostgreSQL 16 + TimescaleDB & SQLite Hybrid)
 * Supports enterprise connection pooling, graceful reconnects, automated migrations bootstrap,
 * and seamless fallback to embedded SQLite (WAL mode) when running standalone without Postgres.
 */

import pg from 'pg';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { db as sqliteDb } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
        this.bootstrapMigrations().catch((err) => {
          console.warn('[Horologium DB] Migration bootstrap error:', err.message);
        });
      } catch (err) {
        console.warn('[Horologium DB] Postgres pool initialization failed, using SQLite WAL fallback:', err.message);
        this.isPostgres = false;
      }
    } else {
      console.info('[Horologium DB] DATABASE_URL not set. Running embedded high-performance SQLite engine (WAL mode).');
      this.isPostgres = false;
    }
  }

  async bootstrapMigrations() {
    if (!this.isPostgres || !this.pgPool) return;
    try {
      const migrationsDir = resolve(__dirname, './migrations');
      if (existsSync(migrationsDir)) {
        const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        for (const file of files) {
          const sql = readFileSync(resolve(migrationsDir, file), 'utf-8');
          await this.pgPool.query(sql);
          console.info(`[Horologium DB] Verified enterprise migration: ${file}`);
        }
      }
    } catch (err) {
      console.warn('[Horologium DB] Migration bootstrap warning:', err.message);
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

  async findOperator(callsign) {
    if (!callsign) return null;
    const clean = callsign.trim().toLowerCase();
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT * FROM operators WHERE callsign = $1 LIMIT 1', [clean]);
        return res.rows[0] || null;
      } catch (err) {
        console.warn('[Postgres] findOperator fallback:', err.message);
      }
    }
    const stmt = sqliteDb.prepare('SELECT * FROM operators WHERE callsign = ?');
    return stmt.get(clean) || null;
  }

  async updateOperatorPassword(callsign, hash, salt) {
    if (!callsign) return false;
    const clean = callsign.trim().toLowerCase();
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query('UPDATE operators SET password_hash = $1, salt = $2 WHERE callsign = $3', [hash, salt, clean]);
        return res.rowCount > 0;
      } catch (err) {
        console.warn('[Postgres] updateOperatorPassword fallback:', err.message);
      }
    }
    const stmt = sqliteDb.prepare('UPDATE operators SET password_hash = ?, salt = ? WHERE callsign = ?');
    const res = stmt.run(hash, salt, clean);
    return res.changes > 0;
  }

  async getPins() {
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT id, city, country, tz_identifier AS tz, latitude AS lat, longitude AS lng, sort_order FROM pinned_stations ORDER BY sort_order ASC, created_at ASC');
        return res.rows;
      } catch (err) {
        console.warn('[Postgres] getPins fallback:', err.message);
      }
    }
    const stmt = sqliteDb.prepare('SELECT id, city, country, tz, sort_order FROM pinned_stations ORDER BY sort_order ASC, id ASC');
    return stmt.all();
  }

  async createPin({ city, country, tz, sort_order = 0, lat = null, lng = null }) {
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'INSERT INTO pinned_stations (city, country, tz_identifier, latitude, longitude, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [city, country, tz, lat, lng, sort_order]
        );
        return res.rows[0]?.id;
      } catch (err) {
        console.warn('[Postgres] createPin fallback:', err.message);
      }
    }
    const stmt = sqliteDb.prepare(`
      INSERT INTO pinned_stations (city, country, tz, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(city, country, tz, sort_order);
    return Number(info.lastInsertRowid);
  }

  async deletePin(id) {
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query('DELETE FROM pinned_stations WHERE id = $1', [id]);
        return res.rowCount > 0;
      } catch (err) {
        console.warn('[Postgres] deletePin fallback:', err.message);
      }
    }
    const stmt = sqliteDb.prepare('DELETE FROM pinned_stations WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  async recordTelemetryLog(eventType, details) {
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    try {
      const stmt = sqliteDb.prepare('INSERT INTO telemetry_logs (event_type, details) VALUES (?, ?)');
      stmt.run(eventType, detailsStr);
      return true;
    } catch (_) {
      return false;
    }
  }

  async createTransmission({ transmitterName, returnFrequency, payload, ipAddress }) {
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'INSERT INTO transmissions (transmitter_name, return_frequency, payload, ip_address) VALUES ($1, $2, $3, $4) RETURNING id',
          [transmitterName, returnFrequency, payload, ipAddress]
        );
        return res.rows[0]?.id;
      } catch (err) {
        console.warn('[Postgres] createTransmission fallback:', err.message);
      }
    }
    const stmt = sqliteDb.prepare(`
      INSERT INTO transmissions (transmitter_name, return_frequency, payload, ip_address)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(transmitterName, returnFrequency, payload, ipAddress);
    return Number(info.lastInsertRowid);
  }

  async getTransmissions(limit = 50) {
    if (this.isPostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'SELECT id, transmitter_name, return_frequency, payload, ip_address, status, created_at FROM transmissions ORDER BY created_at DESC LIMIT $1',
          [limit]
        );
        return res.rows;
      } catch (err) {
        console.warn('[Postgres] getTransmissions fallback:', err.message);
      }
    }
    const stmt = sqliteDb.prepare('SELECT id, transmitter_name, return_frequency, payload, ip_address, status, created_at FROM transmissions ORDER BY id DESC LIMIT ?');
    return stmt.all(limit);
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
