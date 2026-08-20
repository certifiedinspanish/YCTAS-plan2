// Game 3 — DTS Role Play ("Cuatro Amigos")
//
// The user picks one character to role-play for a session ("round"), then
// builds sentences by tapping word buttons — no typing. Every tap plays that
// word's own short audio clip immediately. When the user taps "¡Dilo!" (Say
// it!), the built sequence is checked (ignoring punctuation/case) against
// that character's Answer Bank. A match = points + the real recorded
// sentence audio + a visible correct-sentence display. No match = no points.
//
// ABCD rules, enforced automatically (never explained to the user in words):
//   A. Yo   — only about the speaker themself
//   B. Tú   — only about ONE character, decided by whichever character the
//              user's first successful Tú sentence turns out to be about
//   C. Él/Ella — about any character that isn't the speaker or the locked Tú
//              target; must name the character (never a bare pronoun)
//
// Two modes:
//   Guided    — once a Tú target is locked, other characters' words go
//               inactive whenever the user is mid-way through building a
//               Tú-form sentence (i.e. right after tapping "Eres").
//   Challenge — nothing is ever disabled; a wrong-character attempt gets a
//               short buzz and "Not valid — wrong character."
function createGame3(opts) {
  const { container, dataSrc } = opts;

  container.innerHTML = `
    <div class="g3-root" data-el="g3Root">
      <p style="text-align:center;color:var(--text-muted);">Loading…</p>
    </div>
  `;
  const root = container.querySelector('[data-el="g3Root"]');
  let story = null;
  let speaker = null;          // the chosen character object
  let mode = 'guided';         // 'guided' | 'challenge'
  let scored = new Set();      // sentence texts already scored this round
  let tuLocked = null;         // character name, once first Tú sentence lands
  let attempt = [];            // array of {key, display} tiles tapped so far
  let currentVerbKey = null;   // 'soy' | 'eres' | 'es' | null (for this attempt)
  const audioEl = new Audio();
  const wordAudioEl = new Audio();

  function playAudio(el, src) {
    return new Promise((resolve) => {
      if (!src) { resolve(); return; }
      el.pause();
      el.src = src;
      el.currentTime = 0;
      const done = () => { el.removeEventListener('ended', done); resolve(); };
      el.addEventListener('ended', done);
      el.play().catch(() => resolve());
    });
  }
  function pause() { audioEl.pause(); wordAudioEl.pause(); }

  function normalize(s) {
    return s.toLowerCase().replace(/[.,:]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Short buzz for an invalid/wrong-character attempt (no recording needed).
  function playBuzz() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 140;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  async function load() {
    try {
      const res = await fetch(dataSrc);
      story = await res.json();
      renderCharacterSelect();
    } catch (e) {
      root.innerHTML = '<p style="text-align:center;color:var(--coral);">Could not load the game.</p>';
      console.error(e);
    }
  }

  function shell(inner) {
    root.innerHTML = `<div class="g3-card">${inner}</div>`;
  }

  // ---------------- Character select (once per round) ----------------
  function renderCharacterSelect() {
    shell(`
      <div class="qprompt-label" style="text-align:center;">¿Quién eres tú?</div>
      <p style="text-align:center;color:var(--text-muted);font-size:13px;margin-bottom:16px;">Choose who you'll play this round</p>
      <div class="g3-charGrid">
        ${story.characters.map((c, i) => `
          <button class="g3-charTile" data-idx="${i}">
            <img src="${c.img}" alt="${c.name}">
            <span>${c.name}</span>
          </button>
        `).join('')}
      </div>
    `);
    root.querySelectorAll('.g3-charTile').forEach(btn => {
      btn.addEventListener('click', () => {
        speaker = story.characters[Number(btn.dataset.idx)];
        scored = new Set();
        tuLocked = null;
        attempt = [];
        currentVerbKey = null;
        renderGame();
      });
    });
  }

  // ---------------- Main role-play screen ----------------
  function isVerbWord(key) { return key === 'soy' || key === 'eres' || key === 'es'; }

  // Which characters' identity/trait words should be tappable right now,
  // given the in-progress verb (only matters in Guided mode).
  function activeAboutCharacters() {
    const all = story.characters.map(c => c.name);
    if (currentVerbKey === 'soy') {
      return [speaker.name];
    }
    if (currentVerbKey === 'eres') {
      if (tuLocked) return [tuLocked];
      return all.filter(n => n !== speaker.name);
    }
    if (currentVerbKey === 'es') {
      return all.filter(n => n !== speaker.name && n !== tuLocked);
    }
    // No verb chosen yet this attempt — everything open.
    return all;
  }

  function wordBelongsToCharacter(vocabWord) {
    for (const c of story.characters) {
      if (c.name.toLowerCase() === vocabWord.key) return c.name;
      if (c.trait_words.includes(vocabWord.key)) return c.name;
    }
    return null; // shared word (soy/eres/es/un/una) — never gated
  }

  function renderGame() {
    const bankWords = story.vocabulary;
    const activeChars = mode === 'guided' ? activeAboutCharacters() : null;

    const attemptHtml = attempt.map((t, i) => `
      <button class="g3-tile answer" data-i="${i}">${t.display}</button>
    `).join('') || '<span class="g3-placeholder">Tap words to build a sentence</span>';

    const bankHtml = bankWords.map((w) => {
      const owner = wordBelongsToCharacter(w);
      let disabled = false;
      if (mode === 'guided' && owner && activeChars && !activeChars.includes(owner)) {
        disabled = true;
      }
      return `<button class="g3-tile ${disabled ? 'disabled' : ''}" data-key="${w.key}" data-audio="${w.audio}" ${disabled ? 'disabled' : ''}>${w.word}</button>`;
    }).join('');

    const answered = story.answerBank[speaker.name].length;
    const pct = Math.round((scored.size / answered) * 100);

    shell(`
      <div class="g3-topRow">
        <img class="g3-avatar" src="${speaker.img}" alt="${speaker.name}">
        <div class="g3-topInfo">
          <div class="g3-playingAs">Playing as</div>
          <div class="g3-charName">${speaker.name}</div>
        </div>
        <button class="g3-switchBtn" data-el2="switchChar">Switch</button>
      </div>

      ${tuLocked ? `<div class="g3-statusLine">Now talking to <strong>${tuLocked}</strong> only.</div>` : ''}

      <div class="g3-modeRow">
        <button class="g3-modeBtn ${mode === 'guided' ? 'active' : ''}" data-mode="guided">Guided</button>
        <button class="g3-modeBtn ${mode === 'challenge' ? 'active' : ''}" data-mode="challenge">Challenge</button>
      </div>

      <div class="g3-answerRow" data-el2="answerRow">${attemptHtml}</div>

      <div class="g3-bankRow">${bankHtml}</div>

      <div class="g3-actionRow">
        <button class="g3-clearBtn" data-el2="clearBtn">Clear</button>
        <button class="g3-sayBtn" data-el2="sayBtn" ${attempt.length === 0 ? 'disabled' : ''}>¡Dilo! (Say it)</button>
      </div>

      <div class="g3-feedback" data-el2="feedback"></div>

      <div class="g3-progressWrap">
        <div class="g3-progressLabel">${speaker.name}'s progress: ${scored.size} / ${answered}</div>
        <div class="g3-progressBar"><div class="g3-progressFill" style="width:${pct}%;"></div></div>
      </div>

      <div class="g3-serTab" data-el2="serTab">ser? <span class="g3-chev">‹</span></div>
      <div class="g3-serBox hidden" data-el2="serBox">
        <div class="g3-serTitle">ser</div>
        <div><b>Yo soy</b> — I am</div>
        <div><b>Tú eres</b> — you are</div>
        <div><b>Él es</b> — he is</div>
        <div><b>Ella es</b> — she is</div>
      </div>
    `);

    // word taps
    root.querySelectorAll('.g3-tile:not(.answer):not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const audio = btn.dataset.audio;
        if (isVerbWord(key) && attempt.length === 0) currentVerbKey = key;
        attempt.push({ key, display: btn.textContent });
        playAudio(wordAudioEl, audio);
        renderGame();
      });
    });
    // remove a tile from the answer row
    root.querySelectorAll('.g3-tile.answer').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        attempt.splice(i, 1);
        if (attempt.length === 0) currentVerbKey = null;
        renderGame();
      });
    });

    root.querySelector('[data-el2="clearBtn"]').addEventListener('click', () => {
      attempt = []; currentVerbKey = null; renderGame();
    });
    root.querySelector('[data-el2="switchChar"]').addEventListener('click', renderCharacterSelect);
    root.querySelectorAll('.g3-modeBtn').forEach(btn => {
      btn.addEventListener('click', () => { mode = btn.dataset.mode; renderGame(); });
    });
    root.querySelector('[data-el2="sayBtn"]').addEventListener('click', checkAttempt);

    const serTab = root.querySelector('[data-el2="serTab"]');
    const serBox = root.querySelector('[data-el2="serBox"]');
    serTab.addEventListener('click', () => serBox.classList.toggle('hidden'));
  }

  async function checkAttempt() {
    const built = normalize(attempt.map(t => t.display).join(' '));
    const bank = story.answerBank[speaker.name];
    const match = bank.find(item => normalize(item.sentence) === built);
    const feedback = root.querySelector('[data-el2="feedback"]');

    if (!match) {
      playBuzz();
      feedback.textContent = 'Not a sentence from the story — try again.';
      feedback.className = 'g3-feedback wrong';
      return;
    }

    if (match.category === 'Tú' && tuLocked && match.about !== tuLocked) {
      playBuzz();
      feedback.textContent = 'Not valid — wrong character.';
      feedback.className = 'g3-feedback wrong';
      return;
    }

    // Valid match.
    if (match.category === 'Tú' && !tuLocked) {
      tuLocked = match.about;
    }
    const alreadyScored = scored.has(match.sentence);
    if (!alreadyScored) scored.add(match.sentence);

    feedback.textContent = alreadyScored
      ? '¡Correcto! (already counted once)'
      : '¡Correcto! +1';
    feedback.className = 'g3-feedback correct';

    attempt = [];
    currentVerbKey = null;
    renderGame();
    // re-select feedback element after re-render, then show the sentence + play audio
    const fb2 = root.querySelector('[data-el2="feedback"]');
    fb2.textContent = match.sentence;
    fb2.className = 'g3-feedback correct show';
    await playAudio(audioEl, match.audio);
  }

  load();
  return { pause };
}
