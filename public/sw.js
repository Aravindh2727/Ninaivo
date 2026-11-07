/**
 * Service Worker for Ninaivo
 * Provides offline shell caching, asset persistence, and update handling
 */

const CACHE_NAME = 'ninaivo-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/ninaivo_favicon.png',
  '/icons/ninaivo_app_icon_light.png',
  '/icons/ninaivo_app_icon_dark.png',
  '/icons/ninaivo_icon_192.png',
  '/icons/ninaivo_icon_512.png',
  '/icons/ninaivo_icon_maskable.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg'
];

// Install: Cache initial application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW pre-cache warning:', err);
      });
    })
  );
  // Do not automatically force skipWaiting without user notification
});

// Activate: Clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache external API calls, Firebase Firestore, or Cloudinary uploads in SW (handled via SDK persistence)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('cloudinary.com') ||
    req.method !== 'GET'
  ) {
    return;
  }

  // Navigation requests: Network first with cached index.html fallback for SPA
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Static assets (scripts, styles, images, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return cached or pass through
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for skipWaiting message from client application
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

