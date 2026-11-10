# ⬡ HOROLOGIUM: SECURITY ARCHITECTURE & THREAT MODEL
**System Classification:** Enterprise Chronometry & Distributed Telemetry Engine
**Calibre Specification:** Calibre-01
**Lead Architect:** Shaik Imthiyas
**Status:** Canonical Security Specification

---

## 1. Security Philosophy & Governing Posture

Horologium is designed on a **defense-in-depth, zero-knowledge client architecture**. Because chronometry data, system time synchronization, and cross-border scheduling often interface with corporate calendars, enterprise log pipelines, and internal infrastructure, security is treated as an immutable structural constraint rather than a perimeter afterthought.

---

## 2. Threat Model & Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                      UNTRUSTED CLIENT ZONE                      │
│  - Browser Client / Progressive Web App                         │
│  - Embeddable Widget Iframes (<horologium-clock>)               │
│  - Third-party Integrations (Notion, Confluence, React apps)   │
└────────────────┬───────────────────────────────┬────────────────┘
                 │ TLS 1.3 / HTTPS               │ WSS (Encrypted Socket)
                 ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE REVERSE PROXY & GATEWAY                 │
│  - Strict Frame-Ancestors Policy for /embed/*                   │
│  - Distributed Redis Sliding-Window Rate Limiter                │
│  - SHA-256 Scoped API Key Authenticator                         │
│  - Zod Request Schema Validator (Strict Type Enforcement)       │
└────────────────┬───────────────────────────────┬────────────────┘
                 │ Internal VPC / IPC
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTERNAL SERVICES & STORAGE                  │
│  - Stratum-1 NTP Engine & Marzullo Consensus                    │
│  - Embedded SQLite (WAL Mode) / PostgreSQL 16 TimescaleDB       │
│  - Native scrypt Key Derivation & Timing-Safe Verification      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Security Subsystems

### 3.1 Zero-Knowledge Client Chronometry
- **Local Browser Execution:** All solar declination trigonometry, meridian projections, and 24-hour meeting overlap calculations execute directly inside the user's browser using native `Intl.DateTimeFormat` and JavaScript Math APIs.
- **Zero Geo-Tracking:** User geographic coordinates, IP locations, and selected timezone pairs are **never transmitted** to external tracking services, ad networks, or telemetry collectors.
- **Cookie-Free Architecture:** Horologium sets no tracking cookies, analytics pixels, or canvas fingerprinting scripts.

### 3.2 Cryptographic API Key Lifecycle & Storage
- **Key Generation:** Keys use the standard prefix `hlg_live_` followed by 24 cryptographically random bytes generated via `node:crypto`'s `randomBytes(24)` (48 hex characters).
- **One-Way Hashing:** Raw keys are displayed to developers **only once** upon provisioning. The database stores exclusively the deterministic **SHA-256** hash:
  $$\text{KeyHash} = \text{SHA-256}(\text{RawKey})$$
- **Prefix Scoping:** A 15-character public prefix (`key_prefix`, e.g. `hlg_live_8f3a9b`) is stored to allow audit identification and UI display without compromising the secret.
- **Domain Whitelisting (CORS):** Keys can be scoped to specific allowed origin domains (`allowed_domains`), preventing unauthorized key extraction or reuse in client-side web apps.
- **Rate Limit Tiers:** Standard developer keys enforce a default limit of 1,200 requests/minute (20 requests/second).

### 3.3 Operator Authentication & Password Security
- **scrypt Key Derivation:** Passwords are never stored in plaintext or MD5/SHA-1 hashes. Storage uses native `scryptSync` with:
  - 16-byte cryptographically secure random salt (`randomBytes(16)`).
  - 64-byte derived key length.
  - $N=16384$, $r=8$, $p=1$ memory and CPU cost parameters.
- **Timing Side-Channel Protection:** Verification uses `crypto.timingSafeEqual` across equal-length buffers to eliminate statistical execution-time variance attacks.

### 3.4 Distributed Sliding-Window Rate Limiting
- **Redis Sorted Sets:** Rate limiting uses atomic sliding-window transactions (`ZREMRANGEBYSCORE`, `ZADD`, `ZCARD`, `EXPIRE`) to prevent burst clustering at minute boundaries:
  - **General API Gateway:** 180 requests/minute per client IP / API key.
  - **Inquiry & Transmission Endpoint:** 5 requests/5 minutes per IP terminal to mitigate spam and socket flooding.
- **In-Memory Fallback:** When Redis is unavailable, an embedded sliding-window ring buffer ensures protection remains active without service interruption.

### 3.5 WebSocket SNTP Frame Guard
- **Frame Limit:** The `/ws/sntp` WebSocket server enforces a strict maximum frame payload of **1,024 bytes (1 KB)** (`maxPayload: 1024`).
- **Memory Exhaustion Defense:** Malformed, oversized, or non-JSON WebSocket packets are immediately rejected and the socket terminated, preventing Node.js event-loop buffer saturation.
- **Heartbeat Dead-Socket Pruning:** Sockets are tracked with periodic `ping`/`pong` intervals. Unresponsive clients are culled after 30 seconds of inactivity.

### 3.6 Strict Input Validation & RFC 7807 Error Handling
- **Zod Schema Contracts:** All HTTP query strings, route parameters, and JSON payloads pass through compiled Zod schema validators before controller execution.
- **No Stack Leakage:** Production error responses adhere strictly to RFC 7807 Problem Details (`application/problem+json`). Internal stack traces, SQL syntax, or filesystem paths are never returned to clients.

### 3.7 Content Security Policy & Embed Security
- **Isolated Embed Routes:** `/embed/*` routes permit iframe framing (`X-Frame-Options: ALLOWALL` and `Content-Security-Policy: frame-ancestors *`) solely for widget cards.
- **Hardened Console Pages:** Operator dashboards, API Explorer, and workbench interfaces are protected against clickjacking via strict frame-ancestor constraints.

---

## 4. Vulnerability Disclosure Policy

We welcome vulnerability disclosures from security researchers. Disclosures should be made responsibly:

1. **Private Reporting:** Send an encrypted email to `shaik.imthiyas.t@gmail.com` with the subject tag `[SECURITY] Horologium Vulnerability Report`.
2. **Do Not Open Public Issues:** Never post proof-of-concept exploits, zero-days, or reproduction steps in public GitHub issues or discussions.
3. **Required Information:**
   - Affected endpoint or component (e.g. Express Gateway, WebSocket SNTP, Rate Limiter, SQLite engine).
   - Step-by-step reproduction guide or curl command.
   - Assessed impact (DoS, bypass, memory leak, timing anomaly).

### Response SLA Commitments
- **Initial Acknowledgment:** Within 24 hours.
- **Triage & Severity Confirmation:** Within 48 hours.
- **Patch Deployment:** Within 7 business days for Critical / High severity CVEs.
- **Coordinated Disclosure:** Public release notes and CVE credit published upon fix release.

