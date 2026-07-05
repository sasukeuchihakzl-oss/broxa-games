/* Service Worker — Forge of Life (BROXA GAMES) PWA
   Estratégia:
   - App shell (index.html + ícones + manifest) em cache pra abrir offline.
   - Navegação: tenta rede; se cair, serve o index.html do cache.
   - Mesma origem (GET): cache-first com atualização em segundo plano (stale-while-revalidate).
   - Firebase / fontes (cross-origin): passa direto pela rede (não cacheia dados ao vivo).
   Pra forçar atualização do app, suba o número da versão abaixo. */
const VERSION = 'fol-v107';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navegação (abrir o app): SEMPRE busca HTML fresco (ignora cache do navegador);
  // só cai pro index.html do cache se estiver offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'reload' })
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cross-origin (Firebase, Google Fonts): deixa a rede cuidar.
  if (!sameOrigin) return;

  // Mesma origem: stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
