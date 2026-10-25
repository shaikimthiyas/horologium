/**
 * Unit Test Suite: Sprint J - Dynamic Chrono-Slider (DST & Solar Terminator Time Travel)
 * Horologium Calibre-01
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseShortOffsetToMinutes,
  formatOffsetMinutes,
  getTimeZoneOffsetMinutes,
  getDstStatus,
  getTimeZoneDeltaMinutes
} from '../../src/utils/dstEngine.js';
import {
  getSolarDeclination,
  getSubsolarLongitude,
  generateTerminatorPath
} from '../../src/utils/timeMath.js';
import { ChronoSliderController } from '../../src/components/clock/chronoSlider.js';

describe('Sprint J: Daylight Saving Time (DST) & Chronometry Engine', () => {
  it('should parse RFC and Intl shortOffset strings into signed integer minutes', () => {
    assert.equal(parseShortOffsetToMinutes('GMT'), 0);
    assert.equal(parseShortOffsetToMinutes('UTC'), 0);
    assert.equal(parseShortOffsetToMinutes('UTC±00:00'), 0);
    assert.equal(parseShortOffsetToMinutes('GMT+5:30'), 330);
    assert.equal(parseShortOffsetToMinutes('UTC+05:30'), 330);
    assert.equal(parseShortOffsetToMinutes('GMT-4'), -240);
    assert.equal(parseShortOffsetToMinutes('UTC-04:00'), -240);
    assert.equal(parseShortOffsetToMinutes('GMT+1'), 60);
    assert.equal(parseShortOffsetToMinutes('GMT-10'), -600);
  });

  it('should format signed minutes into canonical RFC 9557 / ISO offset strings', () => {
    assert.equal(formatOffsetMinutes(0), 'UTC±00:00');
    assert.equal(formatOffsetMinutes(330), 'UTC+05:30');
    assert.equal(formatOffsetMinutes(-240), 'UTC-04:00');
    assert.equal(formatOffsetMinutes(60), 'UTC+01:00');
    assert.equal(formatOffsetMinutes(-600), 'UTC-10:00');
  });

  it('should detect Northern Hemisphere DST active in Summer (EDT) and inactive in Winter (EST)', () => {
    const nySummer = new Date('2026-07-15T12:00:00Z');
    const nyWinter = new Date('2026-01-15T12:00:00Z');

    const summerStatus = getDstStatus('America/New_York', nySummer);
    assert.equal(summerStatus.hasDst, true, 'New York must observe DST');
    assert.equal(summerStatus.isDst, true, 'July must be in Daylight Saving Time (EDT)');
    assert.equal(summerStatus.currentOffsetMinutes, -240, 'EDT offset must be UTC-4');
    assert.equal(summerStatus.dstShiftMinutes, 60, 'DST shift must be +60m');
    assert.equal(summerStatus.badgeClass, 'badge-dst-active');

    const winterStatus = getDstStatus('America/New_York', nyWinter);
    assert.equal(winterStatus.hasDst, true, 'New York must observe DST');
    assert.equal(winterStatus.isDst, false, 'January must be in Standard Time (EST)');
    assert.equal(winterStatus.currentOffsetMinutes, -300, 'EST offset must be UTC-5');
    assert.equal(winterStatus.dstShiftMinutes, 0, 'No DST shift in winter');
    assert.equal(winterStatus.badgeClass, 'badge-dst-std');
  });

  it('should detect Southern Hemisphere DST active in January (AEDT) and inactive in July (AEST)', () => {
    const sydneySummer = new Date('2026-01-15T12:00:00Z'); // Southern Summer
    const sydneyWinter = new Date('2026-07-15T12:00:00Z'); // Southern Winter

    const summerStatus = getDstStatus('Australia/Sydney', sydneySummer);
    assert.equal(summerStatus.hasDst, true, 'Sydney must observe seasonal DST');
    assert.equal(summerStatus.isDst, true, 'January must be in Southern DST (AEDT UTC+11)');
    assert.equal(summerStatus.currentOffsetMinutes, 660, 'AEDT must be UTC+11');

    const winterStatus = getDstStatus('Australia/Sydney', sydneyWinter);
    assert.equal(winterStatus.hasDst, true);
    assert.equal(winterStatus.isDst, false, 'July must be in Standard Time (AEST UTC+10)');
    assert.equal(winterStatus.currentOffsetMinutes, 600, 'AEST must be UTC+10');
  });

  it('should identify non-DST territories (Asia/Kolkata, Asia/Tokyo) with constant standard offset', () => {
    const summer = new Date('2026-07-15T12:00:00Z');
    const winter = new Date('2026-01-15T12:00:00Z');

    const kolkataStatus = getDstStatus('Asia/Kolkata', summer);
    assert.equal(kolkataStatus.hasDst, false, 'Kolkata does not observe DST');
    assert.equal(kolkataStatus.isDst, false);
    assert.equal(kolkataStatus.currentOffsetMinutes, 330, 'IST is UTC+05:30 year-round');
    assert.equal(kolkataStatus.badgeClass, 'badge-dst-none');

    const tokyoStatus = getDstStatus('Asia/Tokyo', winter);
    assert.equal(tokyoStatus.hasDst, false, 'Tokyo does not observe DST');
    assert.equal(tokyoStatus.currentOffsetMinutes, 540, 'JST is UTC+09:00 year-round');
  });

  it('should calculate accurate timezone delta between two territories across seasons', () => {
    const summer = new Date('2026-07-15T12:00:00Z');
    // London in July is BST (UTC+1 = +60m), New York is EDT (UTC-4 = -240m)
    // Delta London -> NY = -240 - 60 = -300 minutes (-5 hours)
    const delta = getTimeZoneDeltaMinutes('Europe/London', 'America/New_York', summer);
    assert.equal(delta, -300, 'London to New York delta in July must be -5h (-300m)');
  });
});

describe('Sprint J: Solar Terminator Time Travel Mathematics', () => {
  it('should shift subsolar longitude smoothly as time is scrubbed', () => {
    const t0 = new Date('2026-10-25T12:00:00Z'); // Noon UTC -> Sun at Prime Meridian 0°
    const lon0 = getSubsolarLongitude(t0);
    assert.equal(Math.abs(Math.round(lon0)), 0);

    // Scrub forward 3 hours (+180 minutes) -> 15:00:00 UTC -> Sun moves West to -45°
    const tPlus3 = new Date(t0.getTime() + 3 * 3600 * 1000);
    const lonPlus3 = getSubsolarLongitude(tPlus3);
    assert.equal(Math.round(lonPlus3), -45);

    // Scrub backward 4 hours (-240 minutes) -> 08:00:00 UTC -> Sun was East at +60°
    const tMinus4 = new Date(t0.getTime() - 4 * 3600 * 1000);
    const lonMinus4 = getSubsolarLongitude(tMinus4);
    assert.equal(Math.round(lonMinus4), 60);
  });

  it('should re-generate closed SVG terminator polygon coordinates at arbitrary simulation times', () => {
    const noon = new Date('2026-06-21T12:00:00Z'); // Summer solstice noon
    const termNoon = generateTerminatorPath(noon);
    assert.ok(termNoon.pathD.startsWith('M '), 'Must produce valid SVG path command');
    assert.ok(termNoon.pathD.endsWith('Z'), 'Terminator path must be closed polygon');
    assert.ok(termNoon.declinationDeg > 20, 'Summer solstice declination ~23.44°');

    const midnight = new Date('2026-06-21T00:00:00Z'); // Summer solstice midnight
    const termMidnight = generateTerminatorPath(midnight);
    assert.notEqual(termNoon.subsolarLon, termMidnight.subsolarLon, 'Subsolar longitude must rotate by 180°');
    assert.equal(Math.abs(termNoon.subsolarLon - termMidnight.subsolarLon), 180);
  });
});

describe('Sprint J: ChronoSliderController State & Playback Simulation Engine', () => {
  it('should initialize with live atomic synchronization state', () => {
    const slider = new ChronoSliderController({ autoInit: false });
    assert.equal(slider.isLive, true);
    assert.equal(slider.offsetMinutes, 0);
    assert.equal(slider.isPlaying, false);
    assert.equal(slider.playbackSpeed, 60);

    const activeDate = slider.getActiveDate();
    const now = new Date();
    assert.ok(Math.abs(activeDate.getTime() - now.getTime()) < 1000, 'Active date must match atomic time');
  });

  it('should advance offset on stepOffset and correctly transition out of live mode', () => {
    let emittedShift = null;
    const slider = new ChronoSliderController({
      autoInit: false,
      onTimeShift: (data) => { emittedShift = data; }
    });

    // Step forward 60 minutes
    slider.stepOffset(60);
    assert.equal(slider.offsetMinutes, 60);
    assert.equal(slider.isLive, false);
    assert.ok(emittedShift, 'Must emit onTimeShift callback');
    assert.equal(emittedShift.offsetMinutes, 60);
    assert.equal(emittedShift.isLive, false);

    // Step backward 15 minutes
    slider.stepOffset(-15);
    assert.equal(slider.offsetMinutes, 45);

    // Active date must be exactly 45 minutes in the future
    const activeDate = slider.getActiveDate();
    const expected = new Date(Date.now() + 45 * 60 * 1000);
    assert.ok(Math.abs(activeDate.getTime() - expected.getTime()) < 2000);
  });

  it('should recover instantaneous live atomic time on snapToLive()', () => {
    let liveSnapped = false;
    const slider = new ChronoSliderController({
      autoInit: false,
      onLiveSnap: () => { liveSnapped = true; }
    });

    slider.stepOffset(120);
    assert.equal(slider.isLive, false);

    slider.snapToLive();
    assert.equal(slider.isLive, true);
    assert.equal(slider.offsetMinutes, 0);
    assert.equal(slider.isPlaying, false);
    assert.equal(liveSnapped, true, 'Must invoke onLiveSnap handler');
  });

  it('should cycle simulation playback speeds correctly (1x -> 60x -> 3600x -> 1x)', () => {
    const slider = new ChronoSliderController({ autoInit: false });
    assert.equal(slider.playbackSpeed, 60);

    slider.toggleSpeed();
    assert.equal(slider.playbackSpeed, 3600);

    slider.toggleSpeed();
    assert.equal(slider.playbackSpeed, 1);

    slider.toggleSpeed();
    assert.equal(slider.playbackSpeed, 60);
  });

  it('should toggle simulation play and pause states', () => {
    const slider = new ChronoSliderController({ autoInit: false });
    assert.equal(slider.isPlaying, false);

    slider.play();
    assert.equal(slider.isPlaying, true);
    assert.equal(slider.isLive, false);

    slider.pause();
    assert.equal(slider.isPlaying, false);
  });
});
