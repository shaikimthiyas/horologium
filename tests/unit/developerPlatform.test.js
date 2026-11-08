/**
 * Unit Test Suite: Enterprise Developer Platform, Key Governance & Metrics
 * Verifies developer key provisioning, validation, rate limiting metadata, and portal markup
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../../server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

describe('Enterprise Developer Platform & Key Governance', () => {
  let server;
  let baseUrl;
  let provisionedKey;

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

  test('POST /api/v1/developers/keys provisions valid developer key with tenant tier', async () => {
    const res = await fetch(`${baseUrl}/api/v1/developers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantName: 'Stripe Engineering',
        tenantEmail: 'devs@stripe.internal',
        tier: 'partner',
        allowedDomains: '*.stripe.com'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();

    assert.equal(data.status, 'success');
    assert.ok(data.apiKey.startsWith('hlg_live_'), 'Key must use canonical prefix hlg_live_');
    assert.equal(data.tenantName, 'Stripe Engineering');
    assert.equal(data.tier, 'partner');
    assert.equal(data.rateLimitRpm, 1200);

    provisionedKey = data.apiKey;
  });

  test('POST /api/v1/developers/keys rejects invalid payload with RFC 7807 problem details', async () => {
    const res = await fetch(`${baseUrl}/api/v1/developers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantName: 'A', // Too short
        tenantEmail: 'not-an-email'
      })
    });

    assert.equal(res.status, 400);
    const problem = await res.json();
    assert.equal(problem.status, 400);
    assert.ok(problem.title.includes('Invalid') || problem.detail);
  });

  test('GET /api/v1/developers/keys/verify confirms status of provisioned key', async () => {
    const res = await fetch(`${baseUrl}/api/v1/developers/keys/verify`, {
      headers: {
        'X-Horologium-Key': provisionedKey
      }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'valid');
    assert.equal(data.tenantName, 'Stripe Engineering');
    assert.equal(data.tier, 'partner');
  });

  test('GET /api/v1/developers/keys/verify rejects missing or invalid keys with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/developers/keys/verify`, {
      headers: {
        'X-Horologium-Key': 'hlg_live_invalidkey123456789'
      }
    });

    assert.equal(res.status, 401);
    const problem = await res.json();
    assert.equal(problem.status, 401);
    assert.ok(problem.title.includes('Unauthorized') || problem.detail);
  });

  test('GET /api/v1/developers/metrics provides platform operational telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/v1/developers/metrics`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.status, 'operational');
    assert.ok(typeof data.tenants.activeKeys === 'number');
    assert.ok(typeof data.tenants.totalRequestsLogged === 'number');
    assert.ok(data.uptimeSlaPercent);
  });

  test('Developer portal HTML file exists with Widget Studio and API quickstarts', () => {
    const devHtmlPath = resolve(rootDir, 'developers/index.html');
    assert.ok(existsSync(devHtmlPath), 'developers/index.html must exist on disk');

    const html = readFileSync(devHtmlPath, 'utf8');
    assert.ok(html.includes('DEVELOPER PLATFORM') || html.includes('Developer Portal'), 'Must include Developer Portal header');
    assert.ok(html.includes('Widget Studio'), 'Must contain Widget Studio visualizer');
    assert.ok(html.includes('Generate Free API Key') || html.includes('Generate Developer API Key'), 'Must contain self-service key generation');
    assert.ok(html.includes('Shaik Imthiyas'), 'Must maintain architect attribution');
  });
});
