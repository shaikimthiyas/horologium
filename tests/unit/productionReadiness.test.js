import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../../server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

const CANONICAL_HTML_FILES = [
  'index.html',
  'pages/horo/index.html',
  'pages/flight-deck/index.html',
  'pages/geodesic-registry/index.html',
  'pages/developers/index.html',
  'pages/api-explorer/index.html',
  'pages/protocol-liaison/index.html',
  'pages/operator-gateway/index.html',
  'pages/status/index.html',
  'pages/about/index.html',
  'pages/privacy/index.html'
];

describe('Enterprise Production Readiness & Anti-AI Slop Suite', () => {
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
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('Metadata & Head Polish across all 11 canonical HTML consoles', () => {
    for (const relPath of CANONICAL_HTML_FILES) {
      const fullPath = resolve(rootDir, relPath);
      assert.ok(existsSync(fullPath), `File must exist: ${relPath}`);

      const html = readFileSync(fullPath, 'utf8');

      // 1. Zero-Flash Theme Script
      assert.ok(
        html.includes('localStorage.getItem(\'horologium_theme\')'),
        `${relPath} must contain inline zero-flash theme script in <head>`
      );

      // 2. Canonical self-referencing link
      assert.ok(
        html.includes('<link rel="canonical"'),
        `${relPath} must define a self-referencing canonical URL link`
      );

      // 3. Dual adaptive theme-color meta tags
      assert.ok(
        html.includes('media="(prefers-color-scheme: dark)"'),
        `${relPath} must declare dark mode adaptive theme-color`
      );
      assert.ok(
        html.includes('media="(prefers-color-scheme: light)"'),
        `${relPath} must declare light mode adaptive theme-color`
      );

      // 4. Complete Favicon & Manifest Suite
      assert.ok(html.includes('href="/favicon.svg"'), `${relPath} must link favicon.svg`);
      assert.ok(html.includes('href="/apple-touch-icon.png"'), `${relPath} must link apple-touch-icon.png`);
      assert.ok(html.includes('href="/manifest.webmanifest"'), `${relPath} must link manifest.webmanifest`);

      // 5. Open Graph & Twitter Cards
      assert.ok(html.includes('property="og:title"'), `${relPath} must define og:title`);
      assert.ok(html.includes('name="twitter:card"'), `${relPath} must define twitter:card`);
    }
  });

  test('Public discovery assets: llms.txt, security.txt, sitemap.xml, robots.txt', () => {
    // 1. llms.txt
    const llmsPath = resolve(rootDir, 'public/llms.txt');
    assert.ok(existsSync(llmsPath), 'public/llms.txt must exist at domain root');
    const llmsContent = readFileSync(llmsPath, 'utf8');
    assert.ok(llmsContent.includes('Shaik Imthiyas'), 'llms.txt must attribute sovereign architecture to Shaik Imthiyas');
    assert.ok(llmsContent.includes('Marzullo'), 'llms.txt must document Marzullo consensus algorithm');
    assert.ok(llmsContent.includes('/api/v1/time'), 'llms.txt must document core time endpoint');

    // 2. .well-known/security.txt (RFC 9116)
    const secPath = resolve(rootDir, 'public/.well-known/security.txt');
    assert.ok(existsSync(secPath), 'public/.well-known/security.txt must exist');
    const secContent = readFileSync(secPath, 'utf8');
    assert.ok(secContent.includes('Contact:'), 'security.txt must define security contact');
    assert.ok(secContent.includes('Canonical:'), 'security.txt must define canonical URL');
    assert.ok(secContent.includes('Policy:'), 'security.txt must define security policy');

    // 3. sitemap.xml covers all 10 canonical public consoles
    const sitemapPath = resolve(rootDir, 'public/sitemap.xml');
    assert.ok(existsSync(sitemapPath), 'public/sitemap.xml must exist');
    const sitemapContent = readFileSync(sitemapPath, 'utf8');
    assert.ok(sitemapContent.includes('/flight-deck/'), 'sitemap must include /flight-deck/');
    assert.ok(sitemapContent.includes('/geodesic-registry/'), 'sitemap must include /geodesic-registry/');
    assert.ok(sitemapContent.includes('/developers/'), 'sitemap must include /developers/');
    assert.ok(sitemapContent.includes('/api-explorer/'), 'sitemap must include /api-explorer/');
    assert.ok(sitemapContent.includes('/status/'), 'sitemap must include /status/');
    assert.ok(sitemapContent.includes('/about/'), 'sitemap must include /about/');
    assert.ok(sitemapContent.includes('/privacy/'), 'sitemap must include /privacy/');

    // 4. robots.txt disallows internal probes and links to sitemap
    const robotsPath = resolve(rootDir, 'public/robots.txt');
    assert.ok(existsSync(robotsPath), 'public/robots.txt must exist');
    const robotsContent = readFileSync(robotsPath, 'utf8');
    assert.ok(robotsContent.includes('Disallow: /healthz'), 'robots.txt must protect /healthz');
    assert.ok(robotsContent.includes('Disallow: /readyz'), 'robots.txt must protect /readyz');
    assert.ok(robotsContent.includes('Sitemap:'), 'robots.txt must reference sitemap URL');
  });

  test('Static 500 error fallback console and server route', async () => {
    const errPagePath = resolve(rootDir, 'pages/500.html');
    assert.ok(existsSync(errPagePath), 'pages/500.html must exist');
    const content = readFileSync(errPagePath, 'utf8');
    assert.ok(content.includes('fault-reticle'), '500 page must contain fault reticle');
    assert.ok(content.includes('ERR_INTERNAL_500'), '500 page must provide diagnostic code');

    const res = await fetch(`${baseUrl}/500`);
    assert.equal(res.status, 500);
    const body = await res.text();
    assert.ok(body.includes('Server Fault Detected'));
  });

  test('CSS Anti-Slop, typography polish, selection, and print stylesheet', () => {
    const baseCss = readFileSync(resolve(rootDir, 'src/styles/base.css'), 'utf8');

    // 1. Scrollbar gutter stability
    assert.ok(baseCss.includes('scrollbar-gutter: stable'), 'CSS must enforce scrollbar-gutter: stable');

    // 2. Scroll margin offsets for sticky header
    assert.ok(baseCss.includes('scroll-margin-top: 72px'), 'CSS must apply scroll-margin-top on headings');

    // 3. Custom text selection
    assert.ok(baseCss.includes('::selection'), 'CSS must define brand ::selection');

    // 4. Print stylesheet
    assert.ok(baseCss.includes('@media print'), 'CSS must declare @media print rules');

    // 5. Six-state interactive buttons
    assert.ok(baseCss.includes('[data-loading="true"]'), 'CSS must style data-loading');
    assert.ok(baseCss.includes(':focus-visible'), 'CSS must style focus-visible');
    assert.ok(baseCss.includes('.skeleton-bone'), 'CSS must define skeleton placeholders');
    assert.ok(baseCss.includes('.offline-marine-banner'), 'CSS must style offline banner');
  });

  test('Invisible bot honeypot trap on transmission submission', async () => {
    // Normal transmission with required fields
    const validRes = await fetch(`${baseUrl}/api/transmissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Test Operator',
        email: 'operator@horologium.telemetry.org',
        message: 'Normal valid inquiry payload.'
      })
    });
    assert.equal(validRes.status, 201);
    const validData = await validRes.json();
    assert.equal(validData.success, true);

    // Bot submission triggering honeypot token
    const botRes = await fetch(`${baseUrl}/api/transmissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Spam Bot Agent',
        email: 'bot@spamnetwork.xyz',
        message: 'Spam solicitation message.',
        hp_station_token: 'bot_injected_token_value'
      })
    });
    // Silently dropped with 201 success so spambots don't retry or adapt
    assert.equal(botRes.status, 201);
    const botData = await botRes.json();
    assert.equal(botData.success, true);
  });
});
