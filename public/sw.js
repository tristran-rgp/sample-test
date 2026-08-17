/** Zero Day — Service Worker: cache-first cho assets đã hash, network-first cho shell */
const CACHE = 'zd-cache-v1';
const IMMORTAL = /\/(assets|assert)\/|\?v=/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Assets content-hashed (?v=... hoặc /assets/) → cache-first vĩnh viễn
  if (IMMORTAL.test(url.pathname + url.search)) {
    event.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(request).then(hit =>
          hit || fetch(request).then(resp => {
            if (resp.ok) cache.put(request, resp.clone());
            return resp;
          }).catch(() => hit)
        )
      )
    );
    return;
  }

  // HTML / API → network-first, fallback cache
  event.respondWith(
    fetch(request).then(resp => {
      if (resp.ok && request.mode === 'navigate') {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
      }
      return resp;
    }).catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
  );
});
