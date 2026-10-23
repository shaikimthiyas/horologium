/**
 * Horologium Deterministic Clock Finite State Machine (FSM)
 * 
 * Formal state transition engine governing client chronometer synchronization.
 * Eliminates ad-hoc boolean flags with deterministic states, transition guards,
 * timeout fallbacks, and telemetry metadata.
 * 
 * State Diagram:
 *   [INITIALIZING]
 *         │
 *         ▼
 *   [PROBING_NTP] ◄───────────────┐
 *     │         │                 │
 *     │         ▼                 │
 *     │     [DEGRADED] ───────────┤
 *     │         ▲                 │
 *     ▼         │                 │
 *   [LOCKED] ───┘                 │
 *     │                           │
 *     ▼                           │
 *   [OFFLINE] ────────────────────┘
 */

export const ClockState = Object.freeze({
  INITIALIZING: 'INITIALIZING',
  PROBING_NTP: 'PROBING_NTP',
  LOCKED: 'LOCKED',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE'
});

export const ClockEvent = Object.freeze({
  BOOT: 'BOOT',
  PROBE_START: 'PROBE_START',
  SYNC_SUCCESS: 'SYNC_SUCCESS',
  SYNC_FAIL: 'SYNC_FAIL',
  JITTER_SPIKE: 'JITTER_SPIKE',
  SLEW_COMPLETE: 'SLEW_COMPLETE',
  CONNECTION_LOST: 'CONNECTION_LOST',
  CONNECTION_RESTORED: 'CONNECTION_RESTORED',
  FORCE_RECALIBRATE: 'FORCE_RECALIBRATE'
});

export class ClockFSM {
  constructor(options = {}) {
    this.initialState = options.initialState || ClockState.INITIALIZING;
    this.currentState = this.initialState;
    this.previousState = null;
    this.stateEnterTimestamp = Date.now();
    this.historyLimit = options.historyLimit || 50;
    this.history = [];
    this.subscribers = new Set();
    this.probeTimeoutMs = options.probeTimeoutMs || 10000;
    this.probeTimer = null;
    this.transitionCounts = {
      [ClockState.INITIALIZING]: 0,
      [ClockState.PROBING_NTP]: 0,
      [ClockState.LOCKED]: 0,
      [ClockState.DEGRADED]: 0,
      [ClockState.OFFLINE]: 0
    };

    // Transition matrix defining valid origin -> target transitions
    this.validTransitions = {
      [ClockState.INITIALIZING]: new Set([ClockState.PROBING_NTP, ClockState.OFFLINE]),
      [ClockState.PROBING_NTP]: new Set([ClockState.LOCKED, ClockState.DEGRADED, ClockState.OFFLINE]),
      [ClockState.LOCKED]: new Set([ClockState.PROBING_NTP, ClockState.DEGRADED, ClockState.OFFLINE]),
      [ClockState.DEGRADED]: new Set([ClockState.PROBING_NTP, ClockState.LOCKED, ClockState.OFFLINE]),
      [ClockState.OFFLINE]: new Set([ClockState.PROBING_NTP, ClockState.INITIALIZING])
    };

    this._recordHistory(null, this.currentState, 'INITIAL_BOOT', {});
  }

  /**
   * Current active state name
   */
  get state() {
    return this.currentState;
  }

  /**
   * Duration in milliseconds spent in current state
   */
  get timeInCurrentStateMs() {
    return Date.now() - this.stateEnterTimestamp;
  }

  /**
   * Transition to a target state with context data
   */
  transition(targetState, reason = 'UNSPECIFIED', metadata = {}) {
    if (!ClockState[targetState]) {
      throw new Error(`[ClockFSM] Invalid target state: "${targetState}"`);
    }

    const allowedTargets = this.validTransitions[this.currentState];
    if (!allowedTargets || !allowedTargets.has(targetState)) {
      const errorMsg = `[ClockFSM] Illegal transition from ${this.currentState} -> ${targetState} (Reason: ${reason})`;
      this._notifyError(errorMsg, { from: this.currentState, to: targetState, reason, metadata });
      return false;
    }

    // Clear any active probe timeout
    this._clearProbeTimeout();

    const fromState = this.currentState;
    this.previousState = fromState;
    this.currentState = targetState;
    this.stateEnterTimestamp = Date.now();
    this.transitionCounts[targetState] = (this.transitionCounts[targetState] || 0) + 1;

    // Start probe timeout if entering PROBING_NTP
    if (targetState === ClockState.PROBING_NTP) {
      this._startProbeTimeout();
    }

    this._recordHistory(fromState, targetState, reason, metadata);
    this._notifySubscribers(fromState, targetState, reason, metadata);

    return true;
  }

  /**
   * Process a discrete semantic event with payload
   */
  dispatch(event, payload = {}) {
    switch (event) {
      case ClockEvent.BOOT:
        return this.transition(ClockState.PROBING_NTP, 'SYSTEM_BOOT', payload);

      case ClockEvent.PROBE_START:
      case ClockEvent.FORCE_RECALIBRATE:
        return this.transition(ClockState.PROBING_NTP, 'RECALIBRATE_REQUESTED', payload);

      case ClockEvent.SYNC_SUCCESS: {
        const offset = Math.abs(Number(payload.offsetMs || payload.offset || 0));
        const maxTightTolerance = payload.toleranceMs || 150;
        // If offset is high, go to DEGRADED while slewing; otherwise LOCKED
        const target = (offset > maxTightTolerance) ? ClockState.DEGRADED : ClockState.LOCKED;
        return this.transition(target, 'SNTP_CONSENSUS_REACHED', payload);
      }

      case ClockEvent.SYNC_FAIL:
        return this.transition(
          this.previousState === ClockState.LOCKED ? ClockState.DEGRADED : ClockState.OFFLINE,
          'SNTP_PROBE_EXHAUSTED',
          payload
        );

      case ClockEvent.JITTER_SPIKE:
        return this.transition(ClockState.DEGRADED, 'JITTER_EXCEEDED_THRESHOLD', payload);

      case ClockEvent.SLEW_COMPLETE:
        return this.transition(ClockState.LOCKED, 'CLOCK_SLEW_SETTLED', payload);

      case ClockEvent.CONNECTION_LOST:
        return this.transition(ClockState.OFFLINE, 'NETWORK_DISCONNECTED', payload);

      case ClockEvent.CONNECTION_RESTORED:
        return this.transition(ClockState.PROBING_NTP, 'NETWORK_RECONNECTED', payload);

      default:
        console.warn(`[ClockFSM] Unhandled event: ${event}`);
        return false;
    }
  }

  /**
   * Semantic alias for dispatch
   */
  handleEvent(event, payload = {}) {
    return this.dispatch(event, payload);
  }

  /**
   * Temperature-Compensated Crystal Oscillator (TCXO) Drift Calculation
   * Simulates microsecond-level oscillator drift during offline marine / flight operations.
   * Based on standard parabolic quartz resonance curve: Δf/f = -0.034 ppm/°C² * (T - T0)²
   */
  getOfflineDriftMetrics(ambientTempC = 25.0) {
    if (this.currentState !== ClockState.OFFLINE) {
      return {
        isOffline: false,
        status: 'SYNCHRONIZED_NTP',
        accumulatedDriftMs: 0.0,
        driftRatePpm: 0.0
      };
    }

    const elapsedSeconds = this.timeInCurrentStateMs / 1000;
    const referenceTempC = 25.0;
    const tempDelta = ambientTempC - referenceTempC;
    const thermalDriftPpm = -0.034 * (tempDelta * tempDelta);
    const nominalDriftPpm = 0.035; // calibrated TCXO stability factor
    const totalDriftPpm = nominalDriftPpm + thermalDriftPpm;
    
    // Accumulated drift in milliseconds: (totalDriftPpm * elapsed_seconds) / 1000
    const accumulatedDriftMs = (totalDriftPpm * elapsedSeconds) / 1000;

    return {
      isOffline: true,
      status: 'SOVEREIGN_TCXO_DRIFT_ACTIVE',
      elapsedOfflineSeconds: Math.floor(elapsedSeconds),
      nominalDriftPpm,
      totalDriftPpm,
      accumulatedDriftMs: Number(accumulatedDriftMs.toFixed(6))
    };
  }

  /**
   * Subscribe to state transition events
   * @param {Function} listener (fromState, toState, reason, metadata) => void
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('[ClockFSM] Listener must be a function');
    }
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /**
   * Read telemetry summary
   */
  getTelemetry() {
    return {
      state: this.currentState,
      previousState: this.previousState,
      timeInCurrentStateMs: this.timeInCurrentStateMs,
      stateEnterTimestamp: this.stateEnterTimestamp,
      transitionCounts: { ...this.transitionCounts },
      historyDepth: this.history.length,
      offlineDrift: this.getOfflineDriftMetrics()
    };
  }

  /**
   * Reset FSM back to INITIALIZING
   */
  reset() {
    this._clearProbeTimeout();
    this.previousState = this.currentState;
    this.currentState = ClockState.INITIALIZING;
    this.stateEnterTimestamp = Date.now();
    this._recordHistory(this.previousState, this.currentState, 'FSM_RESET', {});
    this._notifySubscribers(this.previousState, this.currentState, 'FSM_RESET', {});
  }

  // --- Internal Helpers ---

  _startProbeTimeout() {
    if (this.probeTimeoutMs <= 0) return;
    this.probeTimer = setTimeout(() => {
      if (this.currentState === ClockState.PROBING_NTP) {
        this.transition(
          this.previousState === ClockState.LOCKED ? ClockState.DEGRADED : ClockState.OFFLINE,
          'PROBE_TIMEOUT_EXPIRED',
          { timeoutMs: this.probeTimeoutMs }
        );
      }
    }, this.probeTimeoutMs);

    if (this.probeTimer && typeof this.probeTimer.unref === 'function') {
      this.probeTimer.unref();
    }
  }

  _clearProbeTimeout() {
    if (this.probeTimer) {
      clearTimeout(this.probeTimer);
      this.probeTimer = null;
    }
  }

  _recordHistory(from, to, reason, metadata) {
    this.history.unshift({
      timestamp: Date.now(),
      from,
      to,
      reason,
      metadata: { ...metadata }
    });

    if (this.history.length > this.historyLimit) {
      this.history.length = this.historyLimit;
    }
  }

  _notifySubscribers(from, to, reason, metadata) {
    for (const listener of this.subscribers) {
      try {
        listener(from, to, reason, metadata);
      } catch (err) {
        console.error('[ClockFSM] Error in subscriber listener:', err);
      }
    }
  }

  _notifyError(message, details) {
    console.warn(message, details);
    for (const listener of this.subscribers) {
      try {
        if (typeof listener.onError === 'function') {
          listener.onError(message, details);
        }
      } catch (e) {
        // Suppress listener error
      }
    }
  }
}

export const clockFSM = new ClockFSM();
