const CACHE_APP = 'c555-app-v1779083979';
const CACHE_TILES = 'c555-tiles-v1';
const APP_SHELL = ['./index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_APP).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n.startsWith('c555-app-') && n !== CACHE_APP).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Tile requests: cache-first
  if (url.hostname.includes('tiles.openfreemap.org') && (url.pathname.includes('.pbf') || url.pathname.includes('/fonts/') || url.pathname.includes('/sprites/'))) {
    e.respondWith(
      caches.open(CACHE_TILES).then(c =>
        c.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(resp => {
            if (resp.ok || resp.type === 'opaque') c.put(e.request, resp.clone());
            return resp;
          }).catch(() => new Response('', {status: 503}));
        })
      )
    );
    return;
  }
  // CDN assets (maplibre JS/CSS): cache-first
  if (url.hostname === 'unpkg.com') {
    e.respondWith(
      caches.open(CACHE_APP).then(c =>
        c.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(resp => {
            if (resp.ok) c.put(e.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }
  // App shell: network-first, fallback cache for offline race use.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (e.request.method === 'GET' && resp.ok) {
          caches.open(CACHE_APP).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Everything else: network-first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
