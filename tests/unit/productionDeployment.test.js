/**
 * Horologium Enterprise Production Deployment & Architectural Completion Test Suite
 * Validates:
 * 1. Federated Search Engine (/api/v1/search) across territories, timezones, offsets, and consoles.
 * 2. Harmonized Station Pinning (/api/pins) supporting dual contract schemas and sync.
 * 3. Request Tracing & Rate Limiting (X-Request-Id, X-RateLimit-*).
 * 4. Operator Password Rotation (/api/auth/change-password).
 * 5. Developer Quota Governance & UI without browser alert().
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../../server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

describe('Enterprise Production Deployment & Architecture Verification', () => {
  let server;
  let baseUrl;
  let operatorToken;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Obtain operator token for authenticated test cases
    const authRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    const authData = await authRes.json();
    if (!authRes.ok) {
      console.error('[TEST DEBUG] /api/auth/login failed:', authRes.status, authData);
    }
    operatorToken = authData.token;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('Federated Search: queries return accurate ranked results across entities', async () => {
    // 1. Query city / capital / country
    const resTokyo = await fetch(`${baseUrl}/api/v1/search?q=tokyo`);
    assert.equal(resTokyo.status, 200);
    const dataTokyo = await resTokyo.json();
    assert.ok(dataTokyo.total > 0);
    const hasJapanOrTokyo = dataTokyo.results.some(r => 
      r.title.toLowerCase().includes('tokyo') || 
      (r.country && r.country.toLowerCase().includes('japan')) ||
      (r.capital && r.capital.toLowerCase().includes('tokyo'))
    );
    assert.ok(hasJapanOrTokyo, 'Search for tokyo must return Tokyo timezone or Japan');

    // 2. Query UTC offset
    const resOffset = await fetch(`${baseUrl}/api/v1/search?q=UTC%2B05:30`);
    assert.equal(resOffset.status, 200);
    const dataOffset = await resOffset.json();
    assert.ok(dataOffset.total > 0);
    const hasIndiaOrKolkata = dataOffset.results.some(r => 
      r.title.toLowerCase().includes('kolkata') || 
      (r.country && r.country.toLowerCase().includes('india'))
    );
    assert.ok(hasIndiaOrKolkata, 'Search for UTC+05:30 must index India or Kolkata');

    // 3. Query navigation consoles
    const resNav = await fetch(`${baseUrl}/api/v1/search?q=flight&category=navigation`);
    assert.equal(resNav.status, 200);
    const dataNav = await resNav.json();
    assert.ok(dataNav.results.length > 0);
    assert.equal(dataNav.results[0].type, 'navigation');
    assert.ok(dataNav.results[0].url.includes('flight-deck'));
  });

  test('Station Pinning Harmonization: supports both contract schemas with dual-engine fields', async () => {
    assert.ok(operatorToken, 'Valid operator clearance token required');

    // 1. Schema A: { city, country, tz }
    const resA = await fetch(`${baseUrl}/api/pins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${operatorToken}`
      },
      body: JSON.stringify({ city: 'Geneva', country: 'Switzerland', tz: 'Europe/Zurich', sort_order: 10 })
    });
    assert.equal(resA.status, 201);
    const dataA = await resA.json();
    assert.ok(dataA.id, 'Must return created pin ID');

    // 2. Schema B: { name, timezone, lat, lng }
    const resB = await fetch(`${baseUrl}/api/pins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${operatorToken}`
      },
      body: JSON.stringify({ name: 'Reykjavik', timezone: 'Atlantic/Reykjavik', lat: 64.14, lng: -21.94 })
    });
    assert.equal(resB.status, 201);
    const dataB = await resB.json();
    assert.ok(dataB.id, 'Must return created pin ID');

    // 3. GET /api/pins returns harmonized contract
    const resList = await fetch(`${baseUrl}/api/pins`);
    assert.equal(resList.status, 200);
    const listData = await resList.json();
    const pinA = listData.pins.find(p => p.id === dataA.id);
    const pinB = listData.pins.find(p => p.id === dataB.id);

    assert.ok(pinA, 'Pin A must exist in list');
    assert.equal(pinA.city, 'Geneva');
    assert.equal(pinA.name, 'Geneva');
    assert.equal(pinA.tz, 'Europe/Zurich');
    assert.equal(pinA.timezone, 'Europe/Zurich');

    assert.ok(pinB, 'Pin B must exist in list');
    assert.equal(pinB.city, 'Reykjavik');
    assert.equal(pinB.name, 'Reykjavik');

    // 4. Cleanup
    await fetch(`${baseUrl}/api/pins/${dataA.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${operatorToken}` }
    });
    await fetch(`${baseUrl}/api/pins/${dataB.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${operatorToken}` }
    });
  });

  test('Observability & Tracing: X-Request-Id and Rate Limit headers are emitted', async () => {
    // 1. X-Request-Id generation
    const res = await fetch(`${baseUrl}/api/time`);
    assert.equal(res.status, 200);
    const reqId = res.headers.get('x-request-id');
    assert.ok(reqId, 'X-Request-Id header must be present on response');
    assert.ok(reqId.length >= 16, 'X-Request-Id must be a valid correlation string');

    // 2. X-Request-Id propagation
    const customId = 'hlg-trace-test-uuid-999';
    const resCustom = await fetch(`${baseUrl}/api/time`, {
      headers: { 'X-Request-Id': customId }
    });
    assert.equal(resCustom.headers.get('x-request-id'), customId);

    // 3. Rate Limit headers on generalLimiter endpoints
    const limitHeader = res.headers.get('x-ratelimit-limit');
    const remainingHeader = res.headers.get('x-ratelimit-remaining');
    assert.ok(limitHeader, 'X-RateLimit-Limit header must be present');
    assert.ok(remainingHeader !== null, 'X-RateLimit-Remaining header must be present');
  });

  test('Operator Password Rotation: POST /api/auth/change-password operates securely', async () => {
    const tempPassword = 'NewSecretPassword2026!';

    // 1. Rotate password
    const resChange = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${operatorToken}`
      },
      body: JSON.stringify({
        currentPassword: 'password123',
        newPassword: tempPassword
      })
    });
    assert.equal(resChange.status, 200);
    const dataChange = await resChange.json();
    assert.equal(dataChange.success, true);

    // 2. Old password must fail
    const resOldLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    assert.equal(resOldLogin.status, 401);

    // 3. New password must succeed
    const resNewLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: tempPassword })
    });
    assert.equal(resNewLogin.status, 200);
    const newAuthData = await resNewLogin.json();
    assert.ok(newAuthData.token);

    // 4. Restore original password for test repeatability
    await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newAuthData.token}`
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: 'password123'
      })
    });
  });

  test('Developer Platform: Zero browser alert() calls and live inspection tool in DOM', () => {
    const devHtmlPath = resolve(rootDir, 'pages/developers/index.html');
    assert.ok(existsSync(devHtmlPath));
    const content = readFileSync(devHtmlPath, 'utf8');

    // No raw alert calls in scripts
    assert.ok(!content.includes('alert('), 'Developer portal must have zero alert() calls');

    // Status message card and Inspector elements present
    assert.ok(content.includes('id="keyStatusMsg"'), 'Status message element must exist');
    assert.ok(content.includes('id="verifyKeyInput"'), 'Key inspector input must exist');
    assert.ok(content.includes('id="btnVerifyKey"'), 'Key inspector button must exist');
    assert.ok(content.includes('id="verifyKeyResult"'), 'Key inspector result box must exist');
  });
});
