// YCTAS! Plan 2 — offline support (service worker)
const CACHE_NAME = 'yctas-plan2-v50';

const FILES_TO_CACHE = [
  './',
  'app.js?v=46',
  'apple-touch-icon.png',
  'argentina.png',
  'bolivia.png',
  'capitals_song.mp3',
  'chile.png',
  'clip_argentina.mp3',
  'clip_bolivia.mp3',
  'clip_cap_argentina.mp3',
  'clip_cap_bolivia.mp3',
  'clip_cap_chile.mp3',
  'clip_cap_colombia.mp3',
  'clip_cap_costa_rica.mp3',
  'clip_cap_cuba.mp3',
  'clip_cap_ecuador.mp3',
  'clip_cap_el_salvador.mp3',
  'clip_cap_espana.mp3',
  'clip_cap_guatemala.mp3',
  'clip_cap_honduras.mp3',
  'clip_cap_mexico.mp3',
  'clip_cap_nicaragua.mp3',
  'clip_cap_panama.mp3',
  'clip_cap_paraguay.mp3',
  'clip_cap_peru.mp3',
  'clip_cap_puerto_rico.mp3',
  'clip_cap_republica_dominicana.mp3',
  'clip_cap_uruguay.mp3',
  'clip_cap_venezuela.mp3',
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
  'compare.json?v=46',
  'costa_rica.png',
  'countries.json?v=46',
  'countries_song.mp3',
  'cuba.png',
  'cues_capitals.json?v=46',
  'cues_countries.json?v=46',
  'ecuador.png',
  'eg.js?v=46',
  'eg_capital.mp3',
  'eg_data.json?v=46',
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
  'manifest.json?v=46',
  'map.json?v=46',
  'mexico.png',
  'nicaragua.png',
  'panama.png',
  'paraguay.png',
  'peru.png',
  'puerto_rico.png',
  'republica_dominicana.png',
  'songplayer.js?v=46',
  'style.css?v=46',
  'tester.js?v=46',
  'uruguay.png',
  'venezuela.png',
  'game3.js?v=27',
  'game3_data.json?v=27',
  'match_games.js?v=27',
  'match_games_data.json?v=27',
  'paula.png',
  'lez.png',
  'clifford.png',
  'harry.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const failed = [];
      await Promise.all(FILES_TO_CACHE.map(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) { failed.push(url + ' (HTTP ' + res.status + ')'); return; }
          await cache.put(url, res);
        } catch (err) {
          failed.push(url + ' (' + err.message + ')');
        }
      }));
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
    caches.match(event.request).then((cached) => {
      if(cached) return cached;
      return fetch(event.request).then((res) => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
