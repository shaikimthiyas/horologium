/**
 * Horologium Enterprise Graceful Process Shutdown Manager
 * Implements clean connection draining, WebSocket disconnection notices,
 * database pool termination, and signal handling for zero-downtime deployments.
 */

import { appLifecycle } from '../middleware/healthProbes.js';
import { dbManager } from '../db/postgresClient.js';
import { redisClient } from '../cache/redisClient.js';

let isShuttingDown = false;

export function registerGracefulShutdown(httpServer, wsServer = null, options = {}) {
  const { graceTimeoutMs = 10000 } = options;

  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    appLifecycle.isShuttingDown = true;

    console.info(`\n[Horologium Lifecycle] ${signal} signal received. Initiating graceful shutdown sequence...`);

    // Force exit safety timer
    const forceExitTimer = setTimeout(() => {
      console.error(`[Horologium Lifecycle] Grace period (${graceTimeoutMs}ms) exceeded. Forcing termination.`);
      process.exit(1);
    }, graceTimeoutMs);
    if (forceExitTimer.unref) forceExitTimer.unref();

    try {
      // Step 1: Notify and close WebSocket clients
      if (wsServer && typeof wsServer.close === 'function') {
        console.info('[Horologium Lifecycle] Terminating WebSocket SNTP server...');
        wsServer.close();
      }

      // Step 2: Stop accepting new HTTP connections
      if (httpServer && typeof httpServer.close === 'function') {
        await new Promise((resolve) => {
          httpServer.close((err) => {
            if (err) {
              console.warn('[Horologium Lifecycle] Error closing HTTP server listener:', err.message);
            } else {
              console.info('[Horologium Lifecycle] HTTP listener closed cleanly.');
            }
            resolve();
          });
        });
      }

      // Step 3: Disconnect Redis cache client
      if (redisClient && typeof redisClient.disconnect === 'function') {
        console.info('[Horologium Lifecycle] Disconnecting Redis client...');
        await redisClient.disconnect().catch(e => console.warn('[Horologium Lifecycle] Redis disconnect warning:', e.message));
      }

      // Step 4: Close database pool / SQLite handles
      if (dbManager && typeof dbManager.close === 'function') {
        console.info('[Horologium Lifecycle] Closing database connections...');
        await dbManager.close().catch(e => console.warn('[Horologium Lifecycle] DB close warning:', e.message));
      }

      clearTimeout(forceExitTimer);
      console.info('[Horologium Lifecycle] Graceful shutdown sequence completed. Exiting (0).');
      process.exit(0);
    } catch (err) {
      console.error('[Horologium Lifecycle] Error during graceful shutdown:', err);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Horologium Lifecycle] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Horologium Lifecycle] Uncaught Exception thrown:', err);
    shutdown('UNCAUGHT_EXCEPTION');
  });
}
