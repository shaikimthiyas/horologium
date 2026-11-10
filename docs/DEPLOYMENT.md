# ⬡ HOROLOGIUM: DEPLOYMENT & DEVOPS INFRASTRUCTURE GUIDE
**System Classification:** Production Deployment, Containerization & Orchestration Specification
**Calibre Specification:** Calibre-01
**Lead Architect:** Shaik Imthiyas
**Status:** Production-Ready Specification

---

## 1. Deployment Topology Overview

Horologium is architected to deploy across two environments:

1. **Standalone Zero-Configuration Deployment:** A single Node.js runtime running embedded SQLite (WAL mode) with in-memory caching. Requires only Node.js `>= 20.10.0` or a single Docker container.
2. **Enterprise Clustered Deployment:** Multi-tier containerized stack with Redis sliding-window caching, PostgreSQL 16 + TimescaleDB hypertables, an autonomous Go Stratum-1 UDP NTP time daemon, and Prometheus/Grafana observability.

---

## 2. Environment Variables Reference

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | integer | `3001` | HTTP and WebSocket listener port. |
| `HOST` | string | `0.0.0.0` | Network binding interface. |
| `NODE_ENV` | string | `development` | Environment mode (`development`, `production`, `test`). |
| `DATABASE_URL` | string | *(empty)* | PostgreSQL/TimescaleDB URI. If omitted, embedded SQLite WAL is used. |
| `REDIS_URL` | string | *(empty)* | Redis connection URI for rate limiting & cache. If omitted, in-memory engine is used. |
| `JWT_SECRET` | string | `horologium_dev_secret` | Secret key used to sign and verify operator session tokens. |
| `ALLOWED_ORIGINS` | string | `*` | Comma-delimited list of CORS allowed origins. |

---

## 3. Docker Deployment

### 3.1 Production Multi-Stage Container (`Dockerfile`)
The root [Dockerfile](file:///D:/01_PROJECTS/ACTIVE/Horologium/Dockerfile) implements an optimized 2-stage build:
- **Stage 1 (Builder):** Compiles multi-page HTML, minifies Vite asset bundles, and packages client assets.
- **Stage 2 (Runner):** Minimal Node.js 22 Alpine image, unprivileged `node` user, zero devDependencies, with an automated curl health check.

```bash
# Build the production image
docker build -t horologium:latest .

# Run standalone container
docker run -d \
  -p 3001:3001 \
  --name horologium-app \
  --restart unless-stopped \
  horologium:latest
```

### 3.2 Full Enterprise Stack (`docker-compose.yml`)
Spins up the complete clustered environment including TimescaleDB, Redis, Go NTP daemon, Prometheus, and Grafana:

```bash
# Start all 6 orchestrated services
docker compose up -d

# Check cluster health
docker compose ps

# View real-time logs
docker compose logs -f gateway
```

#### Services in Stack
| Service | Image / Build | Port | Purpose |
| :--- | :--- | :--- | :--- |
| **gateway** | `Dockerfile` (Node 22) | `3001:3001` | Core REST API, WebSockets & UI Shells |
| **stratum1** | `./server/ntp-stratum1` (Go 1.22) | `123:123/udp` | Autonomous Stratum-1 UDP Time Server |
| **timescaledb**| `timescale/timescaledb:latest-pg16` | `5432:5432` | Time-Series Hypertable Storage |
| **redis** | `redis:7-alpine` | `6379:6379` | Sliding-Window Rate Limiter & Cache |
| **prometheus** | `prom/prometheus:v2.51.0` | `9090:9090` | Time-Series Metrics Telemetry Scraper |
| **grafana** | `grafana/grafana:10.4.0` | `3000:3000` | Operational Health & SLA Dashboard |

---

## 4. Kubernetes Probes & Cloud Native Orchestration

Horologium implements Kubernetes container lifecycle probes:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 15
  timeoutSeconds: 3

readinessProbe:
  httpGet:
    path: /readyz
    port: 3001
  initialDelaySeconds: 3
  periodSeconds: 10
  timeoutSeconds: 3

startupProbe:
  httpGet:
    path: /startupz
    port: 3001
  failureThreshold: 10
  periodSeconds: 2
```

---

## 5. Observability & Monitoring

- **Prometheus Scrape Endpoint:** `GET /metrics` exposes metrics in OpenMetrics format:
  - `horologium_http_requests_total`: Counter by route and HTTP status code.
  - `horologium_http_request_duration_seconds`: Response latency histogram.
  - `horologium_ntp_clock_skew_milliseconds`: Live Marzullo skew gauge.
  - `horologium_active_websocket_connections`: Gauge tracking connected SNTP clients.
- **Grafana Dashboard:** Pre-provisioned dashboard available at `http://localhost:3000` (credentials: `admin`/`chronos_ops_vault`).
