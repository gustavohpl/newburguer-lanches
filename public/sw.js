// app instalável: página sempre da rede (cai na última cópia se offline); arquivos estáticos do cache; API nunca passa por aqui
const CACHE = 'nb-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put('/', c)); }
      return r;
    }).catch(() => caches.match('/')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(req, c)); }
      return r;
    })));
    return;
  }
  if (url.pathname.endsWith('.json')) return;
  if (/^\/(prime|icons)\//.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then((k) => k.match(req).then((hit) => {
      const rede = fetch(req).then((r) => { if (r.ok) k.put(req, r.clone()); return r; });
      return hit || rede;
    })));
  }
});
