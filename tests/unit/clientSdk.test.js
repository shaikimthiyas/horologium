/**
 * Unit Test Suite: Universal Client SDK (@horologium/client & /public/sdk/horologium.js)
 * Verifies SDK methods, atomic calibration, solar mechanics, and overlap computation
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HorologiumClient } from '../../packages/client/index.js';
import { app } from '../../server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

describe('Universal Client SDK (@horologium/client)', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
      server.unref();
    }
  });

  test('HorologiumClient instantiates with default options and endpoint configuration', () => {
    const client = new HorologiumClient({ endpoint: baseUrl, apiKey: 'hlg_live_testkey' });
    assert.equal(client.endpoint, baseUrl);
    assert.equal(client.apiKey, 'hlg_live_testkey');
    assert.equal(client.skewMs, 0);
  });

  test('calculateOverlap generates complete 24-hour timeline matrix with golden hours', () => {
    const client = new HorologiumClient();
    const overlap = client.calculateOverlap({
      stationA: 'Europe/London',
      stationB: 'Asia/Tokyo',
      workStart: 9,
      workEnd: 18
    });

    assert.equal(overlap.stationA, 'Europe/London');
    assert.equal(overlap.stationB, 'Asia/Tokyo');
    assert.equal(overlap.timeline.length, 24);

    const slot0 = overlap.timeline[0];
    assert.ok(typeof slot0.utcHour === 'number');
    assert.ok(typeof slot0.stationAHour === 'number');
    assert.ok(typeof slot0.stationBHour === 'number');
    assert.ok(typeof slot0.isWorkA === 'boolean');
    assert.ok(typeof slot0.isWorkB === 'boolean');
    assert.ok(typeof slot0.isOverlap === 'boolean');
  });

  test('getSolarPosition calculates valid astronomical declination and longitude', () => {
    const client = new HorologiumClient();
    const pos = client.getSolarPosition(new Date('2026-06-21T12:00:00Z')); // Summer solstice approx

    assert.ok(pos.declinationDeg >= -23.5 && pos.declinationDeg <= 23.5, 'Declination must be within Earth axial tilt bounds [-23.45, 23.45]');
    assert.ok(pos.subsolarLongitudeDeg >= -180 && pos.subsolarLongitudeDeg <= 180, 'Longitude must be between -180 and 180');
    // At 12:00 UTC, sun should be near prime meridian (around 0 degrees lon)
    assert.ok(Math.abs(pos.subsolarLongitudeDeg) < 2.0, 'At 12:00 UTC sun must be close to Greenwich meridian');
  });

  test('getAtomicTime retrieves synchronized time from live API and computes RTT', async () => {
    const client = new HorologiumClient({ endpoint: baseUrl });
    const sync = await client.getAtomicTime();

    assert.ok(typeof sync.epochMs === 'number');
    assert.ok(sync.utcIso);
    assert.ok(typeof sync.rttMs === 'number');
    assert.ok(sync.rttMs >= 0);
    assert.ok(sync.source);
  });

  test('getAtomicTime falls back to OFFLINE_MONOTONIC when endpoint is unreachable', async () => {
    const unreachableClient = new HorologiumClient({ endpoint: 'http://127.0.0.1:59999' });
    const fallback = await unreachableClient.getAtomicTime();

    assert.equal(fallback.source, 'OFFLINE_MONOTONIC');
    assert.ok(typeof fallback.epochMs === 'number');
    assert.ok(fallback.utcIso);
  });

  test('subscribeToTicks produces monotonic ticks and unsubscribes cleanly', async () => {
    const client = new HorologiumClient();
    let tickCount = 0;

    const unsubscribe = client.subscribeToTicks((tick) => {
      tickCount++;
      assert.ok(tick.epochMs > 0);
      assert.ok(tick.date instanceof Date);
    }, 50);

    await new Promise((r) => setTimeout(r, 160));
    unsubscribe();

    const recordedCount = tickCount;
    assert.ok(recordedCount >= 2, 'Must have received at least 2 ticks');

    // Wait another 100ms to ensure unsubscribe stopped the timer
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(tickCount, recordedCount, 'Timer must not tick after unsubscribe');
  });

  test('SDK entry points exist for package distribution and CDN browser loading', () => {
    const packageEntry = resolve(rootDir, 'packages/client/index.js');
    const cdnEntry = resolve(rootDir, 'public/sdk/horologium.js');

    assert.ok(existsSync(packageEntry), 'packages/client/index.js must exist');
    assert.ok(existsSync(cdnEntry), 'public/sdk/horologium.js must exist');

    const cdnContent = readFileSync(cdnEntry, 'utf8');
    assert.ok(cdnContent.includes('window.HorologiumClient = HorologiumClient'), 'Must support browser script tag inclusion');
  });
});
