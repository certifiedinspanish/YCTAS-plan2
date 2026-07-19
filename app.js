async function loadJSON(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error('Failed to load ' + path);
  return res.json();
}

async function main(){
  // Load all shared data once. Flags are referenced by relative path (not
  // embedded), same as the audio files — this only works when served over
  // http/https (e.g. GitHub Pages), not when double-clicking index.html
  // directly from disk, since browsers block fetch() on file:// URLs.
  const [countries, cuesCountries, cuesCapitals, mapData, compareData, egData] = await Promise.all([
    loadJSON('countries.json?v=20'),
    loadJSON('cues_countries.json?v=20'),
    loadJSON('cues_capitals.json?v=20'),
    loadJSON('map.json?v=20'),
    loadJSON('compare.json?v=20'),
    loadJSON('eg_data.json?v=20'),
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

  const views = {
    home: document.getElementById('view-home'),
    countries: document.getElementById('view-countries'),
    capitals: document.getElementById('view-capitals'),
    practice: document.getElementById('view-practice'),
    spotlight: document.getElementById('view-spotlight'),
  };
  const backBtn = document.getElementById('backBtn');

  function showView(name){
    Object.entries(views).forEach(([key, node]) => {
      node.classList.toggle('hidden', key !== name);
    });
    backBtn.classList.toggle('hidden', name === 'home');

    // Pause whichever song player isn't currently visible, so audio
    // doesn't keep playing silently in the background after navigating away.
    if(name !== 'countries' && countriesPlayer) countriesPlayer.pause();
    if(name !== 'capitals' && capitalsPlayer) capitalsPlayer.pause();
    if(name !== 'practice' && practiceInstance) practiceInstance.pause();
    if(name !== 'spotlight' && spotlightInstance) spotlightInstance.pause();

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

    window.scrollTo(0, 0);
  }

  document.querySelectorAll('[data-goto]').forEach(tile => {
    tile.addEventListener('click', () => goToView(tile.dataset.goto));
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
