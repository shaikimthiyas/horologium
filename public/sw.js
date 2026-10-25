/**
 * HOROLOGIUM ENTERPRISE SERVICE WORKER (PWA Offline Chronometer Engine v1.4.0)
 * 
 * - Cache-First for static assets, WebGL shaders, styles, and multi-page shell
 * - Network-First with synthetic offline fallback for /api/v1/* telemetry
 * - Stale-While-Revalidate for sovereign country & geodesic datasets
 */

const CACHE_NAME = 'horologium-core-v1.4.0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/flight-deck/',
  '/flight-deck/index.html',
  '/geodesic-registry/',
  '/geodesic-registry/index.html',
  '/operator-gateway/',
  '/operator-gateway/index.html',
  '/protocol-liaison/',
  '/protocol-liaison/index.html',
  '/api-explorer/',
  '/api-explorer/index.html',
  '/about/',
  '/about/index.html',
  '/status/',
  '/status/index.html',
  '/privacy/',
  '/privacy/index.html',
  '/404.html',
  '/src/styles/main.css',
  '/src/styles/tokens.css',
  '/src/styles/base.css',
  '/src/styles/layout.css',
  '/favicon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.info('[Horologium SW v1.4.0] Precaching multi-page application shell');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Horologium SW v1.4.0] Precache partial note (will populate on navigation):', err.message);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.info('[Horologium SW v1.4.0] Purging deprecated cache namespace:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // Stale-While-Revalidate + Synthetic Fallback for Telemetry API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Check cached response first
          return cache.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              const headers = new Headers(cachedResponse.headers);
              headers.set('X-Horologium-Offline-Cached', 'true');
              return cachedResponse;
            }

            // Synthetic offline response for time / telemetry endpoints
            const syntheticPayload = {
              offline: true,
              stratum: 'OFFLINE_TCXO_QUARTZ_EMULATOR',
              timestamp: new Date().toISOString(),
              systemStatus: 'SOVEREIGN_OFFLINE_MODE',
              message: 'Operating in disconnected / marine flight mode. Drift compensation active via client TCXO.'
            };

            return new Response(JSON.stringify(syntheticPayload), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Horologium-Offline': 'true'
              }
            });
          });
        });
      })
    );
    return;
  }

  // Cache-First for static assets, scripts, styles, images, and HTML shell
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Background revalidation
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
      });
    })
  );
});
