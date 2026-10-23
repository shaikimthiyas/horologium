import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorBoundary } from '../../src/utils/errorBoundary.js';
import { ClockFSM, ClockState } from '../../src/utils/clockFSM.js';

test('ErrorBoundary - Chronometer Exception & Safe Mode Engine', async (t) => {
  await t.test('records structured error with context and stack', () => {
    const boundary = new ErrorBoundary({ autoInstall: false });
    const fakeError = new TypeError('Simulation of hardware timer null pointer');
    
    const record = boundary.recordError(fakeError, { context: 'hardware_timer_sync', isFatal: false });
    assert.ok(record.id.startsWith('err_'));
    assert.equal(record.name, 'TypeError');
    assert.equal(record.message, 'Simulation of hardware timer null pointer');
    assert.equal(record.context, 'hardware_timer_sync');
    assert.equal(record.isFatal, false);
    assert.equal(boundary.getCapturedErrors().length, 1);
  });

  await t.test('filters benign browser extension and ResizeObserver noise', () => {
    const boundary = new ErrorBoundary({ autoInstall: false });
    
    const res1 = boundary.recordError(new Error('ResizeObserver loop completed with undelivered notifications.'));
    const res2 = boundary.recordError(new Error('chrome-extension://xyz/content.js network error'));
    
    assert.equal(res1, null);
    assert.equal(res2, null);
    assert.equal(boundary.getCapturedErrors().length, 0); // No noise added
  });

  await t.test('executes runGuarded cleanly and returns fallback on failure', () => {
    const boundary = new ErrorBoundary({ autoInstall: false });
    
    // Success path
    const successResult = boundary.runGuarded(() => 42, 0, 'test_success');
    assert.equal(successResult, 42);

    // Failing path
    const failResult = boundary.runGuarded(() => {
      throw new RangeError('Index out of range');
    }, 'FALLBACK_VALUE', 'test_failure');

    assert.equal(failResult, 'FALLBACK_VALUE');
    assert.equal(boundary.getCapturedErrors().length, 1);
    assert.equal(boundary.getCapturedErrors()[0].context, 'test_failure');
  });

  await t.test('integrates with ClockFSM to include active chronometer state in diagnostic report', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 0 });
    fsm.transition(ClockState.PROBING_NTP, 'PROBE_START');

    const boundary = new ErrorBoundary({ autoInstall: false, fsm });
    boundary.recordError(new Error('SNTP packet CRC checksum failure'), { isFatal: true });

    const report = boundary.generateDiagnosticReport();
    assert.ok(report.schema);
    assert.equal(report.fsmTelemetry.state, ClockState.PROBING_NTP);
    assert.equal(report.activeError.fsmState, ClockState.PROBING_NTP);
    assert.equal(report.recentErrorsCount, 1);
  });

  await t.test('clears errors when requested', () => {
    const boundary = new ErrorBoundary({ autoInstall: false });
    boundary.recordError(new Error('Transient network timeout'));
    assert.equal(boundary.getCapturedErrors().length, 1);

    boundary.clearErrors();
    assert.equal(boundary.getCapturedErrors().length, 0);
  });
});
