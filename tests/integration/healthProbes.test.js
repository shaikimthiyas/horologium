/**
 * Integration Tests: Kubernetes-Standard Health, Readiness & Startup Probes
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../server/app.js';
import { appLifecycle } from '../../server/middleware/healthProbes.js';

describe('Kubernetes Health, Readiness & Liveness Probes', () => {
  let server;
  let baseUrl;

  before(async () => {
    appLifecycle.isStarted = true;
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
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /healthz returns 200 ALIVE with uptime', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ALIVE');
    assert.equal(body.subsystem, 'horologium-core-runtime');
    assert.ok(typeof body.uptimeSeconds === 'number');
  });

  test('GET /livez alias returns 200 ALIVE', async () => {
    const res = await fetch(`${baseUrl}/livez`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ALIVE');
  });

  test('GET /readyz returns 200 READY with database & ntp subsystem metrics', async () => {
    const res = await fetch(`${baseUrl}/readyz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'READY');
    assert.ok(body.subsystems.database);
    assert.ok(body.subsystems.cache);
    assert.ok(body.subsystems.ntp);
  });

  test('GET /startupz returns 200 STARTED once initialized', async () => {
    const res = await fetch(`${baseUrl}/startupz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'STARTED');
    assert.ok(typeof body.bootDurationMs === 'number');
  });

  test('GET /api/v1/stratum1/sync returns Marzullo consensus diagnostics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/stratum1/sync`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'SYNCHRONIZED');
    assert.equal(body.algorithm, 'MARZULLO_INTERSECTION_CONSENSUS');
    assert.ok(Array.isArray(body.truechimers), 'truechimers must be an array');
    assert.ok(typeof body.skewMs === 'number', 'skewMs must be a number');
  });
});
