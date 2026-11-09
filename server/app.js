/**
 * HOROLOGIUM DESIGN SYSTEM (v1.0.0-PRO) // CORE PRODUCTION SERVER SETUP
 * Enterprise Multi-Route & Meridian Telemetry Gateway
 */
import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { apiRouter } from './routes/api.js';
import { embedRouter } from './routes/embed.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { livenessProbe, readinessProbe, startupProbe } from './middleware/healthProbes.js';
import { problemDetailsErrorHandler } from './middleware/problemDetails.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Observability & OpenMetrics Middleware
app.use(metricsMiddleware);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Kubernetes-Standard Probes (Top-level Aliases)
app.get('/healthz', livenessProbe);
app.get('/livez', livenessProbe);
app.get('/readyz', readinessProbe);
app.get('/startupz', startupProbe);

// Top-level Prometheus Metrics endpoint alias
app.get('/metrics', (req, res, next) => {
  req.url = '/api/metrics';
  apiRouter(req, res, next);
});

// Serve static public folder (manifest, openapi.json, cover, etc.)
const publicPath = resolve(__dirname, '../public');
if (existsSync(publicPath)) {
  app.use('/public', express.static(publicPath));
}

// Serve OpenAPI Specification & Postman Collection
app.get(['/openapi.json', '/api/openapi.json'], (req, res) => {
  const specPath = resolve(__dirname, '../public/openapi.json');
  if (existsSync(specPath)) {
    res.setHeader('Content-Type', 'application/json');
    return res.sendFile(specPath);
  }
  res.status(404).json({ error: 'OpenAPI specification not found.' });
});

app.get(['/horologium.postman_collection.json', '/api/postman.json'], (req, res) => {
  const postmanPath = resolve(__dirname, '../public/horologium.postman_collection.json');
  if (existsSync(postmanPath)) {
    res.setHeader('Content-Type', 'application/json');
    return res.sendFile(postmanPath);
  }
  res.status(404).json({ error: 'Postman collection not found.' });
});

// Enterprise Route Aliases & Legacy Redirections (Zero-Breakage Guarantee)
const redirectWithTrailingSlash = (targetPath) => (req, res, next) => {
  if (req.path === targetPath) return next();
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, `${targetPath}${qs}`);
};

app.get(['/horo', '/horologium'], redirectWithTrailingSlash('/horo/'));
app.get(['/flight-deck', '/map'], redirectWithTrailingSlash('/flight-deck/'));
app.get(['/geodesic-registry', '/registry', '/directory', '/country'], redirectWithTrailingSlash('/geodesic-registry/'));
app.get(['/operator-gateway', '/operator', '/security', '/auth'], redirectWithTrailingSlash('/operator-gateway/'));
app.get(['/protocol-liaison', '/liaison', '/inquiry', '/contact'], redirectWithTrailingSlash('/protocol-liaison/'));
app.get(['/docs', '/api/docs', '/api-explorer'], redirectWithTrailingSlash('/api-explorer/'));
app.get(['/developers', '/developer', '/portal', '/business'], redirectWithTrailingSlash('/developers/'));
app.get(['/about', '/colophon', '/author'], redirectWithTrailingSlash('/about/'));
app.get(['/status', '/telemetry', '/uptime'], redirectWithTrailingSlash('/status/'));
app.get(['/privacy', '/legal', '/terms'], redirectWithTrailingSlash('/privacy/'));

// API Routes
// Public Embeddable Service & Standalone Iframes
app.use('/embed', embedRouter);

// Static Widgets CDN Route
const widgetsPath = resolve(__dirname, '../public/widgets');
if (existsSync(widgetsPath)) {
  app.use('/widgets', express.static(widgetsPath));
}

// SDK CDN Route
const sdkPath = resolve(__dirname, '../public/sdk');
if (existsSync(sdkPath)) {
  app.use('/sdk', express.static(sdkPath));
}

app.use('/api', apiRouter);

// Production Static Distribution & Multi-Page Routing
const distPath = resolve(__dirname, '../dist');
const rootPath = resolve(__dirname, '../');
const baseStatic = existsSync(distPath) ? distPath : rootPath;

app.use(express.static(baseStatic));

// Explicit directory handlers to guarantee sub-page index resolution
const resolvePage = (rel) => {
  const inDist = resolve(distPath, rel);
  if (existsSync(inDist)) return inDist;
  return resolve(rootPath, rel);
};

app.get('/', (req, res) => res.sendFile(resolvePage('index.html')));
app.get('/horo/', (req, res) => res.sendFile(resolvePage('horo/index.html')));
app.get('/about/', (req, res) => res.sendFile(resolvePage('about/index.html')));
app.get('/status/', (req, res) => res.sendFile(resolvePage('status/index.html')));
app.get('/privacy/', (req, res) => res.sendFile(resolvePage('privacy/index.html')));
app.get('/flight-deck/', (req, res) => res.sendFile(resolvePage('flight-deck/index.html')));
app.get('/geodesic-registry/', (req, res) => res.sendFile(resolvePage('geodesic-registry/index.html')));
app.get('/operator-gateway/', (req, res) => res.sendFile(resolvePage('operator-gateway/index.html')));
app.get('/protocol-liaison/', (req, res) => res.sendFile(resolvePage('protocol-liaison/index.html')));
app.get('/api-explorer/', (req, res) => res.sendFile(resolvePage('api-explorer/index.html')));
app.get('/developers/', (req, res) => res.sendFile(resolvePage('developers/index.html')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  const notFoundPath = resolvePage('404.html');
  if (existsSync(notFoundPath)) {
    return res.status(404).sendFile(notFoundPath);
  }
  // Route to root index for unmapped front-end paths
  res.sendFile(resolvePage('index.html'));
});

// RFC 7807 Standardized Problem Details Error Middleware
app.use(problemDetailsErrorHandler);
