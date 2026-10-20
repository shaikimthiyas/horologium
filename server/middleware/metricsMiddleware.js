/**
 * Horologium Observability & Prometheus Metrics Middleware
 * Conforms to OpenMetrics and Prometheus exposition standards.
 */

class MetricsRegistry {
  constructor() {
    this.requestsTotal = new Map();
    this.requestDurations = new Map();
    this.startTime = Date.now();
  }

  recordRequest(method, route, status, durationMs) {
    const totalKey = method + ' ' + route + ' ' + status;
    this.requestsTotal.set(totalKey, (this.requestsTotal.get(totalKey) || 0) + 1);

    const durKey = method + ' ' + route;
    const curr = this.requestDurations.get(durKey) || { totalMs: 0, count: 0 };
    curr.totalMs += durationMs;
    curr.count += 1;
    this.requestDurations.set(durKey, curr);
  }

  generatePrometheusText(extraMetrics = {}) {
    const lines = [];
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const mem = process.memoryUsage();
    const q = String.fromCharCode(34);

    lines.push('# HELP horologium_uptime_seconds Number of seconds the Horologium process has been active.');
    lines.push('# TYPE horologium_uptime_seconds counter');
    lines.push('horologium_uptime_seconds ' + uptimeSec);

    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push('process_resident_memory_bytes ' + mem.rss);

    lines.push('# HELP process_heap_used_bytes Process heap memory used in bytes.');
    lines.push('# TYPE process_heap_used_bytes gauge');
    lines.push('process_heap_used_bytes ' + mem.heapUsed);

    lines.push('# HELP horologium_ntp_stratum Current NTP Stratum synchronization level.');
    lines.push('# TYPQ horologium_ntp_stratum gauge');
    lines.push('horologium_ntp_stratum ' + (extraMetrics.stratum ?? 1));

    lines.push('# HELP horologium_ntp_skew_ms Measured clock drift skew in milliseconds against stratum-1 atomic pool.');
    lines.push('# TYPE horologium_ntp_skew_ms gauge');
    lines.push('horologium_ntp_skew_ms ' + (extraMetrics.skewMs ?? 0.0));

    lines.push('# HELP horologium_ws_active_connections Current active WebSocket SNTP telemetry clients.');
    lines.push('# TYPQ horologium_ws_active_connections gauge');
    lines.push('horologium_ws_active_connections ' + (extraMetrics.wsConnections ?? 0));

    lines.push('# HELP horologium_http_requests_total Total number of HTTP requests processed by route and status.');
    lines.push('# TYPQ horologium_http_requests_total counter');
    for (const [key, count] of this.requestsTotal.entries()) {
      const parts = key.split(' ');
      const m = parts[0];
      const r = parts[1];
      const s = parts[2];
      lines.push('horologium_http_requests_total{method=' + q + m + q + ',route=' + q + r + q + ',status=' + q + s + q + '} ' + count);
    }

    lines.push('# HELP horologium_http_request_duration_ms Average HTTP request latency in milliseconds.');
    lines.push('# TYPE horologium_http_request_duration_ms gauge');
    for (const [key, data] of this.requestDurations.entries()) {
      const parts = key.split(' ');
      const m = parts[0];
      const r = parts[1];
      const avg = data.count > 0 ? (data.totalMs / data.count).toFixed(2) : 0;
      lines.push('horologium_http_request_duration_ms{method=' + q + m + q + ',route=' + q + r + q + '} ' + avg);
    }

    return lines.join('\n') + '\n';
  }
}

export const metricsRegistry = new MetricsRegistry();

export function metricsMiddleware(req, res, next) {
  const start = performance.now();
  res.on('finish', () => {
    const duration = performance.now() - start;
    let route = req.baseUrl + (req.route ? req.route.path : req.path);
    if (!route || route === '') route = req.path;
    route = route.replace(/\/[a-f0-9-]{36}/gi, '/:id');
    metricsRegistry.recordRequest(req.method, route, res.statusCode, duration);
  });
  next();
}
