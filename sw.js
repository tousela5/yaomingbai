const CACHE_NAME = 'yaomingbai-shell-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './sw.js',
  './data/medicine-catalog.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const INDEX_URL = new URL('./index.html', self.location.href).href;

function requestUrl(request) {
  return new URL(typeof request === 'string' ? request : request.url, self.location.href);
}

function isSameOrigin(request) {
  return requestUrl(request).origin === self.location.origin;
}

async function cacheResponse(request, response) {
  if (!response || !response.ok || !isSameOrigin(request)) return response;
  try {
    const cache = await caches.open(CACHE_NAME);
    const cacheRequest = new Request(requestUrl(request).href);
    await cache.put(cacheRequest, response.clone());
  } catch {
    // A network response is still useful when a browser refuses a cache write.
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('yaomingbai-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;

  // Network first keeps a newly published catalog or script visible immediately;
  // the app shell remains available when the phone is offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response.ok ? cacheResponse(INDEX_URL, response) : response)
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => cacheResponse(request, response))
      .catch(() => caches.match(request))
  );
});
