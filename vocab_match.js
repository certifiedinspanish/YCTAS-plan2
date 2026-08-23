// Game 1 "Match the Words" — rebuilt per feedback.
//
// Two changes from the original flip-tile version:
//  1. Everything is visible from the start (no hidden/flip tiles) — this is
//     the same style as Quizlet's "Match" mode: tap a Spanish word, then its
//     English partner. A correct pair fades out; nothing is ever memory-recall
//     guesswork the way flip-tiles are.
//  2. Only a small set (6 pairs) is shown at once, not all 17. Progress is
//     tracked per word (a simple 0-3 mastery level, same spirit as Plan 1's
//     5-box system) and saved on the device, so struggling words come back
//     sooner in future sets/sessions, and mastered words drop out of rotation.
function createVocabMatch(opts) {
  const { container, dataSrc, gameKey } = opts;
  const SET_SIZE = 6;
  const MASTERED_LEVEL = 3;
  const STORAGE_KEY = 'yctas_plan2_vocabmatch_levels_v1';

  container.innerHTML = `
    <div class="vm-root" data-el="vmRoot">
      <p style="text-align:center;color:var(--text-muted);">Loading…</p>
    </div>
  `;
  const root = container.querySelector('[data-el="vmRoot"]');
  const audioEl = new Audio();

  let allPairs = [];
  let levels = {};
  let currentSet = [];   // array of pair objects for this set
  let tiles = [];        // 2 * SET_SIZE tile objects
  let selected = null;   // currently-selected tile index, or null
  let locked = false;
  let title = '';

  function playAudio(src) {
    if (!src) return;
    audioEl.pause();
    audioEl.src = src;
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  }
  function pause() { audioEl.pause(); }

  function loadLevels() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      levels = raw ? JSON.parse(raw) : {};
    } catch (e) { levels = {}; }
  }
  function saveLevels() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(levels)); } catch (e) {}
  }
  function levelOf(pairId) { return levels[pairId] || 0; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function load() {
    try {
      const res = await fetch(dataSrc);
      const all = await res.json();
      const game = all[gameKey];
      title = game.title;
      allPairs = game.pairs;
      loadLevels();
      buildNextSet();
      render();
    } catch (e) {
      root.innerHTML = '<p style="text-align:center;color:var(--coral);">Could not load the game.</p>';
      console.error(e);
    }
  }

  // Picks the next SET_SIZE pairs, prioritizing lower mastery level (weaker
  // words) first, so struggling words recycle sooner rather than waiting
  // for a full lap through everything.
  function buildNextSet() {
    const eligible = allPairs.filter(p => levelOf(p.pairId) < MASTERED_LEVEL);
    const sorted = shuffle(eligible).sort((a, b) => levelOf(a.pairId) - levelOf(b.pairId));
    currentSet = sorted.slice(0, SET_SIZE);

    const raw = [];
    currentSet.forEach(p => {
      raw.push({ pairId: p.pairId, side: 'es', text: p.spanish, audio: p.audio, matched: false });
      raw.push({ pairId: p.pairId, side: 'en', text: p.english, audio: null, matched: false });
    });
    tiles = shuffle(raw).map((t, i) => ({ ...t, idx: i }));
    selected = null;
    locked = false;
  }

  function masteredCount() {
    return allPairs.filter(p => levelOf(p.pairId) >= MASTERED_LEVEL).length;
  }

  function render() {
    const total = allPairs.length;
    const done = masteredCount();

    if (currentSet.length === 0) {
      root.innerHTML = `
        <div class="vm-card">
          <div class="qprompt-label" style="text-align:center;">${title}</div>
          <p style="text-align:center;font-size:32px;margin:20px 0;">🎉</p>
          <p style="text-align:center;font-weight:700;">All words mastered for now!</p>
          <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:6px;">${done} / ${total} words mastered</p>
          <button class="nextbtn show" data-el2="resetBtn">🔁 Practice again</button>
        </div>
      `;
      root.querySelector('[data-el2="resetBtn"]').addEventListener('click', () => {
        levels = {}; saveLevels();
        buildNextSet(); render();
      });
      return;
    }

    const tilesHtml = tiles.map(t => {
      if (t.matched) return `<div class="vm-tile vm-gone"></div>`;
      const isSelected = selected === t.idx;
      return `<button class="vm-tile ${isSelected ? 'selected' : ''}" data-idx="${t.idx}">${t.text}</button>`;
    }).join('');

    root.innerHTML = `
      <div class="vm-card">
        <div class="qprompt-label" style="text-align:center;">${title}</div>
        <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Tap a word, then its match</p>
        <div class="vm-progressWrap">
          <div class="vm-progressLabel">${done} / ${total} words mastered</div>
          <div class="vm-progressBar"><div class="vm-progressFill" style="width:${Math.round(done/total*100)}%;"></div></div>
        </div>
        <div class="vm-grid">${tilesHtml}</div>
      </div>
    `;

    root.querySelectorAll('.vm-tile:not(.vm-gone)').forEach(btn => {
      btn.addEventListener('click', () => tap(Number(btn.dataset.idx)));
    });
  }

  function tap(idx) {
    if (locked) return;
    const t = tiles[idx];
    if (t.matched) return;

    if (t.audio) playAudio(t.audio);

    if (selected === null) {
      selected = idx;
      render();
      return;
    }
    if (selected === idx) {
      selected = null;
      render();
      return;
    }

    const a = tiles[selected];
    const b = t;
    const isMatch = a.pairId === b.pairId && a.side !== b.side;

    if (isMatch) {
      locked = true;
      levels[a.pairId] = Math.min(MASTERED_LEVEL, levelOf(a.pairId) + 1);
      saveLevels();
      a.matched = true; b.matched = true;
      selected = null;
      render();
      setTimeout(() => {
        locked = false;
        if (tiles.every(x => x.matched)) {
          buildNextSet();
        }
        render();
      }, 350);
    } else {
      levels[a.pairId] = Math.max(0, levelOf(a.pairId) - 1);
      saveLevels();
      locked = true;
      const wrongIdx = [selected, idx];
      selected = null;
      render();
      root.querySelectorAll('.vm-tile').forEach(btn => {
        if (wrongIdx.includes(Number(btn.dataset.idx))) btn.classList.add('wrong');
      });
      setTimeout(() => { locked = false; render(); }, 500);
    }
  }

  load();
  return { pause };
}
