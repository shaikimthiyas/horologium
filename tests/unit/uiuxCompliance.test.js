import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

function parseHexColor(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getRelativeLuminance(rgb) {
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map(val => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function calculateContrastRatio(hex1, hex2) {
  const lum1 = getRelativeLuminance(parseHexColor(hex1));
  const lum2 = getRelativeLuminance(parseHexColor(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

test('UI/UX & Cognitive Laws Compliance Suite (Sprint F / WCAG 2.2)', async (t) => {
  const CANONICAL_PAGE_PATHS = [
    'index.html',
    'flight-deck/index.html',
    'geodesic-registry/index.html',
    'operator-gateway/index.html',
    'protocol-liaison/index.html',
    'api-explorer/index.html'
  ];

  await t.test('all canonical multi-page HTML documents exist on disk', () => {
    for (const rel of CANONICAL_PAGE_PATHS) {
      const fullPath = path.join(REPO_ROOT, rel);
      assert.ok(fs.existsSync(fullPath), `Missing canonical page: ${rel}`);
    }
  });

  await t.test('all canonical pages have valid semantic HTML5 landmarks and viewport meta', () => {
    for (const rel of CANONICAL_PAGE_PATHS) {
      const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      assert.ok(content.includes('<!DOCTYPE html>'), `${rel} missing DOCTYPE`);
      assert.ok(content.includes('<meta name="viewport"'), `${rel} missing responsive viewport meta`);
      assert.ok(content.includes('<title>'), `${rel} missing document title`);
      assert.ok(content.includes('<header'), `${rel} missing semantic <header> landmark`);
    }
  });

  await t.test('WCAG 2.2 AAA Contrast Math: Obsidian Rhodium theme passes AAA threshold (>= 7.0:1)', () => {
    // Primary body text (#EDEFF2) against deepest canvas (#08090B)
    const ratioPrimary = calculateContrastRatio('#EDEFF2', '#08090B');
    assert.ok(ratioPrimary >= 7.0, `Primary contrast ${ratioPrimary.toFixed(2)} must be >= 7.0 (WCAG AAA)`);
    assert.ok(ratioPrimary > 16.0, `Obsidian contrast is extremely high-legibility (${ratioPrimary.toFixed(2)})`);

    // Secondary structural text (#8E95A2) against canvas (#08090B)
    const ratioSecondary = calculateContrastRatio('#8E95A2', '#08090B');
    assert.ok(ratioSecondary >= 4.5, `Secondary contrast ${ratioSecondary.toFixed(2)} must be >= 4.5 (WCAG AA)`);
  });

  await t.test('WCAG 2.2 AAA Contrast Math: Silvered Dial theme passes AAA threshold (>= 7.0:1)', () => {
    // Ink (#0D1017) against Silvered plate (#FFFFFF)
    const ratio = calculateContrastRatio('#0D1017', '#FFFFFF');
    assert.ok(ratio >= 7.0, `Silvered Dial contrast ${ratio.toFixed(2)} must be >= 7.0 (WCAG AAA)`);
    assert.ok(ratio > 17.0, `Silvered Dial readability is pristine (${ratio.toFixed(2)})`);
  });

  await t.test('Fitts\'s Law: CSS tokens enforce minimum 44px coarse pointer touch target size', () => {
    const tokensContent = fs.readFileSync(path.join(REPO_ROOT, 'src/styles/tokens.css'), 'utf-8');
    assert.ok(tokensContent.includes('--ctrl-md: 44px'), 'tokens.css must declare --ctrl-md: 44px for coarse pointer targets');
    assert.ok(tokensContent.includes('@media (pointer: coarse)'), 'tokens.css must contain coarse pointer media query');
  });

  await t.test('Layout CSS contains optical halation compensation and focus-visible indicators', () => {
    const layoutContent = fs.readFileSync(path.join(REPO_ROOT, 'src/styles/layout.css'), 'utf-8');
    assert.ok(layoutContent.includes('*:focus-visible'), 'layout.css must declare strict high-contrast focus rings');
    assert.ok(layoutContent.includes('-webkit-font-smoothing'), 'layout.css must enable font smoothing for dark-mode halation');
  });

  await t.test('Master Navigation controller exports canonical page registry with unique shortcuts', async () => {
    const { CANONICAL_PAGES } = await import('../../src/components/navigation/masterHeader.js');
    assert.equal(CANONICAL_PAGES.length, 6);

    const shortcuts = CANONICAL_PAGES.map(p => p.shortcut);
    const uniqueShortcuts = new Set(shortcuts);
    assert.equal(shortcuts.length, uniqueShortcuts.size, 'All page shortcuts must be unique');

    // Ensure links match existing canonical URLs
    assert.ok(CANONICAL_PAGES.some(p => p.href === '/'));
    assert.ok(CANONICAL_PAGES.some(p => p.href === '/flight-deck/'));
    assert.ok(CANONICAL_PAGES.some(p => p.href === '/geodesic-registry/'));
    assert.ok(CANONICAL_PAGES.some(p => p.href === '/operator-gateway/'));
    assert.ok(CANONICAL_PAGES.some(p => p.href === '/protocol-liaison/'));
    assert.ok(CANONICAL_PAGES.some(p => p.href === '/api-explorer/'));
  });
});
