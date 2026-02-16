const CACHE_NAME = 'pace-clock-v7'; // Increment version

const ASSETS = [
  './',               // The root
  './index.html',     // The specific file
  './manifest.json',
  './style.css',      // Ensure CSS is included!
  './app.js',         // Ensure JS is included!
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 1. Install - Pre-cache essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activate - Aggressive cleanup of old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Purging old cache:', key);
              return caches.delete(key);
            })
      )
    )
  );
  self.clients.claim(); // Take control of page immediately
});

// 3. Fetch - The "Offline-Proof" Strategy
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached asset if it exists
      if (response) return response;

      // Otherwise, try network
      return fetch(event.request).catch(() => {
        /**
         * FAILSAFE: If network fails and it's a navigation (refresh),
         * serve index.html from the cache.
         */
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
