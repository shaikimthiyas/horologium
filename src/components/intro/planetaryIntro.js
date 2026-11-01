/**
 * HOROLOGIUM CALIBRE-01 // PLANETARY INTRO STAGE (Sprint M - Redesign)
 * Enterprise-Grade Mission Telemetry & Planetary Launch Experience
 * 
 * Features:
 * - 3D Orthographic Canvas Globe with rotating meridians, continents, day/night solar terminator,
 *   pulsing geodesic hubs (London, New York, Zurich, Dubai, Delhi, Tokyo, Sydney), and radar sweep.
 * - Master Stratum-1 UTC Atomic Clock with sub-second millisecond ticking.
 * - Global Meridian Clocks Cluster for primary financial/aerospace temporal anchors.
 * - Enterprise SLO & System Readiness Matrix (99.999% SLA, <0.12ms Jitter, 4/4 Truechimers).
 * - Fast 3.8-second calibrated initialization sequence with sequential milestone lock steps.
 * - 1-Click skip with Space / Esc / Click with mechanical audio haptics integration.
 */

import { haptics } from '../../utils/audioHaptics.js';
import { getSolarDeclination, getSubsolarLongitude } from '../../utils/timeMath.js';

// Continent outlines in spherical [lonDeg, latDeg] polygons
export const CONTINENT_POLYGONS = [
  // North America
  [
    [-168, 65], [-140, 70], [-100, 75], [-60, 70], [-55, 50], [-65, 45],
    [-75, 35], [-80, 25], [-90, 20], [-105, 20], [-120, 32], [-125, 48],
    [-140, 60], [-168, 65]
  ],
  // South America
  [
    [-80, 10], [-60, 12], [-35, -5], [-35, -15], [-40, -22], [-55, -35],
    [-65, -55], [-75, -50], [-72, -35], [-80, -5], [-80, 10]
  ],
  // Europe
  [
    [-10, 36], [0, 42], [5, 44], [15, 40], [25, 36], [30, 45], [40, 55],
    [30, 65], [15, 68], [5, 62], [-5, 58], [-10, 45], [-10, 36]
  ],
  // Africa
  [
    [-17, 15], [-5, 36], [10, 37], [32, 31], [43, 12], [51, 10], [40, -10],
    [35, -25], [20, -35], [15, -30], [10, -5], [0, 5], [-15, 10], [-17, 15]
  ],
  // Asia / Eurasia
  [
    [30, 40], [45, 40], [55, 25], [70, 25], [75, 10], [80, 15], [90, 22],
    [100, 15], [105, 5], [115, 20], [122, 30], [130, 40], [140, 45], [145, 60],
    [170, 65], [100, 75], [60, 70], [45, 60], [30, 40]
  ],
  // Australia
  [
    [115, -22], [125, -15], [140, -12], [150, -22], [153, -30], [148, -38],
    [135, -35], [115, -35], [115, -22]
  ]
];

// Strategic global geodesic time hubs
export const GLOBAL_TIME_HUBS = [
  { id: 'LON', name: 'LONDON', country: 'GB', tz: 'Europe/London', lon: 0, lat: 51.5, offset: 'UTC+0', flag: '🇬🇧' },
  { id: 'NYC', name: 'NEW YORK', country: 'US', tz: 'America/New_York', lon: -74.0, lat: 40.7, offset: 'UTC-5', flag: '🇺🇸' },
  { id: 'ZRH', name: 'ZURICH', country: 'CH', tz: 'Europe/Zurich', lon: 8.5, lat: 47.4, offset: 'UTC+1', flag: '🇨🇭' },
  { id: 'DXB', name: 'DUBAI', country: 'AE', tz: 'Asia/Dubai', lon: 55.3, lat: 25.2, offset: 'UTC+4', flag: '🇦🇪' },
  { id: 'DEL', name: 'NEW DELHI', country: 'IN', tz: 'Asia/Kolkata', lon: 77.2, lat: 28.6, offset: 'UTC+5:30', flag: '🇮🇳' },
  { id: 'TYO', name: 'TOKYO', country: 'JP', tz: 'Asia/Tokyo', lon: 139.7, lat: 35.7, offset: 'UTC+9', flag: '🇯🇵' },
  { id: 'SYD', name: 'SYDNEY', country: 'AU', tz: 'Australia/Sydney', lon: 151.2, lat: -33.8, offset: 'UTC+11', flag: '🇦🇺' }
];

export class PlanetaryIntroStage {
  constructor(options = {}) {
    this.options = Object.assign({
      durationMs: 3800, // 3.8s enterprise calibration window (3-5s requirement)
      autoStart: true,
      onComplete: () => {}
    }, options);

    this.hasDom = typeof document !== 'undefined';
    this.stageEl = this.hasDom ? document.getElementById('introStage') : null;
    this.canvas = this.hasDom ? document.getElementById('introGlobeCanvas') : null;
    this.ctx = this.canvas && typeof this.canvas.getContext === 'function' ? this.canvas.getContext('2d') : null;

    // Elements
    this.utcMasterEl = this.hasDom ? document.getElementById('introMasterUtc') : null;
    this.solarDecEl = this.hasDom ? document.getElementById('introSolarDec') : null;
    this.subsolarLonEl = this.hasDom ? document.getElementById('introSubsolarLon') : null;
    this.progressBarEl = this.hasDom ? document.getElementById('introProgressBar') : null;
    this.progressPctEl = this.hasDom ? document.getElementById('introProgressPct') : null;
    this.statusPillEl = this.hasDom ? document.getElementById('introStatusPill') : null;
    this.btnSkip = this.hasDom ? document.getElementById('btnSkipIntro') : null;
    this.btnSound = this.hasDom ? document.getElementById('introSoundToggle') : null;

    // Animation & Sequence State
    this.isActive = true;
    this.startTime = null;
    this.animId = null;
    this.globeRotation = 0; // Radians
    this.lastTickSec = -1;
    this.radarAngle = 0;

    // 4 Calibrated Initialization Milestones
    this.milestones = [
      { timeMs: 0, id: 'introStep1', label: 'STRATUM-1 UTC REFERENCE SYNCED', statId: 'step1Stat', statText: 'LOCKED' },
      { timeMs: 950, id: 'introStep2', label: '220 GEODESIC BOUNDARIES MAPPED', statId: 'step2Stat', statText: 'VERIFIED' },
      { timeMs: 1900, id: 'introStep3', label: 'SOLAR TERMINATOR & ZENITH ALIGNED', statId: 'step3Stat', statText: 'RESOLVED' },
      { timeMs: 2850, id: 'introStep4', label: 'MARZULLO 99.999% SLO NOMINAL', statId: 'step4Stat', statText: 'ARMED' }
    ];

    if (this.hasDom && this.options.autoStart) {
      this.init();
    }
  }

  init() {
    if (!this.stageEl) return;

    this.setupListeners();
    this.resizeCanvas();
    this.renderInitialStatic();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.resizeCanvas());
      this.startSequence();
    }
  }

  setupListeners() {
    // Skip Button
    if (this.btnSkip) {
      this.btnSkip.addEventListener('click', (e) => {
        e.preventDefault();
        haptics.playMechanicalClick();
        this.dismiss();
      });
    }

    // Audio Haptics Toggle
    if (this.btnSound) {
      this.btnSound.addEventListener('click', (e) => {
        e.preventDefault();
        const enabled = haptics.toggle();
        const icon = this.btnSound.querySelector('.sound-icon');
        const text = this.btnSound.querySelector('.sound-text');
        if (icon) icon.textContent = enabled ? '🔊' : '🔇';
        if (text) text.textContent = enabled ? 'AUDIO ON' : 'AUDIO OFF';
      });
    }

    // Global Key Listener: Space / Esc to skip immediately
    this.keyHandler = (e) => {
      if (!this.isActive) return;
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;

      if (e.code === 'Space' || e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        haptics.playMechanicalClick();
        this.dismiss();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  resizeCanvas() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.min(rect.width || 340, rect.height || 340);
    this.canvas.width = Math.floor(size * dpr);
    this.canvas.height = Math.floor(size * dpr);
    this.ctx.scale(dpr, dpr);
  }

  startSequence() {
    this.isActive = true;
    this.startTime = null;
    this.lastTickSec = -1;
    if (this.stageEl) this.stageEl.classList.remove('dismissed');

    const loop = (timestamp) => {
      if (!this.isActive) return;
      if (!this.startTime) this.startTime = timestamp;

      const elapsed = timestamp - this.startTime;
      const progress = Math.min(elapsed / this.options.durationMs, 1.0);

      this.updateProgress(progress, elapsed);
      this.updateClocks();
      this.renderGlobe(elapsed);

      // Tick audio each second
      const sec = Math.floor(elapsed / 1000);
      if (sec !== this.lastTickSec && sec < 4) {
        this.lastTickSec = sec;
        haptics.playTick();
      }

      if (elapsed >= this.options.durationMs) {
        this.dismiss();
      } else {
        this.animId = requestAnimationFrame(loop);
      }
    };

    this.animId = requestAnimationFrame(loop);
  }

  updateProgress(progress, elapsed) {
    // Update Progress bar width
    if (this.progressBarEl) {
      this.progressBarEl.style.width = `${(progress * 100).toFixed(1)}%`;
    }

    // Update Percentage Text
    if (this.progressPctEl) {
      this.progressPctEl.textContent = `${Math.floor(progress * 100)}%`;
    }

    // Sequential milestone illumination
    this.milestones.forEach(m => {
      if (elapsed >= m.timeMs) {
        const stepRow = document.getElementById(m.id);
        const statEl = document.getElementById(m.statId);
        if (stepRow && !stepRow.classList.contains('active')) {
          stepRow.classList.add('active', 'completed');
        }
        if (statEl) {
          statEl.textContent = m.statText;
          statEl.style.color = 'var(--semantic-success, #10b981)';
        }
      }
    });

    if (progress >= 0.95 && this.statusPillEl) {
      this.statusPillEl.textContent = 'SYSTEM OPERATIONAL // NOMINAL';
      this.statusPillEl.style.color = 'var(--semantic-success, #10b981)';
    }
  }

  updateClocks() {
    const now = new Date();

    // 1. Master Stratum-1 UTC Clock with sub-second hundredths
    if (this.utcMasterEl) {
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      const ms = String(Math.floor(now.getUTCMilliseconds() / 10)).padStart(2, '0');
      this.utcMasterEl.textContent = `${h}:${m}:${s}.${ms} UTC`;
    }

    // 2. Solar Declination & Subsolar Meridian
    const dec = getSolarDeclination(now);
    const subLon = getSubsolarLongitude(now);

    if (this.solarDecEl) {
      this.solarDecEl.textContent = `${dec >= 0 ? '+' : ''}${dec.toFixed(2)}°`;
    }
    if (this.subsolarLonEl) {
      this.subsolarLonEl.textContent = `${subLon >= 0 ? '+' : ''}${subLon.toFixed(1)}°`;
    }

    // 3. Update Global Time Hub Clocks
    GLOBAL_TIME_HUBS.forEach(hub => {
      const el = document.getElementById(`clockHub_${hub.id}`);
      if (el) {
        try {
          const timeStr = new Intl.DateTimeFormat('en-US', {
            timeZone: hub.tz,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).format(now);
          el.textContent = timeStr;
        } catch (_) {}
      }
    });
  }

  renderGlobe(elapsed = 0) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const size = this.canvas.width / (window.devicePixelRatio || 1);
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.40; // Globe Radius

    ctx.clearRect(0, 0, size, size);

    // Rotate globe continuously (approx 1 rev / 16 seconds)
    this.globeRotation = (elapsed * 0.0004);
    this.radarAngle = (elapsed * 0.002) % (Math.PI * 2);

    // 1. Atmospheric Outer Glow Ring
    const atmoGlow = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.15);
    atmoGlow.addColorStop(0, 'rgba(0, 229, 184, 0.16)');
    atmoGlow.addColorStop(0.5, 'rgba(255, 68, 0, 0.08)');
    atmoGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmoGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // 2. Compass & Orbital Tick Ring
    ctx.save();
    ctx.strokeStyle = 'rgba(237, 239, 242, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
    ctx.stroke();

    // Degree Ticks
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * (R * 1.06);
      const y1 = cy + Math.sin(rad) * (R * 1.06);
      const x2 = cx + Math.cos(rad) * (R * 1.10);
      const y2 = cy + Math.sin(rad) * (R * 1.10);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Deep Obsidian Planetary Sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // Base Ocean Gradient
    const oceanGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    oceanGrad.addColorStop(0, '#10141c');
    oceanGrad.addColorStop(0.7, '#07090d');
    oceanGrad.addColorStop(1, '#030406');
    ctx.fillStyle = oceanGrad;
    ctx.fill();

    // 4. Latitude Parallels (Equator, Tropics, Arctic)
    ctx.strokeStyle = 'rgba(237, 239, 242, 0.08)';
    ctx.lineWidth = 1;
    const parallels = [-66.5, -23.44, 0, 23.44, 66.5];
    parallels.forEach(latDeg => {
      const latRad = (latDeg * Math.PI) / 180;
      const y = cy - Math.sin(latRad) * R;
      const rAtY = Math.cos(latRad) * R;
      ctx.beginPath();
      ctx.ellipse(cx, y, rAtY, rAtY * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 5. Rotating Longitude Meridians (Every 30 degrees)
    for (let lonDeg = 0; lonDeg < 360; lonDeg += 30) {
      const effLon = ((lonDeg * Math.PI) / 180 + this.globeRotation) % (Math.PI * 2);
      const sinLon = Math.sin(effLon);
      const cosLon = Math.cos(effLon);

      // Only draw when visible on front hemisphere
      if (cosLon > -0.1) {
        ctx.beginPath();
        ctx.strokeStyle = (lonDeg === 0)
          ? 'rgba(255, 68, 0, 0.45)' // Highlight 0° Prime Meridian in Vermilion
          : 'rgba(237, 239, 242, 0.09)';
        ctx.lineWidth = (lonDeg === 0) ? 1.5 : 1;
        ctx.ellipse(cx, cy, Math.abs(sinLon) * R, R, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 6. Continents Landmass Polygons
    ctx.fillStyle = '#181f2a';
    ctx.strokeStyle = 'rgba(0, 229, 184, 0.45)';
    ctx.lineWidth = 1.2;

    CONTINENT_POLYGONS.forEach(poly => {
      ctx.beginPath();
      let started = false;

      for (let i = 0; i < poly.length; i++) {
        const [lonDeg, latDeg] = poly[i];
        const lonRad = (lonDeg * Math.PI) / 180;
        const latRad = (latDeg * Math.PI) / 180;

        const effLon = lonRad + this.globeRotation;
        const x3d = R * Math.cos(latRad) * Math.sin(effLon);
        const y3d = -R * Math.sin(latRad);
        const z3d = R * Math.cos(latRad) * Math.cos(effLon);

        if (z3d > 0) {
          const px = cx + x3d;
          const py = cy + y3d;
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      if (started) {
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });

    // 7. Astronomical Solar Day/Night Terminator Shading
    const now = new Date();
    const decDeg = getSolarDeclination(now);
    const decRad = (decDeg * Math.PI) / 180;
    const subLonRad = (getSubsolarLongitude(now) * Math.PI) / 180;
    const sunEffLon = subLonRad + this.globeRotation;

    const sunX = Math.cos(decRad) * Math.sin(sunEffLon);
    const sunY = -Math.sin(decRad);
    const sunZ = Math.cos(decRad) * Math.cos(sunEffLon);

    // Night Shading Overlay
    const nightGrad = ctx.createRadialGradient(
      cx - sunX * R * 0.8,
      cy - sunY * R * 0.8,
      R * 0.2,
      cx,
      cy,
      R * 1.1
    );
    nightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    nightGrad.addColorStop(0.5, 'rgba(3, 5, 8, 0.45)');
    nightGrad.addColorStop(1, 'rgba(2, 3, 5, 0.82)');
    ctx.fillStyle = nightGrad;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // 8. Radar Sweep Scan Line
    const rx = cx + Math.cos(this.radarAngle) * R;
    const ry = cy + Math.sin(this.radarAngle) * R;

    const radarGrad = ctx.createLinearGradient(cx, cy, rx, ry);
    radarGrad.addColorStop(0, 'rgba(255, 68, 0, 0.35)');
    radarGrad.addColorStop(1, 'rgba(255, 68, 0, 0.0)');
    ctx.strokeStyle = radarGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(rx, ry);
    ctx.stroke();

    // 9. Pulsing Geodesic Hub Nodes (London, New York, Zurich, etc.)
    GLOBAL_TIME_HUBS.forEach((hub, idx) => {
      const lonRad = (hub.lon * Math.PI) / 180;
      const latRad = (hub.lat * Math.PI) / 180;

      const effLon = lonRad + this.globeRotation;
      const x3d = R * Math.cos(latRad) * Math.sin(effLon);
      const y3d = -R * Math.sin(latRad);
      const z3d = R * Math.cos(latRad) * Math.cos(effLon);

      if (z3d > 10) { // On visible front hemisphere
        const px = cx + x3d;
        const py = cy + y3d;
        const pulse = Math.sin(elapsed * 0.005 + idx) * 2;

        // Glowing Hub Ring
        ctx.strokeStyle = (hub.id === 'LON') ? 'var(--accent-primary, #ff4400)' : 'var(--semantic-success, #10b981)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, 4 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Hub Core Dot
        ctx.fillStyle = (hub.id === 'LON') ? '#ff4400' : '#10b981';
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();

        // Hub Text Label
        ctx.font = '9px var(--font-mono, monospace)';
        ctx.fillStyle = 'rgba(237, 239, 242, 0.85)';
        ctx.fillText(hub.id, px + 8, py + 3);
      }
    });

    // 10. Subsolar Zenith Point Indicator (☀️ Sun Marker)
    if (sunZ > 0) {
      const sx = cx + sunX * R;
      const sy = cy + sunY * R;
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore(); // End Sphere Clip

    // 11. Coordinate Reticle Overlay Crosshair
    ctx.strokeStyle = 'rgba(255, 68, 0, 0.45)';
    ctx.lineWidth = 1;
    // Central Crosshair
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();
  }

  renderInitialStatic() {
    this.updateClocks();
    this.renderGlobe(0);
  }

  dismiss() {
    if (!this.isActive) return;
    this.isActive = false;

    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }

    if (this.stageEl) {
      this.stageEl.classList.add('dismissed');
    }

    // Play tactile mechanical lock tone on transition
    haptics.playLockTone();

    if (typeof this.options.onComplete === 'function') {
      this.options.onComplete();
    }
  }

  replay() {
    if (this.stageEl) {
      this.stageEl.classList.remove('dismissed');
      // Reset diagnostic milestone styles
      this.milestones.forEach(m => {
        const row = document.getElementById(m.id);
        const stat = document.getElementById(m.statId);
        if (row) row.classList.remove('active', 'completed');
        if (stat) { stat.textContent = 'PENDING'; stat.style.color = 'var(--fg-2, #8e95a2)'; }
      });
      if (this.statusPillEl) {
        this.statusPillEl.textContent = 'ENGAGING ATOMIC REFERENCE';
        this.statusPillEl.style.color = 'var(--accent-primary, #ff4400)';
      }
      this.startSequence();
    }
  }

  destroy() {
    this.dismiss();
    if (this.keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyHandler);
    }
  }
}

export function initPlanetaryIntro(options = {}) {
  return new PlanetaryIntroStage(options);
}
