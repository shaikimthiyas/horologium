/**
 * Unit Tests: RFC 7807 Problem Details & Zod Request Schema Validation
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { z, validateRequest } from '../../server/middleware/schemaValidator.js';
import { problemDetailsErrorHandler, sendProblem, ProblemError } from '../../server/middleware/problemDetails.js';

describe('RFC 7807 Problem Details & Zod Schema Validation', () => {
  let app;
  let server;
  let baseUrl;

  before(async () => {
    app = express();
    app.use(express.json());

    const testQuerySchema = z.object({
      stationA: z.string().min(3),
      limit: z.coerce.number().int().min(1).max(100).optional()
    });

    const testBodySchema = z.object({
      email: z.string().email(),
      frequencyHz: z.number().positive()
    });

    app.get('/test/query', validateRequest({ query: testQuerySchema }), (req, res) => {
      res.json({ success: true, query: req.query });
    });

    app.post('/test/body', validateRequest({ body: testBodySchema }), (req, res) => {
      res.json({ success: true, body: req.body });
    });

    app.get('/test/custom-error', (req, res, next) => {
      next(new ProblemError({
        status: 409,
        title: 'Chronometer Oscillator Conflict',
        detail: 'Hardware quartz frequency mismatch detected.'
      }));
    });

    app.use(problemDetailsErrorHandler);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('should accept valid query parameters', async () => {
    const res = await fetch(`${baseUrl}/test/query?stationA=UTC&limit=25`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.query.limit, 25);
  });

  test('should reject invalid query with RFC 7807 Problem Details (status 400)', async () => {
    // stationA is too short (< 3 chars)
    const res = await fetch(`${baseUrl}/test/query?stationA=AB`);
    assert.equal(res.status, 400);
    assert.ok(res.headers.get('content-type').includes('application/problem+json'));

    const body = await res.json();
    assert.equal(body.status, 400);
    assert.equal(body.title, 'Invalid Request Parameters');
    assert.ok(Array.isArray(body.invalidParams));
    assert.equal(body.invalidParams[0].name, 'stationA');
  });

  test('should reject invalid body with RFC 7807 format', async () => {
    const res = await fetch(`${baseUrl}/test/body`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', frequencyHz: -5 })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.title, 'Invalid Request Parameters');
    assert.equal(body.invalidParams.length, 2);
  });

  test('should correctly format custom ProblemError instances', async () => {
    const res = await fetch(`${baseUrl}/test/custom-error`);
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.status, 409);
    assert.equal(body.title, 'Chronometer Oscillator Conflict');
    assert.equal(body.detail, 'Hardware quartz frequency mismatch detected.');
  });
});
