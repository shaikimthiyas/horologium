# Factual Claims & Technical Implementation Audit

This document traces user-facing claims directly to their backend and frontend code implementations.

| User-Facing Claim | Claimed Property | Implementation Location | Verification Status | Action |
| :--- | :--- | :--- | :--- | :--- |
| **Marzullo Consensus** | Multi-source NTP intersection algorithm filtering falsetickers | `server/services/ntpService.js` (`calculateMarzulloConsensus`) | **VERIFIED.** Actual mathematical implementation sorting intervals. | **KEEP**, but explain clearly without sci-fi decorations. |
| **Monotonic Clock Slewing** | Smooth drift adjustment without backwards time jumps | `src/utils/clockSlew.js` (`ClockSlewController`) | **VERIFIED.** Actual slew integrator with rate limiting. | **KEEP.** |
| **Solar Terminator** | Real-time calculation of subsolar coordinates & twilight bands | `src/utils/solarTerminator.js` & `timeMath.js` | **VERIFIED.** Spherical trigonometry with declination and meridian calculation. | **KEEP.** |
| **TCXO Quartz Drift** | Simulation of quartz oscillator thermal drift when offline | `src/utils/clockFSM.js` (`simulateQuartzDrift`) | **VERIFIED.** Quadratic thermal drift model running when disconnected. | **KEEP.** |
| **Zero-Knowledge Privacy** | No remote user tracking; local storage of preferences | `server/app.js` (no tracking cookies), `public/sw.js` | **VERIFIED.** No third-party analytics or external telemetry scripts. | **KEEP.** |
| **API Rate Limits** | Tiered rate limiting per developer API key | `server/middleware/apiKeyMiddleware.js` | **VERIFIED.** Cryptographic SHA-256 keys with 60/300/1200 RPM counters. | **KEEP.** |
| **99.999% SLA** | Continuous guaranteed uptime | `status/index.html` | **PARTIAL.** Measured availability target is 99.99%. | **REWRITE** to state target honestly as `99.99% Availability Target`. |
| **Cryptographic Clearance** | Cryptographic authentication in `operator-gateway` | `operator-gateway/index.html` | **UNSUPPORTED.** The page manages local client stations in IndexedDB. | **REWRITE** to `Settings & Base Stations`. |
| **Radio-Frequency Transmission** | RF dispatch in `protocol-liaison` | `protocol-liaison/index.html` | **UNSUPPORTED.** The page is an HTTP contact & feedback form. | **REWRITE** to `Contact & Inquiries`. |
| **Military Time Format** | Military time toggle in `flight-deck` | `flight-deck/index.html` | **UNSUPPORTED.** It is standard 24-hour time formatting (`Intl.DateTimeFormat`). | **REWRITE** to `24-Hour Format`. |
