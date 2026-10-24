/**
 * Unit Test Suite: Sprint H - Progressive Web App (PWA) & Offline Marine Chronometer Engine
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClockFSM, ClockState, ClockEvent } from '../../src/utils/clockFSM.js';
import { pwaManager } from '../../src/utils/pwaManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

describe('Sprint H: Progressive Web App & Offline Marine Chronometer Engine', () => {

  test('PWA Web App Manifest: Schema, metadata & canonical shortcuts', () => {
    const manifestPath = resolve(rootDir, 'public/manifest.webmanifest');
    assert.ok(existsSync(manifestPath), 'manifest.webmanifest must exist in public directory');

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.id, '/', 'Manifest id must be root "/"');
    assert.ok(manifest.name.includes('HOROLOGIUM'), 'Manifest name must identify HOROLOGIUM');
    assert.equal(manifest.short_name, 'Horologium');
    assert.equal(manifest.display, 'standalone', 'Display mode must be standalone');
    assert.equal(manifest.scope, '/', 'Scope must be root "/"');
    assert.equal(manifest.start_url, '/index.html');
    assert.ok(manifest.background_color, 'Must define background_color');
    assert.ok(manifest.theme_color, 'Must define theme_color');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Must define app icons');

    // Check shortcuts
    assert.ok(Array.isArray(manifest.shortcuts), 'Must define canonical shortcuts');
    const shortcutUrls = manifest.shortcuts.map(s => s.url);
    assert.ok(shortcutUrls.includes('/flight-deck/'), 'Shortcuts must include Flight Deck');
    assert.ok(shortcutUrls.includes('/geodesic-registry/'), 'Shortcuts must include Geodesic Registry');
  });

  test('Service Worker: Precache manifest covers all canonical multi-page shells', () => {
    const swPath = resolve(rootDir, 'public/sw.js');
    assert.ok(existsSync(swPath), 'sw.js must exist in public directory');

    const swContent = readFileSync(swPath, 'utf8');
    assert.ok(swContent.includes('horologium-core-v1.4.0'), 'Cache name must be bumped to v1.4.0');
    assert.ok(swContent.includes('/flight-deck/index.html'), 'Precache must include flight deck html');
    assert.ok(swContent.includes('/geodesic-registry/index.html'), 'Precache must include registry html');
    assert.ok(swContent.includes('/api-explorer/index.html'), 'Precache must include api explorer html');
    assert.ok(swContent.includes('X-Horologium-Offline'), 'Must set synthetic offline response headers');
  });

  test('PWAManager Controller: Offline telemetry queue & record generation', async () => {
    await pwaManager.init();
    assert.ok(pwaManager, 'PWAManager must initialize cleanly');

    const testPayload = { metric: 'crystal_frequency', value_hz: 32768.012 };
    const recordId = pwaManager.queueOfflineTelemetry(testPayload);

    assert.ok(recordId.startsWith('off_'), 'Generated recordId must have off_ prefix');
    assert.ok(pwaManager.offlineQueue.some(r => r.id === recordId), 'Record must exist in offline queue');

    // Subscription notification test
    let receivedEvent = null;
    const unsubscribe = pwaManager.subscribe((evt) => {
      receivedEvent = evt;
    });

    pwaManager._notify({ type: 'TEST_EVENT', detail: 42 });
    assert.equal(receivedEvent.type, 'TEST_EVENT');
    unsubscribe();
  });

  test('ClockFSM TCXO Quartz Drift Engine: Validates mathematical oscillator stability', () => {
    const fsm = new ClockFSM({ probeTimeoutMs: 50 });

    // Non-offline state: reports zero drift
    const onlineDrift = fsm.getOfflineDriftMetrics();
    assert.equal(onlineDrift.isOffline, false);
    assert.equal(onlineDrift.accumulatedDriftMs, 0.0);

    // Transition to OFFLINE
    fsm.transition(ClockState.OFFLINE, 'NETWORK_SEVERED_FOR_TEST');
    assert.equal(fsm.state, ClockState.OFFLINE);

    // Simulate elapsed offline time of 3600 seconds (1 hour)
    fsm.stateEnterTimestamp = Date.now() - 3600000;

    // Standard ambient temp 25°C: nominal drift = 0.035 ppm
    // Accumulated drift = (0.035 ppm * 3600s) / 1000 = 0.126 ms
    const drift25C = fsm.getOfflineDriftMetrics(25.0);
    assert.equal(drift25C.isOffline, true);
    assert.equal(drift25C.status, 'SOVEREIGN_TCXO_DRIFT_ACTIVE');
    assert.equal(drift25C.elapsedOfflineSeconds, 3600);
    assert.equal(drift25C.nominalDriftPpm, 0.035);
    assert.ok(drift25C.accumulatedDriftMs > 0.12, '1-hour accumulated drift at 25C must be > 0.12ms');

    // Thermal deviation at 35°C (ΔT = +10°C):
    // Thermal drift = -0.034 * 10^2 = -3.4 ppm
    // Total drift rate is lower due to quartz parabola
    const drift35C = fsm.getOfflineDriftMetrics(35.0);
    assert.ok(drift35C.totalDriftPpm < drift25C.totalDriftPpm, 'Higher temperature must shift frequency along quartz parabola');

    // Telemetry summary includes offline drift metadata
    const telemetry = fsm.getTelemetry();
    assert.ok(telemetry.offlineDrift, 'Telemetry must contain offlineDrift block');
    assert.equal(telemetry.offlineDrift.isOffline, true);
  });

  test('ClockFSM Event Handler: Syncs with CONNECTION_LOST and CONNECTION_RESTORED events', () => {
    const fsm = new ClockFSM();
    fsm.handleEvent(ClockEvent.BOOT);
    assert.equal(fsm.state, ClockState.PROBING_NTP);

    fsm.handleEvent(ClockEvent.CONNECTION_LOST);
    assert.equal(fsm.state, ClockState.OFFLINE);

    fsm.handleEvent(ClockEvent.CONNECTION_RESTORED);
    assert.equal(fsm.state, ClockState.PROBING_NTP);
  });
});
