/**
 * Horologium Production Server Entrypoint
 * Integrates HTTP/REST API and Stratum-1 WebSocket SNTP Synchronization
 */
import 'dotenv/config';
import { app } from './server/app.js';
import { WebSocketSntpServer } from './server/services/websocketSntp.js';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.info(`========================================================`);
  console.info(`   HOROLOGIUM // CORE TELEMETRY SERVER ONLINE           `);
  console.info(`   PORT: ${PORT}                                       `);
  console.info(`   HEALTH CHECK: http://localhost:${PORT}/api/health    `);
  console.info(`   WEBSOCKET SNTP: ws://localhost:${PORT}/ws/sntp       `);
  console.info(`   OPENAPI DOCS: http://localhost:${PORT}/api/docs      `);
  console.info(`========================================================`);
});

// Attach Bidirectional WebSocket SNTP Engine
export const wsSntpServer = new WebSocketSntpServer(server);

process.on('SIGTERM', () => {
  console.info('[Horologium] SIGTERM received. Shutting down gracefully.');
  wsSntpServer.close();
  server.close(() => process.exit(0));
});
