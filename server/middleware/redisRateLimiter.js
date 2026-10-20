/**
 * Horologium MAANG-Grade Distributed Rate Limiter
 * Implements sliding-window log/counter algorithm using Redis Sorted Sets (ZADD / ZREMRANGEBYSCORE).
 * Provides sub-millisecond atomic window evaluation with resilient in-memory fallback.
 */

import { randomUUID } from 'node:crypto';
import { redisClient } from '../cache/redisClient.js';

export function createRedisRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute sliding window
    maxRequests = 120,    // 120 requests per window
    keyPrefix = 'rl',
    message = 'Too many requests. Temporal rate limit exceeded. Please retry shortly.'
  } = options;

  // In-memory sliding window fallback store if Redis is unavailable
  const memoryFallback = new Map();

  return async function redisRateLimiterMiddleware(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const key = `${keyPrefix}:${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const windowSecs = Math.ceil(windowMs / 1000);

    const client = redisClient.getClient();

    if (client && redisClient.isConnected) {
      try {
        const requestId = `${now}:${randomUUID()}`;

        // Atomic Redis Pipeline Execution
        const pipeline = client.pipeline();
        // 1. Evict entries outside the sliding window
        pipeline.zremrangebyscore(key, 0, windowStart);
        // 2. Count requests currently in sliding window
        pipeline.zcard(key);
        // 3. Conditionally add current request and set expiration
        pipeline.zadd(key, now, requestId);
        pipeline.expire(key, windowSecs + 1);

        const results = await pipeline.exec();
        // results[1] is the output of zcard: [err, count]
        const currentCount = results[1][1];

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - (currentCount + 1)));
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

        if (currentCount >= maxRequests) {
          res.setHeader('Retry-After', windowSecs);
          return res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfterSeconds: windowSecs,
            policy: 'REDIS_SLIDING_WINDOW_COUNTER'
          });
        }

        return next();
      } catch (err) {
        console.warn('[RateLimiter] Redis pipeline execution failed, falling back to in-memory sliding window:', err.message);
      }
    }

    // In-Memory Sliding Window Fallback
    let timestamps = memoryFallback.get(key) || [];
    timestamps = timestamps.filter(ts => ts > windowStart);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - (timestamps.length + 1)));
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

    if (timestamps.length >= maxRequests) {
      res.setHeader('Retry-After', windowSecs);
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message,
        retryAfterSeconds: windowSecs,
        policy: 'MEMORY_SLIDING_WINDOW_FALLBACK'
      });
    }

    timestamps.push(now);
    memoryFallback.set(key, timestamps);

    // Garbage collection for memory map
    if (memoryFallback.size > 10000) {
      const cutoff = now - windowMs;
      for (const [k, v] of memoryFallback.entries()) {
        if (!v.some(ts => ts > cutoff)) {
          memoryFallback.delete(k);
        }
      }
    }

    next();
  };
}
