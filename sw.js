// YCTAS! Plan 2 — offline support (service worker)
//
// Note on login/accounts: the Firebase CDN scripts are NOT precached here on
// purpose — they're cross-origin (gstatic.com), and the login feature
// already degrades gracefully with no internet. Precaching third-party
// scripts adds real complexity for a feature that's fully optional by
// design.
const CACHE_NAME = 'yctas-plan2-v50';

const FILES_TO_CACHE = [
  './',
  'app.js?v=50',
  'apple-touch-icon.png',
  'argentina.png',
  'auth.js?v=50',
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
  'compare.json?v=50',
  'costa_rica.png',
  'countries.json?v=50',
  'countries_song.mp3',
  'cuba.png',
  'cues_capitals.json?v=50',
  'cues_countries.json?v=50',
  'ecuador.png',
  'eg.js?v=50',
  'eg_capital.mp3',
  'eg_data.json?v=50',
  'eg_flag.png',
  'eg_gentilicio.mp3',
  'eg_malabo.mp3',
  'eg_name.mp3',
  'el_salvador.png',
  'equatorial_guinea.png',
  'espana.png',
  'game3.js?v=50',
  'game3_data.json?v=50',
  'guatemala.png',
  'honduras.png',
  'icon-192.png',
  'icon-512.png',
  'index.html',
  'manifest.json?v=50',
  'map.json?v=50',
  'match_games.js?v=50',
  'match_games_data.json?v=50',
  'mexico.png',
  'nicaragua.png',
  'panama.png',
  'paraguay.png',
  'peru.png',
  'puerto_rico.png',
  'republica_dominicana.png',
  'songplayer.js?v=50',
  'style.css?v=50',
  'tester.js?v=50',
  'uruguay.png',
  'venezuela.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Fetching all files at once overwhelms a real mobile connection —
      // the browser can only hold a handful of simultaneous connections per
      // site, so most requests just queue up and some quietly stall before
      // finishing. Fixed by fetching a small batch at a time, with
      // automatic retries for anything that fails.
      const BATCH_SIZE = 6;
      const MAX_ATTEMPTS = 3;
      const failed = [];

      async function fetchOne(url){
        for(let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++){
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            await cache.put(url, res);
            return true;
          } catch (err) {
            if(attempt === MAX_ATTEMPTS) return err.message;
          }
        }
      }

      for(let i = 0; i < FILES_TO_CACHE.length; i += BATCH_SIZE){
        const batch = FILES_TO_CACHE.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(fetchOne));
        results.forEach((result, j) => {
          if(result !== true) failed.push(batch[j] + ' (' + result + ')');
        });
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
  if (new URL(event.request.url).origin !== location.origin) return;
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
