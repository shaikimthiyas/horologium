# Changelog

All notable changes to the **HOROLOGIUM** distributed chronometry architecture are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-10-25

### Added - Sprint I (Interactive OpenAPI 3.1 Swagger UI & Postman)
- Interactive Dual-Mode API Explorer (`/api-explorer/`): Calibre-01 HUD + Official embedded Swagger UI (OpenAPI 3.1.0).
- Official Postman Collection v2.1.0 (`public/horologium.postman_collection.json`) with embedded automated test assertions.
- Standardized RFC 7807 `ProblemDetails` schema definitions and Kubernetes probe endpoints (`/healthz`, `/readyz`, `/startupz`, `/metrics`).
- Dedicated unit test suite `tests/unit/openApiSwagger.test.js` (74 passing tests total).

---

## [1.3.0] - 2026-10-24

### Added - Sprint H (PWA & Offline Marine Chronometer Engine)
- Progressive Web App Service Worker (`public/sw.js` v1.4.0) with multi-strategy caching and synthetic offline API fallbacks.
- Enhanced Web App Manifest (`public/manifest.webmanifest`) with canonical shortcuts and standalone display mode.
- PWA Lifecycle Controller (`src/utils/pwaManager.js`) capturing `beforeinstallprompt` and queuing offline telemetry.
- Temperature-Compensated Crystal Oscillator (TCXO) mathematical drift simulation in `ClockFSM` during network severance.
- Dynamic `⬇ INSTALL` button and `OFFLINE (TCXO)` indicator in Master HUD.

---

## [1.2.0] - 2026-10-23

### Added - Sprints E & F (Mission Gateway & Master UI/UX HUD)
- Sovereign Navigation Header (`masterHeader.js`) with persistent UTC chronometer and ClockFSM telemetry pill.
- Global accessible keyboard shortcuts (<kbd>1</kbd>–<kbd>6</kbd>, <kbd>M</kbd>, <kbd>T</kbd>, <kbd>?</kbd>).
- WCAG 2.2 AAA mathematical contrast compliance ($\ge 7:1$) and Fitts's law coarse pointer touch targets ($\ge 44\text{px}$).
- Executive Engineering Audit (`docs/audit/EXECUTIVE_SUMMARY.md`) and Requirement Traceability Matrix (100% M1.1–M2.21 compliance).

---

## [1.1.0] - 2026-10-22

### Added - Sprint D (Frontend Hardening & Finite State Machine)
- Deterministic 7-state Clock Finite State Machine (`ClockFSM`).
- WebGL context loss and dynamic recovery engine in `globeWebGL.js`.
- Calibre-01 Global Error Boundary with structured diagnostic reporting and graceful fallback.
- Audio haptics synthesizer with mute control and autoplay policy resilience.
- Upgraded high-resolution visual branding (`public/cover.jpg`, 2752×1536).

---

## [1.0.0] - 2026-10-21

### Added - Sprints A, B & C (Enterprise Core, DevOps & CI/CD)
- Multi-source Marzullo intersection consensus algorithm for atomic NTP filtering.
- Client-side smooth clock slewing controller (Linux `adjtime` emulation).
- Kubernetes-standard health probes (`/healthz`, `/readyz`, `/startupz`).
- RFC 7807 Problem Details error formatting and Zod schema validation.
- Multi-stage production `Dockerfile` and `docker-compose.yml` (Gateway + TimescaleDB + Redis + Prometheus + Grafana).
- GitHub Actions CI workflow testing Node 20.x, 22.x, and Go 1.22 Stratum-1 server.
