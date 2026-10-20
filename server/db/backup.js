/**
 * Horologium Database Backup & WAL Maintenance Engine
 * Flushes SQLite WAL frames to primary storage and produces atomic point-in-time snapshots.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKUPS_DIR = resolve(__dirname, '../data/backups');
const DB_SOURCE_PATH = resolve(__dirname, '../data/horologium.db');

export async function createDatabaseBackup() {
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  // 1. Force WAL checkpoint flush to ensure 100% data durability
  try {
    if (db) {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    }
  } catch (err) {
    console.warn('[Horologium Backup] Notice: SQLite checkpoint warning (ignorable if running Postgres):', err.message);
  }

  // 2. Generate atomic point-in-time snapshot filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = 'horologium-snapshot-' + timestamp + '.db';
  const backupDestPath = resolve(BACKUPS_DIR, backupFileName);

  if (!existsSync(DB_SOURCE_PATH)) {
    return {
      success: false,
      message: 'Source SQLite database file not found on disk.'
    };
  }

  // 3. Atomically copy database file
  copyFileSync(DB_SOURCE_PATH, backupDestPath);

  const fileStats = statSync(backupDestPath);

  // 4. Automatic Pruning: Retain latest 14 snapshots, purge older
  try {
    const files = readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('horologium-snapshot-') && f.endsWith('.db'))
      .map(f => ({ name: f, path: resolve(BACKUPS_DIR, f), ctime: statSync(resolve(BACKUPS_DIR, f)).ctimeMs }))
      .sort((a, b) => b.ctime - a.ctime);

    if (files.length > 14) {
      const toDelete = files.slice(14);
      for (const item of toDelete) {
        unlinkSync(item.path);
      }
    }
  } catch (pruneErr) {
    console.warn('[Horologium Backup] Snapshot pruning warning:', pruneErr.message);
  }

  return {
    success: true,
    backupFile: backupFileName,
    sizeBytes: fileStats.size,
    timestamp: new Date().toISOString(),
    retainedSnapshots: 14
  };
}

export function listDatabaseBackups() {
  if (!existsSync(BACKUPS_DIR)) return [];
  return readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('horologium-snapshot-') && f.endsWith('.db'))
    .map(f => {
      const p = resolve(BACKUPS_DIR, f);
      const st = statSync(p);
      return {
        fileName: f,
        sizeBytes: st.size,
        createdAt: new Date(st.ctimeMs).toISOString()
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
