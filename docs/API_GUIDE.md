# ⬡ HOROLOGIUM: DEVELOPER API & INTEGRATION GUIDE
**System Classification:** Canonical REST & WebSocket Telemetry Protocol Specification
**Calibre Specification:** Calibre-01
**Lead Architect:** Shaik Imthiyas
**Status:** Production-Ready Specification (OpenAPI 3.1 & RFC 9557 Compliant)

---

## 1. Overview & Connection Architecture

Horologium exposes high-precision time synchronization, daylight boundary computations, cross-border meeting overlap algorithms, and geodesic country catalogs through standard HTTP REST and WebSocket SNTP interfaces.

- **Base URL (Local):** `http://localhost:3001`
- **Base URL (Production):** `https://horologium.io` (or your edge deployment host)
- **Content Type:** `application/json`
- **Error Standard:** RFC 7807 Problem Details (`application/problem+json`)
- **OpenAPI 3.1 Specification:** Available at [`/openapi.json`](file:///D:/01_PROJECTS/ACTIVE/Horologium/public/openapi.json) or interactively at [`/api-explorer/`](http://localhost:5173/api-explorer/)
- **Postman Collection:** Downloadable directly from [`/horologium.postman_collection.json`](file:///D:/01_PROJECTS/ACTIVE/Horologium/public/horologium.postman_collection.json)

---

## 2. Authentication & API Key Management

Public read endpoints (such as `/api/v1/time` and `/api/v1/countries`) are openly accessible for low-frequency queries. Enterprise applications and high-frequency widgets authenticate using an API key:

### Supplying the Key
Pass your key via either HTTP header:
```http
X-Horologium-Key: hlg_live_0123456789abcdef0123456789abcdef
```
or
```http
Authorization: Bearer hlg_live_0123456789abcdef0123456789abcdef
```

### Key Provisioning
Generate a free key instantly with no credit card required via [`POST /api/v1/developers/keys`](#post-apiv1developerskeys) or the [Developer Portal](http://localhost:5173/developers/).

---

## 3. Rate Limiting & Quotas

The API enforces distributed sliding-window rate limiting backed by Redis (with local fallback):

| Client Tier | Rate Limit | Scope |
| :--- | :--- | :--- |
| **Anonymous / Public** | 180 requests / minute | Per IP address |
| **Developer API Key** | 1,200 requests / minute | Per API Key across allowed domains |
| **Contact Transmissions** | 5 requests / 5 minutes | Per IP address |

Response headers provide real-time quota telemetry:
```http
X-RateLimit-Limit: 1200
X-RateLimit-Remaining: 1198
X-RateLimit-Reset: 1731234567
```

---

## 4. Standard Error Format (RFC 7807)

When an error occurs, the server returns an RFC 7807 Problem Details payload:

```json
{
  "type": "https://horologium.io/errors/invalid-parameters",
  "title": "Validation Error",
  "status": 400,
  "detail": "Invalid IANA timezone identifier: 'Unknown/City'.",
  "instance": "/api/v1/time"
}
```

---

## 5. REST Endpoints Reference

### `GET /api/v1/time`
Returns synchronized UTC time, epoch timestamp, astronomical solar declination, and subsolar meridian coordinates.

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `timezone` / `tz` | string | Optional | Target IANA timezone (e.g. `Europe/Zurich`, `Asia/Tokyo`). Default: `UTC`. |

#### Response (`200 OK`)
```json
{
  "utcTime": "2026-11-10T09:20:00.000Z",
  "epochMs": 1794216000000,
  "timezone": "Europe/Zurich",
  "civilTime": "10:20:00",
  "utcOffset": "UTC+01:00",
  "solarDeclinationDeg": -17.31,
  "subsolarLongitudeDeg": 18.25,
  "isDaylightSaving": false,
  "stratum": 1,
  "accuracy": "99.99%"
}
```

---

### `GET /api/v1/zones/overlap`
Computes the 24-hour mutual working hour overlap matrix and optimal meeting window between any two global timezones.

#### Query Parameters
| Parameter | Type | Required | Default |
| :--- | :--- | :--- | :--- |
| `stationA` | string | Optional | `Europe/London` |
| `stationB` | string | Optional | `Asia/Tokyo` |

#### Response (`200 OK`)
```json
{
  "stationA": "Europe/London",
  "stationB": "Asia/Tokyo",
  "deltaHours": 9,
  "calculatedAt": "2026-11-10T09:20:00.000Z",
  "overlapHours": [
    {
      "hourUtc": 9,
      "hourA": 9,
      "hourB": 18,
      "isGoldenOverlap": true,
      "isOneSided": true
    }
  ],
  "source": "COMPUTED"
}
```

---

### `GET /api/v1/stratum1/sync`
Returns live Marzullo consensus diagnostics across active Stratum-1 atomic references.

#### Response (`200 OK`)
```json
{
  "status": "SYNCHRONIZED",
  "algorithm": "MARZULLO_INTERSECTION_CONSENSUS",
  "skewMs": 0.12,
  "roundTripDelayMs": 2.4,
  "stratum": 1,
  "sourcesSampled": 4,
  "sourcesAccepted": 4,
  "synchronizedAt": "2026-11-10T09:20:00.000Z"
}
```

---

### `GET /api/v1/countries`
Lists 220 sovereign countries and territories indexed by ISO code, capital, IANA timezone, and standard UTC offset.

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `query` | string | Optional | Substring search by country name, capital, or code (e.g. `Japan`, `Paris`, `JP`). |
| `page` | integer | Optional | Pagination page (default: `1`). |
| `limit` | integer | Optional | Results per page (default: `50`, max: `250`). |

---

### `POST /api/v1/developers/keys`
Self-service provisioning endpoint to generate a developer API key.

#### Request Body
```json
{
  "tenantName": "Acme SaaS",
  "tenantEmail": "engineering@acme.com",
  "allowedDomains": "app.acme.com,acme.com"
}
```

#### Response (`201 Created`)
```json
{
  "status": "PROVISIONED",
  "apiKey": "hlg_live_8f3a9b1c7d2e4f0a5b6c7d8e9f0a1b2c",
  "keyPrefix": "hlg_live_8f3a9b",
  "tenantName": "Acme SaaS",
  "allowedDomains": "app.acme.com,acme.com",
  "rateLimitRpm": 1200
}
```

---

### `GET /api/v1/stream/time` (Server-Sent Events)
Live 1-Hertz streaming event feed delivering real-time atomic clock ticks and solar declination updates over a persistent HTTP connection.

```text
event: tick
data: {"utcTime":"2026-11-10T09:20:01.000Z","solarDeclinationDeg":-17.31,"subsolarLongitudeDeg":18.25}
```

---

### Kubernetes Health Probes
- `GET /healthz` (or `/livez`): Liveness probe returning `200 ALIVE`.
- `GET /readyz`: Readiness probe verifying database, cache, and NTP subsystems.
- `GET /startupz`: Startup probe confirming complete server initialization.
- `GET /metrics`: Prometheus / OpenMetrics scraping endpoint.

---

## 6. WebSocket SNTP Protocol (`ws://localhost:3001/ws/sntp`)

High-precision clients calibrate clock skew and round-trip delay using bidirectional RFC 4330 SNTP packet exchange:

```
CLIENT                                  SERVER
  │                                       │
  │─── { type: "SNTP_PROBE", t1 } ───────>│ (Records T2: Server Receive)
  │                                       │ (Records T3: Server Transmit)
  │<── { type: "SNTP_RESPONSE", ... } ───│
  │ (Records T4: Client Receive)          │
```

### Formulas
$$\text{Round-Trip Latency} = (T_4 - T_1) - (T_3 - T_2)$$
$$\text{Client Clock Skew} = \frac{(T_2 - T_1) + (T_3 - T_4)}{2}$$

---

## 7. Universal Client SDK Integration

Install from npm or reference the standalone bundle:

```bash
npm install @horologium/client
```

```javascript
import { HorologiumClient } from '@horologium/client';

const client = new HorologiumClient({
  endpoint: 'http://localhost:3001',
  apiKey: 'hlg_live_your_key_here'
});

// 1. Fetch live atomic time
const time = await client.getAtomicTime('Asia/Tokyo');
console.log(`Tokyo Time: ${time.civilTime}`);

// 2. Compute 24-hr team overlap
const overlap = client.calculateOverlap('America/New_York', 'Europe/London');
console.log(`Working delta: ${overlap.deltaHours} hours`);
```

---

## 8. Embeddable Web Components & Iframes

### Web Component (`<horologium-clock>`)
Include the script from your server:
```html
<script type="module" src="http://localhost:3001/widgets/horologium-widgets.js"></script>

<horologium-clock tz="Asia/Tokyo" city="Tokyo" theme="obsidian"></horologium-clock>
```

### Iframe Embed
```html
<iframe
  src="http://localhost:3001/embed/clock?tz=America/New_York&city=New+York&theme=obsidian"
  width="280"
  height="150"
  frameborder="0"
  style="border-radius: 8px; border: 1px solid #232838;">
</iframe>
```
