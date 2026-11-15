// Service worker: rende l'app disponibile offline e la tiene aggiornata.
// Cambia VERSION a ogni rilascio.
// - codice e pagina: prima la rete (sempre l'ultima versione), la cache solo senza connessione;
// - foto degli esercizi: prima la cache (non cambiano), in una cache a parte che sopravvive agli aggiornamenti.
const VERSION = 'ritmo-v12';
const MEDIA = 'ritmo-media-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/flow.js',
  './js/indagine.js',
  './js/engine.js',
  './js/exercises.js',
  './js/guide.js',
  './js/guide-extra.js',
  './js/demos.js',
  './js/demo.js',
  './js/fx.js',
  './js/sheet.js',
  './js/player.js',
  './js/assessment.js',
  './js/assess-ui.js',
  './js/narrative.js',
  './js/gymreview.js',
  './js/diet.js',
  './js/giornata.js',
  './js/coppia.js',
  './js/ai.js',
  './fonts/figtree.woff2',
  './fonts/fraunces.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' scavalca la cache HTTP del browser: si scarica davvero la versione nuova
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/media/')) {
    e.respondWith(
      caches.open(MEDIA).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const cached = await cache.match(req, { ignoreSearch: true });
        return cached || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
      }
    }),
  );
});
