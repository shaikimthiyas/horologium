/**
 * Unit Test Suite: Enterprise Embed Service & Micro-Widgets
 * Verifies standalone embed routes, framing security headers, and Web Components
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

describe('Enterprise Embed Service & Micro-Widgets', () => {
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

  test('GET /embed/clock serves embeddable clock with permissive frame headers', async () => {
    const res = await fetch(`${baseUrl}/embed/clock?tz=Asia/Tokyo&theme=obsidian`);
    assert.equal(res.status, 200);

    const csp = res.headers.get('content-security-policy') || '';
    assert.ok(csp.includes('frame-ancestors *'), 'Must permit cross-origin iframe embedding in SaaS platforms');

    const xFrame = res.headers.get('x-frame-options');
    assert.ok(!xFrame || xFrame === 'ALLOWALL', 'Must not restrict framing with SAMEORIGIN or DENY');

    const html = await res.text();
    assert.ok(html.includes('clock-card'), 'HTML must render clock-card container');
    assert.ok(html.includes('Asia/Tokyo'), 'Must reflect requested timezone');
    assert.ok(html.includes('Horologium'), 'Must include instrument branding');
  });

  test('GET /embed/overlap serves interactive cross-border overlap widget', async () => {
    const res = await fetch(`${baseUrl}/embed/overlap?stationA=Europe/London&stationB=Asia/Tokyo`);
    assert.equal(res.status, 200);

    const csp = res.headers.get('content-security-policy') || '';
    assert.ok(csp.includes('frame-ancestors *'));

    const html = await res.text();
    assert.ok(html.includes('planner-card'), 'HTML must render planner-card container');
    assert.ok(html.includes('London'), 'Must reflect Station A');
    assert.ok(html.includes('Tokyo'), 'Must reflect Station B');
  });

  test('GET /embed/terminator serves astronomical day/night terminator embed', async () => {
    const res = await fetch(`${baseUrl}/embed/terminator`);
    assert.equal(res.status, 200);

    const html = await res.text();
    assert.ok(html.includes('<svg'), 'Must render SVG element');
    assert.ok(html.includes('Astronomical Solar Terminator') || html.includes('Horologium'), 'Must include instrument branding');
  });

  test('Web Component bundle file exists and defines custom elements', () => {
    const widgetBundlePath = resolve(rootDir, 'public/widgets/horologium-widgets.js');
    assert.ok(existsSync(widgetBundlePath), 'horologium-widgets.js must exist on disk');

    const bundleContent = readFileSync(widgetBundlePath, 'utf8');
    assert.ok(bundleContent.includes('customElements.define(\'horologium-clock\''), 'Must register <horologium-clock>');
    assert.ok(bundleContent.includes('customElements.define(\'horologium-overlap\''), 'Must register <horologium-overlap>');
    assert.ok(bundleContent.includes('attachShadow'), 'Must use isolated Shadow DOM');
  });
});
