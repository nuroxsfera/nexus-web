const CACHE = 'nexus-v24';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  '/app-data.js',
  '/health-vault.js',
  '/auth.js',
  '/cloud-social.js',
  '/app-logic.js',
  '/icon.svg'
];
const NETWORK_FIRST = new Set(ASSETS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Always check the network for the app shell first. This prevents an installed
  // PWA from silently running old JavaScript after a successful deployment.
  if (NETWORK_FIRST.has(url.pathname) || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).catch(() => caches.match('/')))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
