/**
 * Kubernetes-Standard Health, Readiness & Liveness Probes
 * Provides /healthz (liveness), /readyz (readiness), and /startupz (startup)
 * alongside legacy /health endpoint.
 */

import { dbManager } from '../db/postgresClient.js';
import { redisClient } from '../cache/redisClient.js';
import { ntpService } from '../services/ntpService.js';

export const appLifecycle = {
  isStarted: false,
  isReady: true,
  isShuttingDown: false,
  startupTimestamp: Date.now()
};

/**
 * Liveness Probe: /healthz
 * Returns 200 if process event loop is responding.
 */
export function livenessProbe(req, res) {
  if (appLifecycle.isShuttingDown) {
    return res.status(503).json({
      status: 'SHUTTING_DOWN',
      message: 'Node process is terminating gracefully.'
    });
  }

  res.status(200).json({
    status: 'ALIVE',
    subsystem: 'horologium-core-runtime',
    uptimeSeconds: Math.floor(process.uptime()),
    timestampUtc: new Date().toISOString()
  });
}

/**
 * Readiness Probe: /readyz
 * Returns 200 if database, cache, and chronometric subsystems can serve traffic.
 * Returns 503 if dependencies fail or system is draining connections.
 */
export async function readinessProbe(req, res) {
  if (appLifecycle.isShuttingDown) {
    return res.status(503).json({
      status: 'NOT_READY',
      reason: 'Server is currently in graceful drain state.'
    });
  }

  const dbHealth = await dbManager.healthCheck();
  const cacheHealth = await redisClient.health();
  const ntpStatus = ntpService?.cachedSync || { stratum: 16 };

  // Database is critical; cache and NTP have fallbacks but report status
  const isDbHealthy = dbHealth && (dbHealth.status === 'CONNECTED' || dbHealth.engine === 'sqlite-embedded');
  const isReady = isDbHealthy && !appLifecycle.isShuttingDown;

  const payload = {
    status: isReady ? 'READY' : 'DEGRADED',
    timestampUtc: new Date().toISOString(),
    subsystems: {
      database: dbHealth,
      cache: cacheHealth,
      ntp: {
        stratum: ntpStatus.stratum || 1,
        skewMs: ntpStatus.skewMs || 0,
        primaryServer: ntpStatus.primaryServer || 'cached'
      }
    }
  };

  if (!isReady) {
    return res.status(503).json(payload);
  }

  return res.status(200).json(payload);
}

/**
 * Startup Probe: /startupz
 * Returns 200 once initialization tasks have completed.
 */
export function startupProbe(req, res) {
  if (!appLifecycle.isStarted) {
    return res.status(503).json({
      status: 'STARTING',
      message: 'Application bootstrapping is still executing.'
    });
  }

  res.status(200).json({
    status: 'STARTED',
    bootDurationMs: Date.now() - appLifecycle.startupTimestamp,
    timestampUtc: new Date().toISOString()
  });
}

/**
 * Full Telemetry Diagnostics: /health
 * Legacy comprehensive payload for dashboard monitors
 */
export async function fullHealthCheck(req, res) {
  const dbHealth = await dbManager.healthCheck();
  const cacheHealth = await redisClient.health();

  res.status(200).json({
    status: 'ONLINE',
    subsystem: 'Horologium Core Telemetry API',
    version: '1.2.0-PRO',
    uptimeSeconds: Math.floor(process.uptime()),
    serverTimeUtc: new Date().toISOString(),
    nodeVersion: process.version,
    database: dbHealth,
    cache: cacheHealth,
    ntp: {
      stratum: ntpService.cachedSync.stratum || 1,
      source: ntpService.cachedSync.primaryServer || 'Cloudflare / NIST SNTP Pool',
      cachedSkewMs: ntpService.cachedSync.skewMs
    }
  });
}
