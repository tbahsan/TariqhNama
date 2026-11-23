(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const bn = n => new Intl.NumberFormat('bn-BD').format(n);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const labels = {
    politics: 'রাজনীতি ও রাষ্ট্র',
    war: 'যুদ্ধ ও সামরিক',
    science: 'জ্ঞান ও বিজ্ঞান',
    culture: 'সংস্কৃতি ও শিল্প',
    society: 'সমাজ ও শিক্ষা',
    treaty: 'চুক্তি ও শান্তি',
    context: 'প্রেক্ষাপট'
  };

  const HISTORICAL_SYNONYMS = [
    ['উসমান', 'ওসমান', 'উসমানীয়', 'ওসমানিয়া', 'উসমানি', 'ওসমানি', 'অটোমান', 'অটোম্যান', 'uthman', 'osman', 'ottoman'],
    ['মুহাম্মদ', 'মোহাম্মদ', 'মুহম্মদ', 'মোহাম্মাদ', 'মহম্মদ', 'নবী', 'রাসুল', 'রাসূল', 'muhammad', 'mohammad'],
    ['উমর', 'ওমর', 'ফারুক', 'ফারূক', 'umar', 'omar'],
    ['আলী', 'আলি', 'মর্তুজা', 'মোরতজা', 'ali'],
    ['আবু বকর', 'আবু বকর সিদ্দিক', 'আবুবকর', 'abu bakr'],
    ['হুসাইন', 'হোসেন', 'হোসাইন', 'হুসেন', 'husayn', 'hussain', 'hossein'],
    ['হাসান', 'হাসেন', 'hasan', 'hassan'],
    ['মুয়াবিয়া', 'মোয়াবিয়া', 'মুআবিয়া', 'মুয়াবিয়া', 'মোয়াবিয়া', 'muawiya', 'muawiyah'],
    ['খাদিজা', 'খদিজা', 'খাদীজা', 'khadijah', 'khadija'],
    ['আয়েশা', 'আয়িশা', 'আয়েশা', 'আইশা', 'ayesha', 'aisha'],
    ['ফাতিমা', 'ফাতেমা', 'fatima'],
    ['সালাহুদ্দিন', 'সালাহউদ্দিন', 'সালাহউদ্দীন', 'সালাহুদ্দীন', 'আইয়ুবী', 'আইয়ূবী', 'আইয়ুবি', 'saladin', 'salahuddin', 'ayyubid'],
    ['তারেক', 'তারিক', 'তারিক বিন জিয়াদ', 'তারিক ইবন জিয়াদ', 'tariq'],
    ['খালেদ', 'খালিদ', 'খালিদ বিন ওয়ালিদ', 'সাইফুল্লাহ', 'khalid'],
    ['ইবনে সিনা', 'ইবন সিনা', 'avicenna', 'ibn sina'],
    ['ইবনে রুশদ', 'ইবন রুশদ', 'averroes', 'ibn rushd'],
    ['ইবনে খালদুন', 'ইবন খালদুন', 'ibn khaldun'],
    ['ইবনে বাতুতা', 'ইবন বতুতা', 'ibn battuta'],
    ['বুখারি', 'বোখারি', 'বুখারী', 'বোখারী', 'bukhari'],
    ['কুরআন', 'কোরআন', 'কোরান', 'কুরান', 'quran', 'koran'],
    ['মক্কা', 'মক্কার', 'mecca', 'makkah'],
    ['মদিনা', 'মদীনা', 'মদিনার', 'ইয়াসরিব', 'medina', 'madinah'],
    ['দামেস্ক', 'দিমাশক', 'দামাস্কাস', 'damascus'],
    ['বাগদাদ', 'বাগদাদের', 'baghdad'],
    ['কর্ডোভা', 'কোরদোবা', 'কোরদোভা', 'কর্ডোবা', 'আন্দালুস', 'আন্দালুসিয়া', 'স্পেন', 'cordoba', 'andalus', 'spain'],
    ['জেরুজালেম', 'বায়তুল মুকাদ্দাস', 'বাইতুল মুকাদ্দাস', 'কুদ্স', 'আল-কুদস', 'jerusalem', 'quds'],
    ['কনস্টান্টিনোপল', 'ইস্তাম্বুল', 'ইস্তানবুল', 'কুসতুনতুনিয়া', 'constantinople', 'istanbul'],
    ['তিতুমীর', 'তিতুমির', 'বাঁশের কেল্লা', 'বাশের কেল্লা', 'বারাসাত', 'titumir'],
    ['সিরাজউদ্দৌলা', 'সিরাজউদ্দৌলাহ', 'সিরাজ উদ দৌলা', 'সিরাজ', 'পলাশী', 'palashi', 'siraj'],
    ['গৌড়', 'গৌড়', 'লক্ষণাবতী', 'gaur', 'lakhnauti'],
    ['সেলজুক', 'সালজুক', 'সেলজুকীয়', 'seljuk'],
    ['আব্বাসীয়', 'আব্বাসী', 'আব্বাসি', 'abbasid'],
    ['উমাইয়া', 'উমাইয়্যা', 'ওমাইয়া', 'umayyad'],
    ['খলিফা', 'খেলাফত', 'খিলাফত', 'caliph', 'caliphate'],
    ['এরতুগ্রুল', 'আরতুগ্রুল', 'এরতুগরুল', 'আর্তুরুল', 'ertugrul'],
    ['বখতিয়ার', 'ইখতিয়ার', 'বখতিয়ার খলজি', 'খলজি', 'khalji'],
    ['বারো ভূঁইয়া', 'বারো ভূঁইয়া', 'ঈসা খাঁ', 'ইসা খাঁ', 'baro bhuiyan']
  ];

  function normalizeBanglaPhonetics(s) {
    if (!s) return '';
    let res = String(s).toLocaleLowerCase().trim();
    res = res.replace(/\u09df/g, 'য').replace(/\u09af\u09bc/g, 'য');
    res = res.replace(/([ক-হ])উ/g, '$1ু');
    res = res.replace(/([ক-হ])ই/g, '$1ি');
    res = res.replace(/([ক-হ])্\1/g, '$1');
    res = res.replace(/[ীি]/g, 'ি');
    res = res.replace(/[ূু]/g, 'ু');
    res = res.replace(/[শষস]/g, 'স');
    res = res.replace(/[ণন]/g, 'ন');
    res = res.replace(/[ৎত]/g, 'ত');
    res = res.replace(/[ঢ়ড়র]/g, 'র');
    res = res.replace(/[ঈই]/g, 'ই');
    res = res.replace(/[উও]/g, 'উ');
    res = res.replace(/[যজ]/g, 'জ');
    res = res.replace(/[োু]/g, 'ু');
    res = res.replace(/[ঃ\(\)\.।,!?\-—–'"\/]/g, '');
    return res;
  }

  function getStems(word) {
    const stems = [word];
    const suffixes = ['দেরকে', 'দের', 'খানা', 'খানি', 'গুলো', 'গুলি', 'য়ের', 'ের', 'িয়া', 'িয়', 'ীয়', 'কে', 'তে', 'র', 'এ', 'ে', 'য়'];
    for (const suf of suffixes) {
      if (word.endsWith(suf) && word.length - suf.length >= 2) {
        stems.push(word.slice(0, -suf.length));
        break;
      }
    }
    return stems;
  }

  function extractSearchTokens(query) {
    const raw = String(query).trim().toLocaleLowerCase();
    const rawClean = raw.replace(/[ঃ\(\)\.।,!?\-—–'"\/]/g, ' ');
    const rawTokens = rawClean.split(/\s+/).filter(t => t.length >= 2);
    const tokenSet = new Set(rawTokens);

    for (const t of rawTokens) {
      for (const st of getStems(t)) {
        tokenSet.add(st);
        const normSt = normalizeBanglaPhonetics(st);
        if (normSt) tokenSet.add(normSt);
      }
    }

    for (const group of HISTORICAL_SYNONYMS) {
      const match = group.some(syn => {
        const synNorm = normalizeBanglaPhonetics(syn);
        return raw.includes(syn) || rawTokens.includes(syn) ||
               tokenSet.has(syn) || tokenSet.has(synNorm);
      });
      if (match) {
        for (const syn of group) {
          tokenSet.add(syn);
          const synNorm = normalizeBanglaPhonetics(syn);
          if (synNorm) tokenSet.add(synNorm);
        }
      }
    }

    return { raw, tokens: [...tokenSet], rawNorm: normalizeBanglaPhonetics(raw) };
  }

  let events = [], people = [], places = [], sources = [];
  let placeMap = new Map(), personMap = new Map(), eventMap = new Map();
  let leafletMap = null, markerGroup = null, markersByPlaceId = new Map();
  let selectedPlaceId = null;
  let activeEra = 'all', activeRegion = 'all';

  const els = {
    search: $('#map-search'),
    yearSlider: $('#map-year-slider'),
    yearLabel: $('#map-year-label'),
    resetBtn: $('#reset-map-filters'),
    cards: $('#place-cards'),
    count: $('#map-result-count'),
    themeToggle: $('#theme-toggle'),
    themeIcon: $('#theme-icon')
  };

  async function load() {
    initTheme();
    initFeedbackComposer();
    try {
      const [evRes, pplRes, plcRes, srcRes] = await Promise.all([
        fetch('data/events.json').then(r => r.json()),
        fetch('data/people.json').then(r => r.json()),
        fetch('data/places.json').then(r => r.json()),
        fetch('data/sources.json').then(r => r.json())
      ]);

      events = evRes;
      people = pplRes;
      places = plcRes;
      sources = srcRes;

      placeMap = new Map(places.map(p => [p.id, p]));
      personMap = new Map(people.map(p => [p.id, p]));
      eventMap = new Map(events.map(e => [e.id, e]));

      initMap();
      bindControls();
      render();
    } catch (e) {
      console.error(e);
      if (els.count) els.count.textContent = 'তথ্য লোড করা যায়নি। লোকাল সার্ভার থেকে খুলুন।';
    }
  }

  /* ==========================================================================
     Theme Support
     ========================================================================== */
  function initTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeIcon(currentTheme);

    if (els.themeToggle) {
      els.themeToggle.addEventListener('click', () => {
        const active = document.documentElement.getAttribute('data-theme') || 'light';
        const next = active === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('tariqhnama_theme', next);
        updateThemeIcon(next);
      });
    }
  }

  function updateThemeIcon(theme) {
    if (els.themeIcon) {
      els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  /* ==========================================================================
     Leaflet Map Setup (Free OpenStreetMap Standard Tiles - No API Key Needed)
     ========================================================================== */
  function initMap() {
    const mapContainer = $('#interactive-map');
    if (!mapContainer || typeof L === 'undefined') {
      initFallbackSvg();
      return;
    }

    try {
      leafletMap = L.map('interactive-map', {
        center: [28.0, 48.0],
        zoom: 4,
        minZoom: 2,
        maxZoom: 18,
        scrollWheelZoom: true
      });

      // Standard OpenStreetMap tiles - 100% Free, NO API KEY REQUIRED!
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(leafletMap);

      markerGroup = L.layerGroup().addTo(leafletMap);
    } catch (err) {
      console.warn('Leaflet initialization failed, falling back to SVG:', err);
      initFallbackSvg();
    }
  }

  function initFallbackSvg() {
    const svgMap = $('#world-map');
    if (svgMap) svgMap.hidden = false;
    const leafletDiv = $('#interactive-map');
    if (leafletDiv) leafletDiv.hidden = true;

    fetch('assets/ne_110m_land.geojson')
      .then(r => r.json())
      .then(land => {
        drawSvgMap(land);
      })
      .catch(() => {});
  }

  function proj(lon, lat) {
    return [(lon + 180) / 360 * 1000, (90 - lat) / 180 * 500];
  }

  function pathRing(ring) {
    let d = '', prev = null;
    for (const [lon, lat] of ring) {
      const [x, y] = proj(lon, lat);
      if (prev && Math.abs(lon - prev[0]) > 180) d += ' ';
      d += `${prev && Math.abs(lon - prev[0]) > 180 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
      if (!prev || Math.abs(lon - prev[0]) > 180) d = `M${x.toFixed(1)},${y.toFixed(1)} `;
      prev = [lon, lat];
    }
    return d + 'Z';
  }

  function drawSvgMap(land) {
    const svg = $('#world-map');
    if (!svg || !land) return;
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    for (const f of land.features) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) {
        const p = document.createElementNS(ns, 'path');
        p.setAttribute('d', poly.map(pathRing).join(' '));
        p.setAttribute('class', 'land-polygon');
        svg.append(p);
      }
    }
  }

  function matchesEra(year, era) {
    if (era === 'all') return true;
    if (era === 'prophetic_rashidun') return year >= 570 && year <= 661;
    if (era === 'umayyad') return year >= 661 && year <= 750;
    if (era === 'abbasid') return year >= 750 && year <= 1258;
    if (era === 'medieval_bengal') return year >= 1204 && year <= 1757;
    if (era === 'andalus') return year >= 711 && year <= 1492;
    if (era === 'ottoman') return year >= 1299 && year <= 1924;
    if (era === 'modern') return year >= 1757 && year <= 2024;
    return true;
  }

  function bindControls() {
    if (els.search) {
      els.search.addEventListener('input', () => {
        const drawerSearch = $('#drawer-search');
        if (drawerSearch) drawerSearch.value = els.search.value;
        render();
      });
    }

    const drawerSearch = $('#drawer-search');
    if (drawerSearch) {
      drawerSearch.addEventListener('input', () => {
        if (els.search) els.search.value = drawerSearch.value;
        render();
      });
    }

    if (els.yearSlider) {
      els.yearSlider.addEventListener('input', () => {
        if (els.yearLabel) els.yearLabel.textContent = bn(+els.yearSlider.value);
        render();
      });
    }

    if (els.resetBtn) {
      els.resetBtn.addEventListener('click', () => {
        if (els.search) els.search.value = '';
        if (drawerSearch) drawerSearch.value = '';
        if (els.yearSlider) {
          els.yearSlider.value = '2024';
          if (els.yearLabel) els.yearLabel.textContent = '২০২৪';
        }
        activeEra = 'all';
        activeRegion = 'all';
        $$('#map-era-pills .filter-pill').forEach(b => b.classList.toggle('active', b.dataset.era === 'all'));
        $$('#map-region-pills .filter-pill').forEach(b => b.classList.toggle('active', b.dataset.region === 'all'));
        render();
      });
    }

    // Era pills
    $$('#map-era-pills .filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#map-era-pills .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeEra = btn.dataset.era || 'all';
        render();
      });
    });

    // Region pills
    $$('#map-region-pills .filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#map-region-pills .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeRegion = btn.dataset.region || 'all';
        render();
      });
    });

    // Mobile tabs switcher
    $$('.atlas-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.atlas-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.atlasTab;
        const mapPane = $('#atlas-map-pane');
        const drawerPane = $('#atlas-drawer-pane');
        if (tab === 'map') {
          if (mapPane) mapPane.style.display = 'block';
          if (drawerPane) drawerPane.style.display = 'none';
          if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 200);
        } else {
          if (mapPane) mapPane.style.display = 'none';
          if (drawerPane) drawerPane.style.display = 'flex';
        }
      });
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        const mapPane = $('#atlas-map-pane');
        const drawerPane = $('#atlas-drawer-pane');
        if (mapPane) mapPane.style.display = '';
        if (drawerPane) drawerPane.style.display = '';
        if (leafletMap) leafletMap.invalidateSize();
      }
    });

    const closeBtn = $('#dialog-close');
    if (closeBtn) closeBtn.addEventListener('click', () => $('#detail-dialog')?.close());
  }

  function getFilteredEvents() {
    const term = els.search ? els.search.value.trim().toLocaleLowerCase() : '';
    const maxYear = els.yearSlider ? +els.yearSlider.value : 2024;
    const { raw, tokens, rawNorm } = term ? extractSearchTokens(term) : { raw: '', tokens: [], rawNorm: '' };

    return events.filter(e => {
      if (e.year > maxYear) return false;
      if (!matchesEra(e.year, activeEra)) return false;
      if (activeRegion !== 'all' && e.region !== activeRegion) return false;
      if (!term) return true;

      const placeNames = (e.places || []).map(id => placeMap.get(id)?.name || '').join(' ');
      const personNames = (e.people || []).map(id => personMap.get(id)?.name || '').join(' ');
      const hay = [e.title, e.summary, e.region, placeNames, personNames].join(' ').toLocaleLowerCase();
      if (hay.includes(raw)) return true;
      const hayNorm = normalizeBanglaPhonetics(hay);
      if (rawNorm && hayNorm.includes(rawNorm)) return true;
      return tokens.some(t => hay.includes(t) || (hayNorm && hayNorm.includes(t)));
    });
  }

  function render() {
    const chosenEvents = getFilteredEvents();
    const term = els.search ? els.search.value.trim().toLocaleLowerCase() : '';
    const { raw, tokens, rawNorm } = term ? extractSearchTokens(term) : { raw: '', tokens: [], rawNorm: '' };

    const matchingPlaceIds = new Set(chosenEvents.flatMap(e => e.places || []));

    const matchedPlaces = places.filter(p => {
      const matchText = [p.name, p.modern, p.description].join(' ').toLocaleLowerCase();
      const matchTextNorm = normalizeBanglaPhonetics(matchText);
      const directMatch = term && (matchText.includes(raw) || (rawNorm && matchTextNorm.includes(rawNorm)) || tokens.some(t => matchText.includes(t) || (matchTextNorm && matchTextNorm.includes(t))));
      const eventMatch = matchingPlaceIds.has(p.id);
      return directMatch || eventMatch || (!term && matchingPlaceIds.has(p.id));
    });

    if (els.count) {
      els.count.textContent = `${bn(matchedPlaces.length)}টি স্থান`;
    }
    const mobileBadge = $('#mobile-places-badge');
    if (mobileBadge) {
      mobileBadge.textContent = bn(matchedPlaces.length);
    }

    updateLeafletMarkers(matchedPlaces, chosenEvents);
    renderPlaceCards(matchedPlaces, chosenEvents);
  }

  function updateLeafletMarkers(matchedPlaces, chosenEvents) {
    if (!leafletMap || !markerGroup) {
      updateSvgMarkers(matchedPlaces);
      return;
    }

    markerGroup.clearLayers();
    markersByPlaceId.clear();

    matchedPlaces.forEach(p => {
      if (!p.lat || !p.lon) return;

      const linkedEvents = chosenEvents.filter(e => (e.places || []).includes(p.id));

      const pinIcon = L.divIcon({
        className: `custom-map-pin${selectedPlaceId === p.id ? ' active' : ''}`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const marker = L.marker([p.lat, p.lon], { icon: pinIcon }).addTo(markerGroup);
      markersByPlaceId.set(p.id, marker);

      const eventsHtml = linkedEvents.length ? `
        <div class="map-popup-events">
          <h4>এই স্থানের ঘটনা (${bn(linkedEvents.length)}):</h4>
          ${linkedEvents.slice(0, 5).map(e => `
            <a class="map-popup-event-link" href="index.html#reader" title="পাণ্ডুলিপিতে পড়ুন">
              <b>${esc(e.title)}</b> (${esc(e.dateLabel)})
            </a>
          `).join('')}
        </div>
      ` : '';

      const popupContent = `
        <div class="map-popup-card">
          <h3>${esc(p.name)}</h3>
          <small>${esc(p.modern)} · ${Number(p.lat).toFixed(2)}°, ${Number(p.lon).toFixed(2)}°</small>
          <p>${esc(p.description)}</p>
          ${eventsHtml}
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 320 });

      marker.on('click', () => {
        selectedPlaceId = p.id;
        highlightPlaceCard(p.id);
      });
    });
  }

  function updateSvgMarkers(matchedPlaces) {
    const svg = $('#world-map');
    if (!svg) return;
    svg.querySelectorAll('.map-marker').forEach(n => n.remove());
    const ns = 'http://www.w3.org/2000/svg';

    matchedPlaces.forEach(p => {
      const [x, y] = proj(p.lon, p.lat);
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', `map-marker${selectedPlaceId === p.id ? ' active' : ''}`);
      g.setAttribute('transform', `translate(${x},${y})`);

      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('r', '5');
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${p.name} - ${p.modern}`;
      g.append(c, title);

      g.addEventListener('click', () => {
        selectedPlaceId = p.id;
        openPlaceDetail(p);
      });
      svg.append(g);
    });
  }

  function renderPlaceCards(matchedPlaces, chosenEvents) {
    if (!els.cards) return;
    els.cards.innerHTML = '';

    if (!matchedPlaces.length) {
      els.cards.innerHTML = '<div class="empty-box" style="grid-column: 1 / -1;">এই ফিল্টারে কোনো স্থান মেলেনি। ফিল্টার রিসেট করে দেখুন।</div>';
      return;
    }

    matchedPlaces.forEach(p => {
      const card = document.createElement('div');
      card.className = `place-card${selectedPlaceId === p.id ? ' active' : ''}`;
      card.id = `card-place-${p.id}`;

      const linkedEvents = chosenEvents.filter(e => (e.places || []).includes(p.id));

      card.innerHTML = `
        <b>${esc(p.name)}</b>
        <small>${esc(p.modern)}</small>
        <span>${esc(p.description).substring(0, 110)}...</span>
        ${linkedEvents.length ? `<span class="place-card-events-count">📖 ${bn(linkedEvents.length)}টি ঘটনা</span>` : ''}
      `;

      card.addEventListener('click', () => {
        selectedPlaceId = p.id;
        highlightPlaceCard(p.id);

        if (leafletMap && markersByPlaceId.has(p.id)) {
          const marker = markersByPlaceId.get(p.id);
          leafletMap.flyTo([p.lat, p.lon], Math.max(leafletMap.getZoom(), 6), { duration: 1.0 });
          marker.openPopup();
          if (window.innerWidth <= 768) {
            const mapTab = $('[data-atlas-tab="map"]');
            if (mapTab) mapTab.click();
          }
        } else {
          openPlaceDetail(p);
        }
      });

      els.cards.append(card);
    });
  }

  function highlightPlaceCard(placeId) {
    $$('.place-card').forEach(c => c.classList.remove('active'));
    const target = $(`#card-place-${placeId}`);
    if (target) {
      target.classList.add('active');
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function openPlaceDetail(p) {
    const dialog = $('#detail-dialog');
    const content = $('#detail-content');
    if (!dialog || !content) return;

    const linked = events.filter(e => (e.places || []).includes(p.id));

    content.innerHTML = `
      <p class="dialog-meta">${esc(p.modern)} · স্থানাঙ্ক: ${Number(p.lat).toFixed(3)}°, ${Number(p.lon).toFixed(3)}°</p>
      <h2 class="dialog-title">${esc(p.name)}</h2>
      <p class="dialog-copy">${esc(p.description)}</p>
      <div class="dialog-section">
        <h3>এই স্থানের সঙ্গে যুক্ত ঐতিহাসিক ঘটনা (${bn(linked.length)})</h3>
        <div class="dialog-events">
          ${linked.length ? linked.map(e => `
            <a class="dialog-event" href="index.html#reader" style="display:block; text-decoration:none;">
              <b>${esc(e.title)}</b>
              <span>${esc(e.dateLabel)} · ${esc(e.region)}</span>
            </a>
          `).join('') : '<p class="muted">কোনো নথিবদ্ধ ঘটনা নেই।</p>'}
        </div>
      </div>
    `;

    dialog.showModal();
  }

  /* ==========================================================================
     Mouse-Interactive Ambient Lantern & Parallax Texture
     ========================================================================== */
  if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let rafId = null;
    window.addEventListener('mousemove', e => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const x = e.clientX;
        const y = e.clientY;
        document.documentElement.style.setProperty('--cursor-x', `${x}px`);
        document.documentElement.style.setProperty('--cursor-y', `${y}px`);
        const shiftX = ((x / window.innerWidth) - 0.5) * 14;
        const shiftY = ((y / window.innerHeight) - 0.5) * 14;
        document.documentElement.style.setProperty('--bg-shift-x', `${shiftX.toFixed(1)}px`);
        document.documentElement.style.setProperty('--bg-shift-y', `${shiftY.toFixed(1)}px`);
        rafId = null;
      });
    }, { passive: true });
  }

  window.addEventListener('DOMContentLoaded', load);

  // Interactive Feedback & Issue Composer Logic
  function initFeedbackComposer() {
    const dialog = document.getElementById('feedback-dialog');
    if (!dialog) return;

    const closeBtn = document.getElementById('feedback-close');
    const submitBtn = document.getElementById('feedback-submit-github');
    const copyBtn = document.getElementById('feedback-copy-template');
    const statusDiv = document.getElementById('feedback-status');

    function openDialog() {
      try {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      } catch (e) {
        dialog.setAttribute('open', '');
      }
    }

    function closeDialog() {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    document.querySelectorAll('#open-feedback-composer, #header-feedback-btn, #nav-feedback-trigger, .feedback-trigger-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openDialog();
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeDialog();
    });

    function buildIssuePayload() {
      const catSelect = document.getElementById('feedback-category');
      const catText = catSelect ? catSelect.selectedOptions[0].text : 'পরামর্শ';
      const catVal = catSelect ? catSelect.value : 'general';
      const titleInput = document.getElementById('feedback-title');
      const rawTitle = titleInput ? titleInput.value.trim() : '';
      const contentInput = document.getElementById('feedback-content');
      const content = contentInput ? contentInput.value.trim() : '';
      const sourcesInput = document.getElementById('feedback-sources');
      const sources = sourcesInput ? sourcesInput.value.trim() : '';

      const labelMap = {
        correction: 'historical-correction',
        proposal: 'new-content-proposal',
        map: 'geography-map',
        typo: 'typo-grammar',
        general: 'feedback'
      };

      const title = `[${catText.replace(/^[^\w\u0980-\u09FF]+/, '').split(' ')[0] || 'পরামর্শ'}] ${rawTitle || 'ঐতিহাসিক তথ্যের পর্যালোচনা'}`;

      const body = `### বিষয় / ক্যাটাগরি:
${catText}

### পর্যবেক্ষণ ও বিবরণ:
${content || 'কোনো বিস্তারিত বিবরণ দেওয়া হয়নি।'}

### তথ্যসূত্র / আকর গ্রন্থ:
${sources || 'উৎস উল্লেখ করা হয়নি।'}

---
*তারিখনামা (Tariqhnama) ওয়েব ইন্টারফেসের ইন-সাইট ফর্ম থেকে প্রেরিত।*
*সংস্করণ: Tariqhnama v2.0*`;

      return { title, body, label: labelMap[catVal] || 'feedback' };
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const payload = buildIssuePayload();
        const url = `https://github.com/tbahsan/TariqhNama/issues/new?title=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(payload.body)}&labels=${encodeURIComponent(payload.label)}`;
        window.open(url, '_blank');
        closeDialog();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const payload = buildIssuePayload();
        const textToCopy = `Title: ${payload.title}\n\n${payload.body}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
          if (statusDiv) {
            statusDiv.textContent = '✓ টেমপ্লেট ক্লিপবোর্ডে কপি করা হয়েছে!';
            statusDiv.style.display = 'block';
            statusDiv.style.color = 'var(--gold)';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
          }
        }).catch(() => {
          alert('কপি করা সম্ভব হয়নি, অনুগ্রহ করে সরাসরি গিটহাবে প্রেরণ বাটনটি ব্যবহার করুন।');
        });
      });
    }
  }

})();
