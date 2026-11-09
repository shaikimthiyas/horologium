# Horologium Content Inventory

This inventory captures the visible text surfaces, microcopy, headings, and labels across all 12 canonical application consoles.

---

## 1. Intro Stage (`index.html`)
- **Header:** `HOROLOGIUM // CALIBRE-01 STRATUM-1 TELEMETRY`, `SYSTEM OPERATIONAL · 99.999% SLA · GENEVA STRATUM-1`, `ENTER HOROLOGIUM SPACE →`, `ARCHITECT: SHAIK IMTHIYAS`.
- **Main Readout:** `HOROLOGIUM // CALIBRE-01`, `SWISS HOROLOGICAL PLANETARY TELEMETRY ENGINE`, `UTC [TIME] GMT (GENEVA)`, `[ STRATUM-1 SYNC: 99.999% ]`, `[ NTP ]`, `[ 220+ NATIONS ]`.
- **Telemetry Footer:**
  - `LOCKED [01/04] STRATUM-1 UTC REFERENCE SYNCED`
  - `VERIFIED [02/04] 220 SOVEREIGN GEODESIC BOUNDARIES`
  - `RESOLVED [03/04] ASTRONOMICAL SOLAR TERMINATOR`
  - `ARMED [04/04] MARZULLO 99.999% SLO NOMINAL`
- **Assessment:** Heavy sci-fi / military jargon ("ARMED", "LOCKED", "TELEMETRY ENGINE"). While maintaining the high-craft Swiss watchmaking Calibre-01 identity, the copy should feel composed, dignified, and editorial rather than like an arcade flight simulator.

---

## 2. Hero Workbench (`horo/index.html`)
- **Hero Title:** `The world's time, mapped to the second.`
- **Hero Subtitle:** `Compare global time zones, find overlapping business hours, and track live daylight across 220 regions.`
- **Buttons:** `Open World Map`, `Compare Time Zones`.
- **Cards:**
  - `YOUR LOCAL TIME` (with atomic clock dial and sync indicator)
  - `Meeting Overlap Planner` (Station A vs. Station B, 24-Hour Timeline, Golden Window)
  - `Day & Night Map` (2D Map / 3D Globe toggle, Subsolar Meridian readout)
  - `World Clock Directory` (Search 220 sovereign nations and 470 global cities)
- **Assessment:** Clean core layout, but contains occasional decorative dashes and artificial sci-fi badges in sub-panels.

---

## 3. Flight Deck (`flight-deck/index.html`)
- **HUD Readouts:** `RETICLE: LAT +00.00° · LON +000.00°`, `UTC+00:00`.
- **Controls:** `Toggle 12H / 24H Military Format`, `Toggle Avionics Night Deck / Paper Atlas`.
- **Assessment:** Technical navigation labels need to be grounded in astronomical geography. "Military Format" should simply be "24-Hour Format".

---

## 4. Geodesic Registry (`geodesic-registry/index.html`)
- **Title:** `GEODESIC SOVEREIGN REGISTRY`
- **Description:** `Global Timezone Coordinates & Territorial Meridian Directory`
- **Search Placeholder:** `Filter territories by ISO code, country, or capital city...`
- **Assessment:** Needs sentence case or clean title case, removing overly militaristic "geodesic sovereign" phrasing in favor of clear "Global Timezone & Country Directory".

---

## 5. Operator Gateway (`operator-gateway/index.html`)
- **Title:** `CRYPTOGRAPHIC OPERATOR CLEARANCE`
- **Description:** `Station Authorization & Persistent Local Telemetry Cache`
- **Assessment:** High severity of artificial security jargon ("Cryptographic Operator Clearance", "Secure Node"). In reality, this is the user's **Settings & Preferences** console (configuring home station, time display preferences, IndexedDB offline cache management). Needs complete editorial grounding.

---

## 6. Protocol Liaison (`protocol-liaison/index.html`)
- **Title:** `TRANSMISSION PROTOCOL LIAISON`
- **Description:** `Operator Inquiry Dispatch & Cryptographic Telemetry Log`
- **Assessment:** Artificial sci-fi terminology ("Transmission Protocol Liaison", "Inquiry Dispatch"). This is the **Contact, Feedback & Support** console. Should be written like Stripe or Linear: clear, helpful, respectful of the user's time.

---

## 7. Developer Portal (`developers/index.html`)
- **Title:** `DEVELOPER PLATFORM // API & EMBEDDABLE WIDGETS`
- **Description:** High-precision chronometry SDK, embeddable W3C Custom Elements, and developer API key governance.
- **Assessment:** Well-engineered; needs review to ensure rate limits and code examples are presented with zero hyperbole.

---

## 8. About & Colophon (`about/index.html`)
- **Title:** `COLOPHON // CALIBRE-01 ARCHITECTURE`
- **Description:** Documentation of design tokens, mechanical typography, and builder notes.
- **Assessment:** Maintain Shaik Imthiyas sovereign attribution while ensuring tone is confident, humble, and mathematically precise.

---

## 9. Status Console (`status/index.html`)
- **Title:** `SYSTEM STATUS & SLA AVAILABILITY`
- **Description:** Live probes against Kubernetes `/healthz`, `/readyz`, `/metrics`.
- **Assessment:** Ensure all SLA metrics reflect real probe results rather than decorative hardcoded badges.

---

## 10. Privacy & Data Sovereignty (`privacy/index.html`)
- **Title:** `ZERO-KNOWLEDGE DATA SOVEREIGNTY POLICY`
- **Description:** Client-side computation, no tracking cookies, local storage privacy.
- **Assessment:** Ground policy in factual RFC 9557 compliance and transparent local storage explanations.

---

## 11. Error Console (`404.html`)
- **Title:** `404 // TEMPORAL DISCONTINUITY`
- **Description:** Radar sweep graphic with navigation recovery links.
- **Assessment:** Ensure recovery navigation is primary, friendly, and helpful.
