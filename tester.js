function createTester(opts) {
  const { container, countries, flags, compareData, countriesAudioSrc, capitalsAudioSrc } = opts;

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
    <p class="stargrid-label">Your progress so far:</p>
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
  // If an account is logged in, every local save also gets queued up to sync
  // to the cloud. If no one's logged in, YCTASAuth.pushProgress is a no-op —
  // this line is safe to call unconditionally and never breaks the no-login
  // experience.
  function cloudSync(){
    if(window.YCTASAuth && window.YCTASAuth.isLoggedIn()){
      window.YCTASAuth.pushProgress({ progress, streaks, dailyStreak });
    }
  }
  function saveDailyStreak(s){ try{ localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(s)); }catch(e){} cloudSync(); }
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

  function loadProgress(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    const p = {};
    countries.forEach(c => p[c.key] = { correctDates: [] });
    return p;
  }
  function saveProgress(p){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }catch(e){} cloudSync(); }
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
  function saveStreaks(s){ try{ localStorage.setItem(STREAK_KEY, JSON.stringify(s)); }catch(e){} cloudSync(); }

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

      const seqRow = document.createElement('div');
      seqRow.style.display = 'flex'; seqRow.style.justifyContent='center'; seqRow.style.gap='8px'; seqRow.style.marginBottom='16px';
      shown.forEach(c => {
        const img = document.createElement('img');
        img.src = flagSrc(c.key);
        img.style.width='54px'; img.style.height='38px'; img.style.objectFit='cover'; img.style.borderRadius='6px';
        seqRow.appendChild(img);
      });
      el.qcard.appendChild(seqRow);

      const choicesWrap = document.createElement('div');
      choicesWrap.className = 'choices';
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.dataset.key = opt.key;
        const img = document.createElement('img');
        img.src = flagSrc(opt.key);
        btn.appendChild(img);
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
      if(mode !== 'order'){
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
  }

  container.querySelectorAll('.modebtn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.modebtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
      const isCompare = (mode === 'pop' || mode === 'area');
      el.masteryBar.style.display = isCompare ? 'none' : 'flex';
      el.starGrid.style.display = isCompare ? 'none' : 'grid';
      el.streakBar.style.display = isCompare ? 'flex' : 'none';
      el.streakHint.classList.toggle('hidden', !isCompare);
      el.browseBtn.classList.toggle('hidden', !isCompare);
      browsing = false;
      el.browseBtn.textContent = '📖 See the rankings first';
      if(isCompare) renderStreak();
      newQuestion();
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

  // If a login happens while this screen is already open (rare, but
  // possible), reload everything fresh from localStorage — auth.js writes
  // the merged result there — and re-render so nothing looks stale.
  function refreshFromStorage(){
    progress = loadProgress();
    streaks = loadStreaks();
    dailyStreak = loadDailyStreak();
    renderProgress();
    renderStreak();
    renderDailyStreak();
    newQuestion();
  }
  window.addEventListener('yctas:progressMerged', refreshFromStorage);

  return { pause: pauseReferenceAudio, refresh: refreshFromStorage };
}
