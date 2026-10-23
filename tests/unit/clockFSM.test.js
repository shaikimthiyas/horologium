import test from 'node:test';
import assert from 'node:assert/strict';
import { ClockFSM, ClockState, ClockEvent } from '../../src/utils/clockFSM.js';

test('ClockFSM - State Machine Verification', async (t) => {
  await t.test('initializes with default INITIALIZING state', () => {
    const fsm = new ClockFSM();
    assert.equal(fsm.state, ClockState.INITIALIZING);
    assert.equal(fsm.history.length, 1);
    assert.equal(fsm.history[0].to, ClockState.INITIALIZING);
  });

  await t.test('allows valid transition from INITIALIZING to PROBING_NTP', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 0 });
    const success = fsm.transition(ClockState.PROBING_NTP, 'BOOT_PROBE');
    assert.equal(success, true);
    assert.equal(fsm.state, ClockState.PROBING_NTP);
    assert.equal(fsm.previousState, ClockState.INITIALIZING);
  });

  await t.test('rejects illegal transition from INITIALIZING directly to LOCKED', () => {
    const fsm = new ClockFSM();
    const success = fsm.transition(ClockState.LOCKED, 'ILLEGAL_JUMP');
    assert.equal(success, false);
    assert.equal(fsm.state, ClockState.INITIALIZING); // Must remain unchanged
  });

  await t.test('dispatches SYNC_SUCCESS to LOCKED when offset is tight', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 0 });
    fsm.dispatch(ClockEvent.BOOT);
    assert.equal(fsm.state, ClockState.PROBING_NTP);

    const success = fsm.dispatch(ClockEvent.SYNC_SUCCESS, { offsetMs: 12, jitterMs: 1.5 });
    assert.equal(success, true);
    assert.equal(fsm.state, ClockState.LOCKED);
  });

  await t.test('dispatches SYNC_SUCCESS to DEGRADED when offset requires slewing (>150ms)', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 0 });
    fsm.dispatch(ClockEvent.BOOT);

    const success = fsm.dispatch(ClockEvent.SYNC_SUCCESS, { offsetMs: 320, toleranceMs: 150 });
    assert.equal(success, true);
    assert.equal(fsm.state, ClockState.DEGRADED);

    // After slew settles, transition to LOCKED
    fsm.dispatch(ClockEvent.SLEW_COMPLETE);
    assert.equal(fsm.state, ClockState.LOCKED);
  });

  await t.test('handles JITTER_SPIKE by degrading from LOCKED to DEGRADED', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 0 });
    fsm.dispatch(ClockEvent.BOOT);
    fsm.dispatch(ClockEvent.SYNC_SUCCESS, { offsetMs: 5 });
    assert.equal(fsm.state, ClockState.LOCKED);

    fsm.dispatch(ClockEvent.JITTER_SPIKE, { jitterMs: 45 });
    assert.equal(fsm.state, ClockState.DEGRADED);
  });

  await t.test('handles network disconnection and restoration cycle', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 0 });
    fsm.dispatch(ClockEvent.BOOT);
    fsm.dispatch(ClockEvent.SYNC_SUCCESS, { offsetMs: 2 });
    assert.equal(fsm.state, ClockState.LOCKED);

    // Disconnect
    fsm.dispatch(ClockEvent.CONNECTION_LOST);
    assert.equal(fsm.state, ClockState.OFFLINE);

    // Reconnect
    fsm.dispatch(ClockEvent.CONNECTION_RESTORED);
    assert.equal(fsm.state, ClockState.PROBING_NTP);
  });

  await t.test('notifies subscribers on transition and respects unsubscribe', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 0 });
    const transitions = [];

    const unsubscribe = fsm.subscribe((from, to, reason) => {
      transitions.push({ from, to, reason });
    });

    fsm.dispatch(ClockEvent.BOOT);
    fsm.dispatch(ClockEvent.SYNC_SUCCESS, { offsetMs: 1 });
    assert.equal(transitions.length, 2);
    assert.equal(transitions[0].to, ClockState.PROBING_NTP);
    assert.equal(transitions[1].to, ClockState.LOCKED);

    // Unsubscribe
    unsubscribe();
    fsm.dispatch(ClockEvent.JITTER_SPIKE);
    assert.equal(transitions.length, 2); // Unsubscribed, no new notifications
  });

  await t.test('provides comprehensive telemetry metrics', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 0 });
    fsm.dispatch(ClockEvent.BOOT);
    fsm.dispatch(ClockEvent.SYNC_SUCCESS, { offsetMs: 1 });

    const telemetry = fsm.getTelemetry();
    assert.equal(telemetry.state, ClockState.LOCKED);
    assert.equal(telemetry.previousState, ClockState.PROBING_NTP);
    assert.ok(telemetry.timeInCurrentStateMs >= 0);
    assert.equal(telemetry.transitionCounts[ClockState.LOCKED], 1);
    assert.equal(telemetry.transitionCounts[ClockState.PROBING_NTP], 1);
  });

  await t.test('times out stuck PROBING_NTP into OFFLINE after probe timeout', async () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 50 });
    fsm.dispatch(ClockEvent.BOOT);
    assert.equal(fsm.state, ClockState.PROBING_NTP);

    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(fsm.state, ClockState.OFFLINE);
  });
});
