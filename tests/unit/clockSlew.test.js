/**
 * Unit Tests: Smooth Clock Slewing Controller (Linux adjtime emulation)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ClockSlewController } from '../../src/utils/clockSlew.js';

describe('Clock Slewing Controller & Monotonicity Engine', () => {
  test('should initialize offset on first probe', () => {
    const controller = new ClockSlewController();
    assert.equal(controller.isInitialized, false);

    controller.setTargetOffset(25.0);
    assert.equal(controller.isInitialized, true);
    assert.equal(controller.currentOffsetMs, 25.0);
    assert.equal(controller.stats.lastAdjustmentType, 'INITIAL_STEP');
  });

  test('should enter slewing mode for small offset changes (< 500ms)', () => {
    const controller = new ClockSlewController({ stepThresholdMs: 500, slewRateMsPerSec: 100 });
    controller.setTargetOffset(20.0); // Initial

    // Apply +30ms drift delta (total 50ms)
    controller.setTargetOffset(50.0);

    assert.equal(controller.targetOffsetMs, 50.0);
    // Should NOT jump to 50ms immediately
    assert.equal(controller.currentOffsetMs, 20.0);
    assert.equal(controller.stats.lastAdjustmentType, 'SLEWING');
  });

  test('should trigger step adjustment when discontinuity exceeds threshold', () => {
    const controller = new ClockSlewController({ stepThresholdMs: 500 });
    controller.setTargetOffset(10.0);

    // Apply +2500ms leap discontinuity
    controller.setTargetOffset(2510.0);

    assert.equal(controller.currentOffsetMs, 2510.0);
    assert.equal(controller.stats.lastAdjustmentType, 'DISCONTINUOUS_STEP');
    assert.equal(controller.stats.totalSteps, 2);
  });

  test('should strictly guarantee non-decreasing monotonic time', () => {
    const controller = new ClockSlewController({ enforceMonotonic: true });
    controller.setTargetOffset(100.0);

    let lastTime = controller.getAdjustedEpochMs();

    // Sudden negative step offset simulated
    controller.setTargetOffset(-200.0);

    for (let i = 0; i < 50; i++) {
      const currentTime = controller.getAdjustedEpochMs();
      assert.ok(
        currentTime >= lastTime,
        `Monotonicity violation: currentTime (${currentTime}) < lastTime (${lastTime})`
      );
      lastTime = currentTime;
    }
  });

  test('should provide comprehensive telemetry status', () => {
    const controller = new ClockSlewController();
    controller.setTargetOffset(15.0);

    const telemetry = controller.getTelemetry();
    assert.equal(telemetry.currentOffsetMs, 15.0);
    assert.equal(telemetry.targetOffsetMs, 15.0);
    assert.equal(telemetry.isSlewing, false);
    assert.ok(typeof telemetry.stats.totalSteps === 'number');
  });
});
