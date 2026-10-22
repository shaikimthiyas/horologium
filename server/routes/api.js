/**
 * Horologium Central REST API Router (Production MAANG Standards)
 * Integrates Redis sliding-window rate limiting, Stratum-1 NTP synchronization,
 * Marzullo truechimer consensus, TimescaleDB / SQLite persistence,
 * Kubernetes-standard health probes, and Zod schema validation.
 */

import { Router } from 'express';
import { getTime, getSolarDeclination, getSubsolarLongitude } from '../controllers/timeController.js';
import { getCountries, getCountryByCode } from '../controllers/countriesController.js';
import { login, getMe, logout } from '../controllers/authController.js';
import { getPins, addPin, deletePin } from '../controllers/pinsController.js';
import { createTransmission, getTransmissions } from '../controllers/inquiryController.js';
import { requireOperatorAuth } from '../middleware/authMiddleware.js';
import { createRedisRateLimiter } from '../middleware/redisRateLimiter.js';
import { metricsRegistry } from '../middleware/metricsMiddleware.js';
import { validateRequest, z } from '../middleware/schemaValidator.js';
import { livenessProbe, readinessProbe, startupProbe, fullHealthCheck } from '../middleware/healthProbes.js';
import { createDatabaseBackup, listDatabaseBackups } from '../db/backup.js';
import { redisClient } from '../cache/redisClient.js';
import { ntpService } from '../services/ntpService.js';
import { getActiveWsClientsCount } from '../services/websocketSntp.js';

export const apiRouter = Router();

// Distributed Redis Sliding-Window Rate Limiter (ZADD / ZREMRANGEBYSCORE)
const generalLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 180,
  keyPrefix: 'rl:api'
});

const transmissionLimiter = createRedisRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'rl:transmissions',
  message: 'Transmission frequency limit reached for this IP terminal. Please standby.'
});

apiRouter.use(generalLimiter);

/**
 * Kubernetes-Standard Probes & Telemetry
 */
apiRouter.get('/health', fullHealthCheck);
apiRouter.get('/healthz', livenessProbe);
apiRouter.get('/livez', livenessProbe);
apiRouter.get('/readyz', readinessProbe);
apiRouter.get('/startupz', startupProbe);

/**
 * OpenMetrics / Prometheus Metrics Telemetry Exposition
 */
apiRouter.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  const wsCount = getActiveWsClientsCount();
  const metricsText = metricsRegistry.generatePrometheusText({
    stratum: ntpService.cachedSync.stratum || 1,
    skewMs: ntpService.cachedSync.skewMs,
    wsConnections: wsCount
  });
  res.send(metricsText);
});

/**
 * Validation Schemas (Zod Contract Enforcement)
 */
const timeQuerySchema = z.object({
  location: z.string().max(100).optional(),
  zone: z.string().max(100).optional(),
  tz: z.string().max(100).optional()
});

const countriesQuerySchema = z.object({
  query: z.string().max(100).optional(),
  tz: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(250).optional()
});

const countryCodeParamsSchema = z.object({
  code: z.string().min(2).max(10)
});

const overlapQuerySchema = z.object({
  stationA: z.string().min(1).max(100).optional(),
  stationB: z.string().min(1).max(100).optional()
});

const pinBodySchema = z.object({
  name: z.string().min(1).max(100),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  timezone: z.string().min(1).max(100)
});

const transmissionBodySchema = z.object({
  sender: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(1).max(2000),
  subject: z.string().max(200).optional()
});

/**
 * High-Precision Stratum-1 Time Synchronization
 */
apiRouter.get('/time', validateRequest({ query: timeQuerySchema }), getTime);
apiRouter.get('/v1/time', validateRequest({ query: timeQuerySchema }), getTime);

apiRouter.get('/v1/stratum1/sync', async (req, res) => {
  try {
    const consensus = await ntpService.getStratum1Consensus();
    res.json({
      status: 'SYNCHRONIZED',
      algorithm: 'MARZULLO_INTERSECTION_CONSENSUS',
      ...consensus
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      message: err.message,
      fallbackTimeUtc: new Date().toISOString()
    });
  }
});

/**
 * Server-Sent Events (SSE) Real-Time Clock & Solar Pulse Stream
 */
apiRouter.get('/v1/stream/time', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write('event: connected\ndata: ' + JSON.stringify({ status: 'STREAM_ONLINE', connectedAt: new Date().toISOString() }) + '\n\n');

  const intervalId = setInterval(() => {
    const now = new Date();
    const solarDec = Number(getSolarDeclination(now).toFixed(2));
    const subLon = Number(getSubsolarLongitude(now).toFixed(2));

    const payload = {
      utcTime: now.toISOString(),
      epochMs: now.getTime(),
      solarDeclinationDeg: solarDec,
      subsolarLongitudeDeg: subLon,
      stratum: ntpService.cachedSync.stratum || 1,
      skewMs: ntpService.cachedSync.skewMs,
      marzulloStatus: ntpService.cachedSync.marzulloStatus
    };

    res.write('event: tick\ndata: ' + JSON.stringify(payload) + '\n\n');
  }, 1000);

  const heartbeatId = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(intervalId);
    clearInterval(heartbeatId);
  });
});

/**
 * Geodesic Sovereign Countries & Timezone Registry
 */
apiRouter.get('/v1/countries', validateRequest({ query: countriesQuerySchema }), getCountries);
apiRouter.get('/countries', validateRequest({ query: countriesQuerySchema }), getCountries);
apiRouter.get('/v1/countries/:code', validateRequest({ params: countryCodeParamsSchema }), getCountryByCode);
apiRouter.get('/countries/:code', validateRequest({ params: countryCodeParamsSchema }), getCountryByCode);

/**
 * Timezone Overlap Engine (with Redis Caching & Input Validation)
 */
apiRouter.get('/v1/zones/overlap', validateRequest({ query: overlapQuerySchema }), async (req, res) => {
  const { stationA = 'Europe/London', stationB = 'Asia/Tokyo' } = req.query;

  const cached = await redisClient.getTimezoneOverlap(stationA, stationB);
  if (cached) {
    return res.json({ ...cached, source: 'REDIS_CACHE_HIT' });
  }

  const now = new Date();
  let hourA, hourB;
  try {
    const formatterA = new Intl.DateTimeFormat('en-US', { timeZone: stationA, hour: 'numeric', hour12: false });
    const formatterB = new Intl.DateTimeFormat('en-US', { timeZone: stationB, hour: 'numeric', hour12: false });
    hourA = parseInt(formatterA.format(now), 10) % 24;
    hourB = parseInt(formatterB.format(now), 10) % 24;
  } catch (err) {
    return res.status(400).json({
      status: 'INVALID_TIMEZONE',
      message: `Invalid IANA timezone identifier: ${err.message}`
    });
  }

  let delta = hourB - hourA;
  if (delta > 12) delta -= 24;
  if (delta < -12) delta += 24;

  const overlapHours = [];
  for (let h = 0; h < 24; h++) {
    const isWorkingA = h >= 9 && h <= 18;
    const correspondingB = (h + delta + 24) % 24;
    const isWorkingB = correspondingB >= 9 && correspondingB <= 18;

    overlapHours.push({
      hourUtc: h,
      hourA: h,
      hourB: correspondingB,
      isGoldenOverlap: isWorkingA && isWorkingB,
      isOneSided: isWorkingA || isWorkingB
    });
  }

  const payload = {
    stationA,
    stationB,
    deltaHours: delta,
    overlapHours,
    calculatedAt: now.toISOString()
  };

  await redisClient.setTimezoneOverlap(stationA, stationB, payload);
  res.json({ ...payload, source: 'COMPUTED' });
});

/**
 * Operator Authentication
 */
apiRouter.post('/auth/login', login);
apiRouter.get('/auth/me', getMe);
apiRouter.post('/auth/logout', logout);

/**
 * Pinned Telemetry Stations
 */
apiRouter.get('/pins', getPins);
apiRouter.post('/pins', requireOperatorAuth, validateRequest({ body: pinBodySchema }), addPin);
apiRouter.delete('/pins/:id', requireOperatorAuth, deletePin);

apiRouter.get('/v1/pins', getPins);
apiRouter.post('/v1/pins', requireOperatorAuth, validateRequest({ body: pinBodySchema }), addPin);
apiRouter.delete('/v1/pins/:id', requireOperatorAuth, deletePin);

/**
 * Transmissions & Inquiries
 */
apiRouter.post('/transmissions', transmissionLimiter, validateRequest({ body: transmissionBodySchema }), createTransmission);
apiRouter.get('/transmissions', requireOperatorAuth, getTransmissions);

/**
 * Admin Database Snapshot & WAL Maintenance (Protected)
 */
apiRouter.post('/admin/backup', requireOperatorAuth, async (req, res) => {
  try {
    const result = await createDatabaseBackup();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/admin/backups', requireOperatorAuth, (req, res) => {
  try {
    const backups = listDatabaseBackups();
    res.json({ status: 'SUCCESS', count: backups.length, backups });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});
