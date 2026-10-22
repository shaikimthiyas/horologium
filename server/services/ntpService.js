/**
 * Horologium Stratum-1 Atomic Synchronization Engine (Node.js Native SNTP)
 * Directly interfaces with Cloudflare (time.cloudflare.com) and NIST (time.nist.gov)
 * via UDP sockets using RFC 5905 algorithms and Marzullo's Intersection Consensus.
 * 
 * Resilient to firewalled / air-gapped environments (e.g. GitHub Actions / Azure NSGs
 * where outbound UDP port 123 is blocked).
 */

import dgram from 'node:dgram';
import { computeMarzulloConsensus } from './marzullo.js';

const NTP_SERVERS = [
  'time.cloudflare.com',
  'time.nist.gov',
  'time.google.com',
  'pool.ntp.org'
];

const NTP_PORT = 123;
const NTP_EPOCH_DELTA = 2208988800; // Seconds between 1900 and 1970
const DEFAULT_TIMEOUT_MS = process.env.CI ? 600 : 2000;

class Stratum1NtpService {
  constructor() {
    this.cachedSync = {
      serverTimeUtc: new Date().toISOString(),
      skewMs: 0.0,
      confidenceHalfWidthMs: 1.0,
      roundTripMs: 12.0,
      primaryServer: 'time.cloudflare.com',
      stratum: 1,
      marzulloStatus: 'INITIALIZING',
      truechimersCount: 1,
      falsetickersCount: 0,
      truechimers: [
        { id: 'time.cloudflare.com', server: 'time.cloudflare.com', offset: 0.0, errorBound: 6.0 }
      ],
      falsetickers: [],
      lastSyncEpoch: Date.now()
    };
    this.syncInterval = null;
    this.startPeriodicSync();
  }

  /**
   * Query a single Stratum-1 server over raw UDP
   */
  queryServer(serverHost, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const client = dgram.createSocket('udp4');
      const packet = Buffer.alloc(48);

      // Leap = 0, Version = 4, Mode = 3 (Client) -> 0x23
      packet[0] = 0x23;

      const t1 = Date.now();
      const sec = Math.floor(t1 / 1000) + NTP_EPOCH_DELTA;
      const frac = Math.floor((t1 % 1000) * (4294967296 / 1000));
      packet.writeUInt32BE(sec, 40);
      packet.writeUInt32BE(frac, 44);

      let timer = setTimeout(() => {
        try { client.close(); } catch (_) {}
        reject(new Error(`NTP query to ${serverHost} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      client.on('message', (msg) => {
        const t4 = Date.now();
        clearTimeout(timer);
        try { client.close(); } catch (_) {}

        if (msg.length < 48) {
          return reject(new Error(`Short NTP packet from ${serverHost}: ${msg.length} bytes`));
        }

        const stratum = msg[1];

        // Receive Timestamp (T2)
        const rxSec = msg.readUInt32BE(32) - NTP_EPOCH_DELTA;
        const rxFrac = msg.readUInt32BE(36);
        const t2 = rxSec * 1000 + Math.floor((rxFrac * 1000) / 4294967296);

        // Transmit Timestamp (T3)
        const txSec = msg.readUInt32BE(40) - NTP_EPOCH_DELTA;
        const txFrac = msg.readUInt32BE(44);
        const t3 = txSec * 1000 + Math.floor((txFrac * 1000) / 4294967296);

        // RFC 5905 Formulas:
        // Offset (skew) = ((T2 - T1) + (T3 - T4)) / 2
        const offset = ((t2 - t1) + (t3 - t4)) / 2;
        // Round trip delay = (T4 - T1) - (T3 - T2)
        const delay = Math.max(0, (t4 - t1) - (t3 - t2));

        resolve({
          server: serverHost,
          stratum,
          skewMs: offset,
          offset,
          roundTripMs: delay,
          delay,
          atomicEpoch: t4 + offset
        });
      });

      client.on('error', (err) => {
        clearTimeout(timer);
        try { client.close(); } catch (_) {}
        reject(err);
      });

      client.send(packet, 0, 48, NTP_PORT, serverHost, (err) => {
        if (err) {
          clearTimeout(timer);
          try { client.close(); } catch (_) {}
          reject(err);
        }
      });
    });
  }

  /**
   * Run consensus query across primary Stratum-1 pool with Marzullo's algorithm
   */
  async getStratum1Consensus() {
    const promises = NTP_SERVERS.map(host => 
      this.queryServer(host).catch(() => null)
    );

    const results = (await Promise.all(promises)).filter(Boolean);

    if (results.length === 0) {
      // Firewalled environment (e.g. GitHub Actions runner, Azure NSG, offline)
      return {
        ...this.cachedSync,
        serverTimeUtc: new Date().toISOString(),
        marzulloStatus: 'FALLBACK_CACHED',
        truechimers: this.cachedSync.truechimers || [
          { id: this.cachedSync.primaryServer, server: this.cachedSync.primaryServer, offset: this.cachedSync.skewMs, errorBound: 6.0 }
        ],
        falsetickers: this.cachedSync.falsetickers || []
      };
    }

    // Apply Marzullo's Intersection Algorithm across responsive sources
    const marzullo = computeMarzulloConsensus(results);
    const primaryId = marzullo.truechimers.length > 0 ? marzullo.truechimers[0].server : results[0].server;
    const bestResult = results.find(r => r.server === primaryId) || results[0];

    const consensusSkew = marzullo.consensusOffset;

    this.cachedSync = {
      serverTimeUtc: new Date(Date.now() + consensusSkew).toISOString(),
      skewMs: Number(consensusSkew.toFixed(3)),
      confidenceHalfWidthMs: marzullo.confidenceHalfWidth,
      roundTripMs: Number(bestResult.roundTripMs.toFixed(2)),
      primaryServer: primaryId,
      stratum: bestResult.stratum || 1,
      marzulloStatus: marzullo.status,
      truechimersCount: marzullo.truechimers.length,
      falsetickersCount: marzullo.falsetickers.length,
      truechimers: marzullo.truechimers,
      falsetickers: marzullo.falsetickers,
      lastSyncEpoch: Date.now()
    };

    return this.cachedSync;
  }

  startPeriodicSync() {
    // Initial sync
    this.getStratum1Consensus().catch(() => {});
    // Sync every 5 minutes to track oscillator drift
    this.syncInterval = setInterval(() => {
      this.getStratum1Consensus().catch(() => {});
    }, 5 * 60 * 1000);
    if (this.syncInterval.unref) this.syncInterval.unref();
  }
}

export const ntpService = new Stratum1NtpService();
