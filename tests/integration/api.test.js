import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../../server/app.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = 'http://127.0.0.1:' + port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => { server.closeAllConnections ? server.closeAllConnections() : null; server.close(resolve); }); server.unref();
});

describe('Horologium Core Telemetry API Integration Tests', () => {
  it('GET /api/health returns healthy telemetry payload', async () => {
    const res = await fetch(baseUrl + '/api/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ONLINE');
    assert.equal(body.subsystem, 'Horologium Core Telemetry API');
    assert.ok(body.serverTimeUtc);
  });

  it('GET /api/time returns synchronized astronomical solar coordinates', async () => {
    const res = await fetch(baseUrl + '/api/time?location=UTC');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'SYNCHRONIZED');
    assert.equal(typeof body.solarDeclinationDeg, 'number');
    assert.equal(typeof body.subsolarLongitudeDeg, 'number');
  });

  it('GET /api/v1/countries provides paginated sovereign territories', async () => {
    const res = await fetch(baseUrl + '/api/v1/countries?limit=10');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'SUCCESS');
    assert.ok(body.totalRecords >= 200, 'Expected >= 200 countries');
    assert.equal(body.data.length, 10);
  });

  it('GET /api/v1/countries?query=Japan filters specific territory accurately', async () => {
    const res = await fetch(baseUrl + '/api/v1/countries?query=Japan');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'SUCCESS');
    assert.ok(body.data.length >= 1);
    const japan = body.data.find(c => c.name === 'Japan');
    assert.ok(japan, 'Japan territory must exist');
    assert.equal(japan.code, 'JP');
    assert.equal(japan.tz, 'Asia/Tokyo');
  });

  it('GET /api/v1/zones/overlap calculates accurate 24-hr delta and golden window', async () => {
    const res = await fetch(baseUrl + '/api/v1/zones/overlap?stationA=Europe/London&stationB=Asia/Tokyo');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.deltaHours, 'number');
    assert.equal(body.overlapHours.length, 24);
    assert.ok(body.overlapHours.some(h => h.isGoldenOverlap || h.isOneSided));
  });

  it('GET /api/metrics exposes Prometheus formatted metrics', async () => {
    const res = await fetch(baseUrl + '/api/metrics');
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('horologium_uptime_seconds'));
    assert.ok(text.includes('horologium_ntp_stratum'));
    assert.ok(text.includes('horologium_http_requests_total'));
  });
});
