/**
 * HOROLOGIUM DESIGN SYSTEM (v1.0.0-PRO) // NAVIGATION & TELEMETRY HEADER
 * Codename: Calibre-01
 * Manages Master UTC clock ticker, Solar Declination readout, theme toggle, and format toggle
 */
import { calculateSolarDeclination } from '../../utils/timeMath.js';
import { STORAGE_KEYS } from '../../config/constants.js';

export class NavigationHeader {
  constructor(options = {}) {
    this.utcMasterEl = document.getElementById('utcClockMaster');
    this.bottomUtcClockEl = document.getElementById('bottomUtcClock');
    this.solarDecEl = document.getElementById('solarDecVal');
    this.formatToggleBtn = document.getElementById('formatToggleBtn');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');

    this.onFormatChange = options.onFormatChange || (() => {});
    this.onThemeChange = options.onThemeChange || (() => {});

    this.is24h = localStorage.getItem(STORAGE_KEYS.TIME_FORMAT) !== '12h';
    this.isDark = localStorage.getItem(STORAGE_KEYS.THEME) !== 'light';

    this.init();
  }

  init() {
    this.applyTheme(this.isDark, false);
    this.applyFormat(this.is24h, false);

    // Module 05: pointerdown execution split for zero release latency
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.toggleTheme();
      });
    }

    if (this.formatToggleBtn) {
      this.formatToggleBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.toggleFormat();
      });
    }

    this.tick(new Date());
  }

  tick(activeDate = new Date()) {
    const utcHours = String(activeDate.getUTCHours()).padStart(2, '0');
    const utcMinutes = String(activeDate.getUTCMinutes()).padStart(2, '0');
    const utcSeconds = String(activeDate.getUTCSeconds()).padStart(2, '0');
    const formattedUtc = `${utcHours}:${utcMinutes}:${utcSeconds} UTC`;

    if (this.utcMasterEl) {
      this.utcMasterEl.textContent = formattedUtc;
    }

    if (this.bottomUtcClockEl) {
      this.bottomUtcClockEl.textContent = formattedUtc;
    }

    if (this.solarDecEl) {
      const dec = calculateSolarDeclination(activeDate);
      const sign = dec >= 0 ? '+' : '';
      this.solarDecEl.textContent = `DEC ${sign}${dec.toFixed(2)}°`;
    }
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    this.applyTheme(this.isDark, true);
  }

  applyTheme(isDark, notify = true) {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'obsidian');
      if (this.themeToggleBtn) this.themeToggleBtn.textContent = 'OBSIDIAN';
      localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
      localStorage.setItem('horologium_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'silvered');
      if (this.themeToggleBtn) this.themeToggleBtn.textContent = 'SILVERED';
      localStorage.setItem(STORAGE_KEYS.THEME, 'light');
      localStorage.setItem('horologium_theme', 'light');
    }
    if (notify) this.onThemeChange(isDark);
  }

  toggleFormat() {
    this.is24h = !this.is24h;
    this.applyFormat(this.is24h, true);
  }

  applyFormat(is24h, notify = true) {
    if (this.formatToggleBtn) {
      this.formatToggleBtn.textContent = is24h ? '24H' : '12H';
    }
    localStorage.setItem(STORAGE_KEYS.TIME_FORMAT, is24h ? '24h' : '12h');
    if (notify) this.onFormatChange(is24h);
  }
}
