// Builds one song-player experience (stage + map + karaoke verses) inside a
// given container. Used for both the Countries Song and Capitals Song, since
// they share the same visual system — only the audio, cues, and clap-break
// behavior differ between the two.
function createSongPlayer(opts) {
  const {
    container, countries, flags, mapData, cues, audioSrc, hasClaps, byKey
  } = opts;

  container.innerHTML = `
    <div class="sticky-top">
      <div class="stage">
        <div class="spotlight"></div>
        <div class="flag-big-wrap"><img class="flag-big" data-el="bigFlag" src="" alt=""></div>
        <div class="active-name" data-el="bigName">Press play to begin</div>
        <div class="active-capital" data-el="bigCapital">&nbsp;</div>
        <div class="transport">
          <button class="playbtn" data-el="playBtn">▶</button>
          <button class="restartbtn" data-el="restartBtn">⟲ Start over</button>
        </div>
        <div class="timeline">
          <div class="track" data-el="track"><div class="fill" data-el="fill"></div></div>
          <div class="timelabels"><span data-el="curTime">0:00</span><span data-el="durTime">0:00</span></div>
        </div>
      </div>
      <div class="map" data-el="map"></div>
    </div>
    <div class="verses" data-el="verses"></div>
    <div class="finale-banner" data-el="finale">🎉 ¡Y Venezuela! You did it! 🎉</div>
    <audio data-el="player" src="${audioSrc}"></audio>
  `;

  const el = {};
  container.querySelectorAll('[data-el]').forEach(node => { el[node.dataset.el] = node; });

  function flagSrc(key){ return flags[key]; }

  const pins = {};
  const shapes = {};
  let firstPin = null;
  const svgNS = 'http://www.w3.org/2000/svg';
  const am = mapData.americas;
  const amSvg = document.createElementNS(svgNS, 'svg');
  amSvg.setAttribute('class', 'americas-svg');
  amSvg.setAttribute('viewBox', '0 0 ' + am.width + ' ' + am.height);
  amSvg.setAttribute('width', am.width);
  amSvg.setAttribute('height', am.height);

  // Context layer: neighboring non-Hispanic countries + water labels, purely
  // for geographic orientation. Deliberately built from separate map.json
  // keys (am.context / am.contextLabels / am.waterLabels) that the quiz and
  // highlight logic never reads, so these can never accidentally become
  // clickable or count toward any game.
  if(am.contextPatches){
    // Precisely-computed fills for the two real gaps between Brazil's real
    // border data and the existing hand-placed song countries (found via
    // proper geometry analysis, not guesswork). Solid, undashed — these
    // should be invisible as their own shape, just quietly closing the gap.
    for (const c of Object.values(am.contextPatches)) {
      const patch = document.createElementNS(svgNS, 'path');
      patch.setAttribute('d', c.d);
      patch.setAttribute('class', 'context-patch');
      amSvg.appendChild(patch);
    }
  }
  if(am.context){
    for (const c of Object.values(am.context)) {
      // Solid "backing" layer first, no dash, thicker stroke acting as a
      // gap-filler — hides any hairline seam where this shape's real-world
      // data doesn't perfectly line up with a neighboring song country's.
      const backing = document.createElementNS(svgNS, 'path');
      backing.setAttribute('d', c.d);
      backing.setAttribute('class', 'context-shape-backing');
      amSvg.appendChild(backing);
    }
    for (const c of Object.values(am.context)) {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', c.d);
      path.setAttribute('class', 'context-shape');
      amSvg.appendChild(path);
    }
  }
  function addLabel(x, y, text, size, weight, anchor){
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('class', 'context-label');
    t.setAttribute('font-size', size); t.setAttribute('font-weight', weight);
    t.setAttribute('text-anchor', anchor);
    t.textContent = text;
    amSvg.appendChild(t);
  }
  (am.contextLabels || []).forEach(l => addLabel(l.x, l.y, l.text, l.size, l.weight, l.anchor));
  (am.contextLeaderLabels || []).forEach(l => {
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', l.cx); line.setAttribute('y1', l.cy);
    line.setAttribute('x2', l.lx); line.setAttribute('y2', l.ly);
    line.setAttribute('class', 'context-leader');
    amSvg.appendChild(line);
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', l.cx); dot.setAttribute('cy', l.cy); dot.setAttribute('r', 1.6);
    dot.setAttribute('class', 'context-leader-dot');
    amSvg.appendChild(dot);
    addLabel(l.lx, l.ly - 3, l.text, 8, 600, 'middle');
  });
  (am.waterLabels || []).forEach(l => {
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', l.x); t.setAttribute('y', l.y);
    t.setAttribute('class', 'water-label');
    t.setAttribute('text-anchor', 'middle');
    if(l.rotate) t.setAttribute('transform', 'rotate(-90 ' + l.x + ' ' + l.y + ')');
    t.textContent = l.text;
    amSvg.appendChild(t);
  });

  for (const [key, c] of Object.entries(am.countries)) {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', c.d);
    path.setAttribute('class', 'country-shape');
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = byKey[key] ? byKey[key].name : key;
    path.appendChild(title);
    amSvg.appendChild(path);
    shapes[key] = path;
  }
  for (const [key, c] of Object.entries(am.countries)) {
    const pin = document.createElementNS(svgNS, 'circle');
    pin.setAttribute('cx', c.cx); pin.setAttribute('cy', c.cy);
    pin.setAttribute('class', 'pin');
    amSvg.appendChild(pin);
    pins[key] = pin;
    if(!firstPin) firstPin = pin;
  }
  el.map.appendChild(amSvg);

  // Spain now lives as a small floating inset in the corner of the SAME map,
  // instead of a separate side panel that was splitting the space in half.
  const sp = mapData.spain;
  const spTopExt = sp.topExtension || 0;
  const spainWrap = document.createElement('div');
  spainWrap.className = 'spain-inset';
  const spSvg = document.createElementNS(svgNS, 'svg');
  spSvg.setAttribute('viewBox', '0 -' + spTopExt + ' ' + sp.width + ' ' + (sp.height + spTopExt));
  // Portugal + France, for geographic context only — same non-interactive
  // pattern as the Americas map's context layer, kept structurally separate
  // from Spain's own shape/pin so it can never become clickable.
  if(sp.context){
    for (const c of Object.values(sp.context)) {
      const cpath = document.createElementNS(svgNS, 'path');
      cpath.setAttribute('d', c.d);
      cpath.setAttribute('class', 'context-shape');
      spSvg.appendChild(cpath);
    }
  }
  const spPath = document.createElementNS(svgNS, 'path');
  spPath.setAttribute('d', sp.d);
  spPath.setAttribute('class', 'country-shape');
  spSvg.appendChild(spPath);
  const spPin = document.createElementNS(svgNS, 'circle');
  spPin.setAttribute('cx', sp.cx); spPin.setAttribute('cy', sp.cy);
  spPin.setAttribute('class', 'pin');
  spSvg.appendChild(spPin);
  // Labels drawn LAST, on top of everything — otherwise Spain's own opaque
  // fill can silently cover part of a neighboring label wherever their
  // bounding boxes happen to overlap, which is exactly what was happening.
  (sp.contextLabels || []).forEach(l => {
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', l.x); t.setAttribute('y', l.y);
    t.setAttribute('class', 'spain-context-label');
    t.setAttribute('font-size', l.size); t.setAttribute('font-weight', l.weight);
    t.setAttribute('text-anchor', l.anchor);
    t.textContent = l.text;
    spSvg.appendChild(t);
  });
  spainWrap.appendChild(spSvg);
  const spLabel = document.createElement('div');
  spLabel.className = 'label'; spLabel.textContent = 'España';
  spainWrap.appendChild(spLabel);
  el.map.appendChild(spainWrap);
  shapes['espana'] = spPath;
  pins['espana'] = spPin;

  const verseNames = {1:'Verse 1',2:'Verse 2',3:'Verse 3',4:'Verse 4',5:'Verse 5 · Finale'};
  const rows = {};
  const verseBlocks = {};
  let clapCounter = 0;

  for (let v = 1; v <= 5; v++) {
    const block = document.createElement('div');
    block.className = 'verse-block';
    verseBlocks[v] = block;
    const head = document.createElement('div');
    head.className = 'verse-head';
    head.innerHTML = '<span class="verse-num">' + verseNames[v] + '</span>';
    block.appendChild(head);

    const inThisVerse = countries.filter(c => c.verse === v);
    inThisVerse.forEach(c => {
      const row = document.createElement('div');
      row.className = 'country-row';
      row.innerHTML =
        '<img class="row-flag" src="' + flagSrc(c.key) + '" alt="">' +
        '<span class="row-name">' + c.name + '</span>' +
        '<span class="row-capital">' + c.capital + '</span>';
      block.appendChild(row);
      rows[c.key] = row;
    });
    el.verses.appendChild(block);
  }

  if (hasClaps) {
    ['puerto_rico','republica_dominicana','uruguay'].forEach((k, i) => {
      const clap = document.createElement('div');
      clap.className = 'clap-marker';
      clap.dataset.clapIdx = i;
      clap.textContent = '👏 · 👏';
      rows[k].after(clap);
    });
  }

  function fmt(t){
    if(!isFinite(t)) return '0:00';
    const m = Math.floor(t/60), s = Math.floor(t%60);
    return m + ':' + (s<10?'0':'') + s;
  }

  let lastCueIdx = -1;
  let sungKeys = new Set();

  function applyState(cueIdx){
    if(cueIdx === lastCueIdx) return;
    lastCueIdx = cueIdx;
    if(cueIdx < 0) return;
    const cue = cues[cueIdx];

    if(cue.type === 'country' || cue.type === 'verse'){
      container.querySelectorAll('.country-row.active').forEach(n => n.classList.remove('active'));
      container.querySelectorAll('.row-name.active-text').forEach(n => n.classList.remove('active-text'));
      container.querySelectorAll('.pin.active').forEach(n => n.classList.remove('active'));
      container.querySelectorAll('.country-shape.active').forEach(n => n.classList.remove('active'));
      container.querySelectorAll('.verse-block.current').forEach(n => n.classList.remove('current'));
    }

    if(cue.type === 'country'){
      const c = byKey[cue.key];
      el.bigFlag.src = flagSrc(c.key);
      el.bigFlag.classList.remove('pulse'); void el.bigFlag.offsetWidth; el.bigFlag.classList.add('pulse');
      el.bigName.textContent = c.name;
      el.bigCapital.innerHTML = c.capital + ' <span>· capital</span>';

      const row = rows[c.key];
      row.classList.add('active');
      row.querySelector('.row-name').classList.add('active-text');

      pins[c.key].classList.add('active');
      if(shapes[c.key]){
        shapes[c.key].classList.add('active');
        // Spain's shape lives in its own separate mini-map, not in the main
        // Americas SVG — re-stacking it here would rip it out of its own
        // box and drop it into the Americas coordinate space by mistake.
        if(firstPin && c.key !== 'espana') amSvg.insertBefore(shapes[c.key], firstPin);
      }
      Object.keys(pins).forEach(k => {
        if(sungKeys.has(k)){
          pins[k].classList.add('done');
          if(shapes[k]) shapes[k].classList.add('done');
        }
      });
      sungKeys.add(c.key);

      verseBlocks[c.verse].classList.add('current');
      if(c.key === 'venezuela'){ el.finale.classList.add('show'); }

    } else if(cue.type === 'verse'){
      verseBlocks[cue.verse].classList.add('current');
    } else if(cue.type === 'clap'){
      container.querySelectorAll('.clap-marker').forEach(n => n.classList.remove('active'));
      const marker = container.querySelector('.clap-marker[data-clap-idx="' + clapCounter + '"]');
      if(marker){ marker.classList.add('active'); }
      clapCounter++;
    }
  }

  function tick(){
    const t = el.player.currentTime;
    const dur = el.player.duration || 0;
    el.fill.style.width = (dur ? (t/dur*100) : 0) + '%';
    el.curTime.textContent = fmt(t);
    el.durTime.textContent = fmt(dur);

    let idx = -1;
    for(let i=0;i<cues.length;i++){
      if(cues[i].time <= t) idx = i; else break;
    }
    applyState(idx);
    if(!el.player.paused) requestAnimationFrame(tick);
  }

  el.player.addEventListener('loadedmetadata', () => { el.durTime.textContent = fmt(el.player.duration); });
  el.playBtn.addEventListener('click', () => {
    if(el.player.paused){
      el.player.play();
      el.playBtn.textContent = '❚❚';
      requestAnimationFrame(tick);
    } else {
      el.player.pause();
      el.playBtn.textContent = '▶';
    }
  });
  el.player.addEventListener('ended', () => { el.playBtn.textContent = '▶'; });

  el.restartBtn.addEventListener('click', () => {
    el.player.pause();
    el.player.currentTime = 0;
    el.playBtn.textContent = '▶';
    lastCueIdx = -1;
    sungKeys = new Set();
    clapCounter = 0;
    container.querySelectorAll('.country-row.active').forEach(n => n.classList.remove('active'));
    container.querySelectorAll('.row-name.active-text').forEach(n => n.classList.remove('active-text'));
    container.querySelectorAll('.pin.active,.pin.done').forEach(n => n.classList.remove('active','done'));
    container.querySelectorAll('.country-shape.active,.country-shape.done').forEach(n => n.classList.remove('active','done'));
    container.querySelectorAll('.verse-block.current').forEach(n => n.classList.remove('current'));
    el.finale.classList.remove('show');
    el.bigFlag.src = '';
    el.bigName.textContent = 'Press play to begin';
    el.bigCapital.innerHTML = '&nbsp;';
    el.fill.style.width = '0%';
    el.curTime.textContent = '0:00';
  });

  el.track.addEventListener('click', (e) => {
    const rect = el.track.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if(el.player.duration){
      el.player.currentTime = pct * el.player.duration;
      tick();
    }
  });

  // Pause this song's audio if the user navigates away to another view
  return {
    pause(){ el.player.pause(); el.playBtn.textContent = '▶'; }
  };
}
