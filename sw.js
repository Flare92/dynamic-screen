// Service worker: rende l'app disponibile offline.
// Cambia VERSION a ogni rilascio per aggiornare la cache.
const VERSION = 'ritmo-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/engine.js',
  './js/exercises.js',
  './js/guide.js',
  './js/motions.js',
  './js/viewer3d.js',
  './js/fx.js',
  './js/sheet.js',
  './js/player.js',
  './vendor/three.module.min.js',
  './fonts/space-grotesk.woff2',
  './fonts/jetbrains-mono-500.woff2',
  './fonts/jetbrains-mono-700.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: risposta immediata dalla cache, aggiornamento in background.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    }),
  );
});
