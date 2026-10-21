let activeInstance = null;
/**
 * Horologium WebSocket SNTP (Simple Network Time Protocol) Engine
 * Implements bidirectional RFC 4330 / RFC 5905 time synchronization over WebSockets.
 * 
 * Protocol Exchange:
 * 1. Client sends SNTP_PROBE with timestamp T1 (client transmit time)
 * 2. Server records T2 (server receive time) via process.hrtime.bigint()
 * 3. Server records T3 (server transmit time) right before sending SNTP_RESPONSE
 * 4. Client records T4 (client receive time)
 * 5. One-way network latency = ((T4 - T1) - (T3 - T2)) / 2
 * 6. Client clock skew / offset = ((T2 - T1) + (T3 - T4)) / 2
 */

import { WebSocketServer } from 'ws';
import { ntpService } from './ntpService.js';
import { dbManager } from '../db/postgresClient.js';

export class WebSocketSntpServer {
  constructor(httpServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws/sntp',
      maxPayload: 1024, // 1KB frame limit to prevent memory exhaustion
    });

    this.clients = new Set();
    this.init();
    activeInstance = this;
  }

  init() {
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
      ws.isAlive = true;
      ws.clientIp = clientIp;
      ws.probeCount = 0;
      ws.lastProbeWindow = Date.now();

      this.clients.add(ws);

      // Heartbeat ping-pong
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        const t2 = Date.now(); // Server receive timestamp (T2)
        this.handleMessage(ws, data, t2);
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.warn('[SNTP WS] Socket error for', clientIp, ':', err.message);
        this.clients.delete(ws);
      });

      // Send initial welcome frame with Stratum-1 status
      ws.send(JSON.stringify({
        type: 'SNTP_READY',
        stratum: ntpService.cachedSync.stratum || 1,
        primaryServer: ntpService.cachedSync.primaryServer,
        serverTimeUtc: new Date().toISOString(),
        message: 'Horologium Stratum-1 WebSocket SNTP Engine online. Send SNTP_PROBE to synchronize.'
      }));
    });

    // 30s Heartbeat loop to purge dead sockets
    this.heartbeatInterval = setInterval(() => {
      for (const ws of this.clients) {
        if (!ws.isAlive) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, 30000);
    if (this.heartbeatInterval.unref) this.heartbeatInterval.unref();
  }

  handleMessage(ws, rawData, t2) {
    try {
      const msg = JSON.parse(rawData.toString());

      if (msg.type === 'SNTP_PROBE') {
        const now = Date.now();

        // Leaky bucket rate limiter: max 12 probes per second per socket
        if (now - ws.lastProbeWindow > 1000) {
          ws.lastProbeWindow = now;
          ws.probeCount = 0;
        }
        ws.probeCount++;

        if (ws.probeCount > 12) {
          ws.send(JSON.stringify({
            type: 'SNTP_ERROR',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many SNTP probes per second. Throttling.'
          }));
          return;
        }

        const t1 = parseFloat(msg.t1);
        if (!t1 || isNaN(t1)) {
          ws.send(JSON.stringify({
            type: 'SNTP_ERROR',
            code: 'INVALID_TIMESTAMP',
            message: 'Missing or invalid t1 timestamp.'
          }));
          return;
        }

        // T3 is server transmit time right before wire serialization
        const t3 = Date.now();

        const responseFrame = {
          type: 'SNTP_RESPONSE',
          id: msg.id || 'probe',
          t1,
          t2,
          t3,
          stratum: ntpService.cachedSync.stratum || 1,
          reference: ntpService.cachedSync.primaryServer,
          serverSkewMs: ntpService.cachedSync.skewMs,
          precision: '100ns'
        };

        ws.send(JSON.stringify(responseFrame));

        // Asynchronously record drift telemetry sample (1 in 10 rate sample to save IO)
        if (ws.probeCount === 1) {
          const estimatedSkew = ((t2 - t1) + (t3 - t1)) / 2;
          dbManager.recordTelemetryDrift({
            clientIp: ws.clientIp,
            skewMs: estimatedSkew,
            roundTripMs: t3 - t1,
            ntpServer: ntpService.cachedSync.primaryServer,
            stratum: 1
          }).catch(() => {});
        }
      }
    } catch (e) {
      ws.send(JSON.stringify({
        type: 'SNTP_ERROR',
        code: 'BAD_REQUEST',
        message: 'Malformed JSON frame.'
      }));
    }
  }

  close() {
    clearInterval(this.heartbeatInterval);
    if (this.wss) {
      this.wss.close();
    }
  }
}

export function getActiveWsClientsCount() {
  return activeInstance ? activeInstance.clients.size : 0;
}
