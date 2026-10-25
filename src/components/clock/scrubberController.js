/**
 * Horologium Dynamic Chrono-Slider & Solar Time Travel Engine (Calibre-01)
 * 
 * Features:
 * - 24h continuous bi-directional mechanical time scrubber with sub-minute resolution
 * - Real-time astronomical solar terminator recalculation (2D Mercator SVG + 3D WebGL Globe)
 * - Automatic Daylight Saving Time (DST) seasonal shift detection & status display
 * - Temporal playback engine (1x, 60x, 3600x) with Play / Pause / Step Controls
 * - Web Audio Haptics mechanical escapement clicks on scrub
 * - 1-Click spring-eased "SNAP TO LIVE ATOMIC TIME" Stratum-1 recovery
 */

import { haptics } from '../../utils/audioHaptics.js';
import { getDstStatus } from '../../utils/dstEngine.js';
import { getSolarDeclination, getSubsolarLongitude } from '../../utils/timeMath.js';
import { sntpClient } from '../../utils/sntpClient.js';

export class ChronoSliderController {
  constructor(options = {}) {
    this.options = Object.assign({
      rangeMinutes: 1440, // 24 Hours scale
      focalTimeZone: 'UTC',
      onTimeShift: () => {},
      onLiveSnap: () => {},
      autoInit: true
    }, options);

    const hasDoc = typeof document !== 'undefined';

    // DOM Elements (Guarded for universal Node/Browser testing)
    this.scrubberTrack = hasDoc ? document.getElementById('scrubberTrack') : null;
    this.scrubberScale = hasDoc ? document.getElementById('scrubberScale') : null;
    this.scrubberNeedle = hasDoc ? document.getElementById('scrubberNeedle') : null;
    this.liveSnapBtn = hasDoc ? document.getElementById('liveSnapBtn') : null;
    this.simulatedOffsetLabel = hasDoc ? document.getElementById('simulatedOffsetLabel') : null;
    this.dstStatusLabel = hasDoc ? document.getElementById('dstStatusLabel') : null;
    this.subsolarPosLabel = hasDoc ? document.getElementById('subsolarPosLabel') : null;

    // Controls container
    this.controlsContainer = hasDoc
      ? (document.querySelector('.scrubber-controls') || document.getElementById('scrubberControls'))
      : null;

    // State
    this.offsetMinutes = 0;
    this.isLive = true;
    this.isDragging = false;
    this.isPlaying = false;
    this.playbackSpeed = 60; // 1 sec = 60 mins (fast simulation)
    this.playTimer = null;
    this.lastTickTime = 0;
    this.focalTimeZone = this.options.focalTimeZone;

    this.onTimeShift = this.options.onTimeShift;
    this.onLiveSnap = this.options.onLiveSnap;

    if (this.options.autoInit && hasDoc) {
      this.init();
    }
  }

  init() {
    this.renderTicks();
    this.mountPlaybackControls();
    this.setupInteractions();
    this.updateDisplay(this.getActiveDate());
  }

  renderTicks() {
    if (!this.scrubberScale || typeof document === 'undefined') return;
    this.scrubberScale.innerHTML = '';

    // 24 Hours x 4 = 96 ticks (15m, 30m, 60m)
    const tickCount = 96;
    for (let i = 0; i <= tickCount; i++) {
      const tick = document.createElement('div');
      tick.classList.add('ruler-tick');

      if (i % 4 === 0) {
        tick.classList.add('hour');
        const hourNum = i / 4;
        if (hourNum % 2 === 0) {
          const label = document.createElement('span');
          label.classList.add('hour-label');
          label.textContent = `${String(hourNum).padStart(2, '0')}:00`;
          tick.appendChild(label);
        }
      } else if (i % 2 === 0) {
        tick.classList.add('minute-30');
      } else {
        tick.classList.add('minute-15');
      }

      this.scrubberScale.appendChild(tick);
    }
  }

  mountPlaybackControls() {
    if (!this.controlsContainer || typeof document === 'undefined') return;

    // Check if playback buttons already mounted
    if (this.controlsContainer.querySelector('#chronoPlayBtn')) return;

    const playBar = document.createElement('div');
    playBar.className = 'chrono-playback-toolbar';
    playBar.style.display = 'inline-flex';
    playBar.style.alignItems = 'center';
    playBar.style.gap = '6px';
    playBar.style.marginRight = '8px';

    playBar.innerHTML = `
      <button type="button" class="chrono-btn-step" id="chronoStepBackBtn" title="Step Back 1 Hour [-1h]" aria-label="Step Back 1 Hour">
        <span>⏪</span>
      </button>
      <button type="button" class="chrono-btn-step" id="chronoStepBack15Btn" title="Step Back 15 Minutes [-15m]" aria-label="Step Back 15 Minutes">
        <span>◀</span>
      </button>
      <button type="button" class="chrono-btn-play" id="chronoPlayBtn" title="Toggle Solar Day/Night Simulation [Space]" aria-label="Toggle Time Simulation">
        <span id="chronoPlayIcon">▶</span>
      </button>
      <button type="button" class="chrono-btn-step" id="chronoStepFwd15Btn" title="Step Forward 15 Minutes [+15m]" aria-label="Step Forward 15 Minutes">
        <span>▶</span>
      </button>
      <button type="button" class="chrono-btn-step" id="chronoStepFwdBtn" title="Step Forward 1 Hour [+1h]" aria-label="Step Forward 1 Hour">
        <span>⏩</span>
      </button>
      <button type="button" class="chrono-speed-toggle" id="chronoSpeedToggle" title="Simulation Speed (60x / 3600x)" aria-label="Simulation Speed">
        <span>60x</span>
      </button>
    `;

    this.controlsContainer.insertBefore(playBar, this.liveSnapBtn || this.controlsContainer.firstChild);

    // Wire Playback Event Listeners
    const btnPlay = this.controlsContainer.querySelector('#chronoPlayBtn');
    const btnStepBack = this.controlsContainer.querySelector('#chronoStepBackBtn');
    const btnStepBack15 = this.controlsContainer.querySelector('#chronoStepBack15Btn');
    const btnStepFwd = this.controlsContainer.querySelector('#chronoStepFwdBtn');
    const btnStepFwd15 = this.controlsContainer.querySelector('#chronoStepFwd15Btn');
    const btnSpeed = this.controlsContainer.querySelector('#chronoSpeedToggle');

    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        haptics.playMechanicalClick();
        this.togglePlay();
      });
    }

    if (btnStepBack) {
      btnStepBack.addEventListener('click', () => {
        haptics.playMechanicalClick();
        this.stepOffset(-60);
      });
    }

    if (btnStepBack15) {
      btnStepBack15.addEventListener('click', () => {
        haptics.playMechanicalClick();
        this.stepOffset(-15);
      });
    }

    if (btnStepFwd) {
      btnStepFwd.addEventListener('click', () => {
        haptics.playMechanicalClick();
        this.stepOffset(60);
      });
    }

    if (btnStepFwd15) {
      btnStepFwd15.addEventListener('click', () => {
        haptics.playMechanicalClick();
        this.stepOffset(15);
      });
    }

    if (btnSpeed) {
      btnSpeed.addEventListener('click', () => {
        haptics.playMechanicalClick();
        this.toggleSpeed();
      });
    }
  }

  setupInteractions() {
    if (!this.scrubberTrack || typeof window === 'undefined') return;

    const handleScrub = (clientX) => {
      const rect = this.scrubberTrack.getBoundingClientRect();
      const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = offsetX / rect.width;

      const targetUtcMinutes = pct * 1440;
      const now = sntpClient.getAtomicTime();
      const currentUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;

      this.offsetMinutes = Math.round(targetUtcMinutes - currentUtcMinutes);
      this.isLive = false;
      if (this.isPlaying) this.pause();

      haptics.playMechanicalClick();
      this.updateNeedlePosition(pct * 100);
      this.notifyTimeShift();
    };

    this.scrubberTrack.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      handleScrub(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) handleScrub(e.clientX);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch events for mobile/tablet
    this.scrubberTrack.addEventListener('touchstart', (e) => {
      this.isDragging = true;
      if (e.touches && e.touches[0]) handleScrub(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches && e.touches[0]) handleScrub(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    if (this.liveSnapBtn) {
      this.liveSnapBtn.addEventListener('click', () => {
        haptics.playMechanicalClick();
        this.snapToLive();
      });
    }
  }

  stepOffset(deltaMinutes) {
    this.offsetMinutes += deltaMinutes;
    this.isLive = false;
    if (this.isPlaying) this.pause();

    const activeDate = this.getActiveDate();
    const totalDayMinutes = activeDate.getUTCHours() * 60 + activeDate.getUTCMinutes() + activeDate.getUTCSeconds() / 60;
    const pct = (totalDayMinutes / 1440) * 100;

    this.updateNeedlePosition(pct);
    this.notifyTimeShift();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    this.isPlaying = true;
    this.isLive = false;
    const playBtn = this.controlsContainer?.querySelector('#chronoPlayBtn');
    const playIcon = this.controlsContainer?.querySelector('#chronoPlayIcon');
    if (playBtn) playBtn.classList.add('active');
    if (playIcon) playIcon.textContent = '❚❚';

    if (this.liveSnapBtn) this.liveSnapBtn.classList.remove('is-live');

    this.lastTickTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.startSimulationLoop();
  }

  pause() {
    this.isPlaying = false;
    const playBtn = this.controlsContainer?.querySelector('#chronoPlayBtn');
    const playIcon = this.controlsContainer?.querySelector('#chronoPlayIcon');
    if (playBtn) playBtn.classList.remove('active');
    if (playIcon) playIcon.textContent = '▶';

    if (this.playTimer) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.playTimer);
      } else {
        clearTimeout(this.playTimer);
      }
      this.playTimer = null;
    }
  }

  toggleSpeed() {
    const speeds = [1, 60, 3600];
    const currentIndex = speeds.indexOf(this.playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    this.playbackSpeed = speeds[nextIndex];

    const btnSpeed = this.controlsContainer?.querySelector('#chronoSpeedToggle');
    if (btnSpeed) {
      btnSpeed.querySelector('span').textContent = `${this.playbackSpeed}x`;
    }
  }

  startSimulationLoop() {
    const loop = (now) => {
      if (!this.isPlaying) return;

      const currentPerf = now || (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const dtSeconds = Math.min((currentPerf - this.lastTickTime) / 1000, 0.1);
      this.lastTickTime = currentPerf;

      // Advance offset by simulated minutes
      const deltaMinutes = (dtSeconds * this.playbackSpeed) / 60;
      this.offsetMinutes += deltaMinutes;

      const activeDate = this.getActiveDate();
      const totalDayMinutes = activeDate.getUTCHours() * 60 + activeDate.getUTCMinutes() + activeDate.getUTCSeconds() / 60;
      const pct = (totalDayMinutes / 1440) * 100;

      this.updateNeedlePosition(pct);
      this.notifyTimeShift(false);

      if (typeof requestAnimationFrame !== 'undefined') {
        this.playTimer = requestAnimationFrame(loop);
      } else {
        this.playTimer = setTimeout(loop, 16);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.playTimer = requestAnimationFrame(loop);
    } else {
      this.playTimer = setTimeout(loop, 16);
    }
  }

  snapToLive() {
    this.pause();
    this.offsetMinutes = 0;
    this.isLive = true;

    if (this.liveSnapBtn) this.liveSnapBtn.classList.add('is-live');

    const now = sntpClient.getAtomicTime();
    const totalDayMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
    const pct = (totalDayMinutes / 1440) * 100;

    this.updateNeedlePosition(pct);
    this.updateDisplay(now);

    this.notifyTimeShift();
    if (typeof this.onLiveSnap === 'function') {
      this.onLiveSnap();
    }
  }

  updateNeedlePosition(pct) {
    if (this.scrubberNeedle) {
      this.scrubberNeedle.style.left = `${Math.max(0, Math.min(pct, 100)).toFixed(2)}%`;
    }
  }

  updateLiveNeedle(date) {
    if (this.isLive && this.scrubberNeedle && !this.isDragging && !this.isPlaying) {
      const d = date || sntpClient.getAtomicTime();
      const totalDayMinutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
      const pct = (totalDayMinutes / 1440) * 100;
      this.updateNeedlePosition(pct);
      this.updateDisplay(d);
    }
  }

  setFocalTimeZone(timeZone) {
    this.focalTimeZone = timeZone;
    this.updateDisplay(this.getActiveDate());
  }

  updateDisplay(activeDate) {
    const d = activeDate || this.getActiveDate();

    // 1. Time Travel Offset Label
    if (this.simulatedOffsetLabel) {
      if (this.isLive || Math.abs(this.offsetMinutes) < 0.1) {
        this.simulatedOffsetLabel.textContent = 'OFFSET: ±00:00 (LIVE STRATUM-1)';
        this.simulatedOffsetLabel.style.color = 'var(--accent-primary)';
      } else {
        const sign = this.offsetMinutes >= 0 ? '+' : '−';
        const absMinutes = Math.abs(Math.round(this.offsetMinutes));
        const absH = Math.floor(absMinutes / 60);
        const absM = absMinutes % 60;
        this.simulatedOffsetLabel.textContent = `TIME TRAVEL: ${sign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')} (${this.isPlaying ? 'SIMULATING' : 'PAUSED'})`;
        this.simulatedOffsetLabel.style.color = 'var(--badge-amber-text, #f59e0b)';
      }
    }

    // 2. Daylight Saving Time Status
    const dstInfo = getDstStatus(this.focalTimeZone, d);
    if (this.dstStatusLabel) {
      this.dstStatusLabel.textContent = dstInfo.statusLabel;
      this.dstStatusLabel.className = `dst-badge ${dstInfo.badgeClass}`;
    }

    // 3. Subsolar Zenith Coordinates
    if (this.subsolarPosLabel) {
      const dec = getSolarDeclination(d).toFixed(1);
      const lon = getSubsolarLongitude(d).toFixed(1);
      this.subsolarPosLabel.textContent = `☀️ SUN: ${dec >= 0 ? '+' : ''}${dec}° LAT | ${lon >= 0 ? '+' : ''}${lon}° LON`;
    }
  }

  notifyTimeShift() {
    const activeDate = this.getActiveDate();
    this.updateDisplay(activeDate);

    if (typeof this.onTimeShift === 'function') {
      this.onTimeShift({
        offsetMinutes: this.offsetMinutes,
        isLive: this.isLive,
        activeDate,
        isPlaying: this.isPlaying,
        speed: this.playbackSpeed,
        dstInfo: getDstStatus(this.focalTimeZone, activeDate)
      });
    }
  }

  getActiveDate() {
    const now = sntpClient.getAtomicTime();
    if (this.isLive || this.offsetMinutes === 0) {
      return now;
    }
    return new Date(now.getTime() + this.offsetMinutes * 60 * 1000);
  }
}

// Backward compatibility alias for legacy imports
export { ChronoSliderController as ScrubberController };
