/**
 * Horologium Enterprise API Key & Tenant Governance Middleware
 * Provides cryptographically secure API key authentication, per-tenant rate limits,
 * domain origin validation, and automatic usage metrics logging.
 */
import { getApiKeyByRaw, recordApiKeyUsage } from '../db/database.js';

export function extractApiKey(req) {
  // 1. Check X-Horologium-Key custom header
  if (req.headers['x-horologium-key']) {
    return String(req.headers['x-horologium-key']).trim();
  }

  // 2. Check Authorization: Bearer hlg_live_*
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith('hlg_')) {
      return token;
    }
  }

  // 3. Fallback to query parameter ?apiKey=...
  if (req.query && req.query.apiKey) {
    return String(req.query.apiKey).trim();
  }

  return null;
}

function checkOriginDomain(allowedDomains, reqOrigin) {
  if (!allowedDomains || allowedDomains === '*') return true;
  if (!reqOrigin) return true; // Server-to-server calls may not have Origin header

  try {
    const originHost = new URL(reqOrigin).hostname.toLowerCase();
    const domains = allowedDomains.split(',').map(d => d.trim().toLowerCase());
    return domains.some(domain => {
      if (domain === '*' || domain === originHost) return true;
      if (domain.startsWith('*.') && originHost.endsWith(domain.slice(2))) return true;
      return originHost === domain;
    });
  } catch (_) {
    return false;
  }
}

/**
 * Optional API Key Authenticator
 * Attaches tenant info if present, falls back gracefully to anonymous tier.
 */
export function apiKeyAuthenticator(req, res, next) {
  const startTime = performance.now();
  const rawKey = extractApiKey(req);

  if (!rawKey) {
    req.apiKeyTenant = null;
    req.apiTier = 'anonymous';
    return next();
  }

  const tenant = getApiKeyByRaw(rawKey);
  if (!tenant) {
    return res.status(401).json({
      type: 'https://horologium.io/errors/unauthorized',
      title: 'Invalid API Key',
      status: 401,
      detail: 'The provided Horologium API key is invalid or has been revoked.',
      instance: req.originalUrl || req.url
    });
  }

  // Check Domain Whitelisting
  const origin = req.headers['origin'] || req.headers['referer'];
  if (origin && !checkOriginDomain(tenant.allowed_domains, origin)) {
    return res.status(403).json({
      type: 'https://horologium.io/errors/forbidden',
      title: 'Domain Not Allowed',
      status: 403,
      detail: `Origin '${origin}' is not authorized to use API key prefix '${tenant.key_prefix}'.`,
      instance: req.originalUrl || req.url
    });
  }

  req.apiKeyTenant = tenant;
  req.apiTier = tenant.tier || 'partner';

  // Informative enterprise response headers
  res.setHeader('X-Horologium-Tenant', tenant.tenant_name);
  res.setHeader('X-Horologium-Tier', tenant.tier);
  res.setHeader('X-RateLimit-Limit', tenant.rate_limit_rpm);

  // Asynchronously record latency & usage on request completion
  res.on('finish', () => {
    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    recordApiKeyUsage(tenant.id, req.baseUrl + req.path, res.statusCode, latencyMs);
  });

  next();
}

/**
 * Strict API Key Mandate Middleware
 * Rejects requests that do not supply a valid enterprise/partner API key.
 */
export function requireApiKey(req, res, next) {
  apiKeyAuthenticator(req, res, () => {
    if (!req.apiKeyTenant) {
      return res.status(401).json({
        type: 'https://horologium.io/errors/unauthorized',
        title: 'Authentication Required',
        status: 401,
        detail: 'A valid Horologium API key is required to access this endpoint. Generate one at /developers/.',
        instance: req.originalUrl || req.url
      });
    }
    next();
  });
}
