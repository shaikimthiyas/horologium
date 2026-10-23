/**
 * Horologium Web Audio Tactile Haptics Engine (Calibre-01)
 * Zero-dependency, purely synthesized mechanical watch clicks and lock tones.
 * Uses native Web Audio API (no external MP3/WAV downloads required).
 * 
 * Features:
 * - Browser Autoplay Policy Manager: Auto-resumes AudioContext on initial user gesture.
 * - Safe SSR/Node.js execution with mock storage fallbacks.
 * - Granular mute/unmute state management with persistent storage.
 * - State change event broadcasting for UI button synchronization.
 */

export class AudioHaptics {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'horologium_audio_enabled';
    this.ctx = null;
    this.listeners = new Set();
    this.unlocked = false;

    // Safe localStorage read
    this.enabled = this._readStorage();

    if (typeof window !== 'undefined') {
      this.setupAutoplayUnlock();
    }
  }

  /**
   * Setup one-time listeners to unlock suspended AudioContext per browser autoplay policy
   */
  setupAutoplayUnlock() {
    if (typeof document === 'undefined') return;

    const unlock = () => {
      this.unlocked = true;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this._notifyStateChange();
        }).catch(() => {});
      }
      ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
        document.removeEventListener(evt, unlock);
      });
    };

    ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, unlock, { once: true, passive: true });
    });
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && this.unlocked) {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Toggle audio enabled / disabled
   */
  toggle() {
    return this.setMuted(this.enabled); // If enabled, mute it; if muted, enable it
  }

  /**
   * Explicitly set mute state
   * @param {boolean} muted - true to mute, false to unmute
   */
  setMuted(muted) {
    this.enabled = !muted;
    this._writeStorage(this.enabled);

    if (this.enabled) {
      this.init();
      this.playMechanicalClick(1200, 0.04);
    }

    this._notifyStateChange();
    return this.enabled;
  }

  /**
   * Check if sound is currently muted
   */
  isMuted() {
    return !this.enabled;
  }

  /**
   * Check if sound is active
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Read full status object
   */
  getState() {
    return {
      enabled: this.enabled,
      muted: !this.enabled,
      contextState: this.ctx ? this.ctx.state : 'uninitialized',
      unlocked: this.unlocked
    };
  }

  /**
   * Subscribe to state change events
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    return () => {};
  }

  /**
   * Subtle mechanical escapement tick (high-frequency, critically damped impulse)
   */
  playTick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.015);

      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.016);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Tactile button click / toggle sound
   */
  playMechanicalClick(freq = 900, duration = 0.03) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(160, t + duration);

      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + duration + 0.005);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Calibration completion lock chord (two pure sine waves harmonizing)
   */
  playLockTone() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    try {
      const t = this.ctx.currentTime;
      [880, 1320].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch (e) {
      // Ignore
    }
  }

  // --- Internal Persistence & Notifications ---

  _readStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(this.storageKey) === 'true';
      }
    } catch (e) {
      // Suppress storage restriction
    }
    return false;
  }

  _writeStorage(value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, value ? 'true' : 'false');
      }
    } catch (e) {
      // Suppress storage restriction
    }
  }

  _notifyStateChange() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        // Suppress listener error
      }
    }
  }
}

export const haptics = new AudioHaptics();
