import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Simple Network Time Protocol (SNTP) Mathematical Core', () => {
  function computeSntp(t1, t2, t3, t4) {
    const roundTripDelay = (t4 - t1) - (t3 - t2);
    const clockOffset = ((t2 - t1) + (t3 - t4)) / 2;
    return { roundTripDelay, clockOffset };
  }

  it('should compute zero offset and exact round-trip delay when clocks are synchronized', () => {
    const t1 = 1000;
    const t2 = 1020; // 20ms one-way network transit
    const t3 = 1025; // 5ms server processing
    const t4 = 1045; // 20ms return transit -> Total RTT = 45 - 5 = 40ms

    const res = computeSntp(t1, t2, t3, t4);
    assert.equal(res.roundTripDelay, 40);
    assert.equal(res.clockOffset, 0);
  });

  it('should detect positive clock offset when client clock is behind server', () => {
    // Client clock is 100ms behind server
    const t1 = 900;
    const t2 = 1020;
    const t3 = 1025;
    const t4 = 945;

    const res = computeSntp(t1, t2, t3, t4);
    assert.equal(res.roundTripDelay, 40);
    assert.equal(res.clockOffset, 100);
  });

  it('should detect negative clock offset when client clock is ahead of server', () => {
    // Client clock is 50ms ahead of server
    const t1 = 1050;
    const t2 = 1020;
    const t3 = 1025;
    const t4 = 1095;

    const res = computeSntp(t1, t2, t3, t4);
    assert.equal(res.roundTripDelay, 40);
    assert.equal(res.clockOffset, -50);
  });
});
