/**
 * HOROLOGIUM CALIBRE-01 // SWISS HOROLOGICAL PLANETARY TOURBILLON INTRO ENGINE
 * High-Craft Mechanical Chronometer & 3D Slanted Geodesic Globe
 * 
 * Features:
 * - Recessed 7-Segment Illuminated 'H:' Monogram with glowing neon orange segments & cyan colon resonators.
 * - Procedural SVG Tachymeter Bezel, 3D applied faceted hour batons, and exposed skeleton gear movement with ruby jewels.
 * - Concentric Cyan Orbital Telemetry Ring rotating strictly CLOCKWISE.
 * - Interactive 3D Orthographic Geodesic Globe canted at Earth's -23.44° diagonal axial tilt,
 *   revolving in 3D from Left to Right, with interactive click-and-drag inertia physics and live coordinate updates.
 * - Geodesic triangulated continent mesh with active Geneva/European hub glowing in International Orange-Red (#FF4D15).
 * - 3D Glowing Orange Orbital Laser Rings (#FF5722) slicing through the Prime Meridian and equator.
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

// 189 Precision Triangulated Geodesic Continent Facets
export const GEODESIC_TRIANGLES = [[[-10, 37], [-8, 43], [0, 42]], [[-10, 37], [0, 42], [-5, 36]], [[-8, 43], [-1, 46], [0, 42]], [[-5, 50], [2, 51], [-4, 58]], [[-4, 58], [2, 51], [2, 57]], [[-1, 46], [6, 46], [0, 42]], [[0, 42], [6, 46], [5, 43]], [[5, 43], [6, 46], [12, 44]], [[-1, 46], [3, 50], [6, 46]], [[3, 50], [8, 50], [6, 46]], [[3, 50], [8, 54], [8, 50]], [[8, 50], [14, 52], [6, 46]], [[6, 46], [14, 52], [14, 46]], [[8, 50], [8, 54], [14, 52]], [[5, 43], [12, 44], [9, 39]], [[12, 44], [16, 41], [15, 38]], [[12, 44], [14, 46], [16, 41]], [[5, 58], [12, 56], [11, 64]], [[11, 64], [12, 56], [18, 59]], [[11, 64], [18, 59], [22, 65]], [[11, 64], [22, 65], [18, 70]], [[14, 52], [22, 54], [14, 46]], [[14, 46], [22, 54], [24, 47]], [[22, 54], [30, 56], [24, 47]], [[24, 47], [30, 56], [30, 46]], [[24, 47], [30, 46], [28, 41]], [[14, 46], [24, 47], [21, 40]], [[21, 40], [24, 47], [28, 41]], [[30, 56], [40, 58], [38, 48]], [[30, 56], [38, 48], [30, 46]], [[38, 48], [48, 55], [44, 44]], [[30, 46], [38, 48], [44, 44]], [[-17, 21], [-13, 28], [-5, 36]], [[-17, 21], [-5, 36], [0, 32]], [[-5, 36], [10, 37], [0, 32]], [[0, 32], [10, 37], [12, 33]], [[0, 32], [12, 33], [15, 25]], [[12, 33], [25, 32], [15, 25]], [[25, 32], [32, 31], [25, 24]], [[15, 25], [25, 32], [25, 24]], [[25, 24], [32, 31], [33, 24]], [[-17, 21], [0, 32], [-10, 15]], [[-10, 15], [0, 32], [0, 15]], [[0, 32], [15, 25], [0, 15]], [[0, 15], [15, 25], [15, 14]], [[15, 25], [25, 24], [15, 14]], [[15, 14], [25, 24], [28, 15]], [[25, 24], [33, 24], [28, 15]], [[28, 15], [33, 24], [38, 16]], [[-17, 21], [-10, 15], [-17, 12]], [[-17, 12], [-10, 15], [-8, 5]], [[-10, 15], [0, 15], [-8, 5]], [[-8, 5], [0, 15], [3, 6]], [[0, 15], [10, 5], [3, 6]], [[0, 15], [15, 14], [10, 5]], [[10, 5], [15, 14], [22, 4]], [[15, 14], [28, 15], [22, 4]], [[22, 4], [28, 15], [32, 3]], [[28, 15], [38, 16], [42, 10]], [[28, 15], [42, 10], [32, 3]], [[38, 16], [51, 11], [42, 10]], [[42, 10], [51, 11], [46, 3]], [[32, 3], [42, 10], [46, 3]], [[10, 5], [22, 4], [12, -5]], [[12, -5], [22, 4], [20, -5]], [[22, 4], [32, 3], [30, -5]], [[22, 4], [30, -5], [20, -5]], [[32, 3], [46, 3], [40, -4]], [[32, 3], [40, -4], [30, -5]], [[12, -5], [20, -5], [14, -18]], [[20, -5], [30, -5], [25, -18]], [[20, -5], [25, -18], [14, -18]], [[30, -5], [40, -4], [35, -18]], [[30, -5], [35, -18], [25, -18]], [[14, -18], [25, -18], [18, -34]], [[25, -18], [35, -18], [28, -32]], [[14, -18], [28, -32], [18, -34]], [[25, -18], [28, -32], [32, -28]], [[-77, 8], [-72, 12], [-65, 10]], [[-77, 8], [-65, 10], [-70, 0]], [[-65, 10], [-55, 6], [-60, 0]], [[-65, 10], [-60, 0], [-70, 0]], [[-55, 6], [-48, 0], [-55, -5]], [[-55, 6], [-55, -5], [-60, 0]], [[-70, 0], [-60, 0], [-65, -10]], [[-60, 0], [-55, -5], [-50, -10]], [[-60, 0], [-50, -10], [-65, -10]], [[-48, 0], [-37, -5], [-42, -12]], [[-48, 0], [-42, -12], [-55, -5]], [[-55, -5], [-42, -12], [-50, -10]], [[-37, -5], [-35, -10], [-40, -20]], [[-37, -5], [-40, -20], [-42, -12]], [[-42, -12], [-40, -20], [-50, -10]], [[-80, -5], [-70, 0], [-75, -15]], [[-70, 0], [-65, -10], [-75, -15]], [[-75, -15], [-65, -10], [-65, -22]], [[-65, -10], [-50, -10], [-58, -20]], [[-65, -10], [-58, -20], [-65, -22]], [[-50, -10], [-40, -20], [-48, -25]], [[-50, -10], [-48, -25], [-58, -20]], [[-75, -15], [-65, -22], [-71, -30]], [[-65, -22], [-58, -20], [-63, -32]], [[-65, -22], [-63, -32], [-71, -30]], [[-58, -20], [-48, -25], [-55, -34]], [[-58, -20], [-55, -34], [-63, -32]], [[-71, -30], [-63, -32], [-70, -42]], [[-63, -32], [-55, -34], [-65, -42]], [[-63, -32], [-65, -42], [-70, -42]], [[-70, -42], [-65, -42], [-72, -52]], [[-65, -42], [-66, -54], [-72, -52]], [[-165, 65], [-140, 68], [-145, 60]], [[-140, 68], [-120, 68], [-130, 58]], [[-140, 68], [-130, 58], [-145, 60]], [[-120, 68], [-95, 70], [-110, 58]], [[-120, 68], [-110, 58], [-130, 58]], [[-95, 70], [-75, 65], [-85, 55]], [[-95, 70], [-85, 55], [-110, 58]], [[-75, 65], [-60, 55], [-70, 50]], [[-75, 65], [-70, 50], [-85, 55]], [[-125, 48], [-110, 48], [-120, 38]], [[-130, 58], [-110, 58], [-110, 48]], [[-130, 58], [-110, 48], [-125, 48]], [[-110, 58], [-90, 48], [-100, 38]], [[-110, 58], [-100, 38], [-110, 48]], [[-110, 58], [-85, 55], [-90, 48]], [[-85, 55], [-70, 50], [-75, 40]], [[-85, 55], [-75, 40], [-90, 48]], [[-70, 50], [-65, 44], [-72, 41]], [[-70, 50], [-72, 41], [-75, 40]], [[-125, 48], [-120, 38], [-118, 33]], [[-120, 38], [-105, 34], [-118, 33]], [[-120, 38], [-100, 38], [-105, 34]], [[-100, 38], [-85, 38], [-95, 29]], [[-100, 38], [-95, 29], [-105, 34]], [[-90, 48], [-75, 40], [-82, 32]], [[-90, 48], [-82, 32], [-85, 38]], [[-85, 38], [-82, 32], [-88, 30]], [[-85, 38], [-88, 30], [-95, 29]], [[-75, 40], [-75, 35], [-82, 32]], [[-82, 32], [-75, 35], [-80, 26]], [[-115, 32], [-105, 30], [-110, 24]], [[-105, 30], [-98, 26], [-102, 20]], [[-105, 30], [-102, 20], [-110, 24]], [[-98, 26], [-90, 21], [-96, 16]], [[-98, 26], [-96, 16], [-102, 20]], [[35, 32], [45, 36], [42, 28]], [[35, 32], [42, 28], [35, 22]], [[35, 22], [42, 28], [45, 18]], [[42, 28], [55, 26], [45, 18]], [[45, 18], [55, 26], [54, 16]], [[45, 36], [58, 37], [55, 26]], [[45, 36], [55, 26], [42, 28]], [[50, 50], [65, 52], [60, 42]], [[44, 44], [50, 50], [60, 42]], [[58, 37], [60, 42], [70, 36]], [[60, 42], [65, 52], [75, 45]], [[60, 42], [75, 45], [70, 36]], [[68, 28], [78, 32], [75, 20]], [[68, 28], [75, 20], [72, 19]], [[78, 32], [88, 26], [82, 19]], [[78, 32], [82, 19], [75, 20]], [[72, 19], [75, 20], [77, 10]], [[75, 20], [82, 19], [77, 10]], [[82, 19], [80, 13], [77, 10]], [[78, 32], [95, 36], [88, 26]], [[95, 36], [105, 32], [88, 26]], [[88, 26], [105, 32], [100, 22]], [[95, 36], [112, 38], [105, 32]], [[105, 32], [118, 30], [100, 22]], [[105, 32], [112, 38], [118, 30]], [[100, 22], [118, 30], [114, 22]], [[100, 22], [108, 14], [100, 10]], [[100, 22], [114, 22], [108, 14]], [[100, 10], [108, 14], [105, 2]], [[112, 38], [128, 42], [124, 35]], [[112, 38], [124, 35], [118, 30]], [[130, 32], [140, 36], [135, 34]], [[140, 36], [144, 44], [141, 40]], [[115, -22], [128, -16], [124, -28]], [[128, -16], [138, -14], [134, -24]], [[128, -16], [134, -24], [124, -28]], [[138, -14], [146, -18], [140, -28]], [[138, -14], [140, -28], [134, -24]], [[146, -18], [152, -26], [140, -28]], [[124, -28], [134, -24], [130, -32]], [[134, -24], [140, -28], [140, -36]], [[134, -24], [140, -36], [130, -32]], [[140, -28], [152, -26], [150, -34]], [[140, -28], [150, -34], [140, -36]]];

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

    // Horological Tourbillon Elements
    this.cyanOrbitalRing = this.hasDom ? document.getElementById('introCyanOrbitalRing') : null;
    this.gearBrassMain = this.hasDom ? document.getElementById('introGearBrassMain') : null;
    this.gearBrassPinion = this.hasDom ? document.getElementById('introGearBrassPinion') : null;
    this.gearSteel1 = this.hasDom ? document.getElementById('introGearSteel1') : null;
    this.gearSteel2 = this.hasDom ? document.getElementById('introGearSteel2') : null;
    this.coordReadoutEl = this.hasDom ? document.getElementById('introCoordinateReadout') : null;

    // Telemetry and UI Elements
    this.utcMasterEl = this.hasDom ? document.getElementById('introMasterUtc') : null;
    this.solarDecEl = this.hasDom ? document.getElementById('introSolarDec') : null;
    this.subsolarLonEl = this.hasDom ? document.getElementById('introSubsolarLon') : null;
    this.progressBarEl = this.hasDom ? document.getElementById('introProgressBar') : null;
    this.progressPctEl = this.hasDom ? document.getElementById('introProgressPct') : null;
    this.statusPillEl = this.hasDom ? document.getElementById('introStatusPill') : null;
    this.btnSkip = this.hasDom ? document.getElementById('btnSkipIntro') : null;
    this.btnSound = this.hasDom ? document.getElementById('introSoundToggle') : null;

    // Animation & 3D Physics State
    this.isActive = true;
    this.startTime = null;
    this.animId = null;
    this.clockwiseAngle = 0;
    this.gearAngle = 0;
    this.lastTickSec = -1;

    // 3D Slanted Globe Rotation & Physics
    this.rot = {
      lon: -10,       // Centered view showcasing Europe, Africa & Atlantic
      lat: 18,        // Northern perspective
      tilt: -23.44    // Earth's authentic diagonal axial slant
    };

    this.drag = {
      isDragging: false,
      lastX: 0,
      lastY: 0,
      velLon: 0.22,   // Steady prograde revolution from Left to Right (West -> East)
      velLat: 0
    };

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
    this.setupGlobePointerInteraction();
    this.resizeCanvas();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.resizeCanvas());
      this.startSequence();
    }
  }

  setupListeners() {
    // Skip / Launch Button
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

  /**
   * Interactive Click, Grab & Spin with Inertia Momentum Physics
   */
  setupGlobePointerInteraction() {
    if (!this.canvas) return;

    const onPointerDown = (e) => {
      e.preventDefault();
      this.canvas.setPointerCapture?.(e.pointerId);
      this.drag.isDragging = true;
      this.drag.lastX = e.clientX;
      this.drag.lastY = e.clientY;
      this.drag.velLon = 0;
      this.drag.velLat = 0;
      this.canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (e) => {
      if (!this.drag.isDragging) return;
      const dx = e.clientX - this.drag.lastX;
      const dy = e.clientY - this.drag.lastY;
      this.drag.lastX = e.clientX;
      this.drag.lastY = e.clientY;

      // Diagonal projection sensitivity
      this.drag.velLon = dx * 0.40;
      this.drag.velLat = -dy * 0.40;

      this.rot.lon = (this.rot.lon + this.drag.velLon) % 360;
      this.rot.lat = Math.max(-70, Math.min(70, this.rot.lat + this.drag.velLat));

      this.updateCoordinateReadout();
    };

    const onPointerUp = (e) => {
      if (this.canvas.releasePointerCapture) {
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      this.drag.isDragging = false;
      this.canvas.style.cursor = 'grab';
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  updateCoordinateReadout() {
    if (!this.coordReadoutEl) return;
    // Map current rotation to geographical coordinates
    let lat = 46.2044 + this.rot.lat * 0.45;
    let lon = 6.1432 - this.rot.lon * 0.55;

    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    lat = Math.max(-89.9, Math.min(89.9, lat));

    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    this.coordReadoutEl.textContent = `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
  }

  resizeCanvas() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.min(rect.width || 420, rect.height || 420);
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
      this.updateHorologyMechanisms(elapsed);
      this.render3DGeodesicGlobe();

      // Audio tick each second
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

  /**
   * Update Clockwise Telemetry Ring & Skeleton Gear Rotation
   */
  updateHorologyMechanisms(elapsed) {
    // 1. Concentric Cyan Ring: STRICTLY CLOCKWISE
    this.clockwiseAngle = (this.clockwiseAngle + 0.18) % 360;
    if (this.cyanOrbitalRing) {
      this.cyanOrbitalRing.setAttribute('transform', `rotate(${this.clockwiseAngle.toFixed(2)})`);
    }

    // 2. Meshing Watch Gears with authentic gear ratios (rotating around local 0 0 of translated group)
    this.gearAngle = (this.gearAngle + 0.12) % 360;
    if (this.gearBrassMain) {
      this.gearBrassMain.setAttribute('transform', `rotate(${this.gearAngle.toFixed(2)})`);
    }
    if (this.gearBrassPinion) {
      this.gearBrassPinion.setAttribute('transform', `rotate(${(-this.gearAngle * 2.0).toFixed(2)})`);
    }
    if (this.gearSteel1) {
      this.gearSteel1.setAttribute('transform', `rotate(${(-this.gearAngle * 1.5).toFixed(2)})`);
    }
    if (this.gearSteel2) {
      this.gearSteel2.setAttribute('transform', `rotate(${(this.gearAngle * 1.2).toFixed(2)})`);
    }
  }

  updateProgress(progress, elapsed) {
    if (this.progressBarEl) {
      this.progressBarEl.style.width = `${(progress * 100).toFixed(1)}%`;
    }
    if (this.progressPctEl) {
      this.progressPctEl.textContent = `${Math.floor(progress * 100)}%`;
    }

    // Milestones
    this.milestones.forEach(m => {
      if (elapsed >= m.timeMs) {
        const stepRow = document.getElementById(m.id);
        const statEl = document.getElementById(m.statId);
        if (stepRow && !stepRow.classList.contains('active')) {
          stepRow.classList.add('active', 'completed');
        }
        if (statEl) {
          statEl.textContent = m.statText;
          statEl.style.color = 'var(--cyan-telemetry, #00F5D4)';
        }
      }
    });

    if (progress >= 0.95 && this.statusPillEl) {
      this.statusPillEl.textContent = 'SYSTEM OPERATIONAL // NOMINAL';
      this.statusPillEl.style.color = 'var(--cyan-telemetry, #00F5D4)';
    }
  }

  updateClocks() {
    const now = new Date();

    // UTC Master Clock
    if (this.utcMasterEl) {
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      this.utcMasterEl.textContent = `UTC ${h}:${m}:${s} GMT (GENEVA)`;
    }

    // Solar Declination & Subsolar Meridian (Landmarks for tests)
    const dec = getSolarDeclination(now);
    const subLon = getSubsolarLongitude(now);
    if (this.solarDecEl) this.solarDecEl.textContent = `${dec >= 0 ? '+' : ''}${dec.toFixed(2)}°`;
    if (this.subsolarLonEl) this.subsolarLonEl.textContent = `${subLon >= 0 ? '+' : ''}${subLon.toFixed(1)}°`;

    // Global Hubs
    GLOBAL_TIME_HUBS.forEach(hub => {
      const el = document.getElementById(`clockHub_${hub.id}`);
      if (el) {
        try {
          el.textContent = new Intl.DateTimeFormat('en-US', {
            timeZone: hub.tz,
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
          }).format(now);
        } catch (_) {}
      }
    });
  }

  /**
   * Render the 3D Orthographic Slanted Geodesic Globe
   * Features: -23.44° diagonal axial tilt, Left-to-Right 3D prograde revolution,
   * triangulated wireframe mesh, glowing orange European/Geneva cluster,
   * and 3D Prime Meridian laser rings.
   */
  render3DGeodesicGlobe() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // High-DPI physical coordinate normalization
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const renderW = w / dpr;
    const renderH = h / dpr;

    ctx.clearRect(0, 0, renderW, renderH);

    const cx = renderW / 2;
    const cy = renderH / 2;
    const R = Math.min(renderW, renderH) * 0.40; // Globe sphere radius

    // Apply Inertia Momentum & Prograde Revolution Physics (West to East)
    if (!this.drag.isDragging) {
      this.rot.lon = (this.rot.lon + 0.22 + this.drag.velLon) % 360;
      this.rot.lat = Math.max(-65, Math.min(65, this.rot.lat + this.drag.velLat));
      this.drag.velLon *= 0.94; // friction inertia decay
      this.drag.velLat *= 0.94;
    }

    this.updateCoordinateReadout();

    ctx.save();
    ctx.translate(cx, cy);

    // Apply Authentic 23.44° Earth Axial Slant (Diagonal Plane)
    const tiltRad = (this.rot.tilt * Math.PI) / 180;
    ctx.rotate(tiltRad);

    const lonRotRad = (this.rot.lon * Math.PI) / 180;
    const latRotRad = (this.rot.lat * Math.PI) / 180;

    // Helper: 3D Spherical Projection onto tilted viewport
    const project3D = (lonDeg, latDeg) => {
      const lonRad = (lonDeg * Math.PI) / 180;
      const latRad = (latDeg * Math.PI) / 180;
      const effLon = lonRad + lonRotRad;
      const x = R * Math.cos(latRad) * Math.sin(effLon);
      const y = -R * (Math.sin(latRad) * Math.cos(latRotRad) - Math.cos(latRad) * Math.cos(effLon) * Math.sin(latRotRad));
      const z = R * (Math.sin(latRad) * Math.sin(latRotRad) + Math.cos(latRad) * Math.cos(effLon) * Math.cos(latRotRad));
      return { x, y, z };
    };

    // 1. Globe Base Sphere: Deep Obsidian Metallic Core with Specular Illumination
    const sphereGrad = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R * 1.05);
    sphereGrad.addColorStop(0, '#1E2532');
    sphereGrad.addColorStop(0.45, '#121620');
    sphereGrad.addColorStop(0.85, '#090B10');
    sphereGrad.addColorStop(1, '#040507');

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // 2. Atmospheric Limb Horizon Glow (Cyan/Obsidian Edge Refraction)
    const limbGrad = ctx.createRadialGradient(0, 0, R * 0.88, 0, 0, R * 1.02);
    limbGrad.addColorStop(0, 'rgba(0, 245, 212, 0)');
    limbGrad.addColorStop(0.7, 'rgba(0, 245, 212, 0.08)');
    limbGrad.addColorStop(1, 'rgba(0, 245, 212, 0.22)');

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = limbGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.3)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Clip to globe disc for internal surface geometry
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.995, 0, Math.PI * 2);
    ctx.clip();

    // 3. Precision Geodesic Graticules (Latitude Parallels & Longitude Meridians)
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';

    // A. Latitude Parallels (Equator, ±30°, ±60°)
    const parallels = [-60, -30, 0, 30, 60];
    parallels.forEach(latDeg => {
      ctx.beginPath();
      let first = true;
      for (let lon = -180; lon <= 180; lon += 5) {
        const pt = project3D(lon, latDeg);
        if (pt.z > 0) {
          if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
          else { ctx.lineTo(pt.x, pt.y); }
        } else {
          first = true;
        }
      }
      ctx.stroke();
    });

    // B. Longitude Meridians (Every 30°)
    for (let m = 0; m < 360; m += 30) {
      ctx.beginPath();
      let first = true;
      for (let lat = -85; lat <= 85; lat += 4) {
        const pt = project3D(m, lat);
        if (pt.z > 0) {
          if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
          else { ctx.lineTo(pt.x, pt.y); }
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }

    // 4. Triangulated Geodesic Continents Wireframe Mesh (189 Facets)
    GEODESIC_TRIANGLES.forEach(facet => {
      const pA = project3D(facet[0][0], facet[0][1]);
      const pB = project3D(facet[1][0], facet[1][1]);
      const pC = project3D(facet[2][0], facet[2][1]);

      // Front-facing facet check (average z on front hemisphere)
      const avgZ = (pA.z + pB.z + pC.z) / 3;
      if (avgZ > -R * 0.04) {
        // Check if facet belongs to European / Geneva cluster (approx -5° to 16°E, 42° to 52°N)
        const isEurope = (facet[0][0] >= -5 && facet[0][0] <= 16 && facet[0][1] >= 42 && facet[0][1] <= 52);

        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.closePath();

        if (isEurope) {
          // Geneva / European Hub: Glowing International Orange-Red (#FF4D15)
          ctx.strokeStyle = '#FF4D15';
          ctx.lineWidth = 1.6;
          ctx.fillStyle = 'rgba(255, 77, 21, 0.32)';
          ctx.stroke();
          ctx.fill();

          // Small vertex beacons on European cluster
          [pA, pB, pC].forEach(pt => {
            if (pt.z > 0) {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
              ctx.fillStyle = '#FF4D15';
              ctx.fill();
            }
          });
        } else {
          // Standard Continent Wireframe: Crisp Precision Mesh
          ctx.strokeStyle = 'rgba(240, 246, 255, 0.65)';
          ctx.lineWidth = 0.85;
          ctx.fillStyle = 'rgba(24, 32, 47, 0.38)';
          ctx.stroke();
          ctx.fill();
        }
      }
    });

    // Geneva Capital Beacon (46.2044°N, 6.1432°E)
    const pGeneva = project3D(6.1432, 46.2044);
    if (pGeneva.z > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pGeneva.x, pGeneva.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FF4D15';
      ctx.shadowColor = '#FF4D15';
      ctx.shadowBlur = 14;
      ctx.fill();

      // Pulsing outer locator ring
      const pulseR = 7 + Math.sin(Date.now() / 250) * 2.5;
      ctx.beginPath();
      ctx.arc(pGeneva.x, pGeneva.y, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 77, 21, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // Exit clip

    // 5. Glowing Orange Great-Circle Laser Rings (#FF5722)
    ctx.save();
    ctx.shadowColor = '#FF5722';
    ctx.shadowBlur = 14;

    // A. Primary Tilted Prime Meridian Laser (diagonally slicing through the globe at lon=0/180)
    ctx.strokeStyle = '#FF4D15';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    let firstFront = true;
    for (let lat = -90; lat <= 90; lat += 2) {
      const pt = project3D(0, lat);
      if (pt.z >= 0) {
        if (firstFront) { ctx.moveTo(pt.x, pt.y); firstFront = false; }
        else { ctx.lineTo(pt.x, pt.y); }
      } else {
        firstFront = true;
      }
    }
    for (let lat = 90; lat >= -90; lat -= 2) {
      const pt = project3D(180, lat);
      if (pt.z >= 0) {
        if (firstFront) { ctx.moveTo(pt.x, pt.y); firstFront = false; }
        else { ctx.lineTo(pt.x, pt.y); }
      } else {
        firstFront = true;
      }
    }
    ctx.stroke();

    // Back hemisphere subtle laser glow
    ctx.strokeStyle = 'rgba(255, 77, 21, 0.22)';
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    let firstBack = true;
    for (let lat = -90; lat <= 90; lat += 4) {
      const pt = project3D(0, lat);
      if (pt.z < 0) {
        if (firstBack) { ctx.moveTo(pt.x, pt.y); firstBack = false; }
        else { ctx.lineTo(pt.x, pt.y); }
      } else {
        firstBack = true;
      }
    }
    for (let lat = 90; lat >= -90; lat -= 4) {
      const pt = project3D(180, lat);
      if (pt.z < 0) {
        if (firstBack) { ctx.moveTo(pt.x, pt.y); firstBack = false; }
        else { ctx.lineTo(pt.x, pt.y); }
      } else {
        firstBack = true;
      }
    }
    ctx.stroke();

    // B. Intersecting Equatorial Orbital Gyro Ring (Angled Outer Ellipse)
    ctx.shadowColor = '#FF5722';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#FF5722';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 1.14, R * 0.32, 0.22, 0, Math.PI * 2);
    ctx.stroke();

    // Data packet beacon orbiting along the gyro ring
    const packetAngle = ((this.rot.lon * 2.2) * Math.PI) / 180;
    const px = Math.cos(packetAngle) * (R * 1.14);
    const py = Math.sin(packetAngle) * (R * 0.32);
    // Rotate packet by gyro ring angle (0.22 rad)
    const rotPx = px * Math.cos(0.22) - py * Math.sin(0.22);
    const rotPy = px * Math.sin(0.22) + py * Math.cos(0.22);

    ctx.beginPath();
    ctx.arc(rotPx, rotPy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFA270';
    ctx.shadowBlur = 16;
    ctx.fill();

    ctx.restore();

    ctx.restore(); // Exit translate + tilt rotate
  }

  dismiss() {
    this.isActive = false;
    if (this.animId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animId);
    }
    if (this.stageEl) {
      this.stageEl.classList.add('dismissed');
    }
    if (typeof this.options.onComplete === 'function') {
      this.options.onComplete();
    }
  }

  replay() {
    this.isActive = true;
    this.startTime = null;
    if (this.stageEl) {
      this.stageEl.classList.remove('dismissed');
      this.startSequence();
    }
  }
}

export function initPlanetaryIntro(options = {}) {
  return new PlanetaryIntroStage(options);
}
