/**
 * Horologium Enterprise Request Tracing Middleware
 * Generates or propagates RFC 4122 UUID v4 correlation IDs
 * across all inbound and outbound HTTP transactions.
 */

import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.trim().length > 0)
    ? incomingId.trim()
    : randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
