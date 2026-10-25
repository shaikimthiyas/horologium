/**
 * Unit Test Suite: Sprint L - Builder Colophon, Live Status, Data Sovereignty & 404
 * Sovereign Author: Shaik Imthiyas
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

describe('Sprint L: Builder Colophon, Live Status, Data Sovereignty & 404 Pages', () => {
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

  test('Colophon & Builder Note (about/index.html) verifies Shaik Imthiyas authorship & specs', () => {
    const filePath = resolve(rootDir, 'about/index.html');
    assert.ok(existsSync(filePath), 'about/index.html must exist on disk');

    const html = readFileSync(filePath, 'utf8');
    assert.ok(html.includes('Shaik Imthiyas'), 'Must feature Shaik Imthiyas as architect/builder');
    assert.ok(html.includes('Calibre-01'), 'Must define Calibre-01 Horological Engine');
    assert.ok(html.includes('Design Tokens') || html.includes('Typography'), 'Must document typography or design tokens');
    assert.ok(html.includes('github.com/shaikimthiyas/horologium'), 'Must link to official repository');
    assert.ok(html.includes('viewport'), 'Must contain responsive viewport tag');
  });

  test('Telemetry Status Dashboard (status/index.html) contains live probe controls & SLA metrics', () => {
    const filePath = resolve(rootDir, 'status/index.html');
    assert.ok(existsSync(filePath), 'status/index.html must exist on disk');

    const html = readFileSync(filePath, 'utf8');
    assert.ok(html.includes('/healthz'), 'Must probe Kubernetes /healthz');
    assert.ok(html.includes('/readyz'), 'Must probe Kubernetes /readyz');
    assert.ok(html.includes('99.99%'), 'Must document 99.99% operational availability target');
    assert.ok(html.includes('btnRunDiagnostics'), 'Must contain interactive diagnostic trigger');
    assert.ok(html.includes('diagnosticOutput'), 'Must contain diagnostic telemetry output console');
  });

  test('Data Sovereignty Policy (privacy/index.html) defines zero-knowledge chronometry & RFC standards', () => {
    const filePath = resolve(rootDir, 'privacy/index.html');
    assert.ok(existsSync(filePath), 'privacy/index.html must exist on disk');

    const html = readFileSync(filePath, 'utf8');
    assert.ok(html.includes('Zero-Tracking') || html.includes('Zero-Knowledge') || html.includes('zero-knowledge'), 'Must declare zero-knowledge policy');
    assert.ok(html.includes('RFC 9557'), 'Must reference RFC 9557 timezone standards');
    assert.ok(html.includes('MIT License'), 'Must reference MIT open-source license');
  });

  test('404 Temporal Discontinuity (404.html) contains radar sweep & navigation recovery', () => {
    const filePath = resolve(rootDir, '404.html');
    assert.ok(existsSync(filePath), '404.html must exist on disk');

    const html = readFileSync(filePath, 'utf8');
    assert.ok(html.includes('404'), 'Must display 404 error code');
    assert.ok(html.includes('TEMPORAL DISCONTINUITY'), 'Must declare temporal discontinuity error');
    assert.ok(html.includes('href="/"') || html.includes('href="/flight-deck/"'), 'Must offer recovery link to Gateway or Flight Deck');
    assert.ok(html.includes('clock404'), 'Must contain live master clock element');
  });

  test('HTTP Route Aliases: Canonical 301 redirections for /about, /status, /privacy', async () => {
    // /about alias
    const resAbout = await fetch(`${baseUrl}/about`, { redirect: 'manual' });
    assert.equal(resAbout.status, 301);
    assert.equal(resAbout.headers.get('location'), '/about/');

    // /colophon alias
    const resColophon = await fetch(`${baseUrl}/colophon`, { redirect: 'manual' });
    assert.equal(resColophon.status, 301);
    assert.equal(resColophon.headers.get('location'), '/about/');

    // /status alias
    const resStatus = await fetch(`${baseUrl}/status`, { redirect: 'manual' });
    assert.equal(resStatus.status, 301);
    assert.equal(resStatus.headers.get('location'), '/status/');

    // /uptime alias
    const resUptime = await fetch(`${baseUrl}/uptime`, { redirect: 'manual' });
    assert.equal(resUptime.status, 301);
    assert.equal(resUptime.headers.get('location'), '/status/');

    // /privacy alias
    const resPrivacy = await fetch(`${baseUrl}/privacy`, { redirect: 'manual' });
    assert.equal(resPrivacy.status, 301);
    assert.equal(resPrivacy.headers.get('location'), '/privacy/');

    // /legal alias
    const resLegal = await fetch(`${baseUrl}/legal`, { redirect: 'manual' });
    assert.equal(resLegal.status, 301);
    assert.equal(resLegal.headers.get('location'), '/privacy/');
  });
});
