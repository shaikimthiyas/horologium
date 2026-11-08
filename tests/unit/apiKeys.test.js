import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateApiKey,
  hashApiKey,
  createApiKey,
  getApiKeyByRaw,
  getApiKeyByHash,
  recordApiKeyUsage,
  listApiKeys,
  revokeApiKey
} from '../../server/db/database.js';

describe('Enterprise API Key & Tenant Governance Engine', () => {
  it('should generate valid hlg_live_* keys with cryptographic prefix and hash', () => {
    const { rawKey, keyPrefix, keyHash } = generateApiKey();
    assert.ok(rawKey.startsWith('hlg_live_'), 'Key must start with hlg_live_ prefix');
    assert.equal(keyPrefix, rawKey.slice(0, 15));
    assert.equal(typeof keyHash, 'string');
    assert.equal(keyHash.length, 64, 'SHA-256 hash must be 64 hex characters');
  });

  it('should hash keys deterministically using SHA-256', () => {
    const key = 'hlg_live_testkey1234567890abcdef';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    assert.equal(hash1, hash2, 'Hash must be deterministic');
    assert.equal(hash1.length, 64);
  });

  it('should provision partner API key with 1200 RPM rate limit tier', () => {
    const tenant = createApiKey({
      tenantName: 'Stripe Global Time',
      tenantEmail: 'eng@stripe.com',
      allowedDomains: 'stripe.com,dashboard.stripe.com',
      tier: 'partner',
      rateLimitRpm: 1200
    });

    assert.ok(tenant.id > 0);
    assert.ok(tenant.rawKey.startsWith('hlg_live_'));
    assert.equal(tenant.tenantName, 'Stripe Global Time');
    assert.equal(tenant.tier, 'partner');
    assert.equal(tenant.rateLimitRpm, 1200);

    // Verify key retrieval by raw string
    const found = getApiKeyByRaw(tenant.rawKey);
    assert.ok(found, 'Must retrieve tenant record by raw API key');
    assert.equal(found.tenant_name, 'Stripe Global Time');
    assert.equal(found.tenant_email, 'eng@stripe.com');
  });

  it('should record API usage metrics and update requests_today counter', () => {
    const tenant = createApiKey({
      tenantName: 'Linear Schedulers',
      tenantEmail: 'team@linear.app'
    });

    const initial = getApiKeyByRaw(tenant.rawKey);
    const prevCount = initial.requests_today || 0;

    recordApiKeyUsage(tenant.id, '/api/v1/time', 200, 3.45);

    const updated = getApiKeyByRaw(tenant.rawKey);
    assert.equal(updated.requests_today, prevCount + 1);
    assert.ok(updated.last_used_at, 'Must update last_used_at timestamp');
  });

  it('should list all keys and revoke an existing key', () => {
    const tenant = createApiKey({
      tenantName: 'Revoke Test',
      tenantEmail: 'temp@test.com'
    });

    const beforeList = listApiKeys();
    assert.ok(beforeList.some(k => k.key_prefix === tenant.keyPrefix));

    revokeApiKey(tenant.id);

    const after = getApiKeyByRaw(tenant.rawKey);
    assert.equal(after, null, 'Revoked key must return null');
  });
});
