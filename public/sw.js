/* Service Worker for Privex V3 */
const CACHE_NAME = 'privex-v3-dynamic';
const assets = ['/', '/index.html', '/manifest.json'];

// 1. INSTALL: Cache core files immediately
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force this new worker to take over immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assets))
  );
});

// 2. ACTIVATE: Delete old caches to force update
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim(); // Take control of all open clients instantly
});

// 3. FETCH: Network First, then Cache (Ensures you always get the latest update)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});