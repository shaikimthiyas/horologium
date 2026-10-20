/**
 * Horologium Central REST API Router (Production MAANG Standards)
 * Integrates Redis sliding-window rate limiting, Stratum-1 NTP synchronization,
 * TimescaleDB / PostgreSQL / SQLite hybrid persistence, and OpenMetrics observability.
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
import { createDatabaseBackup, listDatabaseBackups } from '../db/backup.js';
import { dbManager } from '../db/postgresClient.js';
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
 * Health Check & System Telemetry
 * Provides deep health diagnostics across Core API, Database engine, and Redis cache
 */
apiRouter.get('/health', async (req, res) => {
  const dbHealth = await dbManager.healthCheck();
  const cacheHealth = await redisClient.health();

  res.json({
    status: 'ONLINE',
    subsystem: 'Horologium Core Telemetry API',
    version: '1.2.0-PRO',
    uptimeSeconds: Math.floor(process.uptime()),
    serverTimeUtc: new Date().toISOString(),
    nodeVersion: process.version,
    database: dbHealth,
    cache: cacheHealth,
    ntp: {
      stratum: 1,
      source: 'Cloudflare / NIST SNTP Pool',
      cachedSkewMs: ntpService.cachedSync.skewMs
    }
  });
});

/**
 * OpenMetrics / Prometheus Metrics Telemetry Exposition
 */
apiRouter.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  const wsCount = getActiveWsClientsCount();
  const metricsText = metricsRegistry.generatePrometheusText({
    stratum: 1,
    skewMs: ntpService.cachedSync.skewMs,
    wsConnections: wsCount
  });
  res.send(metricsText);
});

/**
 * High-Precision Stratum-1 Time Synchronization
 */
apiRouter.get('/time', getTime);
apiRouter.get('/v1/time', getTime);

apiRouter.get('/v1/stratum1/sync', async (req, res) => {
  try {
    const consensus = await ntpService.getStratum1Consensus();
    res.json({
      status: 'SYNCHRONIZED',
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
 * Continuous 1-second telemetry broadcast for mission control terminals
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
      stratum: 1,
      skewMs: ntpService.cachedSync.skewMs
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
apiRouter.get('/v1/countries', getCountries);
apiRouter.get('/countries', getCountries);
apiRouter.get('/v1/countries/:code', getCountryByCode);
apiRouter.get('/countries/:code', getCountryByCode);

/**
 * Timezone Overlap Engine (with Redis Caching)
 */
apiRouter.get('/v1/zones/overlap', async (req, res) => {
  const { stationA = 'Europe/London', stationB = 'Asia/Tokyo' } = req.query;

  const cached = await redisClient.getTimezoneOverlap(stationA, stationB);
  if (cached) {
    return res.json({ ...cached, source: 'REDIS_CACHE_HIT' });
  }

  const now = new Date();
  const formatterA = new Intl.DateTimeFormat('en-US', { timeZone: stationA, hour: 'numeric', hour12: false });
  const formatterB = new Intl.DateTimeFormat('en-US', { timeZone: stationB, hour: 'numeric', hour12: false });

  const hourA = parseInt(formatterA.format(now), 10) % 24;
  const hourB = parseInt(formatterB.format(now), 10) % 24;

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
apiRouter.post('/pins', requireOperatorAuth, addPin);
apiRouter.delete('/pins/:id', requireOperatorAuth, deletePin);

apiRouter.get('/v1/pins', getPins);
apiRouter.post('/v1/pins', requireOperatorAuth, addPin);
apiRouter.delete('/v1/pins/:id', requireOperatorAuth, deletePin);

/**
 * Transmissions & Inquiries
 */
apiRouter.post('/transmissions', transmissionLimiter, createTransmission);
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
