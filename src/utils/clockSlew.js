/**
 * Horologium Smooth Clock Slewing Controller (Linux adjtime() Emulation)
 * 
 * In distributed chronometry, instantaneous clock stepping can cause:
 * - Negative time deltas in physics/render loops
 * - Visual jitter in high-frequency vernier dials
 * - Inverted order of historical telemetry logs
 * 
 * This controller emulates UNIX adjtime(2):
 * - Small offsets (< stepThresholdMs) are SLEWED: clock frequency is slightly
 *   accelerated or decelerated smoothly until aligned.
 * - Large discontinuities (>= stepThresholdMs) are STEPPED immediately.
 * - Monotonicity is mathematically guaranteed: t(n+1) >= t(n).
 */

export class ClockSlewController {
  constructor(options = {}) {
    const {
      stepThresholdMs = 500,        // Offsets >= 500ms trigger an immediate step
      slewRateMsPerSec = 50,        // Maximum adjustment rate: 50ms slew per real second
      enforceMonotonic = true
    } = options;

    this.stepThresholdMs = stepThresholdMs;
    this.slewRateMsPerSec = slewRateMsPerSec;
    this.enforceMonotonic = enforceMonotonic;

    this.currentOffsetMs = 0;
    this.targetOffsetMs = 0;
    this.lastUpdateMonotonic = this.getMonotonicNow();
    this.lastReturnedEpochMs = 0;
    this.isInitialized = false;

    this.stats = {
      totalSteps: 0,
      totalSlewEvents: 0,
      lastAdjustmentType: 'NONE'
    };
  }

  getMonotonicNow() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  /**
   * Set target offset from SNTP probe consensus
   */
  setTargetOffset(newTargetOffsetMs) {
    this.updateSlew();
    this.targetOffsetMs = Number(newTargetOffsetMs);

    if (!this.isInitialized) {
      // First sync seeds the clock offset immediately
      this.currentOffsetMs = this.targetOffsetMs;
      this.isInitialized = true;
      this.stats.totalSteps++;
      this.stats.lastAdjustmentType = 'INITIAL_STEP';
      return;
    }

    const delta = Math.abs(this.targetOffsetMs - this.currentOffsetMs);

    if (delta >= this.stepThresholdMs) {
      // Discontinuity exceeds slew threshold -> Step clock
      this.currentOffsetMs = this.targetOffsetMs;
      this.stats.totalSteps++;
      this.stats.lastAdjustmentType = 'DISCONTINUOUS_STEP';
    } else {
      // Small delta -> Slew clock smoothly
      this.stats.totalSlewEvents++;
      this.stats.lastAdjustmentType = 'SLEWING';
    }
  }

  /**
   * Update internal slew progress based on elapsed monotonic time
   */
  updateSlew() {
    const nowMono = this.getMonotonicNow();
    const elapsedSec = Math.max(0, (nowMono - this.lastUpdateMonotonic) / 1000);
    this.lastUpdateMonotonic = nowMono;

    if (this.currentOffsetMs === this.targetOffsetMs || elapsedSec <= 0) {
      return;
    }

    const maxDelta = this.slewRateMsPerSec * elapsedSec;
    const remaining = this.targetOffsetMs - this.currentOffsetMs;

    if (Math.abs(remaining) <= maxDelta) {
      this.currentOffsetMs = this.targetOffsetMs;
    } else {
      const stepDirection = remaining > 0 ? 1 : -1;
      this.currentOffsetMs += stepDirection * maxDelta;
    }
  }

  /**
   * Returns current high-precision adjusted epoch timestamp in milliseconds
   */
  getAdjustedEpochMs() {
    this.updateSlew();
    const systemNow = Date.now();
    let calculated = systemNow + this.currentOffsetMs;

    if (this.enforceMonotonic) {
      if (calculated < this.lastReturnedEpochMs) {
        // Monotonic guard: ensure clock never flows backwards
        calculated = this.lastReturnedEpochMs;
      }
      this.lastReturnedEpochMs = calculated;
    }

    return calculated;
  }

  /**
   * Returns Date object synchronized and slewed to atomic reference
   */
  now() {
    return new Date(this.getAdjustedEpochMs());
  }

  getTelemetry() {
    this.updateSlew();
    const remainingSlewMs = this.targetOffsetMs - this.currentOffsetMs;
    return {
      currentOffsetMs: Number(this.currentOffsetMs.toFixed(3)),
      targetOffsetMs: Number(this.targetOffsetMs.toFixed(3)),
      remainingSlewMs: Number(remainingSlewMs.toFixed(3)),
      isSlewing: Math.abs(remainingSlewMs) > 0.05,
      mode: this.stats.lastAdjustmentType,
      stats: { ...this.stats }
    };
  }
}

export const clockSlewController = new ClockSlewController();
