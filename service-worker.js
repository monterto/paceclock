const CACHE_NAME = 'pace-clock-v6'; // Increment when assets change

const ASSETS = [
  './',                    // Root path
  './index.html',          // Main HTML
  './manifest.json',       // PWA manifest
  './style.css',           // Styles
  './app.js',              // Application logic
  './icons/icon-192.png',  // App icon 192x192
  './icons/icon-512.png'   // App icon 512x512
];

// ============================================================================
// INSTALL - Pre-cache all essential assets
// ============================================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell and assets');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[SW] All assets cached successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Cache installation failed:', error);
        throw error;
      })
  );
});

// ============================================================================
// ACTIVATE - Clean up old caches and take control
// ============================================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    // Delete all caches except current version
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        // Take control of all pages immediately
        return self.clients.claim();
      })
      .catch(error => {
        console.error('[SW] Activation failed:', error);
        throw error;
      })
  );
});

// ============================================================================
// FETCH - Aggressive cache-first strategy with fallbacks
// ============================================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    handleFetch(request)
      .catch(error => {
        console.error('[SW] Fetch handler error:', error);
        // Final fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./index.html')
            .then(response => response || caches.match('./'));
        }
        // Return error for non-navigation requests
        return new Response('Offline - Asset not cached', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});

/**
 * Handle fetch with comprehensive offline-first strategy
 */
async function handleFetch(request) {
  // 1. Try to get from cache first (OFFLINE-FIRST)
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Serving from cache:', request.url);
    
    // Update cache in background if online (don't wait for it)
    if (navigator.onLine) {
      updateCacheInBackground(request).catch(() => {
        // Silently fail - we already have cached version
      });
    }
    
    return cachedResponse;
  }

  // 2. Not in cache - try network
  console.log('[SW] Cache miss, trying network:', request.url);
  
  try {
    const networkResponse = await fetch(request);
    
    // If successful, cache the response for next time
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      // Clone response because it can only be consumed once
      cache.put(request, networkResponse.clone());
      console.log('[SW] Cached new resource:', request.url);
    }
    
    return networkResponse;
    
  } catch (networkError) {
    console.warn('[SW] Network request failed:', request.url, networkError.message);
    
    // 3. Network failed - try cache without query params
    const urlWithoutParams = stripQueryParams(request.url);
    if (urlWithoutParams !== request.url) {
      const fallbackResponse = await caches.match(urlWithoutParams);
      if (fallbackResponse) {
        console.log('[SW] Serving from cache (without params):', urlWithoutParams);
        return fallbackResponse;
      }
    }
    
    // 4. For navigation requests, serve index.html as fallback
    if (request.mode === 'navigate') {
      console.log('[SW] Navigation request failed, serving index.html');
      const indexResponse = await caches.match('./index.html');
      if (indexResponse) {
        return indexResponse;
      }
      
      // Try root as final fallback
      const rootResponse = await caches.match('./');
      if (rootResponse) {
        return rootResponse;
      }
    }
    
    // 5. Nothing worked - throw error to be caught by outer handler
    throw new Error(`Failed to fetch: ${request.url}`);
  }
}

/**
 * Update cache in background (don't block response)
 */
async function updateCacheInBackground(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse);
      console.log('[SW] Background cache update:', request.url);
    }
  } catch (error) {
    // Background update failed - not critical since we have cached version
    console.log('[SW] Background update failed (expected if offline):', request.url);
  }
}

/**
 * Remove query parameters from URL
 */
function stripQueryParams(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch (error) {
    return url;
  }
}

// ============================================================================
// MESSAGE HANDLER - Allow pages to communicate with service worker
// ============================================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    console.log('[SW] Manual cache request for:', event.data.urls);
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(event.data.urls))
        .then(() => {
          console.log('[SW] Manual cache completed');
        })
    );
  }
});

console.log('[SW] Service worker script loaded');
