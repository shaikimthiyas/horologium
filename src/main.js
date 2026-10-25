/**
 * ==========================================================================
 * HOROLOGIUM // PRIMARY APPLICATION BOOTSTRAP
 * Global Temporal & Meridian Telemetry System
 * ==========================================================================
 */

import { MapController } from './components/map/mapController.js';
import { ScrubberController } from './components/clock/scrubberController.js';
import { TelemetryMatrix } from './components/clock/telemetryMatrix.js';
import { CommandPalette } from './components/ui/commandPalette.js';
import { NavigationHeader } from './components/ui/navigation.js';
import { timeService } from './api/timeService.js';
import { APP_CONFIG } from './config/constants.js';
import { getCountryData } from './data/countries.data.js';
import { getQueryParam } from './utils/router.js';
import { sntpClient } from './utils/sntpClient.js';

class HorologiumApp {
  constructor() {
    this.mapController = null;
    this.scrubberController = null;
    this.telemetryMatrix = null;
    this.commandPalette = null;
    this.navHeader = null;

    this.simulatedOffsetMinutes = 0;
    this.isLive = true;
    this.activeTime = new Date();
    this.clockInterval = null;

    this.init();
  }

  async init() {
    console.info(`[Horologium] Bootstrapping ${APP_CONFIG.APP_NAME} v${APP_CONFIG.VERSION}`);

    // 1. Initialize Navigation Header (UTC Clock, Solar Dec, Theme & 12h/24h)
    this.navHeader = new NavigationHeader({
      onThemeChange: (isDark) => {
        // Theme updated globally on html element
      },
      onFormatChange: (is24h) => {
        if (this.telemetryMatrix) {
          this.telemetryMatrix.setFormat(is24h);
          this.telemetryMatrix.render(this.getEffectiveDate());
        }
      }
    });

    // 2. Initialize Telemetry Matrix (Docked Bento Horology)
    this.telemetryMatrix = new TelemetryMatrix({
      onSelectCity: (countryName) => {
        if (this.mapController) {
          this.mapController.selectCountry(countryName);
          this.mapController.focusOnCountry(countryName);
        }
      }
    });
    this.telemetryMatrix.setFormat(this.navHeader.is24h);
    await this.telemetryMatrix.loadRemotePins();

    // 3. Initialize Interactive World Map Controller
    this.mapController = new MapController({
      onSelectCountry: (countryName) => {
        if (this.telemetryMatrix) {
          this.telemetryMatrix.setFocalCountry(countryName);
          this.telemetryMatrix.render(this.getEffectiveDate());
        }
        const cData = getCountryData(countryName);
        if (cData && cData.timezone && this.scrubberController) {
          this.scrubberController.setFocalTimeZone(cData.timezone);
        }
      }
    });

    // Wire Zoom Buttons
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnResetView = document.getElementById('btnResetView');
    const btnToggleGraticules = document.getElementById('btnToggleGraticules');

    if (btnZoomIn) btnZoomIn.addEventListener('click', () => this.mapController.zoomIn());
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => this.mapController.zoomOut());
    if (btnResetView) btnResetView.addEventListener('click', () => this.mapController.resetView());
    if (btnToggleGraticules) {
      btnToggleGraticules.addEventListener('click', () => {
        const visible = this.mapController.toggleGraticules();
        btnToggleGraticules.classList.toggle('active', visible);
      });
    }

    // 4. Initialize 24-Hour Chrono-Slider Controller (Sprint J)
    this.scrubberController = new ScrubberController({
      onTimeShift: (shiftData) => {
        if (shiftData instanceof Date) {
          this.simulatedOffsetMinutes = Math.round((shiftData.getTime() - sntpClient.getAtomicTime().getTime()) / 60000);
          this.isLive = false;
        } else if (shiftData && typeof shiftData.offsetMinutes === 'number') {
          this.simulatedOffsetMinutes = shiftData.offsetMinutes;
          this.isLive = Boolean(shiftData.isLive);
        }
        this.updateTimeFrame();
      },
      onLiveSnap: () => {
        this.simulatedOffsetMinutes = 0;
        this.isLive = true;
        this.updateTimeFrame();
      }
    });

    // 5. Initialize Command Palette (Cmd+K)
    this.commandPalette = new CommandPalette({
      onSelectCountry: (countryName) => {
        if (this.mapController) {
          this.mapController.selectCountry(countryName);
          this.mapController.focusOnCountry(countryName);
        }
      }
    });

    // Check for deep-linked ?country= parameter
    const targetCountry = getQueryParam('country');
    if (targetCountry && this.mapController) {
      setTimeout(() => {
        this.mapController.selectCountry(targetCountry);
        this.mapController.focusOnCountry(targetCountry);
      }, 150);
    }

    // 6. Global Horologium Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 't' || e.key === 'T') {
        if (this.navHeader) this.navHeader.toggleTheme();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (this.scrubberController) this.scrubberController.snapToLive();
      }
    });

    // 7. Start Master Telemetry Clock Loop
    this.startClockTicker();

    // 8. Verify atomic time with remote service in background
    this.syncRemoteTime();
  }

  getEffectiveDate() {
    const now = sntpClient.getAtomicTime();
    if (this.isLive || this.simulatedOffsetMinutes === 0) {
      return now;
    }
    return new Date(now.getTime() + this.simulatedOffsetMinutes * 60 * 1000);
  }

  updateTimeFrame() {
    const effectiveDate = this.getEffectiveDate();

    // Update solar terminator on map
    if (this.mapController) {
      this.mapController.updateTerminator(effectiveDate);
    }

    // Update navigation ticker & solar declination
    if (this.navHeader) {
      this.navHeader.tick(effectiveDate);
    }

    // Update docked matrix horology
    if (this.telemetryMatrix) {
      this.telemetryMatrix.render(effectiveDate);
    }

    // Update scrubber live needle position when operating on Stratum-1
    if (this.scrubberController && this.isLive) {
      this.scrubberController.updateLiveNeedle(effectiveDate);
    }
  }

  startClockTicker() {
    this.updateTimeFrame();

    this.clockInterval = setInterval(() => {
      if (this.isLive) {
        this.updateTimeFrame();
      } else {
        // If scrubber is paused on simulated offset, still tick solar declination & effective time
        this.updateTimeFrame();
      }
    }, APP_CONFIG.CLOCK_TICK_INTERVAL_MS);
  }

  async syncRemoteTime() {
    try {
      const remote = await timeService.fetchTime('UTC');
      if (remote && remote.source !== 'native_fallback') {
        console.info(`[Horologium] Synchronized with atomic reference (${remote.source}): ${remote.utc}`);
      }
    } catch (err) {
      console.warn('[Horologium] External time reference rate-limited; operating on high-precision browser Intl API.');
    }
  }
}

// Bootstrap application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new HorologiumApp());
} else {
  new HorologiumApp();
}
