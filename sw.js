// YCTAS! Plan 2 — offline support (service worker)
//
// How this works, in plain terms: the first time a student opens the app
// with internet, this quietly saves a full copy of every file onto their
// device. After that, the app opens and works even with no internet at all
// — songs, games, progress tracking, everything.
//
// CACHE_NAME is tied to the app's own version number on purpose. Every time
// a new version ships, this number bumps too, which makes the browser throw
// away the old saved copy and fetch a completely fresh one — the same fix
// that's been used everywhere else in this app to avoid stale-cache bugs.
const CACHE_NAME = 'yctas-plan2-v41';

const FILES_TO_CACHE = [
  './',
  'app.js?v=41',
  'apple-touch-icon.png',
  'argentina.png',
  'bolivia.png',
  'capitals_song.mp3',
  'chile.png',
  'clip_argentina.mp3',
  'clip_bolivia.mp3',
  'clip_chile.mp3',
  'clip_colombia.mp3',
  'clip_costa_rica.mp3',
  'clip_cuba.mp3',
  'clip_ecuador.mp3',
  'clip_el_salvador.mp3',
  'clip_espana.mp3',
  'clip_guatemala.mp3',
  'clip_honduras.mp3',
  'clip_mexico.mp3',
  'clip_nicaragua.mp3',
  'clip_panama.mp3',
  'clip_paraguay.mp3',
  'clip_peru.mp3',
  'clip_puerto_rico.mp3',
  'clip_republica_dominicana.mp3',
  'clip_uruguay.mp3',
  'clip_venezuela.mp3',
  'colombia.png',
  'compare.json?v=41',
  'costa_rica.png',
  'countries.json?v=41',
  'countries_song.mp3',
  'cuba.png',
  'cues_capitals.json?v=41',
  'cues_countries.json?v=41',
  'ecuador.png',
  'eg.js?v=41',
  'eg_capital.mp3',
  'eg_data.json?v=41',
  'eg_flag.png',
  'eg_gentilicio.mp3',
  'eg_malabo.mp3',
  'eg_name.mp3',
  'el_salvador.png',
  'equatorial_guinea.png',
  'espana.png',
  'guatemala.png',
  'honduras.png',
  'icon-192.png',
  'icon-512.png',
  'index.html',
  'manifest.json?v=41',
  'map.json?v=41',
  'mexico.png',
  'nicaragua.png',
  'panama.png',
  'paraguay.png',
  'peru.png',
  'puerto_rico.png',
  'republica_dominicana.png',
  'songplayer.js?v=41',
  'style.css?v=41',
  'tester.js?v=41',
  'uruguay.png',
  'venezuela.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const failed = [];
      for (const url of FILES_TO_CACHE) {
        try {
          const res = await fetch(url);
          if (!res.ok) { failed.push(url + ' (HTTP ' + res.status + ')'); continue; }
          await cache.put(url, res);
        } catch (err) {
          failed.push(url + ' (' + err.message + ')');
        }
      }
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.postMessage({
        type: 'sw-cache-report',
        total: FILES_TO_CACHE.length,
        failedCount: failed.length,
        failed: failed,
      }));
    })
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
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
