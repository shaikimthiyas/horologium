/**
 * Horologium Enterprise Service Worker (PWA Offline Engine)
 * Cache-First for core application shell, Stale-While-Revalidate for country data and telemetry
 */

const CACHE_NAME = 'horologium-core-v1.3.0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/flight-deck/',
  '/geodesic-registry/',
  '/operator-gateway/',
  '/protocol-liaison/',
  '/api-explorer/',
  '/src/styles/main.css',
  '/src/styles/tokens.css',
  '/src/styles/base.css',
  '/src/styles/layout.css',
  '/favicon.svg',
  '/public/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.info('[Horologium SW] Precaching application shell assets');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Horologium SW] Precache partial error (non-fatal):', err);
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
            console.info('[Horologium SW] Evicting deprecated cache:', name);
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

  // Stale-While-Revalidate for API endpoints
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Offline fallback from cache
          return cache.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response(JSON.stringify({
              offline: true,
              timestamp: new Date().toISOString(),
              message: 'Operating in disconnected / flight mode. Using offline IndexedDB storage.'
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        });
      })
    );
    return;
  }

  // Cache-First for static assets (Scripts, styles, images, HTML)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate cache
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
          return caches.match('/index.html');
        }
      });
    })
  );
});
