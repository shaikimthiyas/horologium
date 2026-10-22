/**
 * Horologium Embedded SQLite Database Engine
 * High-performance, zero-external-dependency embedded database via node:sqlite
 * with resilient in-memory fallback for Node environments < 22.5.0.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
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
      telemetry_logs: []
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
        if (s.includes('DELETE FROM pinned_stations')) {
          const [id] = params;
          self.tables.pinned_stations = self.tables.pinned_stations.filter(p => p.id !== Number(id));
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
        if (s.includes('SELECT * FROM operators WHERE callsign = ?')) {
          const [callsign] = params;
          return self.tables.operators.find(o => o.callsign === callsign) || null;
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
        return [];
      }
    };
  }
}

export const db = DatabaseSyncClass
  ? new DatabaseSyncClass(resolve(dataDir, 'horologium.db'))
  : new InMemorySqliteFallback();

// Initialize tables in WAL mode if native SQLite is available
db.exec(`
  PRAGMA journal_mode = WAL;
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
 * Seed initial operator & telemetry matrix if empty
 */
function seedDatabase() {
  try {
    // 1. Seed admin operator
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM operators');
    const { count } = countStmt.get();

    if (count === 0) {
      const { hash, salt } = hashPassword('password123');
      const insertOp = db.prepare(`
        INSERT INTO operators (callsign, password_hash, salt, role)
        VALUES (?, ?, ?, ?)
      `);
      insertOp.run('admin', hash, salt, 'commander');
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
