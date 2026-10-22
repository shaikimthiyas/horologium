/**
 * Horologium Production Server Entrypoint
 * Integrates HTTP/REST API, Stratum-1 WebSocket SNTP Synchronization,
 * and Zero-Downtime Graceful Process Teardown.
 */
import 'dotenv/config';
import { app } from './server/app.js';
import { WebSocketSntpServer } from './server/services/websocketSntp.js';
import { registerGracefulShutdown } from './server/lifecycle/shutdown.js';
import { appLifecycle } from './server/middleware/healthProbes.js';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  appLifecycle.isStarted = true;
  console.info(`========================================================`);
  console.info(`   HOROLOGIUM // CORE TELEMETRY SERVER ONLINE           `);
  console.info(`   PORT: ${PORT}                                       `);
  console.info(`   HEALTH CHECK: http://localhost:${PORT}/api/health    `);
  console.info(`   LIVENESS:     http://localhost:${PORT}/healthz       `);
  console.info(`   READINESS:    http://localhost:${PORT}/readyz        `);
  console.info(`   WEBSOCKET SNTP: ws://localhost:${PORT}/ws/sntp       `);
  console.info(`   OPENAPI DOCS: http://localhost:${PORT}/api/docs      `);
  console.info(`========================================================`);
});

// Attach Bidirectional WebSocket SNTP Engine
export const wsSntpServer = new WebSocketSntpServer(server);

// Register Zero-Downtime Graceful Teardown
registerGracefulShutdown(server, wsSntpServer);
