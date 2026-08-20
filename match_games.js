// Games 1 & 2 — flip-tile matching, reusing the same core mechanic Plan 1's
// Match Game already uses (flip two tiles, check for a pair), just with new
// content and a shared, generic engine so both games use one codebase.
//
// Game 1 (Vocabulary Match): Spanish word <-> English meaning. Only the
// Spanish tile has audio (English is the learner's home language).
// Game 2 (Match the Friend): character <-> their identity description.
// Both sides have audio; on a correct match, the name plays first, then the
// descriptor — a small extra rehearsal of "Paula... una chica modelo."
function createMatchGame(opts) {
  const { container, dataSrc, gameKey } = opts;

  container.innerHTML = `
    <div class="mg-root" data-el="mgRoot">
      <p style="text-align:center;color:var(--text-muted);">Loading…</p>
    </div>
  `;
  const root = container.querySelector('[data-el="mgRoot"]');
  const audioEl = new Audio();
  let tiles = [];
  let flipped = [];
  let locked = false;
  let matchedCount = 0;
  let title = '';

  function playAudio(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(); return; }
      audioEl.pause();
      audioEl.src = src;
      audioEl.currentTime = 0;
      const done = () => { audioEl.removeEventListener('ended', done); resolve(); };
      audioEl.addEventListener('ended', done);
      audioEl.play().catch(() => resolve());
    });
  }
  function pause() { audioEl.pause(); }

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
      buildTiles(game);
      title = game.title;
      render();
    } catch (e) {
      root.innerHTML = '<p style="text-align:center;color:var(--coral);">Could not load the game.</p>';
      console.error(e);
    }
  }

  function buildTiles(game) {
    const raw = [];
    if (gameKey === 'game1') {
      game.pairs.forEach(p => {
        raw.push({ pairId: p.pairId, side: 'es', display: p.spanish, audio: p.audio });
        raw.push({ pairId: p.pairId, side: 'en', display: p.english, audio: null });
      });
    } else {
      game.pairs.forEach(p => {
        raw.push({ pairId: p.pairId, side: 'char', display: p.name, img: p.img, audio: p.nameAudio });
        raw.push({ pairId: p.pairId, side: 'desc', display: p.descriptor, audio: p.descriptorAudio });
      });
    }
    tiles = shuffle(raw).map((t, i) => ({ ...t, idx: i, flipped: false, matched: false }));
    matchedCount = 0;
    flipped = [];
    locked = false;
  }

  function render() {
    const total = tiles.length / 2;
    const gridClass = gameKey === 'game2' ? 'mg-grid mg-grid-4col' : 'mg-grid';
    const tilesHtml = tiles.map(t => {
      const show = t.flipped || t.matched;
      let inner;
      if (!show) {
        inner = '<span class="mg-back">❓</span>';
      } else if (t.side === 'char') {
        inner = `<img src="${t.img}" alt="${t.display}"><span>${t.display}</span>`;
      } else {
        inner = `<span class="mg-word">${t.display}</span>`;
      }
      return `<button class="mg-tile ${t.matched ? 'matched' : ''}" data-idx="${t.idx}" ${t.matched ? 'disabled' : ''}>${inner}</button>`;
    }).join('');

    root.innerHTML = `
      <div class="mg-card">
        <div class="qprompt-label" style="text-align:center;">${title}</div>
        <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:14px;">Matched ${matchedCount} / ${total}</p>
        <div class="${gridClass}">${tilesHtml}</div>
        ${matchedCount === total ? '<button class="nextbtn show" data-el2="replayBtn">🔁 Play again</button>' : ''}
      </div>
    `;

    root.querySelectorAll('.mg-tile:not(.matched)').forEach(btn => {
      btn.addEventListener('click', () => tap(Number(btn.dataset.idx)));
    });
    const replay = root.querySelector('[data-el2="replayBtn"]');
    if (replay) replay.addEventListener('click', async () => {
      const res = await fetch(dataSrc);
      const all = await res.json();
      buildTiles(all[gameKey]);
      render();
    });
  }

  async function tap(idx) {
    if (locked) return;
    const t = tiles[idx];
    if (t.flipped || t.matched) return;
    if (flipped.length === 2) return;
    t.flipped = true;
    flipped.push(idx);
    render();
    if (t.audio) await playAudio(t.audio);

    if (flipped.length === 2) {
      locked = true;
      const [i1, i2] = flipped;
      const a = tiles[i1], b = tiles[i2];
      const isMatch = a.pairId === b.pairId && a.side !== b.side;
      if (isMatch) {
        if (a.side === 'char' || b.side === 'char') {
          const first = a.side === 'char' ? a : b;
          const second = a.side === 'char' ? b : a;
          if (first.audio) await playAudio(first.audio);
          if (second.audio) await playAudio(second.audio);
        }
        a.matched = true; b.matched = true; a.flipped = false; b.flipped = false;
        matchedCount += 1;
        flipped = []; locked = false;
        render();
      } else {
        setTimeout(() => {
          a.flipped = false; b.flipped = false;
          flipped = []; locked = false;
          render();
        }, 900);
      }
    }
  }

  load();
  return { pause };
}
