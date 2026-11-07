import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSolarDeclination,
  getSubsolarLongitude,
  getEquationOfTime,
  calculateSolarAltitude,
  classifySolarState,
  calculateLocalSolarTime,
  svgPointToGeographic,
  geographicToSvgPoint,
  generateTerminatorPath,
  generateTwilightBands,
  calculateGreatCircleArc,
  MAJOR_GLOBAL_CITIES
} from '../../src/utils/solarTerminator.js';

describe('Sprint N: Solar Terminator & Astronomical Cartography Engine', () => {
  it('should compute solar declination within valid orbital bounds [-23.45, 23.45]', () => {
    const summerSolstice = new Date('2026-06-21T12:00:00Z');
    const summerDec = getSolarDeclination(summerSolstice);
    assert.ok(summerDec > 20 && summerDec <= 23.5, `Expected summer declination ~23.44°, got ${summerDec}`);

    const winterSolstice = new Date('2026-12-21T12:00:00Z');
    const winterDec = getSolarDeclination(winterSolstice);
    assert.ok(winterDec < -20 && winterDec >= -23.5, `Expected winter declination ~-23.44°, got ${winterDec}`);

    const equinox = new Date('2026-03-20T12:00:00Z');
    const equinoxDec = getSolarDeclination(equinox);
    assert.ok(Math.abs(equinoxDec) < 3.0, `Expected equinox declination near 0°, got ${equinoxDec}`);
  });

  it('should calculate subsolar longitude accurately based on UTC time', () => {
    // 12:00:00 UTC -> Sun at Prime Meridian 0°
    const noon = new Date('2026-10-15T12:00:00Z');
    assert.equal(Math.abs(getSubsolarLongitude(noon)), 0);

    // 18:00:00 UTC -> Sun at -90° (West)
    const sixPm = new Date('2026-10-15T18:00:00Z');
    assert.equal(getSubsolarLongitude(sixPm), -90);

    // 06:00:00 UTC -> Sun at +90° (East)
    const sixAm = new Date('2026-10-15T06:00:00Z');
    assert.equal(getSubsolarLongitude(sixAm), 90);
  });

  it('should generate 3 concentric atmospheric twilight bands and golden-hour horizon line', () => {
    const now = new Date('2026-06-21T12:00:00Z');
    const bands = generateTwilightBands(now, 2000, 857, 120);

    // Assert Civil, Nautical, and Astronomical closed polygons
    assert.ok(bands.civilPolygonD.startsWith('M '), 'Civil twilight must be a valid SVG path');
    assert.ok(bands.civilPolygonD.endsWith('Z'), 'Civil twilight must be a closed polygon');

    assert.ok(bands.nauticalPolygonD.startsWith('M '), 'Nautical twilight must be a valid SVG path');
    assert.ok(bands.nauticalPolygonD.endsWith('Z'), 'Nautical twilight must be a closed polygon');

    assert.ok(bands.astronomicalPolygonD.startsWith('M '), 'Astronomical night must be a valid SVG path');
    assert.ok(bands.astronomicalPolygonD.endsWith('Z'), 'Astronomical night must be a closed polygon');

    // Assert Golden Hour open curve
    assert.ok(bands.goldenHourLineD.startsWith('M '), 'Golden hour must start with M command');
    assert.ok(!bands.goldenHourLineD.endsWith('Z'), 'Golden hour must be an open stroke curve, not closed');

    // Assert Subsolar Zenith Beacon & Antisolar Point
    assert.ok(bands.subsolarPoint.x > 0 && bands.subsolarPoint.x <= 2000);
    assert.ok(bands.subsolarPoint.y > 0 && bands.subsolarPoint.y <= 857);
    assert.ok(bands.antisolarPoint.x > 0 && bands.antisolarPoint.x <= 2000);
    assert.ok(bands.antisolarPoint.y > 0 && bands.antisolarPoint.y <= 857);

    // Assert Solar Analemma Figure-8 Curve
    assert.ok(bands.analemmaPathD.startsWith('M '), 'Analemma must start with M command');
    assert.ok(bands.analemmaPathD.endsWith('Z'), 'Analemma must form a closed figure-8 loop');
  });

  it('should calculate solar altitude angle and classify daylight/twilight/night correctly', () => {
    const noonJune = new Date('2026-06-21T12:00:00Z');

    // Tropic of Cancer at solar noon has solar altitude ~90° (directly overhead)
    const altZenith = calculateSolarAltitude(23.44, 0, noonJune);
    assert.ok(altZenith > 85, `Solar altitude at subsolar point should be ~90°, got ${altZenith}`);
    const stateZenith = classifySolarState(altZenith);
    assert.equal(stateZenith.state, 'daylight');

    // Civil twilight range: 0° to -6°
    const stateCivil = classifySolarState(-3.5);
    assert.equal(stateCivil.state, 'civil_twilight');

    // Nautical twilight range: -6° to -12°
    const stateNautical = classifySolarState(-9.2);
    assert.equal(stateNautical.state, 'nautical_twilight');

    // Astronomical night: < -12°
    const stateNight = classifySolarState(-45.0);
    assert.equal(stateNight.state, 'night');
  });

  it('should calculate Great-Circle Geodesic flight path and fiber latency between London and Tokyo', () => {
    const london = { lat: 51.5074, lon: -0.1278 };
    const tokyo = { lat: 35.6762, lon: 139.6503 };

    const arc = calculateGreatCircleArc(london, tokyo, 2000, 857, 50);

    // London <-> Tokyo surface distance is ~9,560 km
    assert.ok(arc.distanceKm >= 9500 && arc.distanceKm <= 9650, `Expected ~9,560 km, got ${arc.distanceKm}`);

    // Speed-of-light fiber latency is ~64-66 ms
    assert.ok(arc.fiberLatencyMs >= 60 && arc.fiberLatencyMs <= 70, `Expected ~64 ms fiber latency, got ${arc.fiberLatencyMs}`);

    assert.ok(arc.pathD.startsWith('M '), 'Geodesic arc must produce valid SVG path commands');
  });

  it('should maintain a curated dataset of global metropolitan cities', () => {
    assert.ok(MAJOR_GLOBAL_CITIES.length >= 70, 'Must have at least 70 major global cities');
    const london = MAJOR_GLOBAL_CITIES.find(c => c.id === 'LON');
    assert.ok(london, 'Must include London');
    assert.equal(london.name, 'London');

    const tokyo = MAJOR_GLOBAL_CITIES.find(c => c.id === 'TYO');
    assert.ok(tokyo, 'Must include Tokyo');

    const delhi = MAJOR_GLOBAL_CITIES.find(c => c.id === 'DEL');
    assert.ok(delhi, 'Must include New Delhi');

    // Verify all cities have valid coordinates
    MAJOR_GLOBAL_CITIES.forEach(c => {
      assert.ok(c.lat >= -90 && c.lat <= 90, `Invalid lat for ${c.name}`);
      assert.ok(c.lon >= -180 && c.lon <= 180, `Invalid lon for ${c.name}`);
    });
  });

  it('should convert bi-directionally between Geographic and SVG coordinates', () => {
    const geo = { lat: 0, lon: 0 };
    const svg = geographicToSvgPoint(geo.lat, geo.lon, 2000, 857);
    assert.equal(Math.round(svg.x), 1000);
    assert.equal(Math.round(svg.y), 429);

    const backGeo = svgPointToGeographic(svg.x, svg.y, 2000, 857);
    assert.equal(Math.round(backGeo.lat), 0);
    assert.equal(Math.round(backGeo.lon), 0);
  });
});
