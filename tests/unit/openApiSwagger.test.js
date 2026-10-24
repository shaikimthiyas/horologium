/**
 * Unit Test Suite: Sprint I - OpenAPI 3.1 Specification, Swagger UI & Postman Collection
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../../server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

describe('Sprint I: OpenAPI 3.1 Specification, Swagger UI & Postman Collection', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
      server.unref();
    }
  });

  test('OpenAPI 3.1 Specification Schema & Canonical Endpoint Integrity', () => {
    const specPath = resolve(rootDir, 'public/openapi.json');
    assert.ok(existsSync(specPath), 'openapi.json must exist in public directory');

    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    assert.equal(spec.openapi, '3.1.0', 'OpenAPI version must be 3.1.0');
    assert.ok(spec.info.title.includes('HOROLOGIUM'), 'Title must identify HOROLOGIUM');
    assert.ok(spec.info.version, 'Must define API version');

    // Canonical routes must be documented
    const paths = Object.keys(spec.paths);
    assert.ok(paths.includes('/healthz'), 'Must document /healthz');
    assert.ok(paths.includes('/readyz'), 'Must document /readyz');
    assert.ok(paths.includes('/startupz'), 'Must document /startupz');
    assert.ok(paths.includes('/metrics'), 'Must document /metrics');
    assert.ok(paths.includes('/api/v1/time'), 'Must document /api/v1/time');
    assert.ok(paths.includes('/api/v1/stratum1/sync'), 'Must document /api/v1/stratum1/sync');
    assert.ok(paths.includes('/api/v1/zones/overlap'), 'Must document /api/v1/zones/overlap');
    assert.ok(paths.includes('/api/v1/countries'), 'Must document /api/v1/countries');

    // RFC 7807 ProblemDetails schema must be defined
    const schemas = spec.components.schemas;
    assert.ok(schemas.ProblemDetails, 'Must define RFC 7807 ProblemDetails schema');
    assert.ok(schemas.ProblemDetails.properties.type, 'ProblemDetails must have type property');
    assert.ok(schemas.ProblemDetails.properties.title, 'ProblemDetails must have title property');
    assert.ok(schemas.ProblemDetails.properties.status, 'ProblemDetails must have status property');
  });

  test('Official Postman Collection (v2.1.0) Structure & Test Scripts', () => {
    const postmanPath = resolve(rootDir, 'public/horologium.postman_collection.json');
    assert.ok(existsSync(postmanPath), 'horologium.postman_collection.json must exist in public directory');

    const collection = JSON.parse(readFileSync(postmanPath, 'utf8'));
    assert.ok(collection.info.schema.includes('v2.1.0'), 'Must conform to Postman schema v2.1.0');
    assert.ok(collection.info.name.includes('HOROLOGIUM'), 'Collection name must identify HOROLOGIUM');

    // Verify folder organization
    const folders = collection.item.map(i => i.name);
    assert.ok(folders.includes('Kubernetes Health & Probes'), 'Must contain Kubernetes Health & Probes folder');
    assert.ok(folders.includes('Stratum-1 Chronometry & Consensus'), 'Must contain Stratum-1 Chronometry & Consensus folder');
    assert.ok(folders.includes('Sovereign Geodesic Directory'), 'Must contain Sovereign Geodesic Directory folder');

    // Verify test assertions are embedded
    let totalRequests = 0;
    let requestsWithTests = 0;

    for (const folder of collection.item) {
      if (Array.isArray(folder.item)) {
        for (const req of folder.item) {
          totalRequests++;
          if (Array.isArray(req.event) && req.event.some(e => e.listen === 'test')) {
            requestsWithTests++;
          }
        }
      }
    }

    assert.ok(totalRequests >= 5, 'Must contain at least 5 structured test requests');
    assert.equal(requestsWithTests, totalRequests, 'All requests must include automated test assertions');
  });

  test('API Explorer HTML: Dual-view HUD and Swagger UI integration', () => {
    const htmlPath = resolve(rootDir, 'api-explorer/index.html');
    assert.ok(existsSync(htmlPath), 'api-explorer/index.html must exist');

    const html = readFileSync(htmlPath, 'utf8');
    assert.ok(html.includes('swaggerUiContainer'), 'Must contain Swagger UI container element');
    assert.ok(html.includes('viewHud'), 'Must contain Calibre-01 HUD view');
    assert.ok(html.includes('btnViewSwagger'), 'Must contain Swagger UI view toggle button');
    assert.ok(html.includes('horologium.postman_collection.json'), 'Must contain Postman collection download link');
    assert.ok(html.includes('/openapi.json'), 'Must link to raw openapi.json');
  });

  test('HTTP Endpoint: GET /openapi.json returns valid specification', async () => {
    const res = await fetch(`${baseUrl}/openapi.json`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('application/json'));

    const data = await res.json();
    assert.equal(data.openapi, '3.1.0');
  });

  test('HTTP Endpoint: GET /horologium.postman_collection.json returns collection payload', async () => {
    const res = await fetch(`${baseUrl}/horologium.postman_collection.json`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('application/json'));

    const data = await res.json();
    assert.ok(data.info.name.includes('HOROLOGIUM'));
  });
});
