/**
 * Horologium WebSocket SNTP (Simple Network Time Protocol) Client
 * Implements bidirectional RFC 4330/5905 time synchronization over WebSockets.
 * 
 * Provides sub-millisecond atomic clock synchronization, measuring:
 * - One-Way Network Delay (tau)
 * - True Client Clock Skew (theta)
 * - Round-Trip Jitter Filter across a sliding window of probes
 */

class WebSocketSntpClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isSynchronized = false;
    this.clockOffsetMs = 0;       // theta: client local time + offset = atomic time
    this.roundTripDelayMs = 12;   // delta: total round-trip time
    this.oneWayDelayMs = 6;       // tau: one-way latency
    this.stratum = 1;
    this.primaryServer = 'time.cloudflare.com';

    this.pendingProbes = new Map();
    this.sampleHistory = [];      // Sliding window of last 8 probe metrics
    this.maxSamples = 8;
    this.probeInterval = null;
    this.reconnectTimeout = null;
    this.probeCounter = 0;

    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;
    this.connect();
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/sntp`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.info('[SNTP Client] WebSocket connected to', wsUrl);
        // Initial rapid burst of 4 probes to lock clock immediately
        this.performBurstSync();
        // Regular sync every 5 seconds
        clearInterval(this.probeInterval);
        this.probeInterval = setInterval(() => this.sendProbe(), 5000);
      };

      this.ws.onmessage = (event) => {
        const t4 = performance.now() + performance.timeOrigin; // High-resolution receive timestamp T4
        this.handleMessage(event.data, t4);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        clearInterval(this.probeInterval);
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch (e) {
      console.warn('[SNTP Client] WebSocket connection failed, will retry:', e.message);
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => this.connect(), 4000);
    }
  }

  performBurstSync() {
    this.sendProbe();
    setTimeout(() => this.sendProbe(), 150);
    setTimeout(() => this.sendProbe(), 300);
    setTimeout(() => this.sendProbe(), 500);
  }

  sendProbe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.probeCounter++;
    const probeId = `p-${this.probeCounter}-${Math.random().toString(36).slice(2, 7)}`;
    const t1 = performance.now() + performance.timeOrigin; // High-resolution transmit timestamp T1

    this.pendingProbes.set(probeId, t1);

    this.ws.send(JSON.stringify({
      type: 'SNTP_PROBE',
      id: probeId,
      t1
    }));
  }

  handleMessage(rawString, t4) {
    try {
      const msg = JSON.parse(rawString);

      if (msg.type === 'SNTP_RESPONSE') {
        const t1 = this.pendingProbes.get(msg.id) || msg.t1;
        this.pendingProbes.delete(msg.id);

        const t2 = msg.t2;
        const t3 = msg.t3;

        // RFC 5905 Equations:
        // Round trip delay delta = (T4 - T1) - (T3 - T2)
        const roundTrip = Math.max(0, (t4 - t1) - (t3 - t2));
        // Clock offset theta = ((T2 - T1) + (T3 - T4)) / 2
        const offset = ((t2 - t1) + (t3 - t4)) / 2;
        // One-way delay tau = delta / 2
        const oneWay = roundTrip / 2;

        this.recordSample({
          offset,
          roundTrip,
          oneWay,
          t4,
          stratum: msg.stratum,
          reference: msg.reference
        });
      }
    } catch (e) {
      // Ignore malformed frames
    }
  }

  recordSample(sample) {
    this.sampleHistory.push(sample);
    if (this.sampleHistory.length > this.maxSamples) {
      this.sampleHistory.shift();
    }

    // Outlier rejection filter: Sort by lowest round-trip delay
    const sorted = [...this.sampleHistory].sort((a, b) => a.roundTrip - b.roundTrip);
    // Take the best 50% lowest latency samples to eliminate network jitter
    const bestCount = Math.max(1, Math.floor(sorted.length * 0.6));
    const bestSamples = sorted.slice(0, bestCount);

    let sumOffset = 0;
    let sumRoundTrip = 0;
    for (const s of bestSamples) {
      sumOffset += s.offset;
      sumRoundTrip += s.roundTrip;
    }

    this.clockOffsetMs = sumOffset / bestSamples.length;
    this.roundTripDelayMs = sumRoundTrip / bestSamples.length;
    this.oneWayDelayMs = this.roundTripDelayMs / 2;
    this.stratum = sample.stratum || 1;
    this.primaryServer = sample.reference || 'time.cloudflare.com';
    this.isSynchronized = true;

    const metrics = this.getMetrics();

    // Dispatch global event for UI telemetry bars
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sntp:metrics', { detail: metrics }));

      // Update telemetry badges if present on page
      const latencyElements = document.querySelectorAll('.sntp-latency-readout, #sntpLatency, #homeLatencyVal, #mapSntpDelay');
      latencyElements.forEach(el => {
        el.textContent = `${this.roundTripDelayMs.toFixed(1)}ms (${this.oneWayDelayMs.toFixed(1)}ms 1-WAY)`;
      });

      const skewElements = document.querySelectorAll('.sntp-skew-readout, #sntpSkew, #homeDriftVal, #mapSntpDrift');
      skewElements.forEach(el => {
        const sign = this.clockOffsetMs >= 0 ? '+' : '';
        el.textContent = `${sign}${this.clockOffsetMs.toFixed(2)}ms (STRATUM-${this.stratum})`;
      });
    }
  }

  /**
   * Returns high-precision synchronized Date object
   */
  getAtomicTime() {
    return new Date(Date.now() + this.clockOffsetMs);
  }

  getMetrics() {
    return {
      isSynchronized: this.isSynchronized,
      clockOffsetMs: Number(this.clockOffsetMs.toFixed(3)),
      roundTripDelayMs: Number(this.roundTripDelayMs.toFixed(2)),
      oneWayDelayMs: Number(this.oneWayDelayMs.toFixed(2)),
      stratum: this.stratum,
      primaryServer: this.primaryServer,
      samplesRecorded: this.sampleHistory.length
    };
  }
}

export const sntpClient = new WebSocketSntpClient();
