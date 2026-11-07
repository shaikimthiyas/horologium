/**
 * Unit Test Suite: Planetary Intro Experience (Sprint M - Redesign)
 * Horologium Calibre-01
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PlanetaryIntroStage,
  CONTINENT_POLYGONS,
  GLOBAL_TIME_HUBS,
  initPlanetaryIntro
} from '../../src/components/intro/planetaryIntro.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

describe('Sprint M: Planetary Intro Stage & Enterprise Mission Deck', () => {
  it('should export PlanetaryIntroStage, initPlanetaryIntro, CONTINENT_POLYGONS, and GLOBAL_TIME_HUBS', () => {
    assert.equal(typeof PlanetaryIntroStage, 'function');
    assert.equal(typeof initPlanetaryIntro, 'function');
    assert.ok(Array.isArray(CONTINENT_POLYGONS));
    assert.ok(CONTINENT_POLYGONS.length >= 6, 'Must define at least 6 continent outlines');
    assert.ok(Array.isArray(GLOBAL_TIME_HUBS));
    assert.equal(GLOBAL_TIME_HUBS.length, 7, 'Must define 7 strategic global time hubs');
  });

  it('should initialize with default 3.8-second duration (3-5s requirement)', () => {
    const intro = new PlanetaryIntroStage({ autoStart: false });
    assert.ok(intro.options.durationMs >= 3000 && intro.options.durationMs <= 5000,
      `Duration ${intro.options.durationMs}ms must be between 3000ms and 5000ms`);
    assert.equal(intro.options.durationMs, 3800);
    assert.equal(intro.isActive, true);
    assert.equal(intro.milestones.length, 4, 'Must have 4 calibrated initialization milestones');
  });

  it('should verify all 7 global time hubs have valid IANA timezones and coordinates', () => {
    const hubIds = GLOBAL_TIME_HUBS.map(h => h.id);
    assert.ok(hubIds.includes('LON'), 'Must include London Prime Meridian (0°)');
    assert.ok(hubIds.includes('NYC'), 'Must include New York');
    assert.ok(hubIds.includes('ZRH'), 'Must include Zurich Horological Reference');
    assert.ok(hubIds.includes('DXB'), 'Must include Dubai');
    assert.ok(hubIds.includes('DEL'), 'Must include New Delhi');
    assert.ok(hubIds.includes('TYO'), 'Must include Tokyo');
    assert.ok(hubIds.includes('SYD'), 'Must include Sydney');

    // Test Intl date formatting works for all hubs without throwing
    const now = new Date();
    GLOBAL_TIME_HUBS.forEach(h => {
      assert.ok(h.lon >= -180 && h.lon <= 180, `${h.id} longitude out of bounds`);
      assert.ok(h.lat >= -90 && h.lat <= 90, `${h.id} latitude out of bounds`);
      assert.doesNotThrow(() => {
        new Intl.DateTimeFormat('en-US', { timeZone: h.tz }).format(now);
      }, `IANA timezone ${h.tz} must be valid`);
    });
  });

  it('should transition into dismissed state cleanly when dismiss() is called', () => {
    let completedCalled = false;
    const intro = new PlanetaryIntroStage({
      autoStart: false,
      onComplete: () => { completedCalled = true; }
    });

    assert.equal(intro.isActive, true);
    intro.dismiss();
    assert.equal(intro.isActive, false);
    assert.equal(completedCalled, true, 'onComplete callback must be invoked on dismiss');
  });

  it('should verify index.html contains all enterprise intro stage DOM landmarks and elements', () => {
    const indexPath = resolve(rootDir, 'index.html');
    assert.ok(existsSync(indexPath), 'index.html must exist');
    const html = readFileSync(indexPath, 'utf-8');

    // 1. Stage container
    assert.ok(html.includes('id="introStage"'), 'Must contain introStage element');

    // 2. Globe canvas & coordinates
    assert.ok(html.includes('id="introGlobeCanvas"'), 'Must contain introGlobeCanvas element');
    assert.ok(html.includes('id="introSolarDec"'), 'Must contain introSolarDec element');
    assert.ok(html.includes('id="introSubsolarLon"'), 'Must contain introSubsolarLon element');

    // 3. Master UTC Clock & Hubs
    assert.ok(html.includes('id="introMasterUtc"'), 'Must contain introMasterUtc element');
    assert.ok(html.includes('id="clockHub_LON"'), 'Must contain London hub clock');
    assert.ok(html.includes('id="clockHub_NYC"'), 'Must contain New York hub clock');
    assert.ok(html.includes('id="clockHub_TYO"'), 'Must contain Tokyo hub clock');

    // 4. Enterprise SLO & Branding
    assert.ok(html.includes('99.999% SLA') || html.includes('99.999%'), 'Must document 99.999% availability SLO');
    assert.ok(html.includes('H O R O L O G I U M') || html.includes('HOROLOGIUM'), 'Must display HOROLOGIUM title');
    assert.ok(html.includes('SHAIK IMTHIYAS'), 'Must feature author credit Shaik Imthiyas');
    assert.ok(html.includes('astrolabe-logo-svg'), 'Must include astrolabe logo SVG');

    // 5. Controls
    assert.ok(html.includes('id="btnSkipIntro"'), 'Must contain skip intro button');
    assert.ok(html.includes('id="introSoundToggle"'), 'Must contain sound toggle button');
    assert.ok(html.includes('id="introProgressBar"'), 'Must contain progress bar');
  });

  it('should verify layout.css declares responsive rules for the planetary intro deck', () => {
    const cssPath = resolve(rootDir, 'src/styles/layout.css');
    const css = readFileSync(cssPath, 'utf-8');

    assert.ok(css.includes('.intro-stage'), 'Must declare .intro-stage');
    assert.ok(css.includes('.intro-planetary-deck'), 'Must declare .intro-planetary-deck');
    assert.ok(css.includes('.intro-globe-wrapper'), 'Must declare .intro-globe-wrapper');
    assert.ok(css.includes('.intro-master-clock'), 'Must declare .intro-master-clock');
    assert.ok(css.includes('.intro-slo-bento'), 'Must declare .intro-slo-bento');
    assert.ok(css.includes('.btn-intro-skip'), 'Must declare .btn-intro-skip');
  });
});
