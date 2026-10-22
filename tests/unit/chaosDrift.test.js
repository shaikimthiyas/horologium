import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMarzulloConsensus } from '../../server/services/marzullo.js';
import { ClockSlewController } from '../../src/utils/clockSlew.js';

test('Chaos Engineering - Clock Drift & Slew Injection Harness (QA-07)', async (t) => {
  await t.test('Chaos Scenario 1: Malicious or faulty source injecting +10,000ms offset spike', () => {
    // 3 healthy truechimers with ~2-4ms offset, and 1 falseticker with +10,000ms offset
    const sources = [
      { id: 'nist-primary', server: 'time.nist.gov', offset: 2.1, delay: 18.0, dispersion: 1.0 },
      { id: 'cloudflare-time', server: 'time.cloudflare.com', offset: 3.4, delay: 12.0, dispersion: 0.8 },
      { id: 'google-pool', server: 'time.google.com', offset: 1.8, delay: 15.0, dispersion: 1.2 },
      { id: 'compromised-rogue', server: 'rogue.ntp.bad', offset: 10000.0, delay: 20.0, dispersion: 2.0 }
    ];

    const consensus = computeMarzulloConsensus(sources);

    // Assert consensus status is healthy and rogue is flagged
    assert.equal(consensus.status, 'FALSETICKER_REJECTED');
    assert.ok(consensus.falsetickers.some(f => f.id === 'compromised-rogue'));

    // Assert genuine sources are recognized as truechimers
    assert.ok(consensus.truechimers.some(t => t.id === 'nist-primary'));
    assert.ok(consensus.truechimers.some(t => t.id === 'cloudflare-time'));
    assert.ok(consensus.truechimers.some(t => t.id === 'google-pool'));

    // Consensus offset must stay near true UTC (< 10ms), NOT 10,000ms
    assert.ok(Math.abs(consensus.consensusOffset) < 10.0, `Consensus offset ${consensus.consensusOffset}ms was corrupted by rogue source`);
  });

  await t.test('Chaos Scenario 2: Slew Controller steps when jump exceeds max threshold (>=500ms)', () => {
    const controller = new ClockSlewController({
      stepThresholdMs: 500,
      slewRateMsPerSec: 50
    });

    // Initial sync
    controller.setTargetOffset(0);
    assert.equal(controller.stats.lastAdjustmentType, 'INITIAL_STEP');

    // Extreme chaos jump of -12,000ms
    controller.setTargetOffset(-12000);
    assert.equal(controller.stats.lastAdjustmentType, 'DISCONTINUOUS_STEP');
    assert.equal(controller.currentOffsetMs, -12000);
  });

  await t.test('Chaos Scenario 3: Sub-threshold offsets are slewed smoothly without discontinuity', () => {
    const controller = new ClockSlewController({
      stepThresholdMs: 500,
      slewRateMsPerSec: 50
    });

    // Initial sync
    controller.setTargetOffset(0);

    // Minor offset of +120ms
    controller.setTargetOffset(120);
    assert.equal(controller.stats.lastAdjustmentType, 'SLEWING');

    const telemetry = controller.getTelemetry();
    assert.equal(telemetry.targetOffsetMs, 120);
    assert.equal(telemetry.isSlewing, true);
  });

  await t.test('Chaos Scenario 4: Hardware clock monotonicity guard prevents time reversing', () => {
    const controller = new ClockSlewController({
      stepThresholdMs: 500,
      enforceMonotonic: true
    });

    controller.setTargetOffset(100);
    const t1 = controller.getAdjustedEpochMs();

    // Sudden negative offset step
    controller.setTargetOffset(-2000);
    const t2 = controller.getAdjustedEpochMs();

    // Monotonic guard ensures t2 >= t1 (never backwards)
    assert.ok(t2 >= t1, `Time reversed: t1=${t1}, t2=${t2}`);
  });
});
