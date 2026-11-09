#!/usr/bin/env node
/**
 * Horologium Repository & System Integrity Verifier
 * Sovereign Architect: Shaik Imthiyas
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const CANONICAL_PAGES = [
  'index.html',
  'horo/index.html',
  'flight-deck/index.html',
  'geodesic-registry/index.html',
  'operator-gateway/index.html',
  'protocol-liaison/index.html',
  'api-explorer/index.html',
  'developers/index.html',
  'about/index.html',
  'status/index.html',
  'privacy/index.html',
  '404.html'
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

console.log('--- Horologium Integrity Verification ---');
let errors = 0;

for (const page of CANONICAL_PAGES) {
  const p = resolve(root, page);
  if (!existsSync(p)) {
    console.error(`✖ Missing canonical console: ${page}`);
    errors++;
  } else {
    const content = readFileSync(p, 'utf-8');
    if (!content.includes('<!DOCTYPE html>')) {
      console.error(`✖ Malformed HTML in: ${page}`);
      errors++;
    }
  }
}

for (const asset of STATIC_ASSETS) {
  const p = resolve(root, asset);
  if (!existsSync(p)) {
    console.error(`✖ Missing static asset: ${asset}`);
    errors++;
  }
}

for (const pkg of PACKAGES) {
  const p = resolve(root, pkg);
  if (!existsSync(p)) {
    console.error(`✖ Missing package file: ${pkg}`);
    errors++;
  }
}

// JSON parsing validations
try {
  JSON.parse(readFileSync(resolve(root, 'public/openapi.json'), 'utf-8'));
  JSON.parse(readFileSync(resolve(root, 'public/horologium.postman_collection.json'), 'utf-8'));
  JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf-8'));
} catch (e) {
  console.error(`✖ JSON parsing failed: ${e.message}`);
  errors++;
}

if (errors === 0) {
  console.log(`✔ All ${CANONICAL_PAGES.length} canonical pages verified.`);
  console.log(`✔ All ${STATIC_ASSETS.length} static assets verified.`);
  console.log(`✔ All ${PACKAGES.length} client package files verified.`);
  console.log('✔ System architecture integrity: 100% NOMINAL');
  process.exit(0);
} else {
  console.error(`✖ Integrity check failed with ${errors} error(s).`);
  process.exit(1);
}
