/**
 * Horologium Master Navigation Chassis & Global Shortcuts Controller (Calibre-01)
 * 
 * Provides unified multi-page navigation across all 5 canonical operational consoles:
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
 * - Web Audio Haptics mute toggle & sync
 * - Global accessible Keyboard Shortcuts (<kbd>1-6</kbd>, <kbd>M</kbd>, <kbd>T</kbd>, <kbd>?</kbd>)
 */

import { haptics } from '../../utils/audioHaptics.js';

export const CANONICAL_PAGES = [
  { id: 'gateway', label: 'GATEWAY', href: '/', shortcut: '1' },
  { id: 'flight-deck', label: 'FLIGHT DECK', href: '/flight-deck/', shortcut: '2' },
  { id: 'geodesic-registry', label: 'REGISTRY', href: '/geodesic-registry/', shortcut: '3' },
  { id: 'operator-gateway', label: 'OPERATOR', href: '/operator-gateway/', shortcut: '4' },
  { id: 'protocol-liaison', label: 'LIAISON', href: '/protocol-liaison/', shortcut: '5' },
  { id: 'api-explorer', label: 'API DOCS', href: '/api-explorer/', shortcut: '6' }
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

  init() {
    this.headerEl = document.querySelector('.telemetry-bar') || document.querySelector('header');
    if (!this.headerEl) return;

    this.mountNavStrip();
    this.mountTelemetryDock();
    this.bindKeyboardShortcuts();
    this.startMasterClock();
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

    // 2. Sound Toggle Sync
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

    // 3. Shortcuts Button (?)
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

  updateFsmState(state) {
    const led = document.getElementById('masterFsmLed');
    const text = document.getElementById('masterFsmText');
    if (!led || !text) return;

    text.textContent = state;
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
            <div class="shortcut-row"><span>Geodesic Command Palette</span> <kbd class="shortcut-kbd">Ctrl+K</kbd></div>
            <div class="shortcut-row"><span>Close Modals / Reset</span> <kbd class="shortcut-kbd">Esc</kbd></div>
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
}

export function initMasterHeader(options = {}) {
  return new MasterHeaderController(options);
}
