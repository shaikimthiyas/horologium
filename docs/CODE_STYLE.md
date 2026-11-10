# ⬡ HOROLOGIUM: CODE STYLE & ENGINEERING CONVENTIONS
**System Classification:** Technical Architecture & Engineering Standards
**Calibre Specification:** Calibre-01
**Lead Architect:** Shaik Imthiyas
**Status:** Canonical Engineering Guideline

---

## 1. Core Engineering Philosophy

Horologium is built on the principle of **computational austerity and maximum fidelity**. We write standard ECMAScript modules, rely on native browser capabilities (`Intl.DateTimeFormat`, SVG trigonometry, Web Components), and avoid runtime bloat, CSS-in-JS abstractions, and unnecessary third-party dependencies.

---

## 2. Directory & Module Structure

```text
horologium/
├── index.html                  # Root intro & planetary tourbillon entrypoint
├── pages/                      # Multi-page application consoles
│   ├── horo/                   # Main time workbench & overlap planner
│   ├── flight-deck/            # Full-viewport interactive world map
│   ├── geodesic-registry/      # 220-country timezone directory
│   ├── developers/             # Developer platform & API key studio
│   ├── api-explorer/           # Interactive OpenAPI 3.1 & Swagger sandbox
│   ├── operator-gateway/       # Account & operator authentication
│   ├── protocol-liaison/       # Contact & technical support
│   ├── status/                 # Live subsystem health & probe console
│   ├── about/                  # Builder manifesto & technical colophon
│   ├── privacy/                # Zero-tracking data sovereignty policy
│   └── 404.html                # Temporal recovery page
├── src/                        # Client-side core logic
│   ├── components/             # Reusable UI modules & navigation
│   ├── data/                   # Canonical datasets (countries, timezones)
│   ├── styles/                 # Design system tokens, base, layout CSS
│   └── utils/                  # Chronometry, SNTP, solar math, audio
├── server/                     # Backend microservices & persistence
│   ├── cache/                  # Redis connection & caching layer
│   ├── controllers/            # HTTP endpoint controller logic
│   ├── db/                     # SQLite WAL & PostgreSQL adapters
│   ├── middleware/             # Rate limiters, auth, health probes, Zod
│   ├── routes/                 # Express API & Embed route definitions
│   └── services/               # SNTP WebSocket, Marzullo consensus
├── packages/                   # Published packages & libraries
│   └── client/                 # @horologium/client Universal SDK
├── public/                     # Static assets, Web Components, manifests
│   ├── sdk/                    # Standalone client SDK bundle
│   ├── widgets/                # Web Component script distribution
│   └── cover.png               # Canonical project cover visual
├── tests/                      # Automated test suites (node:test)
│   ├── unit/                   # Unit & algorithmic tests
│   └── integration/            # HTTP & database integration tests
└── docs/                       # Canonical system documentation
```

---

## 3. Language & Runtime Standards

- **ECMAScript Standards:** Node.js `>= 20.10.0` (LTS) with `"type": "module"`. Standard ESM `import`/`export` syntax everywhere. CommonJS (`require()`) is strictly prohibited in project code.
- **Client Runtime:** Modern Evergreen Browsers (Chrome 110+, Safari 16.4+, Firefox 115+, Edge 110+). Zero polyfills for baseline ECMAScript 2022 features.
- **TypeScript:** Used in SDK and client package typings (`packages/client/index.d.ts`). Clean JSDoc annotations in core source files.

---

## 4. Naming Conventions

| Entity | Convention | Example |
| :--- | :--- | :--- |
| **Source Modules** | `camelCase.js` | `sntpClient.js`, `solarTerminator.js` |
| **Page Endpoints** | `kebab-case/index.html` | `pages/geodesic-registry/index.html` |
| **Documentation** | `UPPER_SNAKE_CASE.md` | `ARCHITECTURE.md`, `CODE_STYLE.md` |
| **Classes** | `PascalCase` | `ClockSlewController`, `HorologiumClient` |
| **Web Components** | `kebab-case` with namespace | `<horologium-clock>`, `<horologium-overlap>` |
| **Functions & Methods**| `camelCase` with active verb | `calculateOverlap()`, `getAtomicTime()` |
| **Constants & Enums** | `SCREAMING_SNAKE_CASE` | `COUNTRIES_DATA`, `DEFAULT_RATE_LIMIT` |
| **CSS Variables** | `--kebab-case` | `--bg-canvas`, `--accent-primary`, `--ctrl-md` |

---

## 5. Temporal Formatting & Tabular Numeral Rules

Time displays must be mathematically stable. Layout jumping or character vibration during high-frequency millisecond ticks degrades visual credibility:

1. **Tabular Numerals Enforcement:** Every clock, timestamp, coordinate, or offset must use `font-variant-numeric: tabular-nums slashed-zero` or the utility class `.tnum` / `.font-mono`.
2. **Fixed Padding:** All hours, minutes, and seconds must be 2-digit zero-padded:
   ```javascript
   // Correct:
   const hh = String(date.getUTCHours()).padStart(2, '0');
   const mm = String(date.getUTCMinutes()).padStart(2, '0');
   const ss = String(date.getUTCSeconds()).padStart(2, '0');
   ```
3. **Monotonic Measurement:** Never use `new Date().getTime()` or `Date.now()` to compute elapsed time or delta physics. Always use:
   - In browser: `performance.now()`
   - In Node.js: `process.hrtime.bigint()`
4. **Clock Slewing Law:** The client clock must never tick backwards ($dt/dt \ge 0$). Adjust offsets smoothly at $\le 0.5\text{ms/ms}$ slew rates.

---

## 6. CSS & Design System Discipline

We reject utility-class sprawl (e.g. Tailwind). CSS must be semantic, maintainable, and tokenized:

1. **Tokens Over Hardcoded Hex:** Always reference tokens from [tokens.css](file:///D:/01_PROJECTS/ACTIVE/Horologium/src/styles/tokens.css):
   ```css
   /* Correct */
   background-color: var(--bg-surface-1);
   color: var(--text-primary);
   border: 1px solid var(--border-subtle);

   /* Prohibited */
   background-color: #12151e;
   color: #ffffff;
   ```
2. **Unified Button Cadence:** All interactive controls must align to standard control height tokens:
   - `--ctrl-sm: 32px`: Secondary navigation, tags, icon pills.
   - `--ctrl-md: 36px`: Action buttons, input fields, test triggers.
   - `--ctrl-lg: 40px`: Primary hero call-to-actions.
3. **Vertical Alignment:** Every button and button-like anchor must declare:
   ```css
   display: inline-flex;
   align-items: center;
   justify-content: center;
   box-sizing: border-box;
   line-height: 1;
   vertical-align: middle;
   ```
4. **WCAG 2.2 AAA Contrast:** Foreground-to-background contrast must maintain $\ge 7:1$ across both `Obsidian Rhodium` (dark) and `Silvered Dial` (light) themes.

---

## 7. Error Handling & API Standards

1. **RFC 7807 Problem Details:** All API errors must return `application/problem+json`:
   ```json
   {
     "type": "https://horologium.io/errors/invalid-timezone",
     "title": "Invalid Timezone",
     "status": 400,
     "detail": "Unknown timezone identifier: 'Mars/Curiosity'.",
     "instance": "/api/v1/time"
   }
   ```
2. **Zero Uncaught Promises:** Asynchronous routes must use `try`/`catch` with centralized error middleware.
3. **No Console Pollutants:** Remove all debug `console.log` statements before commit. Use structured `console.info` or `console.warn` only for server lifecycle milestones.

---

## 8. Test Suite Conventions

Tests are written using the native Node.js test runner (`node:test`) and assertion library (`node:assert/strict`):

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Timezone Delta Calculation', () => {
  test('computes exact 9-hour delta between UTC and Asia/Tokyo', () => {
    const delta = computeDelta('UTC', 'Asia/Tokyo');
    assert.equal(delta, 9);
  });
});
```

Run test suite:
```bash
npm test          # Runs all 19 suites with concurrency=1
npm run verify    # Validates architectural integrity
```

---

## 9. Commit Message Specification

Follow **Conventional Commits** (`type(scope): imperative description`):
- `feat(map)`: Add solar terminator path clipping.
- `fix(sntp)`: Eliminate jitter in round-trip latency calculation.
- `chore(deps)`: Upgrade dev dependencies.
- `docs(api)`: Document meeting overlap query parameters.
- `test(e2e)`: Verify zero-knowledge client calculations.

