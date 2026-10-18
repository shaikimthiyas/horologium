/**
 * Horologium Web Audio Tactile Haptics Engine
 * Zero-dependency, purely synthesized mechanical watch clicks and lock tones.
 * Uses native Web Audio API (no external MP3/WAV downloads required).
 */

class AudioHaptics {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('horologium_audio_enabled') === 'true';
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('horologium_audio_enabled', this.enabled ? 'true' : 'false');
    if (this.enabled) {
      this.init();
      this.playMechanicalClick(1200, 0.04);
    }
    return this.enabled;
  }

  /**
   * Subtle mechanical escapement tick (high-frequency, critically damped impulse)
   */
  playTick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

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
    if (!this.ctx) return;

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
    if (!this.ctx) return;

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
}

export const haptics = new AudioHaptics();
