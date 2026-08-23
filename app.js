async function loadJSON(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error('Failed to load ' + path);
  return res.json();
}

// Offline support: saves the app onto the device after the first visit with
// internet, so it keeps working (songs, games, progress) with no connection
// after that. Fails silently on older browsers that don't support this —
// the app just works online-only there, same as before.
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      showSwStatus('Offline setup failed to register: ' + err.message);
    });
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if(event.data && event.data.type === 'sw-cache-progress'){
      const { saved, total } = event.data;
      if(saved < total){
        showSwStatus('⏳ Saving for offline use: ' + saved + ' of ' + total + ' files so far...');
      }
    }
    if(event.data && event.data.type === 'sw-cache-report'){
      const { total, failedCount, failed } = event.data;
      if(failedCount === 0){
        showSwStatus('✓ Offline ready — all ' + total + ' files saved for offline use.');
      } else {
        showSwStatus('⚠ Offline setup incomplete: ' + failedCount + ' of ' + total + ' files failed —\n' + failed.join('\n'));
      }
    }
  });
}
function showSwStatus(msg){
  // A plain element sitting in the normal page flow, not floating —
  // position:fixed had already caused two separate display problems
  // (disappearing too fast on phone, not showing at all on laptop), most
  // likely from some ancestor element changing how "fixed" gets anchored.
  // This sidesteps that whole class of bug by never using fixed positioning.
  const el = document.getElementById('swStatus');
  const text = document.getElementById('swStatusText');
  if(!el || !text) return;
  text.textContent = msg;
  el.classList.remove('hidden');
}

async function main(){
  // Load all shared data once. Flags are referenced by relative path (not
  // embedded), same as the audio files — this only works when served over
  // http/https (e.g. GitHub Pages), not when double-clicking index.html
  // directly from disk, since browsers block fetch() on file:// URLs.
  const [countries, cuesCountries, cuesCapitals, mapData, compareData, egData] = await Promise.all([
    loadJSON('countries.json?v=54'),
    loadJSON('cues_countries.json?v=54'),
    loadJSON('cues_capitals.json?v=54'),
    loadJSON('map.json?v=54'),
    loadJSON('compare.json?v=54'),
    loadJSON('eg_data.json?v=54'),
  ]);

  const byKey = {};
  countries.forEach(c => byKey[c.key] = c);

  const flagKeys = countries.map(c => c.key).concat(['equatorial_guinea']);
  const flags = {};
  flagKeys.forEach(k => { flags[k] = k + '.png'; });

  let countriesPlayer = null;
  let capitalsPlayer = null;
  let practiceInstance = null;
  let practiceBuilt = false;
  let spotlightInstance = null;
  let spotlightBuilt = false;
  let game1Instance = null;
  let game1Built = false;
  let game2Instance = null;
  let game2Built = false;
  let game3Instance = null;
  let game3Built = false;

  const views = {
    home: document.getElementById('view-home'),
    countries: document.getElementById('view-countries'),
    capitals: document.getElementById('view-capitals'),
    practice: document.getElementById('view-practice'),
    spotlight: document.getElementById('view-spotlight'),
    game1: document.getElementById('view-game1'),
    game2: document.getElementById('view-game2'),
    game3: document.getElementById('view-game3'),
  };
  const backBtn = document.getElementById('backBtn');

  // Reads the same daily-streak data Practice already tracks, so it's
  // visible the moment the app opens — no need to dig into Practice first.
  function renderHomeStreak(){
    let streak = null;
    try{
      const raw = localStorage.getItem('yctas_plan2_dailystreak_v1');
      if(raw) streak = JSON.parse(raw);
    }catch(e){}
    const wrap = document.getElementById('homeStreak');
    const countEl = document.getElementById('homeStreakCount');
    if(streak && streak.current > 0){
      countEl.textContent = streak.current;
      wrap.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
    }
  }

  function showView(name){
    Object.entries(views).forEach(([key, node]) => {
      node.classList.toggle('hidden', key !== name);
    });
    backBtn.classList.toggle('hidden', name === 'home');
    if(name === 'home') renderHomeStreak();

    // Pause whichever song player isn't currently visible, so audio
    // doesn't keep playing silently in the background after navigating away.
    if(name !== 'countries' && countriesPlayer) countriesPlayer.pause();
    if(name !== 'capitals' && capitalsPlayer) capitalsPlayer.pause();
    if(name !== 'practice' && practiceInstance) practiceInstance.pause();
    if(name !== 'spotlight' && spotlightInstance) spotlightInstance.pause();
    if(name !== 'game1' && game1Instance) game1Instance.pause();
    if(name !== 'game2' && game2Instance) game2Instance.pause();
    if(name !== 'game3' && game3Instance) game3Instance.pause();

    if(name === 'countries' && !countriesPlayer){
      countriesPlayer = createSongPlayer({
        container: document.getElementById('countriesPlayer'),
        countries, flags, mapData, byKey,
        cues: cuesCountries,
        audioSrc: 'countries_song.mp3',
        hasClaps: true,
      });
    }
    if(name === 'capitals' && !capitalsPlayer){
      capitalsPlayer = createSongPlayer({
        container: document.getElementById('capitalsPlayer'),
        countries, flags, mapData, byKey,
        cues: cuesCapitals,
        audioSrc: 'capitals_song.mp3',
        hasClaps: false,
      });
    }
    if(name === 'practice' && !practiceBuilt){
      practiceInstance = createTester({
        container: document.getElementById('practiceRoot'),
        countries, flags, compareData,
        countriesAudioSrc: 'countries_song.mp3',
        capitalsAudioSrc: 'capitals_song.mp3',
        cuesCountries, cuesCapitals,
      });
      practiceBuilt = true;
    }
    if(name === 'spotlight' && !spotlightBuilt){
      spotlightInstance = createSpotlight({
        container: document.getElementById('spotlightRoot'),
        data: egData,
      });
      spotlightBuilt = true;
    }
    if(name === 'game1' && !game1Built){
      game1Instance = createMatchGame({
        container: document.getElementById('game1Root'),
        dataSrc: 'match_games_data.json?v=54',
        gameKey: 'game1',
      });
      game1Built = true;
    }
    if(name === 'game2' && !game2Built){
      game2Instance = createMatchGame({
        container: document.getElementById('game2Root'),
        dataSrc: 'match_games_data.json?v=54',
        gameKey: 'game2',
      });
      game2Built = true;
    }
    if(name === 'game3' && !game3Built){
      game3Instance = createGame3({
        container: document.getElementById('game3Root'),
        dataSrc: 'game3_data.json?v=54',
      });
      game3Built = true;
    }

    window.scrollTo(0, 0);
  }

  document.querySelectorAll('[data-goto]').forEach(tile => {
    tile.addEventListener('click', () => goToView(tile.dataset.goto));
  });
  // One tap, straight into a random game — no mode-picking required.
  document.getElementById('quickPlayBtn').addEventListener('click', () => {
    goToView('practice');
    if(practiceInstance) practiceInstance.quickPlay();
  });
  // Check offline status on demand, any time — reads the cache directly
  // instead of depending on catching a message that fires once at page load.
  document.getElementById('offlineCheckBtn').addEventListener('click', async () => {
    if(!('caches' in window)){
      showSwStatus('This browser doesn\'t support offline mode.');
      return;
    }
    try{
      const keys = await caches.keys();
      const ourCache = keys.find(k => k.startsWith('yctas-plan2-'));
      if(!ourCache){
        showSwStatus('⚠ No offline copy saved yet. Open the app once with internet, then check again.');
        return;
      }
      const cache = await caches.open(ourCache);
      const entries = await cache.keys();

      // Group by base filename (ignoring the ?v=NN part) — if any file has
      // MORE than one cached version sitting side by side, that directly
      // explains a higher-than-expected total count, and shows exactly
      // which files are duplicated instead of just a mystery number.
      const byBaseName = {};
      entries.forEach(req => {
        const u = new URL(req.url);
        const base = u.pathname;
        (byBaseName[base] = byBaseName[base] || []).push(u.search || '(no version)');
      });
      const duplicates = Object.entries(byBaseName).filter(([, versions]) => versions.length > 1);

      let msg = '✓ Offline copy found: ' + entries.length + ' files saved (' + ourCache + ').\nThis device can use the app without internet.';
      if(duplicates.length){
        msg += '\n\n⚠ ' + duplicates.length + ' file(s) have more than one version cached at once:\n';
        duplicates.forEach(([base, versions]) => {
          msg += base + ': ' + versions.join(', ') + '\n';
        });
      }
      showSwStatus(msg);
    }catch(err){
      showSwStatus('Could not check offline status: ' + err.message);
    }
  });

  // Native "Add to Home Screen" — Chrome/Android fires this event only when
  // it decides the site qualifies (valid manifest + service worker). We
  // hold onto that moment and offer a real button for it, instead of
  // leaving people to hunt through a browser menu for it manually. Safari
  // and some other browsers never fire this event at all — the button just
  // stays hidden there, and the old manual-menu route is still the way in.
  let deferredInstallPrompt = null;
  const installBtn = document.getElementById('installAppBtn');
  document.getElementById('swStatusClose').addEventListener('click', () => {
    document.getElementById('swStatus').classList.add('hidden');
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.classList.remove('hidden');
  });
  installBtn.addEventListener('click', async () => {
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.classList.add('hidden');
    if(outcome === 'accepted') showSwStatus('✓ App installed! Look for its icon on your home screen.');
  });
  window.addEventListener('appinstalled', () => {
    installBtn.classList.add('hidden');
  });
  // Both the Home button and the phone's own back arrow now do the same
  // thing: step back to Home inside the app, instead of the back arrow
  // leaving the site entirely. This works by registering each screen with
  // the browser's own history, the same way any single-page app does.
  backBtn.addEventListener('click', () => history.back());

  function goToView(name){
    showView(name);
    history.pushState({ view: name }, '', '#' + name);
  }

  window.addEventListener('popstate', (e) => {
    const target = (e.state && e.state.view) || 'home';
    showView(target);
  });

  history.replaceState({ view: 'home' }, '', '#home');
  showView('home');
}

main().catch(err => {
  document.body.innerHTML =
    '<div style="padding:40px;text-align:center;color:#FAF6EC;font-family:sans-serif;">' +
    '<h2>Could not load the app</h2>' +
    '<p style="color:#9AA6C4;">' + err.message + '</p>' +
    '<p style="color:#9AA6C4;font-size:13px;">If you\'re opening this file directly from disk, that\'s expected — this app needs to be served from a real web address (like GitHub Pages) to load its data files.</p>' +
    '</div>';
  console.error(err);
});
