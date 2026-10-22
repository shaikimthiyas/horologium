/**
 * Unit Tests: Marzullo's Intersection Algorithm (Truechimer Consensus)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeMarzulloConsensus } from '../../server/services/marzullo.js';

describe("Marzullo's Intersection Algorithm & Truechimer Consensus", () => {
  test('should handle empty or null source lists gracefully', () => {
    const res = computeMarzulloConsensus([]);
    assert.equal(res.status, 'EMPTY_SET');
    assert.equal(res.consensusOffset, 0);
    assert.equal(res.sampleCount, 0);
  });

  test('should compute accurate midpoint for a single source', () => {
    const res = computeMarzulloConsensus([
      { server: 'time.cloudflare.com', skewMs: 14.5, roundTripMs: 10, dispersion: 1 }
    ]);
    assert.equal(res.status, 'SINGLE_SOURCE');
    assert.equal(res.consensusOffset, 14.5);
    assert.equal(res.confidenceHalfWidth, 6); // 10/2 + 1 = 6
    assert.equal(res.truechimers.length, 1);
    assert.equal(res.falsetickers.length, 0);
  });

  test('should calculate tight consensus interval across 4 overlapping truechimers', () => {
    const sources = [
      { server: 'time.cloudflare.com', skewMs: 10.0, roundTripMs: 8.0, dispersion: 1.0 }, // [5, 15]
      { server: 'time.google.com',     skewMs: 11.0, roundTripMs: 6.0, dispersion: 1.0 }, // [7, 15]
      { server: 'time.nist.gov',       skewMs: 12.0, roundTripMs: 10.0, dispersion: 1.0 }, // [6, 18]
      { server: 'pool.ntp.org',        skewMs: 9.5,  roundTripMs: 12.0, dispersion: 1.0 }  // [2.5, 16.5]
    ];

    const res = computeMarzulloConsensus(sources);

    assert.equal(res.status, 'HARMONIC_CONSENSUS');
    assert.equal(res.truechimers.length, 4);
    assert.equal(res.falsetickers.length, 0);
    // Consensus interval is [7, 15], midpoint = 11.0
    assert.equal(res.consensusOffset, 11.0);
    assert.equal(res.confidenceHalfWidth, 4.0);
  });

  test('should detect and reject rogue falseticker while preserving consensus', () => {
    const sources = [
      { server: 'time.cloudflare.com', skewMs: 10.0, roundTripMs: 8.0, dispersion: 1.0 },  // [5, 15]
      { server: 'time.google.com',     skewMs: 11.5, roundTripMs: 6.0, dispersion: 1.0 },  // [7.5, 15.5]
      { server: 'time.nist.gov',       skewMs: 12.0, roundTripMs: 10.0, dispersion: 1.0 }, // [6, 18]
      // Rogue rogue falseticker displaced by +50ms
      { server: 'bad-actor-clock.org', skewMs: 65.0, roundTripMs: 10.0, dispersion: 2.0 }  // [58, 72]
    ];

    const res = computeMarzulloConsensus(sources);

    assert.equal(res.status, 'FALSETICKER_REJECTED');
    assert.equal(res.truechimers.length, 3);
    assert.equal(res.falsetickers.length, 1);
    assert.equal(res.falsetickers[0].server, 'bad-actor-clock.org');
    // Consensus offset should remain anchored near ~11.5ms, completely immune to the outlier
    assert.ok(res.consensusOffset >= 10.0 && res.consensusOffset <= 13.0);
  });
});
