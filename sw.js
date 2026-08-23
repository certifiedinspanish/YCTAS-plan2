// YCTAS! Plan 2 — offline support (service worker)
const CACHE_NAME = 'yctas-plan2-v55';

const FILES_TO_CACHE = [
  './',
  'app.js?v=55',
  'apple-touch-icon.png',
  'argentina.png',
  'auth.js?v=55',
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
  'compare.json?v=55',
  'costa_rica.png',
  'countries.json?v=55',
  'countries_song.mp3',
  'cuba.png',
  'cues_capitals.json?v=55',
  'cues_countries.json?v=55',
  'ecuador.png',
  'eg.js?v=55',
  'eg_capital.mp3',
  'eg_data.json?v=55',
  'eg_flag.png',
  'eg_gentilicio.mp3',
  'eg_malabo.mp3',
  'eg_name.mp3',
  'el_salvador.png',
  'equatorial_guinea.png',
  'espana.png',
  'game3.js?v=55',
  'game3_data.json?v=55',
  'guatemala.png',
  'honduras.png',
  'icon-192.png',
  'icon-512.png',
  'index.html',
  'manifest.json?v=55',
  'map.json?v=55',
  'match_games.js?v=55',
  'match_games_data.json?v=55',
  'mexico.png',
  'nicaragua.png',
  'panama.png',
  'paraguay.png',
  'peru.png',
  'puerto_rico.png',
  'republica_dominicana.png',
  'songplayer.js?v=55',
  'style.css?v=55',
  'tester.js?v=55',
  'uruguay.png',
  'venezuela.png',
  'vocab_match.js?v=55',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
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

      let saved = 0;
      for(let i = 0; i < FILES_TO_CACHE.length; i += BATCH_SIZE){
        const batch = FILES_TO_CACHE.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(fetchOne));
        results.forEach((result, j) => {
          if(result !== true) failed.push(batch[j] + ' (' + result + ')');
          else saved++;
        });
        const clientsSoFar = await self.clients.matchAll();
        clientsSoFar.forEach((c) => c.postMessage({
          type: 'sw-cache-progress',
          saved: saved,
          total: FILES_TO_CACHE.length,
        }));
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

  const url = new URL(event.request.url);
  const cacheKey = url.pathname + url.search;
  const isAudio = /\.mp3(\?|$)/.test(url.pathname);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    let cached = await cache.match(cacheKey);

    if(!cached){
      try {
        const res = await fetch(url.origin + cacheKey, { cache: 'no-store' });
        if(res && res.ok){
          cache.put(cacheKey, res.clone());
          cached = res;
        } else {
          return res;
        }
      } catch (err) {
        return new Response('', { status: 504 });
      }
    }

    const rangeHeader = event.request.headers.get('range');
    if(!isAudio || !rangeHeader) return cached;

    const buffer = await cached.clone().arrayBuffer();
    const total = buffer.byteLength;
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    let start = match && match[1] ? parseInt(match[1], 10) : 0;
    let end = match && match[2] ? parseInt(match[2], 10) : total - 1;
    if(isNaN(start)) start = 0;
    if(isNaN(end) || end >= total) end = total - 1;
    const slice = buffer.slice(start, end + 1);

    return new Response(slice, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Content-Length': String(slice.byteLength),
        'Accept-Ranges': 'bytes',
      },
    });
  })());
});
