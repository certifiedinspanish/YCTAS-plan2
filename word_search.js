// "Word Search" — find the real Spanish word hidden inside a country (or capital) name,
// then type the whole name, accents and all, to watch the word light up in place.
//
// One round per word. Flow for each round:
//   1. Spanish word shown large; its English meaning small and quiet beneath it
//      (the English is what the learner already recognises instantly — the Spanish
//      string is what they are learning to see, so the Spanish gets the attention).
//   2. Pick which name contains the word (4 choices; distractors never contain it).
//   3. Type the full name in the letter boxes. Accents must be typed, and matching is
//      accent-EXACT: á is a different letter from a, so the final á in Panamá never
//      counts as an "a" inside a word.
//   4. The word is highlighted in place. NEXT only appears after a correct answer.
//
// Practice-only: results are saved on the device under their own key and never touch
// the star / mastery system.
function createWordSearch(opts) {
  const { container, dataSrc } = opts;
  let setKey = opts.setKey || 'countries';
  const STORE = 'yctas_plan2_wordsearch_v1';
  const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'];

  const nfc = s => String(s).normalize('NFC');
  const norm = s => nfc(s).toLowerCase();       // case-insensitive, accent-EXACT
  const lettersOf = s => Array.from(norm(s).replace(/\s+/g, ''));

  let all = null, store = {};
  let rounds = [], names = [], title = '', kind = 'country';
  let state = { pos: 0, found: {} };
  let idx = 0;           // current round index
  let phase = 'choose';  // 'choose' | 'type' | 'done'
  let choices = [];
  let loaded = false, loading = false;

  const root = document.createElement('div');
  root.className = 'ws-root';
  container.appendChild(root);

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function load() {
    try {
      const r = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (r && typeof r === 'object') store = (r.pos !== undefined && !r.countries) ? { countries: { pos: r.pos || 0, found: r.found || {} } } : r;
    } catch (e) { store = {}; }
  }
  function save() { try { store[setKey] = state; localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) {} }
  function useSet(key) {
    setKey = key;
    const set = all[key];
    title = set.title; names = set.names; rounds = set.rounds; kind = set.kind || 'country';
    state = store[key] && typeof store[key] === 'object' ? { pos: store[key].pos || 0, found: store[key].found || {} } : { pos: 0, found: {} };
    startRound(state.pos > 0 && state.pos < rounds.length ? state.pos : 0);
  }
  function tabsHtml() {
    const keys = Object.keys(all);
    if (keys.length < 2) return '';
    return '<div class="ws-tabs">' + keys.map(k => `<button type="button" class="ws-tab${k === setKey ? ' active' : ''}" data-set="${k}">${esc(all[k].tab || k)}</button>`).join('') + '</div>';
  }
  function bindTabs() {
    root.querySelectorAll('.ws-tab').forEach(b => b.addEventListener('click', () => { if (b.dataset.set !== setKey) useSet(b.dataset.set); }));
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function makeChoices(r) {
    const w = norm(r.word);
    const pool = names.filter(n => n !== r.target && !norm(n).includes(w));
    return shuffle([r.target, ...shuffle(pool).slice(0, 3)]);
  }

  async function ensureLoaded() {
    if (loaded || loading) return;
    loading = true;
    root.innerHTML = '<p class="ws-msg">Loading…</p>';
    try {
      const res = await fetch(dataSrc);
      all = await res.json();
      load();
      loaded = true;
      useSet(all[setKey] ? setKey : Object.keys(all)[0]);
    } catch (e) {
      root.innerHTML = '<p class="ws-msg ws-bad">Could not load the game.</p>';
      console.error(e);
    }
    loading = false;
  }

  function instructions() {
    return `
      <div class="ws-how">
        <div class="ws-how-t">How to play</div>
        <ol>
          <li>Read the Spanish word. The English is just there to help.</li>
          <li>Pick the name that has the word hiding inside it.</li>
          <li>Type the whole name — <b>accents count</b> (á é í ó ú ñ) — and watch the word light up!</li>
        </ol>
      </div>`;
  }

  // Two one-letter words that are inside almost every name, so they can't be rounds.
  // Shown quietly under the instructions: the Spanish letter is the focus, English is small.
  function tinyWordsNote() {
    return `
      <div class="ws-tiny">
        <div class="ws-tiny-t">Two tiny words we left out</div>
        <div class="ws-tiny-row">
          <div class="ws-tiny-w"><span class="ws-tiny-es">a</span><span class="ws-tiny-en">to</span></div>
          <div class="ws-tiny-w"><span class="ws-tiny-es">o</span><span class="ws-tiny-en">or</span></div>
        </div>
        <p class="ws-tiny-p">These two Spanish words are hiding in almost every name, so they are not part of the game. As you play, see how many times you can spot them!</p>
      </div>`;
  }

  function startRound(i) {
    idx = i; phase = 'choose';
    choices = makeChoices(rounds[i]);
    renderRound();
  }

  function renderRound() {
    const r = rounds[idx], N = rounds.length;
    const pct = Math.round(idx / N * 100);
    root.innerHTML = tabsHtml() + `
      <div class="ws-card">
        <div class="ws-top"><span class="ws-title">${esc(title)}</span><span class="ws-round">Round ${idx + 1} of ${N}</span></div>
        <div class="ws-bar"><div class="ws-fill" style="width:${pct}%"></div></div>
        <div class="ws-word">${esc(r.word)}</div>
        <div class="ws-en">${esc(r.en)}</div>
        <div class="ws-q">Which ${kind} name contains the word above?</div>
        <div class="ws-choices" data-el="choices">
          ${choices.map(c => `<button type="button" class="ws-choice" data-name="${esc(c)}">${esc(c)}</button>`).join('')}
        </div>
        <div class="ws-msg" data-el="msg" aria-live="polite"></div>
        <div class="ws-type hidden" data-el="typePanel"></div>
        <button type="button" class="ws-next hidden" data-el="next"></button>
      </div>
      ${instructions()}
      ${tinyWordsNote()}
      <span class="ws-restart" data-el="restart">Start over from Round 1</span>`;
    const q = s => root.querySelector('[data-el="' + s + '"]');
    bindTabs();
    root.querySelectorAll('.ws-choice').forEach(b => b.addEventListener('click', () => pick(b)));
    q('next').addEventListener('click', nextRound);
    q('restart').addEventListener('click', () => { if (confirm('Go back to Round 1?')) { state.pos = 0; save(); startRound(0); } });
  }

  function pick(btn) {
    if (phase !== 'choose') return;
    const r = rounds[idx];
    const msg = root.querySelector('[data-el="msg"]');
    if (btn.dataset.name === r.target) {
      phase = 'type';
      root.querySelectorAll('.ws-choice').forEach(b => { b.disabled = true; if (b !== btn) b.classList.add('ws-dim'); });
      btn.classList.add('ws-right');
      msg.textContent = '';
      msg.className = 'ws-msg';
      buildTyper();
    } else {
      btn.disabled = true; btn.classList.add('ws-wrong');
      msg.className = 'ws-msg ws-bad';
      msg.textContent = 'Not that one — look for the word hiding inside the name.';
    }
  }

  function buildTyper() {
    const r = rounds[idx];
    const target = lettersOf(r.target);
    const L = target.length;
    const display = Array.from(nfc(r.target));          // keeps spaces + original capitals
    const hasAccent = /[^\u0000-\u007f]/.test(r.target);
    const panel = root.querySelector('[data-el="typePanel"]');
    panel.classList.remove('hidden');

    // boxes, grouped by word so long names wrap between words, never mid-word
    let boxIdx = 0;
    const groups = nfc(r.target).split(/\s+/).map(w => '<span class="ws-grp">' +
      Array.from(w).map(() => `<span class="ws-box" data-i="${boxIdx++}"></span>`).join('') + '</span>').join('');

    panel.innerHTML = `
      <div class="ws-q2">Now type the full name${hasAccent ? ' — <b>this one has an accent!</b>' : ''}</div>
      <div class="ws-work" data-el="work">
        <div class="ws-boxes">${groups}</div>
        <input class="ws-input" data-el="inp" type="text" inputmode="text" autocomplete="off" autocorrect="off"
               autocapitalize="none" spellcheck="false" maxlength="${L + 8}" aria-label="Type the full name">
      </div>
      <div class="ws-hint" data-el="hint">Click anywhere inside the box to start typing…</div>
      <div class="ws-keys" data-el="keys">
        ${ACCENTS.map(a => `<button type="button" class="ws-key" data-ch="${a}">${a}</button>`).join('')}
        <button type="button" class="ws-key ws-key-del" data-ch="⌫" aria-label="Delete">⌫</button>
      </div>`;

    const q = s => panel.querySelector('[data-el="' + s + '"]');
    const inp = q('inp'), hint = q('hint'), work = q('work');
    const boxes = Array.from(panel.querySelectorAll('.ws-box'));
    const msg = root.querySelector('[data-el="msg"]');
    let finished = false;

    function typedChars() { return Array.from(nfc(inp.value).replace(/\s+/g, '')).slice(0, L); }

    function paint(typed, bad) {
      boxes.forEach((b, i) => {
        const ch = typed[i];
        b.textContent = ch ? ch.toUpperCase() : '';
        b.classList.toggle('ws-cur', !finished && i === typed.length);
        b.classList.toggle('ws-badbox', !!(bad && bad.has(i)));
      });
    }

    function onInput() {
      if (finished) return;
      const typed = typedChars();
      inp.value = typed.join('');
      hint.textContent = typed.length ? 'Keep going — you can use the accent keys below.' : 'Click anywhere inside the box to start typing…';
      msg.className = 'ws-msg'; msg.textContent = '';
      if (typed.length < L) { paint(typed); return; }
      const bad = new Set();
      typed.forEach((c, i) => { if (norm(c) !== target[i]) bad.add(i); });
      if (bad.size === 0) { success(typed); return; }
      paint(typed, bad);
      msg.className = 'ws-msg ws-bad';
      msg.textContent = 'Check your spelling — fix the red letters.' + (hasAccent ? ' (Don’t forget the accent!)' : '');
    }

    function success(typed) {
      finished = true;
      phase = 'done';
      inp.blur(); inp.disabled = true;
      // highlight the hidden word in place (first occurrence; accent-exact)
      const full = norm(r.target);
      const at = full.indexOf(norm(r.word));
      const before = Array.from(full.slice(0, at)).filter(c => !/\s/.test(c)).length;
      const wl = Array.from(norm(r.word)).length;
      boxes.forEach((b, i) => {
        b.textContent = display.filter(c => !/\s/.test(c))[i].toUpperCase();
        b.classList.remove('ws-cur', 'ws-badbox');
        b.classList.add(i >= before && i < before + wl ? 'ws-hit' : 'ws-soft');
      });
      panel.querySelector('[data-el="keys"]').classList.add('hidden');
      hint.classList.add('hidden');
      work.classList.add('ws-done');
      msg.className = 'ws-msg ws-good';
      msg.textContent = 'Correct! Word match highlighted perfectly.';
      const f = state.found[r.id] || (state.found[r.id] = []);
      const t = today(); if (f.indexOf(t) < 0) f.push(t);
      state.pos = Math.min(idx + 1, rounds.length);
      save();
      const nb = root.querySelector('[data-el="next"]');
      nb.textContent = idx + 1 >= rounds.length ? '🏁 See my results' : 'NEXT →';
      nb.classList.remove('hidden');
      nb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    inp.addEventListener('input', onInput);
    work.addEventListener('click', () => { if (!finished) inp.focus(); });
    panel.querySelectorAll('.ws-key').forEach(k => {
      k.addEventListener('pointerdown', e => e.preventDefault());   // keep the keyboard open
      k.addEventListener('click', () => {
        if (finished) return;
        const cur = typedChars();
        if (k.dataset.ch === '⌫') cur.pop(); else if (cur.length < L) cur.push(k.dataset.ch);
        inp.value = cur.join('');
        onInput();
        inp.focus();
      });
    });
    paint([]);
    inp.focus();
  }

  function nextRound() {
    if (phase !== 'done') return;     // NEXT never works until the round is answered correctly
    if (idx + 1 >= rounds.length) { renderFinish(); return; }
    startRound(idx + 1);
  }

  function renderFinish() {
    const N = rounds.length;
    const n = rounds.filter(r => (state.found[r.id] || []).length).length;
    root.innerHTML = tabsHtml() + `
      <div class="ws-card ws-finish">
        <div class="ws-big">🎉</div>
        <div class="ws-fin-h">All ${N} words found!</div>
        <div class="ws-bar"><div class="ws-fill" style="width:100%"></div></div>
        <p class="ws-fin-p">${n} of ${N} hidden words discovered. Now you know what is hiding inside these names!</p>
        <button type="button" class="ws-next" data-el="again">🔁 Play again</button>
      </div>
      ${tinyWordsNote()}`;
    bindTabs();
    root.querySelector('[data-el="again"]').addEventListener('click', () => { state.pos = 0; save(); startRound(0); });
  }

  return {
    show() { ensureLoaded(); },
    pause() {},
  };
}
