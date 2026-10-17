/* ==========================================================================
   Bright Path PWA Service Worker
   - Offline resilience & caching
   - Push notifications via Firebase Messaging
   - Instant updates via SKIP_WAITING
   ========================================================================== */

const CACHE_NAME = 'bright-path-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/bright-path-logo.png',
  '/placeholder-logo.svg',
];

// Import Firebase background messaging script if present
try {
  importScripts('/firebase-messaging-sw.js');
} catch (err) {
  // Offline or running in an environment without firebase-messaging-sw.js
  console.log('[SW] Firebase messaging script not loaded or offline:', err);
}

// ── Install Event ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[SW] Pre-caching non-fatal warning:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate Event ───────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ── Fetch Event ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Skip browser extensions, socket.io, Next.js dev server HMR, and webpack hot updates
  if (
    url.protocol.startsWith('chrome-extension') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.includes('/_next/webpack-hmr') ||
    url.pathname.includes('.hot-update.')
  ) {
    return;
  }

  // 1. Navigation requests (HTML pages) - Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match(OFFLINE_URL);
        return (
          cachedOffline ||
          new Response(
            '<html><body><h1>Offline</h1><p>You are currently offline.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        );
      })
    );
    return;
  }

  // 2. API requests - Always network only
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 3. Static assets (images, fonts, pre-cached assets) - Stale-while-revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// ── Message Event (for instant SW activation) ────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
