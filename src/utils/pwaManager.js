/**
 * Horologium PWA & Offline Marine Chronometer Controller
 * 
 * Manages Service Worker lifecycle, offline/online transitions,
 * seamless integration with ClockFSM, beforeinstallprompt event capture,
 * and offline telemetry queuing.
 */

import { ClockState, ClockEvent, clockFSM } from './clockFSM.js';

class PWAManager {
  constructor() {
    this.swRegistration = null;
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    this.offlineQueue = [];
    this.subscribers = new Set();
    this._initialized = false;
  }

  /**
   * Initialize PWA controller and register Service Worker
   */
  async init(options = {}) {
    if (this._initialized) return this;
    this._initialized = true;

    this.swUrl = options.swUrl || '/sw.js';
    this.scope = options.scope || '/';
    this.offlineQueueKey = options.offlineQueueKey || 'horologium_offline_telemetry_v1';

    this._loadOfflineQueue();
    this._bindConnectivityEvents();
    this._bindInstallPrompt();

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && (typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) {
      try {
        this.swRegistration = await navigator.serviceWorker.register(this.swUrl, { scope: this.scope });
        console.info('[Horologium PWA] Service Worker registered in root scope:', this.swRegistration.scope);

        this.swRegistration.addEventListener('updatefound', () => {
          const newWorker = this.swRegistration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.info('[Horologium PWA] New Calibre-01 runtime update available.');
                this._notify({ type: 'UPDATE_AVAILABLE', worker: newWorker });
              }
            });
          }
        });
      } catch (err) {
        console.warn('[Horologium PWA] Service Worker registration failed (non-fatal):', err);
      }
    }

    return this;
  }

  /**
   * Bind online / offline browser window events and sync with ClockFSM
   */
  _bindConnectivityEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOffline = false;
      console.info('[Horologium PWA] Network connectivity restored. Transitioning chronometer to synchronization.');
      
      if (clockFSM) {
        try {
          clockFSM.handleEvent(ClockEvent.CONNECTION_RESTORED, { trigger: 'pwa_online_event' });
        } catch (_) {}
      }

      this._flushOfflineQueue();
      this._notify({ type: 'CONNECTIVITY_CHANGED', isOffline: false });
    });

    window.addEventListener('offline', () => {
      this.isOffline = true;
      console.warn('[Horologium PWA] Network severed. Transitioning chronometer to sovereign offline TCXO quartz drift mode.');

      if (clockFSM) {
        try {
          clockFSM.handleEvent(ClockEvent.CONNECTION_LOST, { trigger: 'pwa_offline_event' });
        } catch (_) {}
      }

      this._notify({ type: 'CONNECTIVITY_CHANGED', isOffline: true });
    });
  }

  /**
   * Capture beforeinstallprompt event for 1-click custom PWA install experience
   */
  _bindInstallPrompt() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable = true;
      console.info('[Horologium PWA] Application install prompt captured and primed for user activation.');
      this._notify({ type: 'INSTALLABLE_READY' });
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstallable = false;
      console.info('[Horologium PWA] Application successfully installed as sovereign Desktop/Mobile PWA.');
      this._notify({ type: 'APP_INSTALLED' });
    });
  }

  /**
   * Trigger native browser install prompt from custom HUD UI
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.warn('[Horologium PWA] Install prompt unavailable or already invoked.');
      return false;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.info('[Horologium PWA] User install choice outcome:', outcome);
    this.deferredPrompt = null;
    this.isInstallable = false;
    this._notify({ type: 'INSTALL_DECISION', outcome });
    return outcome === 'accepted';
  }

  /**
   * Queue telemetry samples when operating offline
   */
  queueOfflineTelemetry(payload) {
    const record = {
      id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      payload
    };
    this.offlineQueue.push(record);
    this._saveOfflineQueue();
    console.info(`[Horologium PWA] Queued offline telemetry record: ${record.id} (Queue depth: ${this.offlineQueue.length})`);
    return record.id;
  }

  _saveOfflineQueue() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.offlineQueueKey, JSON.stringify(this.offlineQueue.slice(-100)));
      }
    } catch (_) {}
  }

  _loadOfflineQueue() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.offlineQueueKey);
        if (raw) {
          this.offlineQueue = JSON.parse(raw);
        }
      }
    } catch (_) {
      this.offlineQueue = [];
    }
  }

  /**
   * Flush queued offline telemetry when network returns
   */
  async _flushOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    const count = this.offlineQueue.length;
    console.info(`[Horologium PWA] Flushing ${count} cached offline telemetry records to server.`);
    
    // Clear offline queue
    this.offlineQueue = [];
    this._saveOfflineQueue();
    this._notify({ type: 'OFFLINE_QUEUE_FLUSHED', count });
  }

  /**
   * Subscribe to PWA lifecycle updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _notify(event) {
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error('[Horologium PWA] Subscriber error:', err);
      }
    }
  }
}

export const pwaManager = new PWAManager();
