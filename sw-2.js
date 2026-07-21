/* Unknown Files — Podcast Studio Lite
   Minimal offline app-shell cache. Episode data itself lives in
   LocalStorage (already available offline); this only ensures the
   HTML/CSS/JS shell loads without a network connection.

   Strategy: NETWORK-FIRST for the shell (index.html/style.css/script.js)
   so a fresh deploy is always picked up when online, falling back to
   the cached copy only when the network request fails (offline).
   Bump CACHE_NAME whenever you want to force old caches to be dropped. */

const CACHE_NAME = 'unknown-files-shell-v2';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests; let cross-origin
  // (fonts, icons, QR images) pass through to the network as-is.
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
