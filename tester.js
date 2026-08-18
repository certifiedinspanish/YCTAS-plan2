function createTester(opts) {
  const { container, countries, flags, compareData, countriesAudioSrc, capitalsAudioSrc, cuesCountries } = opts;

  container.innerHTML = `
    <div class="streakflame" data-el="dailyStreakWrap">
      <span class="flame-icon">🔥</span> <span data-el="dailyStreakCount">0</span> day streak
    </div>
    <p style="text-align:center;color:var(--text-muted);font-size:14px;margin:0 0 20px;">
      Get it right a few times, on a couple of different days, and you'll earn a ⭐ for that country — forever!
    </p>
    <div class="celebrate-toast" data-el="celebrateToast"></div>

    <div class="songref">
      <p class="songref-label">🎵 Need more help? You can listen to either song while playing the games.</p>
      <div class="songref-row">
        <div class="songref-pick">
          <button class="songref-btn active" data-el="pickCountriesSong" data-song="countries">Countries Song</button>
          <button class="songref-btn" data-el="pickCapitalsSong" data-song="capitals">Capitals Song</button>
        </div>
        <button class="songref-toggle" data-el="songToggle">▶️ Play</button>
      </div>
    </div>

    <div class="modepick">
      <button class="modebtn active" data-mode="c2cap">Country → Capital</button>
      <button class="modebtn" data-mode="cap2c">Capital → Country</button>
      <button class="modebtn" data-mode="order">Song Order</button>
      <button class="modebtn" data-mode="sequence">🏅 Sequence Game</button>
      <button class="modebtn" data-mode="pop">Compare: People</button>
      <button class="modebtn" data-mode="area">Compare: Size</button>
    </div>
    <div class="progressbar" data-el="masteryBar">
      <span data-el="masteredCount">⭐ 0 / 20 earned</span>
      <div class="progresstrack"><div class="progressfill" data-el="progressFill"></div></div>
    </div>
    <div class="progressbar" data-el="streakBar" style="display:none;">
      <span data-el="streakNow">Streak: 0</span>
      <span data-el="streakBest" style="color:var(--text-muted);">Best: 0</span>
    </div>
    <p class="streak-hint hidden" data-el="streakHint">
      Best only grows when your current streak beats your all-time record. One miss resets the streak — not your Best.
    </p>
    <button class="browsebtn hidden" data-el="browseBtn">📖 See the rankings first</button>
    <div class="qcard" data-el="qcard"></div>
    <div class="finale" data-el="finale">
      <h2>🌟 All 20 Stars Earned! 🌟</h2>
      <p>You know every country and capital by heart!</p>
    </div>
    <p class="stargrid-label" data-el="stargridLabel">Your progress so far:</p>
    <div class="stargrid" data-el="starGrid"></div>
    <span class="resetlink" data-el="resetLink">Reset all progress</span>
  `;

  const el = {};
  container.querySelectorAll('[data-el]').forEach(node => { el[node.dataset.el] = node; });

  function flagSrc(key){ return flags[key]; }
  function todayStr(){
    // Local calendar day, not UTC — a student testing late at night shouldn't
    // have their "today" silently roll over to tomorrow's date (or vice versa)
    // just because UTC is on a different day than their own clock.
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const STORAGE_KEY = 'yctas_plan2_tester_v1';
  const STREAK_KEY = 'yctas_plan2_streaks_v1';
  const DAILY_STREAK_KEY = 'yctas_plan2_dailystreak_v1';

  function yesterdayStr(){
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function loadDailyStreak(){
    try{
      const raw = localStorage.getItem(DAILY_STREAK_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return { current: 0, lastDate: null };
  }
  function saveDailyStreak(s){ try{ localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(s)); }catch(e){} }
  function renderDailyStreak(){
    el.dailyStreakCount.textContent = dailyStreak.current;
  }
  // Counts a day as "kept" the moment the learner answers one question —
  // same trigger Duolingo uses for its streak, so it needs no explanation.
  function bumpDailyStreak(){
    const today = todayStr();
    if(dailyStreak.lastDate === today) return;
    dailyStreak.current = (dailyStreak.lastDate === yesterdayStr()) ? dailyStreak.current + 1 : 1;
    dailyStreak.lastDate = today;
    saveDailyStreak(dailyStreak);
    renderDailyStreak();
  }

  let celebrateTimer = null;
  function celebrate(big, label){
    el.celebrateToast.textContent = big ? ('🌟 ' + (label || 'Mastered!')) : '🎉 Nice one!';
    el.celebrateToast.className = 'celebrate-toast show' + (big ? ' big' : '');
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => {
      el.celebrateToast.classList.remove('show');
    }, big ? 1800 : 1100);
  }

  // Song Order / Sequence Game snippets: each country has its own tiny,
  // pre-cut audio file (clip_<key>.mp3), sliced once from the real Countries
  // song at its exact tagged timestamp. Earlier this seeked into the single
  // long song file at runtime instead — but MP3 seeking in the browser isn't
  // sample-accurate, so it would often land slightly early, in the tail end
  // of the *previous* country's audio. Playing a pre-cut file from its own
  // start avoids runtime seeking (and that imprecision) entirely.
  const clipSrcByKey = {};
  if(cuesCountries){
    cuesCountries.forEach(c => {
      if(c.type === 'country') clipSrcByKey[c.key] = 'clip_' + c.key + '.mp3';
    });
  }
  const snippetAudio = new Audio();
  function playSnippet(key){
    return new Promise(resolve => {
      const src = clipSrcByKey[key];
      const totalKeys = Object.keys(clipSrcByKey).length;
      alert(
        'key: "' + key + '"\n' +
        'src found: ' + (src ? src : 'NONE') + '\n' +
        'total clips loaded: ' + totalKeys + '\n' +
        'cuesCountries passed in: ' + (cuesCountries ? cuesCountries.length + ' entries' : 'MISSING/undefined')
      );
      if(!src){ resolve(); return; }
      // Don't let this short snippet overlap with the looping reference song
      // if it happens to be playing.
      if(refPlaying){
        refAudio.pause();
        refPlaying = false;
        el.songToggle.textContent = '▶️ Play';
        el.songToggle.classList.remove('playing');
      }
      snippetAudio.onended = null;
      snippetAudio.onerror = null;
      snippetAudio.pause();
      snippetAudio.src = src;
      snippetAudio.onended = () => resolve();
      // TEMPORARY diagnostic (v29) — surfaces the exact failure on-screen
      // since remote debugging isn't available. Safe to remove once the
      // real cause is found.
      snippetAudio.onerror = () => {
        alert('Snippet audio error\nsrc: ' + src + '\ncode: ' + (snippetAudio.error ? snippetAudio.error.code : '?'));
        resolve();
      };
      snippetAudio.play().catch(err => {
        alert('Snippet play() rejected\nsrc: ' + src + '\n' + err.name + ': ' + err.message);
        resolve();
      });
    });
  }

  function loadProgress(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    const p = {};
    countries.forEach(c => p[c.key] = { correctDates: [] });
    return p;
  }
  function saveProgress(p){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }catch(e){} }
  function isMastered(p, key){
    const rec = p[key];
    if(!rec) return false;
    const distinctDays = new Set(rec.correctDates).size;
    return rec.correctDates.length >= 5 && distinctDays >= 2;
  }
  function sanitizeStreaks(s){
    const clean = { pop: { current: 0, best: 0 }, area: { current: 0, best: 0 } };
    ['pop', 'area'].forEach(mode => {
      const src = s && s[mode];
      const cur = src ? Number(src.current) : 0;
      const best = src ? Number(src.best) : 0;
      clean[mode].current = Number.isFinite(cur) ? cur : 0;
      clean[mode].best = Number.isFinite(best) ? best : 0;
      // Best can never be lower than current — if a corrupted or
      // legacy value ever left them out of sync, correct it here
      // instead of letting a broken Best silently stop updating.
      if(clean[mode].best < clean[mode].current) clean[mode].best = clean[mode].current;
    });
    return clean;
  }
  function loadStreaks(){
    try{
      const raw = localStorage.getItem(STREAK_KEY);
      if(raw) return sanitizeStreaks(JSON.parse(raw));
    }catch(e){}
    return { pop: { current: 0, best: 0 }, area: { current: 0, best: 0 } };
  }
  function saveStreaks(s){ try{ localStorage.setItem(STREAK_KEY, JSON.stringify(s)); }catch(e){} }

  let progress = loadProgress();
  let streaks = loadStreaks();
  let dailyStreak = loadDailyStreak();
  let mode = 'c2cap';
  let lastComparePair = null;
  let browsing = false;

  function renderStreak(){
    const bar = streaks[mode];
    if(!bar) return;
    el.streakNow.textContent = 'Streak: ' + bar.current;
    el.streakBest.textContent = 'Best: ' + bar.best;
  }

  function pickRandom(arr, n, excludeKey){
    const pool = arr.filter(c => c.key !== excludeKey);
    const out = [];
    while(out.length < n && pool.length){
      const i = Math.floor(Math.random()*pool.length);
      out.push(pool.splice(i,1)[0]);
    }
    return out;
  }

  // Same fair-shuffle used by Plan 1's Sequence Game, for a faithful port.
  function shuffle(arr){
    const a = [...arr];
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  const byKey = {};
  countries.forEach(c => byKey[c.key] = c);

  function chooseTargetCountry(){
    const unmastered = countries.filter(c => !isMastered(progress, c.key));
    const pool = unmastered.length ? unmastered : countries;
    pool.sort((a,b) => (progress[a.key].correctDates.length) - (progress[b.key].correctDates.length));
    const topFew = pool.slice(0, Math.min(6, pool.length));
    return topFew[Math.floor(Math.random()*topFew.length)];
  }

  function renderProgress(){
    const masteredN = countries.filter(c => isMastered(progress, c.key)).length;
    el.masteredCount.textContent = '⭐ ' + masteredN + ' / 20 earned';
    el.progressFill.style.width = (masteredN/20*100) + '%';

    el.starGrid.innerHTML = '';
    countries.forEach(c => {
      const rec = progress[c.key];
      const mastered = isMastered(progress, c.key);
      // Ring fill communicates progress at a glance, no reading required —
      // same idea as Duolingo's filling skill-strength circles.
      const fraction = mastered ? 1 : Math.min(1, (rec ? rec.correctDates.length : 0) / 5);
      const deg = Math.round(fraction * 360);

      const cell = document.createElement('div');
      cell.className = 'star-cell' + (mastered ? ' earned' : '');
      cell.title = c.name;

      const ring = document.createElement('div');
      ring.className = 'ring-cell';
      ring.style.background = mastered
        ? 'var(--gold)'
        : 'conic-gradient(var(--gold) ' + deg + 'deg, var(--line) 0deg)';

      const inner = document.createElement('div');
      inner.className = 'ring-inner';
      const img = document.createElement('img');
      img.src = flagSrc(c.key);
      inner.appendChild(img);
      ring.appendChild(inner);
      cell.appendChild(ring);

      if(mastered){
        const star = document.createElement('span');
        star.className = 'star-badge';
        star.textContent = '⭐';
        cell.appendChild(star);
      }
      el.starGrid.appendChild(cell);
    });

    if(masteredN === 20){
      el.finale.classList.add('show');
      el.qcard.style.display = 'none';
    } else {
      el.finale.classList.remove('show');
      el.qcard.style.display = 'block';
    }
  }

  function renderBrowseList(){
    el.qcard.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'qprompt-label';
    label.textContent = mode === 'pop' ? 'Smallest population → Largest' : 'Smallest area → Largest';
    el.qcard.appendChild(label);

    const compareCountries = countries.concat([{ key: 'equatorial_guinea', name: 'Guinea Ecuatorial' }]);
    const dataKey = mode === 'pop' ? 'pop_m' : 'area_km2';
    const sorted = compareCountries.slice().sort((a, b) => compareData[a.key][dataKey] - compareData[b.key][dataKey]);

    const list = document.createElement('div');
    list.style.cssText = 'text-align:left;max-height:360px;overflow-y:auto;';
    sorted.forEach((c, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--line);';
      row.innerHTML =
        '<span style="font-size:12px;color:var(--text-muted);width:18px;">' + (i+1) + '</span>' +
        '<img src="' + flagSrc(c.key) + '" style="width:38px;height:26px;object-fit:cover;border-radius:4px;">' +
        '<span style="font-weight:700;">' + c.name + '</span>' +
        (mode === 'pop' ? '<span style="margin-left:auto;font-size:12px;color:var(--text-muted);">' + compareData[c.key].pop_band + '</span>' : '');
      list.appendChild(row);
    });
    el.qcard.appendChild(list);
  }

  function newQuestion(){
    if(mode === 'sequence'){ renderSequenceGame(); return; }
    snippetAudio.pause();
    if(browsing && (mode === 'pop' || mode === 'area')){
      renderBrowseList();
      return;
    }
    el.qcard.innerHTML = '';

    if(mode === 'c2cap' || mode === 'cap2c'){
      const target = chooseTargetCountry();
      const distractors = pickRandom(countries, 3, target.key);
      const options = [target, ...distractors].sort(() => Math.random()-0.5);

      const label = document.createElement('div');
      label.className = 'qprompt-label';
      label.textContent = mode === 'c2cap' ? 'What is the capital of...' : 'Which country has this capital?';
      el.qcard.appendChild(label);

      if(mode === 'c2cap'){
        const img = document.createElement('img');
        img.className = 'qflag'; img.src = flagSrc(target.key);
        el.qcard.appendChild(img);
        const text = document.createElement('div');
        text.className = 'qtext'; text.textContent = target.name;
        el.qcard.appendChild(text);
      } else {
        const text = document.createElement('div');
        text.className = 'qtext'; text.style.marginTop='20px'; text.textContent = target.capital;
        el.qcard.appendChild(text);
      }

      const choicesWrap = document.createElement('div');
      choicesWrap.className = 'choices' + (mode === 'c2cap' ? ' single-col' : '');
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.dataset.key = opt.key;
        if(mode === 'c2cap'){
          btn.textContent = opt.capital;
        } else {
          const img = document.createElement('img');
          img.src = flagSrc(opt.key);
          btn.appendChild(img);
          const span = document.createElement('span');
          span.textContent = opt.name;
          btn.appendChild(span);
        }
        btn.addEventListener('click', () => answer(btn, opt.key === target.key, target.key));
        choicesWrap.appendChild(btn);
      });
      el.qcard.appendChild(choicesWrap);

    } else if(mode === 'pop' || mode === 'area'){
      const compareCountries = countries.concat([{ key: 'equatorial_guinea', name: 'Guinea Ecuatorial' }]);
      const pair = pickRandom(compareCountries, 2, null);
      const [a, b] = pair;
      const dataKey = mode === 'pop' ? 'pop_m' : 'area_km2';
      const aVal = compareData[a.key][dataKey];
      const bVal = compareData[b.key][dataKey];
      const correctKey = aVal >= bVal ? a.key : b.key;
      lastComparePair = { a, b, correctKey };

      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:14px;';
      hint.textContent = "Just take your best guess — you'll find out the answer either way, and get a little sharper each round.";
      el.qcard.appendChild(hint);

      const label = document.createElement('div');
      label.className = 'qprompt-label';
      label.textContent = mode === 'pop' ? 'Which country has more people?' : 'Which country is bigger in area?';
      el.qcard.appendChild(label);

      const choicesWrap = document.createElement('div');
      choicesWrap.className = 'choices';
      [a, b].forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.dataset.key = opt.key;
        const img = document.createElement('img');
        img.src = flagSrc(opt.key);
        btn.appendChild(img);
        const span = document.createElement('span');
        span.textContent = opt.name;
        btn.appendChild(span);
        btn.addEventListener('click', () => answer(btn, opt.key === correctKey, correctKey));
        choicesWrap.appendChild(btn);
      });
      el.qcard.appendChild(choicesWrap);

    } else if(mode === 'order'){
      const N = 3;
      const maxStart = countries.length - N - 1;
      const start = Math.floor(Math.random() * Math.max(1, maxStart));
      const shown = countries.slice(start, start + N);
      const correctNext = countries[start + N];
      const distractors = pickRandom(countries, 3, correctNext.key);
      const options = [correctNext, ...distractors].sort(() => Math.random()-0.5);

      const label = document.createElement('div');
      label.className = 'qprompt-label';
      label.textContent = 'What comes next in the song?';
      el.qcard.appendChild(label);

      const hint = document.createElement('p');
      hint.className = 'order-hint';
      hint.innerHTML = '🔊 Tap the little icon to listen &nbsp;·&nbsp; Tap the flag itself to answer';
      el.qcard.appendChild(hint);

      const seqLabel = document.createElement('p');
      seqLabel.className = 'order-seq-label';
      seqLabel.textContent = 'So far in the song:';
      el.qcard.appendChild(seqLabel);

      const seqRow = document.createElement('div');
      seqRow.style.display = 'flex'; seqRow.style.justifyContent='center'; seqRow.style.gap='8px'; seqRow.style.marginBottom='16px';
      shown.forEach(c => {
        const flagBtn = document.createElement('button');
        flagBtn.className = 'seq-flag-btn';
        flagBtn.setAttribute('aria-label', 'Play ' + c.name + ' in the song');
        const img = document.createElement('img');
        img.src = flagSrc(c.key);
        flagBtn.appendChild(img);
        const badge = document.createElement('span');
        badge.className = 'seq-flag-hear';
        badge.textContent = '🔊';
        flagBtn.appendChild(badge);
        flagBtn.addEventListener('click', () => playSnippet(c.key));
        seqRow.appendChild(flagBtn);
      });
      el.qcard.appendChild(seqRow);

      const choicesWrap = document.createElement('div');
      choicesWrap.className = 'choices';
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.dataset.key = opt.key;
        const flagWrap = document.createElement('span');
        flagWrap.className = 'choice-flag-wrap';
        const img = document.createElement('img');
        img.src = flagSrc(opt.key);
        flagWrap.appendChild(img);
        const hearBadge = document.createElement('span');
        hearBadge.className = 'choice-hear';
        hearBadge.textContent = '🔊';
        hearBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          playSnippet(opt.key);
        });
        flagWrap.appendChild(hearBadge);
        btn.appendChild(flagWrap);
        const span = document.createElement('span');
        span.textContent = opt.name;
        btn.appendChild(span);
        btn.addEventListener('click', () => answer(btn, opt.key === correctNext.key, correctNext.key));
        choicesWrap.appendChild(btn);
      });
      el.qcard.appendChild(choicesWrap);
    }

    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.dataset.el2 = 'feedback';
    el.qcard.appendChild(feedback);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'nextbtn';
    nextBtn.textContent = 'Next ▸';
    nextBtn.addEventListener('click', () => { newQuestion(); });
    el.qcard.appendChild(nextBtn);
  }

  function answer(btnEl, isCorrect, correctKey){
    const allChoices = el.qcard.querySelectorAll('.choice');
    allChoices.forEach(b => b.disabled = true);
    if(isCorrect){ btnEl.classList.add('correct'); } else { btnEl.classList.add('wrong'); }
    bumpDailyStreak();

    const feedback = el.qcard.querySelector('[data-el2="feedback"]');
    const nextBtn = el.qcard.querySelector('.nextbtn');

    if(mode === 'pop' || mode === 'area'){
      const { a, b, correctKey: ck } = lastComparePair;
      const winner = ck === a.key ? a : b;
      const loser = ck === a.key ? b : a;
      const verb = mode === 'pop' ? 'has more people than' : 'is bigger than';

      const bar = streaks[mode];
      let milestoneMsg = '';
      if(isCorrect){
        bar.current = (Number(bar.current) || 0) + 1;
        bar.best = Math.max(Number(bar.best) || 0, bar.current);
        const milestones = [5, 10, 15, 20, 25, 30];
        if(milestones.includes(bar.current)){
          milestoneMsg = ' 🔥 ' + bar.current + ' in a row!';
        }
      }
      else { bar.current = 0; }
      saveStreaks(streaks);
      renderStreak();

      if(isCorrect){
        feedback.textContent = 'Correct! ' + winner.name + ' ' + verb + ' ' + loser.name + '.' + milestoneMsg;
        feedback.className = 'feedback correct';
        if(milestoneMsg){ celebrate(true, bar.current + ' in a row!'); } else { celebrate(false); }
      } else {
        feedback.textContent = 'Not quite — ' + winner.name + ' ' + verb + ' ' + loser.name + '.';
        feedback.className = 'feedback wrong';
        const correctBtn = el.qcard.querySelector('.choice[data-key="' + ck + '"]');
        if(correctBtn) correctBtn.classList.add('correct');
      }
      nextBtn.classList.add('show');
      return;
    }

    if(isCorrect){
      feedback.textContent = '¡Correcto! Nice work.';
      feedback.className = 'feedback correct';
      const rec = progress[correctKey];
      const wasMastered = isMastered(progress, correctKey);
      const today = todayStr();
      rec.correctDates.push(today);
      saveProgress(progress);
      const nowMastered = isMastered(progress, correctKey);
      if(!wasMastered && nowMastered){
        const label = byKey[correctKey] ? byKey[correctKey].name : '';
        celebrate(true, label + ' mastered!');
      } else {
        celebrate(false);
      }
    } else {
      feedback.textContent = 'Not quite — the correct answer is highlighted.';
      feedback.className = 'feedback wrong';
      const correctBtn = el.qcard.querySelector('.choice[data-key="' + correctKey + '"]');
      if(correctBtn) correctBtn.classList.add('correct');
    }
    nextBtn.classList.add('show');
    renderProgress();
  }

  // Reference song: a plain background-audio toggle, off by default.
  // This is a proven, simple pattern — no interaction with anything else in
  // the app, since Practice doesn't otherwise play any audio.
  const refAudio = new Audio();
  refAudio.loop = true;
  let refSong = 'countries';
  let refPlaying = false;

  function refSrc(song){ return song === 'countries' ? countriesAudioSrc : capitalsAudioSrc; }

  function setRefSong(song){
    refSong = song;
    el.pickCountriesSong.classList.toggle('active', song === 'countries');
    el.pickCapitalsSong.classList.toggle('active', song === 'capitals');
    if(refPlaying){
      refAudio.src = refSrc(song);
      refAudio.play().catch(() => {});
    }
  }

  el.pickCountriesSong.addEventListener('click', () => setRefSong('countries'));
  el.pickCapitalsSong.addEventListener('click', () => setRefSong('capitals'));

  el.songToggle.addEventListener('click', () => {
    refPlaying = !refPlaying;
    if(refPlaying){
      refAudio.src = refSrc(refSong);
      refAudio.play().catch(() => {});
      el.songToggle.textContent = '⏸ Stop';
      el.songToggle.classList.add('playing');
    } else {
      refAudio.pause();
      el.songToggle.textContent = '▶️ Play';
      el.songToggle.classList.remove('playing');
    }
  });

  function pauseReferenceAudio(){
    if(refPlaying){
      refAudio.pause();
      refPlaying = false;
      el.songToggle.textContent = '▶️ Play';
      el.songToggle.classList.remove('playing');
    }
    snippetAudio.pause();
    seqRunId += 1;
  }

  // Sequence Game — same mechanic as Plan 1's verb Sequence Game, ported to
  // countries + the real song audio (via playSnippet) instead of recorded
  // verb clips. Practice-only: retirement here never touches mastery stars.
  const SEQ_LENGTH = 3;
  const SEQ_MASTERY_THRESHOLD = 5;
  const SEQ_STORAGE_KEY = 'yctas_plan2_seqgame_v1';

  function loadSeqProgress(){
    const fresh = {};
    countries.forEach(c => fresh[c.key] = { gameStreak: 0, gameRetired: false });
    try{
      const raw = localStorage.getItem(SEQ_STORAGE_KEY);
      if(raw){
        const saved = JSON.parse(raw);
        countries.forEach(c => { if(saved[c.key]) fresh[c.key] = saved[c.key]; });
      }
    }catch(e){}
    return fresh;
  }
  function saveSeqProgress(){ try{ localStorage.setItem(SEQ_STORAGE_KEY, JSON.stringify(seqProgress)); }catch(e){} }

  let seqProgress = loadSeqProgress();
  let seqCurrentSequence = [];
  let seqDisplayOrder = [];
  let seqPhase = 'idle';
  let seqPlayerStep = 0;
  let seqMissedKey = null;
  let seqCorrectFlashKey = null;
  let seqDifficulty = 'easy';
  let seqRunId = 0;
  let seqTapLocked = false;

  function seqActiveCountries(){ return countries.filter(c => !seqProgress[c.key].gameRetired); }

  function enterSequenceView(){
    seqRunId += 1; // invalidates any stale async playback from a prior round/mode
    seqPhase = 'idle';
    seqCurrentSequence = [];
    seqDisplayOrder = [];
    seqMissedKey = null;
    seqCorrectFlashKey = null;
    seqTapLocked = false;
    renderSequenceGame();
  }

  function startSequenceGame(){
    seqPhase = 'watching';
    seqNextRound();
  }

  function seqNextRound(){
    seqRunId += 1;
    const myRun = seqRunId;
    const active = seqActiveCountries();
    if(active.length === 0){ seqPhase = 'won'; renderSequenceGame(); return; }
    const count = Math.min(SEQ_LENGTH, active.length);
    seqCurrentSequence = shuffle(active).slice(0, count);
    seqDisplayOrder = shuffle(seqCurrentSequence);
    if(seqCurrentSequence.length > 1){
      let tries = 0;
      const matches = arr => arr.every((c, i) => c.key === seqCurrentSequence[i].key);
      while(tries < 30 && matches(seqDisplayOrder)){ seqDisplayOrder = shuffle(seqCurrentSequence); tries++; }
    }
    seqPlayerStep = 0;
    seqMissedKey = null;
    seqPhase = 'watching';
    renderSequenceGame();
    seqPlaySequence(myRun);
  }

  function seqReshuffleDisplayOrder(){
    let attempt = shuffle(seqCurrentSequence);
    const matchesPlayback = arr => seqCurrentSequence.length > 1 && arr.every((c, i) => c.key === seqCurrentSequence[i].key);
    if(matchesPlayback(attempt)){
      // Guaranteed fix, not just a random retry: swapping the first two
      // positions makes it mathematically impossible to still match playback order.
      [attempt[0], attempt[1]] = [attempt[1], attempt[0]];
    }
    seqDisplayOrder = attempt;
  }

  async function seqPlaySequence(myRun){
    await wait(300);
    if(myRun !== seqRunId) return; // a newer round/mode-switch has since started
    for(const c of seqCurrentSequence){
      if(seqDifficulty === 'easy') renderSequenceGame(c.key);
      await playSnippet(c.key);
      if(myRun !== seqRunId) return;
      if(seqDifficulty === 'easy') renderSequenceGame(null);
      await wait(200);
      if(myRun !== seqRunId) return;
    }
    // Re-scramble tile positions before the answer phase — otherwise
    // remembering "which spot lit up" is enough, and the test is meaningless.
    seqReshuffleDisplayOrder();
    seqPhase = 'playerTurn';
    renderSequenceGame();
  }

  function handleSeqTap(key){
    if(seqPhase !== 'playerTurn' || seqTapLocked) return;
    seqTapLocked = true;
    renderSequenceGame(key);
    const feedbackDone = playSnippet(key);
    setTimeout(() => renderSequenceGame(null), 250);

    const expected = seqCurrentSequence[seqPlayerStep];
    if(key === expected.key){
      seqProgress[expected.key].gameStreak += 1;
      seqCorrectFlashKey = key;
      setTimeout(() => { seqCorrectFlashKey = null; renderSequenceGame(); }, 380);
      if(seqProgress[expected.key].gameStreak >= SEQ_MASTERY_THRESHOLD) seqProgress[expected.key].gameRetired = true;
      seqPlayerStep += 1;
      renderSequenceGame();
      saveSeqProgress();
      seqTapLocked = false;
      if(seqPlayerStep === seqCurrentSequence.length){
        feedbackDone.then(() => wait(350)).then(() => seqNextRound());
      }
    } else {
      seqProgress[expected.key].gameStreak = 0;
      seqMissedKey = expected.key;
      seqPhase = 'watching';
      renderSequenceGame();
      saveSeqProgress();
      seqTapLocked = false;
      feedbackDone.then(() => wait(700)).then(() => seqNextRound());
    }
  }

  function renderSequenceGame(litKey){
    const active = seqActiveCountries();
    const retiredCount = countries.length - active.length;
    const statusText = {
      idle: 'Tap Start to play',
      watching: seqMissedKey ? "Not quite — here's the one that was next:" : (seqDifficulty === 'challenge' ? '👂 Listen carefully — no visual clues this time' : '👀 Watch and listen...'),
      playerTurn: '🎯 Your turn — tap them back in order',
      won: '🎉 All practiced countries retired for now!',
    }[seqPhase];

    let boardHtml = '';
    if(seqPhase !== 'idle' && seqPhase !== 'won' && seqDisplayOrder.length > 0){
      boardHtml = `
        <div class="seq-board" style="grid-template-columns:repeat(${seqDisplayOrder.length}, 1fr);">
          ${seqDisplayOrder.map(c => `
            <div class="seq-tile" data-key="${c.key}" style="border-color:${
              seqCorrectFlashKey === c.key ? 'var(--green)' :
              (seqMissedKey === c.key ? 'var(--coral)' :
              (litKey === c.key ? 'var(--gold)' : 'var(--line)'))
            };cursor:${seqPhase === 'playerTurn' ? 'pointer' : 'default'};opacity:${seqPhase !== 'playerTurn' ? '0.6' : '1'};">
              <img src="${flagSrc(c.key)}" alt="${c.name}">
            </div>
          `).join('')}
        </div>
      `;
    }

    el.qcard.innerHTML = `
      <p class="qprompt-label">🏅 Sequence Game</p>
      <p class="seq-subtitle">Listen to 3 countries in a row, then tap them back in the same order — practice retires each one for a while</p>
      <p class="seq-practiced">Practiced: ${retiredCount}/${countries.length}</p>
      ${(seqPhase === 'idle' || seqPhase === 'won') ? `
        <div class="seq-diff-row">
          <button class="modebtn ${seqDifficulty === 'easy' ? 'active' : ''}" data-el2="seqEasyBtn">Easy</button>
          <button class="modebtn ${seqDifficulty === 'challenge' ? 'active' : ''}" data-el2="seqChallengeBtn">Challenge</button>
        </div>
      ` : ''}
      <p class="seq-status">${statusText}</p>
      ${seqPhase === 'idle' ? `<button class="seq-action-btn" data-el2="seqStartBtn">▶️ Start</button>` : ''}
      ${boardHtml}
      ${seqPhase === 'won' ? `<button class="seq-action-btn" data-el2="seqAgainBtn">🔄 Play Again</button>` : ''}
    `;

    const startBtn = el.qcard.querySelector('[data-el2="seqStartBtn"]');
    if(startBtn) startBtn.addEventListener('click', startSequenceGame);
    const againBtn = el.qcard.querySelector('[data-el2="seqAgainBtn"]');
    if(againBtn) againBtn.addEventListener('click', () => {
      countries.forEach(c => seqProgress[c.key].gameRetired = false);
      saveSeqProgress();
      seqPhase = 'idle';
      renderSequenceGame();
    });
    const easyBtn = el.qcard.querySelector('[data-el2="seqEasyBtn"]');
    if(easyBtn) easyBtn.addEventListener('click', () => { seqDifficulty = 'easy'; renderSequenceGame(); });
    const challengeBtn = el.qcard.querySelector('[data-el2="seqChallengeBtn"]');
    if(challengeBtn) challengeBtn.addEventListener('click', () => { seqDifficulty = 'challenge'; renderSequenceGame(); });
    el.qcard.querySelectorAll('.seq-tile').forEach(tile => {
      tile.addEventListener('click', () => handleSeqTap(tile.dataset.key));
    });
  }

  container.querySelectorAll('.modebtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if(btn.dataset.mode === undefined) return; // dynamic Easy/Challenge buttons share this class but aren't top-nav modes
      container.querySelectorAll('.modebtn[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const leavingSequence = (mode === 'sequence' && btn.dataset.mode !== 'sequence');
      mode = btn.dataset.mode;
      if(leavingSequence){
        seqRunId += 1; // abandon any in-flight async playback from the game
        snippetAudio.pause();
      }
      const isCompare = (mode === 'pop' || mode === 'area');
      const isSequence = (mode === 'sequence');
      el.masteryBar.style.display = (isCompare || isSequence) ? 'none' : 'flex';
      el.starGrid.style.display = (isCompare || isSequence) ? 'none' : 'grid';
      el.stargridLabel.style.display = (isCompare || isSequence) ? 'none' : 'block';
      el.streakBar.style.display = isCompare ? 'flex' : 'none';
      el.streakHint.classList.toggle('hidden', !isCompare);
      el.browseBtn.classList.toggle('hidden', !isCompare);
      browsing = false;
      el.browseBtn.textContent = '📖 See the rankings first';
      if(isCompare) renderStreak();
      if(isSequence){ enterSequenceView(); } else { newQuestion(); }
    });
  });

  el.browseBtn.addEventListener('click', () => {
    browsing = !browsing;
    el.browseBtn.textContent = browsing ? '🎯 Back to the quiz' : '📖 See the rankings first';
    newQuestion();
  });

  el.resetLink.addEventListener('click', () => {
    if(confirm('This clears all mastery progress AND compare-mode streaks. Continue?')){
      progress = {};
      countries.forEach(c => progress[c.key] = { correctDates: [] });
      saveProgress(progress);
      streaks = { pop: { current: 0, best: 0 }, area: { current: 0, best: 0 } };
      saveStreaks(streaks);
      renderProgress();
      renderStreak();
      newQuestion();
    }
  });

  renderProgress();
  renderDailyStreak();
  newQuestion();

  return {
    pause: pauseReferenceAudio,
    quickPlay(){
      const modes = ['c2cap', 'cap2c', 'order', 'sequence', 'pop', 'area'];
      const pick = modes[Math.floor(Math.random() * modes.length)];
      const btn = container.querySelector('.modebtn[data-mode="' + pick + '"]');
      if(btn) btn.click();
    },
  };
}
