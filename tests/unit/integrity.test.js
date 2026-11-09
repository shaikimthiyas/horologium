/**
 * Unit Test Suite: Horologium Repository & System Integrity Verifier
 * Sovereign Architect: Shaik Imthiyas
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../../');

const CANONICAL_PAGES = [
  'index.html',
  'pages/horo/index.html',
  'pages/flight-deck/index.html',
  'pages/geodesic-registry/index.html',
  'pages/operator-gateway/index.html',
  'pages/protocol-liaison/index.html',
  'pages/api-explorer/index.html',
  'pages/developers/index.html',
  'pages/about/index.html',
  'pages/status/index.html',
  'pages/privacy/index.html',
  'pages/404.html'
];

const STATIC_ASSETS = [
  'public/cover.png',
  'public/manifest.webmanifest',
  'public/openapi.json',
  'public/horologium.postman_collection.json',
  'public/sdk/horologium.js',
  'public/widgets/horologium-widgets.js',
  'public/sw.js'
];

const PACKAGES = [
  'packages/client/package.json',
  'packages/client/index.js',
  'packages/client/index.d.ts'
];

describe('Horologium Repository & Architecture Integrity', () => {
  test('all canonical multi-page shells exist on disk with valid doctype', () => {
    for (const page of CANONICAL_PAGES) {
      const p = resolve(root, page);
      assert.ok(existsSync(p), `Missing canonical page: ${page}`);
      const content = readFileSync(p, 'utf-8');
      assert.ok(content.includes('<!DOCTYPE html>'), `Malformed HTML in: ${page}`);
    }
  });

  test('all required public static assets and distribution bundles exist', () => {
    for (const asset of STATIC_ASSETS) {
      const p = resolve(root, asset);
      assert.ok(existsSync(p), `Missing static asset: ${asset}`);
    }
  });

  test('universal client SDK package files exist and have valid structure', () => {
    for (const pkg of PACKAGES) {
      const p = resolve(root, pkg);
      assert.ok(existsSync(p), `Missing package file: ${pkg}`);
    }
  });

  test('canonical JSON manifests and schemas parse cleanly', () => {
    const openapi = JSON.parse(readFileSync(resolve(root, 'public/openapi.json'), 'utf-8'));
    assert.equal(openapi.openapi, '3.1.0');

    const postman = JSON.parse(readFileSync(resolve(root, 'public/horologium.postman_collection.json'), 'utf-8'));
    assert.ok(postman.info.schema);

    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf-8'));
    assert.ok(manifest.name);
  });
});
