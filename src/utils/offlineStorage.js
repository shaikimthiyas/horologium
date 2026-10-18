/**
 * Horologium Client-Side IndexedDB Offline Engine
 * Database: HorologiumOfflineDB_v1
 * Provides persistent offline storage for 220 countries, user pinned stations,
 * and flight telemetry logs for disconnected/maritime/aviation operations.
 */

const DB_NAME = 'HorologiumOfflineDB_v1';
const DB_VERSION = 1;

class OfflineStorageEngine {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('[OfflineStorage] IndexedDB not supported on this client.');
        return resolve(null);
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Country Registry Store
        if (!db.objectStoreNames.contains('countries')) {
          const countryStore = db.createObjectStore('countries', { keyPath: 'country' });
          countryStore.createIndex('code', 'code', { unique: false });
          countryStore.createIndex('tz', 'tz', { unique: false });
        }

        // 2. User Pinned Stations Store
        if (!db.objectStoreNames.contains('pinned_stations')) {
          const pinStore = db.createObjectStore('pinned_stations', { keyPath: 'id', autoIncrement: true });
          pinStore.createIndex('tz', 'tz', { unique: false });
          pinStore.createIndex('sync_status', 'sync_status', { unique: false });
        }

        // 3. Telemetry Snapshots Store
        if (!db.objectStoreNames.contains('telemetry_snapshots')) {
          const telemetryStore = db.createObjectStore('telemetry_snapshots', { keyPath: 'timestamp' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.info('[OfflineStorage] IndexedDB connection established successfully.');
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[OfflineStorage] IndexedDB initialization failed:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  async saveCountries(countriesData) {
    const db = await this.init();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('countries', 'readwrite');
      const store = tx.objectStore('countries');

      Object.entries(countriesData).forEach(([country, details]) => {
        store.put({
          country,
          ...details,
          cached_at: Date.now()
        });
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllCountries() {
    const db = await this.init();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction('countries', 'readonly');
      const store = tx.objectStore('countries');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async savePinnedStation(station) {
    const db = await this.init();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pinned_stations', 'readwrite');
      const store = tx.objectStore('pinned_stations');
      const pinRecord = {
        city: station.city,
        country: station.country,
        tz: station.tz,
        created_at: Date.now(),
        sync_status: station.remoteId ? 'synced' : 'pending_push'
      };
      if (station.id) pinRecord.id = station.id;

      const request = store.put(pinRecord);
      request.onsuccess = () => resolve(request.result);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async getPinnedStations() {
    const db = await this.init();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pinned_stations', 'readonly');
      const store = tx.objectStore('pinned_stations');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async recordTelemetrySnapshot(snapshot) {
    const db = await this.init();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('telemetry_snapshots', 'readwrite');
      const store = tx.objectStore('telemetry_snapshots');
      store.put({
        timestamp: Date.now(),
        ...snapshot
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

export const offlineStorage = new OfflineStorageEngine();
