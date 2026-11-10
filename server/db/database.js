/**
 * Horologium Embedded SQLite Database Engine
 * High-performance, zero-external-dependency embedded database via node:sqlite
 * with resilient in-memory fallback for Node environments < 22.5.0 and test isolation.
 * Extended with Enterprise API Key Management & Service Telemetry metrics.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = resolve(__dirname, '../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

let DatabaseSyncClass = null;
try {
  const sqliteModule = await import('node:sqlite');
  DatabaseSyncClass = sqliteModule.DatabaseSync;
} catch (err) {
  // node:sqlite not supported in this Node runtime (e.g. Node.js < 22.5.0)
  DatabaseSyncClass = null;
}

class InMemorySqliteFallback {
  constructor() {
    this.tables = {
      operators: [],
      pinned_stations: [],
      transmissions: [],
      telemetry_logs: [],
      api_keys: [],
      api_usage_metrics: []
    };
    this.autoId = 1;
  }

  exec(sql) {
    // DDL & PRAGMA queries are no-ops in memory fallback
    return true;
  }

  prepare(sql) {
    const s = sql.trim();
    const self = this;

    return {
      run(...params) {
        if (s.includes('INSERT INTO operators')) {
          const [callsign, hash, salt, role] = params;
          self.tables.operators.push({ id: self.autoId++, callsign, password_hash: hash, salt, role: role || 'operator' });
          return { changes: 1, lastInsertRowid: self.autoId - 1 };
        }
        if (s.includes('INSERT INTO pinned_stations')) {
          const [city, country, tz, sort] = params;
          self.tables.pinned_stations.push({ id: self.autoId++, city, country, tz, sort_order: sort || 0 });
          return { changes: 1, lastInsertRowid: self.autoId - 1 };
        }
        if (s.includes('INSERT INTO transmissions')) {
          const [name, freq, payload, ip] = params;
          self.tables.transmissions.push({ id: self.autoId++, transmitter_name: name, return_frequency: freq, payload, ip_address: ip, status: 'acknowledged', created_at: new Date().toISOString() });
          return { changes: 1, lastInsertRowid: self.autoId - 1 };
        }
        if (s.includes('INSERT INTO telemetry_logs')) {
          const [event_type, details] = params;
          self.tables.telemetry_logs.push({ id: self.autoId++, event_type, details, created_at: new Date().toISOString() });
          return { changes: 1, lastInsertRowid: self.autoId - 1 };
        }
        if (s.includes('INSERT INTO api_keys')) {
          const [key_hash, key_prefix, tenant_name, tenant_email, allowed_domains, tier, rate_limit_rpm] = params;
          self.tables.api_keys.push({
            id: self.autoId++,
            key_hash,
            key_prefix,
            tenant_name,
            tenant_email,
            allowed_domains: allowed_domains || '*',
            tier: tier || 'partner',
            rate_limit_rpm: rate_limit_rpm || 1200,
            requests_today: 0,
            last_used_at: null,
            created_at: new Date().toISOString()
          });
          return { changes: 1, lastInsertRowid: self.autoId - 1 };
        }
        if (s.includes('UPDATE operators') && s.includes('password_hash')) {
          const [hash, salt, callsign] = params;
          const op = self.tables.operators.find(o => o.callsign === callsign);
          if (op) {
            op.password_hash = hash;
            op.salt = salt;
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (s.includes('UPDATE api_keys') && s.includes('requests_today = requests_today + 1')) {
          const [last_used_at, id] = params;
          const k = self.tables.api_keys.find(item => item.id === Number(id));
          if (k) {
            k.requests_today = (k.requests_today || 0) + 1;
            k.last_used_at = last_used_at;
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (s.includes('INSERT INTO api_usage_metrics')) {
          const [key_id, endpoint, status_code, latency_ms] = params;
          self.tables.api_usage_metrics.push({
            id: self.autoId++,
            key_id,
            endpoint,
            status_code,
            latency_ms,
            timestamp: new Date().toISOString()
          });
          return { changes: 1, lastInsertRowid: self.autoId - 1 };
        }
        if (s.includes('DELETE FROM pinned_stations')) {
          const [id] = params;
          self.tables.pinned_stations = self.tables.pinned_stations.filter(p => p.id !== Number(id));
          return { changes: 1 };
        }
        if (s.includes('DELETE FROM api_keys')) {
          const [id] = params;
          self.tables.api_keys = self.tables.api_keys.filter(k => k.id !== Number(id));
          return { changes: 1 };
        }
        return { changes: 0 };
      },

      get(...params) {
        if (s.includes('COUNT(*) as count FROM operators')) {
          return { count: self.tables.operators.length };
        }
        if (s.includes('COUNT(*) as count FROM pinned_stations')) {
          return { count: self.tables.pinned_stations.length };
        }
        if (s.includes('COUNT(*) as count FROM api_keys')) {
          return { count: self.tables.api_keys.length };
        }
        if (s.includes('SELECT * FROM operators WHERE callsign = ?')) {
          const [callsign] = params;
          return self.tables.operators.find(o => o.callsign === callsign) || null;
        }
        if (s.includes('SELECT * FROM api_keys WHERE key_hash = ?')) {
          const [key_hash] = params;
          return self.tables.api_keys.find(k => k.key_hash === key_hash) || null;
        }
        if (s.includes('SELECT * FROM api_keys WHERE id = ?')) {
          const [id] = params;
          return self.tables.api_keys.find(k => k.id === Number(id)) || null;
        }
        if (s.includes('SELECT 1')) {
          return { 1: 1 };
        }
        return null;
      },

      all(...params) {
        if (s.includes('FROM pinned_stations')) {
          return [...self.tables.pinned_stations].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        }
        if (s.includes('FROM transmissions')) {
          return [...self.tables.transmissions].reverse().slice(0, 50);
        }
        if (s.includes('FROM api_keys')) {
          return [...self.tables.api_keys];
        }
        if (s.includes('FROM api_usage_metrics')) {
          return [...self.tables.api_usage_metrics];
        }
        return [];
      }
    };
  }
}

// In test / CI environments, use ':memory:' to avoid file-lock contention across concurrent test workers
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.CI) || process.argv.includes('--test') || process.execArgv.includes('--test');
const dbPath = isTestEnv ? ':memory:' : resolve(dataDir, 'horologium.db');

export const db = DatabaseSyncClass
  ? new DatabaseSyncClass(dbPath)
  : new InMemorySqliteFallback();

// Initialize tables in WAL mode if native SQLite is available
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    callsign TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT DEFAULT 'operator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pinned_stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    tz TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transmissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transmitter_name TEXT NOT NULL,
    return_frequency TEXT NOT NULL,
    payload TEXT NOT NULL,
    ip_address TEXT,
    status TEXT DEFAULT 'acknowledged',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS telemetry_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    tenant_name TEXT NOT NULL,
    tenant_email TEXT NOT NULL,
    allowed_domains TEXT DEFAULT '*',
    tier TEXT DEFAULT 'partner',
    rate_limit_rpm INTEGER DEFAULT 1200,
    requests_today INTEGER DEFAULT 0,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id INTEGER,
    endpoint TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * Password Hashing & Verification via native scrypt
 */
export function hashPassword(password, salt = null) {
  const currentSalt = salt || randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, currentSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: currentSalt
  };
}

export function verifyPassword(password, storedHash, salt) {
  const derivedKey = scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(storedHash, 'hex');
  return timingSafeEqual(derivedKey, keyBuffer);
}

/**
 * Enterprise API Key Hashing, Generation & Query Helpers
 */
export function hashApiKey(rawKey) {
  return createHash('sha256').update(String(rawKey).trim()).digest('hex');
}

export function generateApiKey(prefix = 'hlg_live_') {
  const randomHex = randomBytes(24).toString('hex');
  const rawKey = `${prefix}${randomHex}`;
  const keyPrefix = rawKey.slice(0, 15);
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

export function createApiKey({ tenantName, tenantEmail, allowedDomains = '*', tier = 'partner', rateLimitRpm = 1200 }) {
  const { rawKey, keyPrefix, keyHash } = generateApiKey();
  const stmt = db.prepare(`
    INSERT INTO api_keys (key_hash, key_prefix, tenant_name, tenant_email, allowed_domains, tier, rate_limit_rpm)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(keyHash, keyPrefix, tenantName, tenantEmail, allowedDomains, tier, rateLimitRpm);
  return {
    id: res.lastInsertRowid,
    rawKey,
    keyPrefix,
    tenantName,
    tenantEmail,
    allowedDomains,
    tier,
    rateLimitRpm
  };
}

export function getApiKeyByHash(keyHash) {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?');
  const res = stmt.get(keyHash);
  return res !== undefined ? res : null;
}

export function getApiKeyByRaw(rawKey) {
  if (!rawKey) return null;
  const keyHash = hashApiKey(rawKey);
  return getApiKeyByHash(keyHash);
}

export function recordApiKeyUsage(keyId, endpoint, statusCode, latencyMs) {
  try {
    const updateStmt = db.prepare(`
      UPDATE api_keys
      SET requests_today = requests_today + 1, last_used_at = ?
      WHERE id = ?
    `);
    updateStmt.run(new Date().toISOString(), keyId);

    const insertMetric = db.prepare(`
      INSERT INTO api_usage_metrics (key_id, endpoint, status_code, latency_ms)
      VALUES (?, ?, ?, ?)
    `);
    insertMetric.run(keyId, endpoint, statusCode, latencyMs);
  } catch (err) {
    console.warn('[Horologium DB] Record metric non-fatal warning:', err.message);
  }
}

export function listApiKeys() {
  const stmt = db.prepare('SELECT id, key_prefix, tenant_name, tenant_email, allowed_domains, tier, rate_limit_rpm, requests_today, last_used_at, created_at FROM api_keys');
  return stmt.all();
}

export function revokeApiKey(id) {
  const stmt = db.prepare('DELETE FROM api_keys WHERE id = ?');
  return stmt.run(id);
}

/**
 * Seed initial operator & telemetry matrix if empty
 */
function seedDatabase() {
  try {
    // 1. Seed admin operator
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM operators');
    const { count } = countStmt.get();

    if (count === 0) {
      const initialCallsign = (process.env.OPERATOR_INITIAL_CALLSIGN || 'admin').trim().toLowerCase();
      const initialPassword = process.env.OPERATOR_INITIAL_PASSWORD || 'password123';
      const { hash, salt } = hashPassword(initialPassword);
      const insertOp = db.prepare(`
        INSERT INTO operators (callsign, password_hash, salt, role)
        VALUES (?, ?, ?, ?)
      `);
      insertOp.run(initialCallsign, hash, salt, 'commander');
    }

    // 2. Seed initial pinned telemetry stations
    const pinCountStmt = db.prepare('SELECT COUNT(*) as count FROM pinned_stations');
    const { count: pinCount } = pinCountStmt.get();

    if (pinCount === 0) {
      const initialPins = [
        { city: 'London', country: 'United Kingdom', tz: 'Europe/London', sort: 1 },
        { city: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo', sort: 2 },
        { city: 'New York', country: 'United States', tz: 'America/New_York', sort: 3 },
        { city: 'Berlin', country: 'Germany', tz: 'Europe/Berlin', sort: 4 },
        { city: 'New Delhi', country: 'India', tz: 'Asia/Kolkata', sort: 5 },
        { city: 'Sydney', country: 'Australia', tz: 'Australia/Sydney', sort: 6 }
      ];

      const insertPin = db.prepare(`
        INSERT INTO pinned_stations (city, country, tz, sort_order)
        VALUES (?, ?, ?, ?)
      `);

      for (const p of initialPins) {
        insertPin.run(p.city, p.country, p.tz, p.sort);
      }
    }
  } catch (err) {
    console.warn('[Horologium DB] Seed non-fatal warning:', err.message);
  }
}

seedDatabase();
