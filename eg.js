function createSpotlight(opts) {
  const { container, data } = opts;

  // Capital changed from Malabo to Ciudad de la Paz by official decree,
  // effective Jan 2, 2026. Verified by Curious C via Wikipedia and multiple
  // news outlets before this build — not independently re-checked here,
  // since this session has no live web search available.
  container.innerHTML = `
    <div class="eg-card">
      <img class="eg-flag" src="eg_flag.png" alt="Flag of Equatorial Guinea">
      <div class="eg-title">
        <h1>Guinea Ecuatorial</h1>
        <button class="eg-hear" data-el="hearName" aria-label="Hear the name">🔊</button>
      </div>
      <p class="eg-title-en">${data.name_en}</p>

      <div class="eg-facts">
        <div class="eg-fact">
          <span class="eg-fact-label">Capital</span>
          <span class="eg-fact-value">${data.capital}
            <button class="eg-hear eg-hear-inline" data-el="hearCapital" aria-label="Hear the capital">🔊</button>
          </span>
        </div>
        <p class="eg-footnote">
          Formerly Malabo
          <button class="eg-hear eg-hear-inline" data-el="hearMalabo" aria-label="Hear Malabo">🔊</button>
          — the long-recognized capital until Ciudad de la Paz took over.
        </p>

        <div class="eg-fact">
          <span class="eg-fact-label">Region</span>
          <span class="eg-fact-value">${data.region}</span>
        </div>
        <div class="eg-fact">
          <span class="eg-fact-label">Population</span>
          <span class="eg-fact-value">${data.population}</span>
        </div>
        <div class="eg-fact">
          <span class="eg-fact-label">Gentilicio</span>
          <span class="eg-fact-value">${data.gentilicio_m} / ${data.gentilicio_f}
            <button class="eg-hear eg-hear-inline" data-el="hearGentilicio" aria-label="Hear the gentilicio">🔊</button>
          </span>
        </div>
        <div class="eg-fact">
          <span class="eg-fact-label">Motto</span>
          <span class="eg-fact-value">${data.motto_es} <span class="eg-fact-sub">(${data.motto_en})</span></span>
        </div>
      </div>
    </div>

    <div class="eg-mapcard">
      <p class="eg-map-label">Mainland + island — two pieces, one country</p>
      <div class="eg-map" data-el="mapWrap"></div>
    </div>

    <div class="eg-facts-cards">
      <div class="eg-dyk-card">
        <p class="eg-dyk-eyebrow">Did you know?</p>
        <p>Guinea Ecuatorial is the only country on mainland Africa where Spanish is an official language! Spain ruled here for nearly 200 years, and Spanish stuck as one of the country's official languages even after independence in 1968.</p>
      </div>
      <div class="eg-dyk-card">
        <p class="eg-dyk-eyebrow">Did you know?</p>
        <p>Even though the map above shows two separate pieces of land, most Equatoguineans actually live on the mainland (Río Muni) — the bigger piece — not on Bioko Island.</p>
      </div>
    </div>
  `;

  const el = {};
  container.querySelectorAll('[data-el]').forEach(node => { el[node.dataset.el] = node; });

  // Simple one-shot playback per tap — no looping, no background audio,
  // this is a reference page, not a game.
  const audio = new Audio();
  function playClip(key){
    audio.pause();
    audio.src = `eg_${key}.mp3`;
    audio.play().catch(() => {});
  }
  el.hearName.addEventListener('click', () => playClip('name'));
  el.hearCapital.addEventListener('click', () => playClip('capital'));
  el.hearMalabo.addEventListener('click', () => playClip('malabo'));
  el.hearGentilicio.addEventListener('click', () => playClip('gentilicio'));

  // Render the real-geography map shape (mainland Río Muni + Bioko Island),
  // same SVG approach used for the Americas/Spain maps elsewhere.
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + data.map.width + ' ' + data.map.height);
  svg.setAttribute('width', data.map.width);
  svg.setAttribute('height', data.map.height);
  svg.setAttribute('class', 'eg-map-svg');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', data.map.d);
  path.setAttribute('class', 'eg-map-shape');
  svg.appendChild(path);
  const pin = document.createElementNS(svgNS, 'circle');
  pin.setAttribute('cx', data.map.cx);
  pin.setAttribute('cy', data.map.cy);
  pin.setAttribute('class', 'eg-map-pin');
  svg.appendChild(pin);
  el.mapWrap.appendChild(svg);

  return {
    pause(){ audio.pause(); }
  };
}
