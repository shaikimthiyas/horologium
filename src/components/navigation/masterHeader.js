/**
 * Horologium Master Navigation Chassis & Global Shortcuts Controller (Calibre-01)
 * 
 * Provides unified multi-page navigation across all 6 canonical operational consoles:
 * 1. Mission Gateway (/)
 * 2. Flight Deck (/flight-deck/)
 * 3. Geodesic Registry (/geodesic-registry/)
 * 4. Operator Gateway (/operator-gateway/)
 * 5. Protocol Liaison (/protocol-liaison/)
 * 6. API Explorer (/api-explorer/)
 * 
 * Includes:
 * - Semantic <nav> strip with 1px Vermilion indicator needle
 * - Real-time ClockFSM status sync & LED pip
 * - PWA Offline Marine Chronometer TCXO status badge & 1-click install button
 * - Web Audio Haptics mute toggle & sync
 * - Global accessible Keyboard Shortcuts (<kbd>1-6</kbd>, <kbd>M</kbd>, <kbd>T</kbd>, <kbd>?</kbd>)
 */

import { haptics } from '../../utils/audioHaptics.js';
import { pwaManager } from '../../utils/pwaManager.js';
import { ErrorBoundary } from '../../utils/errorBoundary.js';

export const CANONICAL_PAGES = [
  { id: 'gateway', label: 'Home', href: '/', shortcut: '1' },
  { id: 'flight-deck', label: 'World Map', href: '/flight-deck/', shortcut: '2' },
  { id: 'geodesic-registry', label: 'Directory', href: '/geodesic-registry/', shortcut: '3' },
  { id: 'operator-gateway', label: 'Access', href: '/operator-gateway/', shortcut: '4' },
  { id: 'protocol-liaison', label: 'Contact', href: '/protocol-liaison/', shortcut: '5' },
  { id: 'api-explorer', label: 'API Docs', href: '/api-explorer/', shortcut: '6' }
];

export const ALL_CONSOLES = [
  { id: 'gateway', title: 'Mission Gateway (Home)', href: '/', desc: 'Planetary world clock & dual station overlap' },
  { id: 'flight-deck', title: 'World Map (Flight Deck)', href: '/flight-deck/', desc: '3D orthographic globe & solar terminator' },
  { id: 'geodesic-registry', title: 'Geodesic Directory', href: '/geodesic-registry/', desc: '220 sovereign territories & timezone search' },
  { id: 'developers', title: 'Developer Platform', href: '/developers/', desc: 'API keys, metrics & embeddable widgets' },
  { id: 'api-explorer', title: 'Interactive API Explorer', href: '/api-explorer/', desc: 'OpenAPI 3.1 & Postman collection' },
  { id: 'status', title: 'System Status & SLA', href: '/status/', desc: 'Stratum-1 truechimer consensus telemetry' },
  { id: 'protocol-liaison', title: 'Protocol Liaison', href: '/protocol-liaison/', desc: 'Inquiry & telemetry communications' },
  { id: 'about', title: 'Colophon & Technical Specs', href: '/about/', desc: 'Shaik Imthiyas sovereign architecture' },
  { id: 'privacy', title: 'Data Sovereignty & Privacy', href: '/privacy/', desc: 'Zero-knowledge chronometry policy' },
  { id: 'operator-gateway', title: 'Operator Access', href: '/operator-gateway/', desc: 'NTP telemetry clearance & auth' }
];

export class MasterHeaderController {
  constructor(options = {}) {
    this.activePage = options.activePage || 'gateway';
    this.fsm = options.fsm || (typeof window !== 'undefined' ? window.__HOROLOGIUM_FSM__ : null);
    this.headerEl = null;
    this.isShortcutsOpen = false;

    if (typeof window !== 'undefined' && options.autoInit !== false) {
      this.init();
    }
  }

  async init() {
    // Shield all canonical consoles with universal ErrorBoundary
    if (typeof window !== 'undefined' && !window.__HOROLOGIUM_ERROR_BOUNDARY__) {
      try {
        window.__HOROLOGIUM_ERROR_BOUNDARY__ = new ErrorBoundary({
          appName: 'Horologium Calibre-01',
          fsm: this.fsm
        });
      } catch (_) {}
    }

    this.headerEl = document.querySelector('.telemetry-bar') || document.querySelector('header');
    if (!this.headerEl) return;

    this.mountNavStrip();
    this.mountTelemetryDock();
    this.bindKeyboardShortcuts();
    this.startMasterClock();
    this._initOfflineBanner();
    this._initStaleTabSync();
    this._initGlobalCommandPalette();
    this._initStorageNotice();

    // Initialize PWA Manager & Service Worker lifecycle
    try {
      await pwaManager.init();
      this.syncPwaControls();
    } catch (_) {}
  }

  mountNavStrip() {
    let navContainer = this.headerEl.querySelector('.telemetry-center') || this.headerEl.querySelector('.horologium-nav-strip');
    
    // If telemetry-center exists, enhance it or replace with nav strip
    if (!navContainer) {
      navContainer = document.createElement('nav');
      navContainer.className = 'horologium-nav-strip';
      navContainer.setAttribute('aria-label', 'Primary Consoles');
      this.headerEl.insertBefore(navContainer, this.headerEl.querySelector('.telemetry-right'));
    }

    const navHtml = `
      <nav class="horologium-nav-strip" aria-label="Primary Consoles">
        ${CANONICAL_PAGES.map(p => `
          <a href="${p.href}" 
             class="nav-strip-item ${p.id === this.activePage ? 'active' : ''}" 
             ${p.id === this.activePage ? 'aria-current="page"' : ''}
             title="Console [${p.shortcut}]: ${p.label}">
            <span>${p.label}</span>
            <kbd class="shortcut-kbd" style="font-size:9px; padding:1px 3px; opacity:0.6;">${p.shortcut}</kbd>
          </a>
        `).join('')}
      </nav>
    `;

    // Only inject if not already present
    if (!this.headerEl.querySelector('.horologium-nav-strip')) {
      const center = this.headerEl.querySelector('.telemetry-center');
      if (center) {
        center.innerHTML = navHtml;
      }
    }
  }

  mountTelemetryDock() {
    const right = this.headerEl.querySelector('.telemetry-right');
    if (!right) return;

    // 1. FSM Status Pill
    if (!right.querySelector('.telemetry-fsm-pill')) {
      const fsmPill = document.createElement('div');
      fsmPill.className = 'telemetry-fsm-pill';
      fsmPill.id = 'masterFsmPill';
      fsmPill.innerHTML = `
        <span class="fsm-status-led status-locked" id="masterFsmLed"></span>
        <span id="masterFsmText">LOCKED</span>
      `;
      right.prepend(fsmPill);

      if (this.fsm) {
        this.fsm.subscribe((from, to) => {
          this.updateFsmState(to);
        });
        this.updateFsmState(this.fsm.state);
      }
    }

    // 2. PWA Install & Offline Indicator Dock
    if (!right.querySelector('#masterPwaInstallBtn')) {
      const pwaBtn = document.createElement('button');
      pwaBtn.type = 'button';
      pwaBtn.id = 'masterPwaInstallBtn';
      pwaBtn.className = 'telemetry-btn pwa-install-btn';
      pwaBtn.style.display = 'none'; // Shown when installable
      pwaBtn.setAttribute('aria-label', 'Install Standalone Chronometer App [PWA]');
      pwaBtn.innerHTML = `<span>⬇</span> <span>INSTALL</span>`;
      pwaBtn.onclick = () => {
        haptics.playMechanicalClick();
        pwaManager.promptInstall();
      };
      right.appendChild(pwaBtn);
    }

    // 3. Sound Toggle Sync
    const audioBtn = right.querySelector('#soundToggleBtn') || right.querySelector('.audio-toggle-btn');
    if (!audioBtn && !right.querySelector('#masterSoundToggle')) {
      const soundBtn = document.createElement('button');
      soundBtn.type = 'button';
      soundBtn.id = 'masterSoundToggle';
      soundBtn.className = 'telemetry-btn';
      soundBtn.setAttribute('aria-label', 'Toggle Web Audio Haptics [M]');
      soundBtn.innerHTML = `<span>🔊</span> <span>M</span>`;
      soundBtn.onclick = () => {
        haptics.toggle();
      };
      right.appendChild(soundBtn);

      haptics.subscribe((state) => {
        soundBtn.innerHTML = `<span>${state.enabled ? '🔊' : '🔇'}</span> <span>M</span>`;
      });
    }

    // 4. Shortcuts Button (?)
    if (!right.querySelector('#masterShortcutsBtn')) {
      const shortcutsBtn = document.createElement('button');
      shortcutsBtn.type = 'button';
      shortcutsBtn.id = 'masterShortcutsBtn';
      shortcutsBtn.className = 'telemetry-btn';
      shortcutsBtn.setAttribute('aria-label', 'Keyboard Shortcuts [?]');
      shortcutsBtn.innerHTML = `<span>?</span>`;
      shortcutsBtn.onclick = () => this.toggleShortcutsDialog();
      right.appendChild(shortcutsBtn);
    }
  }

  syncPwaControls() {
    const installBtn = document.getElementById('masterPwaInstallBtn');
    if (installBtn && pwaManager.isInstallable) {
      installBtn.style.display = 'inline-flex';
    }

    pwaManager.subscribe((event) => {
      if (event.type === 'INSTALLABLE_READY' && installBtn) {
        installBtn.style.display = 'inline-flex';
      }
      if (event.type === 'APP_INSTALLED' && installBtn) {
        installBtn.style.display = 'none';
      }
      if (event.type === 'CONNECTIVITY_CHANGED') {
        const text = document.getElementById('masterFsmText');
        if (text && event.isOffline) {
          text.textContent = 'OFFLINE (TCXO)';
        }
      }
    });
  }

  updateFsmState(state) {
    const led = document.getElementById('masterFsmLed');
    const text = document.getElementById('masterFsmText');
    if (!led || !text) return;

    text.textContent = state === 'OFFLINE' ? 'OFFLINE (TCXO)' : state;
    led.className = `fsm-status-led status-${state.toLowerCase()}`;
  }

  startMasterClock() {
    const clockEl = document.getElementById('utcClockMaster') || document.querySelector('.utc-master-clock-val');
    if (!clockEl) return;

    const update = () => {
      const now = new Date();
      const hrs = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      const secs = String(now.getUTCSeconds()).padStart(2, '0');
      clockEl.textContent = `${hrs}:${mins}:${secs} UTC`;
    };

    update();
    setInterval(update, 1000);
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore keystrokes inside inputs or textareas
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Check number shortcuts 1-6
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= CANONICAL_PAGES.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = CANONICAL_PAGES[num - 1];
        if (target && target.id !== this.activePage) {
          haptics.playMechanicalClick();
          window.location.href = target.href;
        }
      }

      // M = Toggle Mute
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        haptics.toggle();
      }

      // T = Toggle Theme
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        this.toggleTheme();
      }

      // ? = Open Shortcuts Help
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        this.toggleShortcutsDialog();
      }

      // Esc = Dismiss Shortcuts
      if (e.key === 'Escape' && this.isShortcutsOpen) {
        this.toggleShortcutsDialog(false);
      }
    });
  }

  toggleTheme() {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme') || 'obsidian';
    const next = current === 'obsidian' ? 'silvered' : 'obsidian';
    root.setAttribute('data-theme', next);
    localStorage.setItem('horologium_theme', next);
    haptics.playMechanicalClick();
  }

  toggleShortcutsDialog(forceState = null) {
    this.isShortcutsOpen = forceState !== null ? forceState : !this.isShortcutsOpen;
    let dialog = document.getElementById('horologiumShortcutsModal');

    if (!this.isShortcutsOpen) {
      if (dialog) dialog.remove();
      return;
    }

    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'horologiumShortcutsModal';
      dialog.className = 'horologium-shortcut-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'shortcutDialogTitle');

      dialog.innerHTML = `
        <div class="shortcut-dialog-card">
          <div class="shortcut-dialog-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:6px;height:6px;background:var(--accent-primary);border-radius:50%;"></span>
              <h2 id="shortcutDialogTitle" style="margin:0;font-family:var(--font-mono);font-size:12px;letter-spacing:0.1em;color:var(--fg-0);">
                HOROLOGIUM // COMMAND SHORTCUTS
              </h2>
            </div>
            <button type="button" id="closeShortcutsModal" style="background:none;border:none;color:var(--fg-1);font-size:18px;cursor:pointer;padding:4px 8px;">&times;</button>
          </div>

          <div class="shortcut-grid">
            <div class="shortcut-row"><span>Mission Gateway</span> <kbd class="shortcut-kbd">1</kbd></div>
            <div class="shortcut-row"><span>Flight Deck</span> <kbd class="shortcut-kbd">2</kbd></div>
            <div class="shortcut-row"><span>Geodesic Registry</span> <kbd class="shortcut-kbd">3</kbd></div>
            <div class="shortcut-row"><span>Operator Gateway</span> <kbd class="shortcut-kbd">4</kbd></div>
            <div class="shortcut-row"><span>Protocol Liaison</span> <kbd class="shortcut-kbd">5</kbd></div>
            <div class="shortcut-row"><span>OpenAPI Explorer</span> <kbd class="shortcut-kbd">6</kbd></div>
            <div class="shortcut-row"><span>Audio Haptics Mute</span> <kbd class="shortcut-kbd">M</kbd></div>
            <div class="shortcut-row"><span>Toggle Theme</span> <kbd class="shortcut-kbd">T</kbd></div>
            <div class="shortcut-row"><span>Install Standalone PWA</span> <kbd class="shortcut-kbd">⬇ HUD</kbd></div>
            <div class="shortcut-row"><span>Close Modals / Reset</span> <kbd class="shortcut-kbd">Esc</kbd></div>
            <div class="shortcut-row" style="border-top:1px dashed var(--border-hairline);margin-top:6px;padding-top:6px;"><a href="/about/" style="color:var(--accent-primary);text-decoration:none;font-size:11px;">Colophon & Builder's Note [Imthiyas]</a> <kbd class="shortcut-kbd">About</kbd></div>
            <div class="shortcut-row"><a href="/status/" style="color:var(--accent-primary);text-decoration:none;font-size:11px;">Live Telemetry & Health Probes</a> <kbd class="shortcut-kbd">Status</kbd></div>
            <div class="shortcut-row"><a href="/privacy/" style="color:var(--accent-primary);text-decoration:none;font-size:11px;">Data Sovereignty & Privacy</a> <kbd class="shortcut-kbd">Legal</kbd></div>
          </div>

          <div style="padding:10px 16px;background:var(--bg-0);border-top:1px solid var(--border-hairline);text-align:right;">
            <button type="button" id="btnDismissShortcuts" class="nav-action-btn" style="cursor:pointer;">CLOSE [Esc]</button>
          </div>
        </div>
      `;

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) this.toggleShortcutsDialog(false);
      });

      document.body.appendChild(dialog);

      dialog.querySelector('#closeShortcutsModal').onclick = () => this.toggleShortcutsDialog(false);
      dialog.querySelector('#btnDismissShortcuts').onclick = () => this.toggleShortcutsDialog(false);
    }
  }

  _initOfflineBanner() {
    if (typeof window === 'undefined') return;
    let banner = document.getElementById('horologiumOfflineBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'horologiumOfflineBanner';
      banner.className = 'offline-marine-banner';
      banner.style.display = 'none';
      document.body.appendChild(banner);
    }

    const showOffline = () => {
      banner.className = 'offline-marine-banner offline';
      banner.innerHTML = '<span>âš“</span> <span>Offline Marine Chronometer — Local TCXO quartz oscillator running. All telemetry queued.</span>';
      banner.style.display = 'flex';
    };

    const showRestored = () => {
      banner.className = 'offline-marine-banner restored';
      banner.innerHTML = '<span>âœ“</span> <span>Network Restored — Re-synchronizing chronometer with Stratum-1 truechimers...</span>';
      banner.style.display = 'flex';
      setTimeout(() => {
        banner.style.display = 'none';
      }, 3500);
    };

    window.addEventListener('offline', showOffline);
    window.addEventListener('online', showRestored);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showOffline();
    }
  }

  _initStaleTabSync() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.startMasterClock();
        window.dispatchEvent(new CustomEvent('horologium:tab_resumed', { detail: { timestamp: Date.now() } }));
      }
    });
  }

  _initGlobalCommandPalette() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const searchModal = document.getElementById('searchModal');
        if (searchModal && typeof window.__openSearchModal === 'function') {
          window.__openSearchModal();
        } else {
          this.openUniversalPalette();
        }
      }
    });
  }

  openUniversalPalette() {
    let modal = document.getElementById('horologiumUniversalPalette');
    if (modal) {
      modal.remove();
      return;
    }

    modal = document.createElement('div');
    modal.id = 'horologiumUniversalPalette';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(8,10,14,0.78);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:12dvh;';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Global Command Palette');

    modal.innerHTML = `
      <div style="background:var(--bg-1,#121721);border:1px solid var(--border-interactive,rgba(255,255,255,0.12));border-radius:var(--radius-md,8px);width:100%;max-width:580px;box-shadow:0 24px 60px rgba(0,0,0,0.6);overflow:hidden;display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border-hairline,rgba(255,255,255,0.08));gap:10px;">
          <span style="color:var(--accent-primary,#FF5E24);font-family:var(--font-mono);font-size:14px;">âŒ˜K</span>
          <input type="text" id="universalPaletteInput" placeholder="Navigate consoles or run commands..." style="flex:1;background:transparent;border:none;outline:none;color:var(--fg-0,#f8fafc);font-family:var(--font-sans,sans-serif);font-size:14px;" />
          <kbd style="font-family:var(--font-mono);font-size:10px;padding:2px 6px;background:var(--bg-2,#1a2230);border-radius:4px;color:var(--fg-muted,#64748b);">ESC</kbd>
        </div>
        <div id="universalPaletteList" style="max-height:360px;overflow-y:auto;padding:8px 0;">
          ${ALL_CONSOLES.map(c => `
            <a href="${c.href}" class="palette-item" style="display:flex;flex-direction:column;padding:10px 16px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.03);transition:background 0.12s ease;">
              <span style="color:var(--fg-0,#f8fafc);font-weight:500;font-size:13px;">${c.title}</span>
              <span style="color:var(--fg-muted,#64748b);font-size:11px;">${c.desc}</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const input = modal.querySelector('#universalPaletteInput');
    input.focus();

    input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = modal.querySelectorAll('.palette-item');
      items.forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(q) ? 'flex' : 'none';
      });
    });

    const close = () => modal.remove();
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        close();
        window.removeEventListener('keydown', onKeyDown);
      }
    };
    window.addEventListener('keydown', onKeyDown);
  }

  _initStorageNotice() {
    if (typeof window === 'undefined' || localStorage.getItem('horologium_storage_ack')) return;
    const notice = document.createElement('div');
    notice.id = 'horologiumStorageNotice';
    notice.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;max-width:380px;background:var(--bg-1,#121721);border:1px solid var(--border-hairline,rgba(255,255,255,0.1));border-radius:8px;padding:14px 16px;box-shadow:0 12px 30px rgba(0,0,0,0.5);font-family:var(--font-mono,monospace);font-size:11px;color:var(--fg-1,#94a3b8);display:flex;flex-direction:column;gap:10px;';
    notice.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;color:var(--fg-0,#f8fafc);font-weight:600;">
        <span style="color:var(--accent-primary,#FF5E24);">â—</span> Zero-Knowledge Chronometry
      </div>
      <div style="line-height:1.45;">
        Horologium uses strictly client-side storage for chronometer calibration, pinned stations, and theme state. No tracking cookies or external ad analytics are ever deployed.
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <a href="/privacy/" style="color:var(--fg-2,#64748b);text-decoration:none;font-size:10px;align-self:center;">Read Policy</a>
        <button type="button" id="ackStorageBtn" style="background:var(--accent-primary,#FF5E24);color:#0b0e14;border:none;border-radius:4px;padding:4px 10px;font-family:var(--font-mono,monospace);font-size:11px;font-weight:600;cursor:pointer;">Acknowledge</button>
      </div>
    `;
    document.body.appendChild(notice);
    notice.querySelector('#ackStorageBtn').onclick = () => {
      localStorage.setItem('horologium_storage_ack', 'true');
      notice.remove();
    };
  }
}

export function initMasterHeader(options = {}) {
  return new MasterHeaderController(options);
}
