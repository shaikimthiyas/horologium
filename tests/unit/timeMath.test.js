import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSolarDeclination, getSubsolarLongitude } from '../../server/controllers/timeController.js';

describe('Astronomical Solar & Meridian Calculations', () => {
  it('should compute solar declination within valid orbital bounds [-23.45, 23.45]', () => {
    // Summer solstice (~June 21)
    const summerSolstice = new Date('2026-06-21T12:00:00Z');
    const summerDec = getSolarDeclination(summerSolstice);
    assert.ok(summerDec > 20 && summerDec <= 23.5, 'Expected summer declination ~23.44');

    // Winter solstice (~Dec 21)
    const winterSolstice = new Date('2026-12-21T12:00:00Z');
    const winterDec = getSolarDeclination(winterSolstice);
    assert.ok(winterDec < -20 && winterDec >= -23.5, 'Expected winter declination ~-23.44');

    // Spring Equinox (~March 20)
    const equinox = new Date('2026-03-20T12:00:00Z');
    const equinoxDec = getSolarDeclination(equinox);
    assert.ok(Math.abs(equinoxDec) < 3.0, 'Expected equinox declination near 0');
  });

  it('should compute subsolar longitude accurately across meridian shifts', () => {
    // Exactly 12:00:00 UTC should be at Prime Meridian 0 deg
    const noonUtc = new Date('2026-10-17T12:00:00Z');
    const lonNoon = getSubsolarLongitude(noonUtc);
    assert.equal(Math.abs(lonNoon), 0, 'Expected 0 at noon UTC');

    // 00:00:00 UTC should be at antimeridian -180 / +180 deg
    const midnightUtc = new Date('2026-10-17T00:00:00Z');
    const lonMidnight = getSubsolarLongitude(midnightUtc);
    assert.equal(Math.abs(lonMidnight), 180, 'Expected 180 at midnight UTC');

    // 06:00:00 UTC should be at +90 deg (East)
    const sixAmUtc = new Date('2026-10-17T06:00:00Z');
    const lonSixAm = getSubsolarLongitude(sixAmUtc);
    assert.equal(lonSixAm, 90, 'Expected 90 at 06:00 UTC');
  });
});
