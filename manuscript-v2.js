(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const bn = n => new Intl.NumberFormat('bn-BD').format(n);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const categoryLabels = {
    politics: 'রাজনীতি ও রাষ্ট্র',
    war: 'যুদ্ধ ও সামরিক ইতিহাস',
    treaty: 'চুক্তি ও শান্তি',
    science: 'জ্ঞান ও বিজ্ঞান',
    culture: 'সংস্কৃতি ও শিল্প',
    society: 'সমাজ ও শিক্ষা',
    context: 'প্রেক্ষাপট'
  };
  const scopeLabels = {
    core: 'মূল ইসলামী ইতিহাস',
    'modern-context': 'আধুনিক মুসলিম-সমাজের প্রেক্ষাপট',
    editorial: 'সম্পাদকীয় সূচনা-নোট'
  };
  const dateTypeLabels = {
    approximate: 'আনুমানিক তারিখ',
    year: 'সালভিত্তিক',
    range: 'সময়সীমা',
    day: 'নির্দিষ্ট তারিখ'
  };

  let events = [], people = [], places = [], sources = [], unminedData = null;
  /* ==========================================================================
     Robust Search Engine (Tokenization, Inflection Stripping & Phonetics)
     ========================================================================== */
  function normalizeBanglaPhonetics(s) {
    if (!s) return '';
    let res = String(s).toLocaleLowerCase().trim();
    res = res.replace(/[ীি]/g, 'ি');
    res = res.replace(/[ূু]/g, 'ু');
    res = res.replace(/[শষস]/g, 'স');
    res = res.replace(/[ণন]/g, 'ন');
    res = res.replace(/য়/g, 'য');
    res = res.replace(/আর্তুরুল|আরতুগ্রুল|এরতুগরুল|ertugrul/g, 'এরতুগ্রুল');
    return res;
  }

  function getStems(word) {
    const stems = [word];
    const suffixes = ['দেরকে', 'দের', 'য়ের', 'ের', 'কে', 'তে', 'র', 'এ', 'গুলো', 'গুলি'];
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
    const rawTokens = raw.split(/[\s,।\-\.\?\!]+/).filter(t => t.length >= 2);
    const tokenSet = new Set(rawTokens);
    for (const t of rawTokens) {
      for (const st of getStems(t)) {
        tokenSet.add(st);
        tokenSet.add(normalizeBanglaPhonetics(st));
      }
    }
    return { raw, tokens: [...tokenSet], rawNorm: normalizeBanglaPhonetics(raw) };
  }

  /* ==========================================================================
     Query Aliases and Normalization (Transliteration support)
     ========================================================================== */
  const ALIAS_RULES = [
    { pattern: /\u0986\u09b0\u09cd\u09a4\u09c1\u09b0\u09c1\u09b2|\u0986\u09b0\u09a4\u09c1\u0997\u09cd\u09b0\u09c1\u09b2|\u098f\u09b0\u09a4\u09c1\u0997\u09b0\u09c1\u09b2|ertugrul/gi, repl: '\u098f\u09b0\u09a4\u09c1\u0997\u09cd\u09b0\u09c1\u09b2' },
    { pattern: /\u0997\u09be\u099c\u09bf/gi, repl: '\u0997\u09be\u099c\u09c0' },
    { pattern: /\u0989\u09b8\u09ae\u09be\u09a8\u09bf/gi, repl: '\u0989\u09b8\u09ae\u09be\u09a8\u09c0\u09af\u09bc' },
    { pattern: /\u09a4\u09c1\u09b0\u09cd\u0995\u09c0/gi, repl: '\u09a4\u09c1\u09b0\u09cd\u0995\u09bf' },
    { pattern: /\u0995\u09b0\u09a1\u09cb\u09ad\u09be|\u0995\u09cb\u09b0\u09a6\u09cb\u09ac\u09be/gi, repl: '\u0995\u09b0\u09cd\u09a1\u09cb\u09ad\u09be' },
    { pattern: /\u09ac\u0996\u09a4\u09bf\u09af\u09bc\u09be\u09b0|\u0987\u0996\u09a4\u09bf\u09af\u09bc\u09be\u09b0/gi, repl: '\u09ac\u0996\u09a4\u09bf\u09af\u09bc\u09be\u09b0' }
  ];

  function getQueryVariants(raw) {
    if (!raw) return [];
    const base = raw.trim().toLocaleLowerCase();
    const set = new Set([base]);
    let normalized = base;
    for (const rule of ALIAS_RULES) {
      if (rule.pattern.test(base)) {
        normalized = normalized.replace(rule.pattern, rule.repl);
        set.add(normalized);
      }
    }
    base.split(/\s+/).forEach(t => {
      if (t.length >= 2) {
        set.add(t);
        for (const rule of ALIAS_RULES) {
          if (rule.pattern.test(t)) {
            set.add(t.replace(rule.pattern, rule.repl));
          }
        }
      }
    });
    return [...set];
  }

  let personMap = new Map(), placeMap = new Map(), sourceMap = new Map(), eventMap = new Map();
  let filteredEvents = [], activeEventIndex = 0, turning = false;
  let activePersonId = null, activePlaceId = null, coverOpened = false;
  let motionEnabled = !prefersReduced;

  // Filter Pill States
  let activeEra = 'all';
  let activePillRegion = 'all';
  let activePillCat = 'all';

  const ui = {
    spread: $('#spread'),
    entries: $('#event-entries'),
    eventSearch: $('#event-search'),
    eventCategory: $('#event-category'),
    eventScope: $('#event-scope'),
    eventRegion: $('#event-region'),
    eventYear: $('#event-year'),
    eventYearLabel: $('#event-year-label'),
    eventResultCount: $('#event-result-count'),
    pageCounter: $('#page-counter'),
    eventPage: $('#event-page'),
    eventBody: $('#event-body'),
    sheet: $('#turn-sheet'),
    sheetDate: $('#sheet-date'),
    sheetTitle: $('#sheet-title'),
    regionName: $('#event-region-name'),
    record: $('#event-record'),
    date: $('#event-date'),
    title: $('#event-title'),
    tags: $('#event-tags'),
    summary: $('#event-summary'),
    detail: $('#event-detail'),
    people: $('#event-people'),
    places: $('#event-places'),
    sources: $('#event-sources'),
    certainty: $('#event-certainty'),
    folio: $('#event-folio'),
    progress: $('#page-progress'),
    prev: $('#prev-page'),
    next: $('#next-page'),
    peopleList: $('#people-list'),
    peopleProfile: $('#people-profile'),
    peopleSearch: $('#people-search'),
    peopleGroup: $('#people-group'),
    peopleSort: $('#people-sort'),
    peopleResult: $('#people-result-count'),
    peopleIndex: $('#people-index'),
    placeList: $('#place-list'),
    placeProfile: $('#place-profile'),
    placeSearch: $('#place-search'),
    placeResult: $('#place-result-count'),
    sourceList: $('#source-list'),
    dialog: $('#detail-dialog'),
    dialogContent: $('#dialog-content'),
    motionToggle: $('#motion-toggle'),
    globalSearch: $('#global-search'),
    globalResults: $('#global-results'),
    // Smart Assistant elements
    assistantDialog: $('#assistant-dialog'),
    assistantInput: $('#assistant-input'),
    assistantChips: $('#assistant-chips'),
    assistantResults: $('#assistant-results'),
    assistantCount: $('#assistant-count'),
    themeToggle: $('#theme-toggle'),
    themeIcon: $('#theme-icon')
  };

  async function loadData() {
    if (window.__ATLAS_DATA__) return window.__ATLAS_DATA__;
    const names = ['events', 'people', 'places', 'sources'];
    const data = await Promise.all(names.map(name => fetch(`data/${name}.json`).then(r => {
      if (!r.ok) throw new Error(`${name}.json লোড হয়নি`);
      return r.json();
    })));

    // Load unmined data asynchronously for the assistant
    fetch('unmined_data/unmined_candidates_inventory.json')
      .then(r => r.ok ? r.json() : fetch('data/unmined_candidates_inventory.json').then(res => res.ok ? res.json() : null))
      .then(u => { unminedData = u; })
      .catch(() => {});

    return { events: data[0], people: data[1], places: data[2], sources: data[3] };
  }

  async function init() {
    try {
      initTheme();
    initFeedbackComposer();
      const data = await loadData();
      events = [...data.events].sort((a, b) => a.year - b.year || String(a.id).localeCompare(String(b.id)));
      people = [...data.people].sort((a, b) => (a.id === 'muhammad' ? -1 : b.id === 'muhammad' ? 1 : (a.sortYear || 9999) - (b.sortYear || 9999)));
      places = [...data.places];
      sources = [...data.sources];
      personMap = new Map(people.map(p => [p.id, p]));
      placeMap = new Map(places.map(p => [p.id, p]));
      sourceMap = new Map(sources.map(s => [s.id, s]));
      eventMap = new Map(events.map(e => [e.id, e]));

      const statEvents = $('#stat-events');
      if (statEvents) statEvents.textContent = bn(events.length);
      const statPeople = $('#stat-people');
      if (statPeople) statPeople.textContent = bn(people.length);
      const statPlaces = $('#stat-places');
      if (statPlaces) statPlaces.textContent = bn(places.length);
      const statSources = $('#stat-sources');
      if (statSources) statSources.textContent = bn(sources.length);
      
      const countPeople = $('#people-count');
      if (countPeople) countPeople.textContent = `${bn(people.length)} জন`;
      const countPlaces = $('#place-count');
      if (countPlaces) countPlaces.textContent = `${bn(places.length)} স্থান`;

      buildOptions();
      bindControls();
      bindFilterPills();
      bindAssistant();
      applyMotionState();
      refreshEvents(false);
      renderPeople();
      renderPlaces();
      renderSources();
    } catch (error) {
      console.error(error);
      if (ui.title) ui.title.textContent = 'তথ্য লোড করা যায়নি';
      if (ui.summary) ui.summary.textContent = 'এই প্রিভিউতে ডেটা ফাইল পাওয়া যায়নি। সাইটটি লোকাল সার্ভার বা GitHub Pages থেকে খুলুন।';
      if (ui.entries) ui.entries.innerHTML = '<div class="empty-box">ডেটা লোড হয়নি।</div>';
      if (ui.pageCounter) ui.pageCounter.textContent = 'লোড ব্যর্থ';
    }
  }

  /* ==========================================================================
     Theme Management (Ancient Parchment & Midnight Obsidian)
     ========================================================================== */
  function initTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeIcon(currentTheme);

    if (ui.themeToggle) {
      ui.themeToggle.addEventListener('click', () => {
        const active = document.documentElement.getAttribute('data-theme') || 'light';
        const next = active === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('tariqhnama_theme', next);
        updateThemeIcon(next);
      });
    }
  }

  function updateThemeIcon(theme) {
    if (ui.themeIcon) {
      ui.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    if (ui.themeToggle) {
      ui.themeToggle.title = theme === 'dark' ? 'হালকা (প্রাচীন পাণ্ডুলিপি) মোডে পরিবর্তন' : 'গাঢ় (নিশীথ পাণ্ডুলিপি) মোডে পরিবর্তন';
    }
  }

  function buildOptions() {
    if (!ui.eventRegion) return;
    [...new Set(events.map(e => e.region))].sort((a, b) => a.localeCompare(b, 'bn'))
      .forEach(region => ui.eventRegion.add(new Option(region, region)));
    if (ui.peopleGroup) {
      [...new Set(people.map(p => p.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'bn'))
        .forEach(group => ui.peopleGroup.add(new Option(group, group)));
    }
  }

  /* ==========================================================================
     Modern Era, Region & Category Pill Filters
     ========================================================================== */
  function bindFilterPills() {
    // Era Pills
    $$('#era-pills .filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#era-pills .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeEra = btn.dataset.era || 'all';
        refreshEvents(true);
      });
    });

    // Region Pills
    $$('#region-pills .filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#region-pills .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePillRegion = btn.dataset.region || 'all';
        if (ui.eventRegion) ui.eventRegion.value = activePillRegion;
        refreshEvents(true);
      });
    });

    // Category Pills
    $$('#category-pills .filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#category-pills .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePillCat = btn.dataset.cat || 'all';
        if (ui.eventCategory) ui.eventCategory.value = activePillCat;
        refreshEvents(true);
      });
    });
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
    const menuToggle = $('#menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        const open = document.querySelector('.site-header').classList.toggle('nav-open');
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.textContent = open ? 'বন্ধ করুন ×' : 'মেনু ☰';
      });
    }

    $$('#main-nav a').forEach(link => link.addEventListener('click', () => {
      const header = document.querySelector('.site-header');
      if (header) header.classList.remove('nav-open');
      if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.textContent = 'মেনু ☰';
      }
    }));

    if (ui.eventSearch) ui.eventSearch.addEventListener('input', () => refreshEvents(true));
    if (ui.eventCategory) {
      ui.eventCategory.addEventListener('change', () => {
        activePillCat = ui.eventCategory.value;
        $$('#category-pills .filter-pill').forEach(b => b.classList.toggle('active', (b.dataset.cat || 'all') === activePillCat));
        refreshEvents(true);
      });
    }
    if (ui.eventScope) ui.eventScope.addEventListener('change', () => refreshEvents(true));
    if (ui.eventRegion) {
      ui.eventRegion.addEventListener('change', () => {
        activePillRegion = ui.eventRegion.value;
        $$('#region-pills .filter-pill').forEach(b => b.classList.toggle('active', (b.dataset.region || 'all') === activePillRegion));
        refreshEvents(true);
      });
    }

    if (ui.eventYear) {
      ui.eventYear.addEventListener('input', () => {
        if (ui.eventYearLabel) ui.eventYearLabel.textContent = bn(+ui.eventYear.value);
        refreshEvents(true);
      });
    }

    if (ui.prev) ui.prev.addEventListener('click', () => turnPage(-1));
    if (ui.next) ui.next.addEventListener('click', () => turnPage(1));

    const contentsToggle = $('#contents-toggle');
    if (contentsToggle) {
      contentsToggle.addEventListener('click', event => {
        const open = !ui.spread.classList.contains('show-contents');
        ui.spread.classList.toggle('show-contents', open);
        event.currentTarget.setAttribute('aria-expanded', String(open));
        event.currentTarget.textContent = open ? 'পাতায় ফিরুন ↗' : 'সূচি ☰';
      });
    }

    const openCoverBtn = $('#open-cover');
    if (openCoverBtn) openCoverBtn.addEventListener('click', openCover);
    const openBookHero = $('#open-book-hero');
    if (openBookHero) openBookHero.addEventListener('click', openCover);
    const coverBook = $('#cover-book');
    if (coverBook) {
      coverBook.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        openCover();
      });
    }

    const bookmark = $('#bookmark');
    if (bookmark) {
      bookmark.addEventListener('click', event => {
        const button = event.currentTarget;
        const saved = !button.classList.contains('saved');
        button.classList.toggle('saved', saved);
        button.textContent = saved ? '★' : '☆';
        button.title = saved ? 'চিহ্ন সরান' : 'এই পাতা চিহ্নিত করুন';
      });
    }

    if (ui.motionToggle) {
      ui.motionToggle.addEventListener('click', () => {
        motionEnabled = !motionEnabled;
        applyMotionState();
      });
    }

    if (ui.peopleSearch) ui.peopleSearch.addEventListener('input', renderPeople);
    if (ui.peopleGroup) ui.peopleGroup.addEventListener('change', renderPeople);
    if (ui.peopleSort) ui.peopleSort.addEventListener('change', renderPeople);
    if (ui.placeSearch) ui.placeSearch.addEventListener('input', renderPlaces);

    const personPrev = $('#person-prev');
    if (personPrev) personPrev.addEventListener('click', () => stepCatalog('person', -1));
    const personNext = $('#person-next');
    if (personNext) personNext.addEventListener('click', () => stepCatalog('person', 1));
    const placePrev = $('#place-prev');
    if (placePrev) placePrev.addEventListener('click', () => stepCatalog('place', -1));
    const placeNext = $('#place-next');
    if (placeNext) placeNext.addEventListener('click', () => stepCatalog('place', 1));

    const peopleIndexToggle = $('#people-index-toggle');
    if (peopleIndexToggle) peopleIndexToggle.addEventListener('click', event => toggleCatalogIndex('people', event.currentTarget));
    const placeIndexToggle = $('#place-index-toggle');
    if (placeIndexToggle) placeIndexToggle.addEventListener('click', event => toggleCatalogIndex('place', event.currentTarget));

    if (ui.globalSearch) {
      ui.globalSearch.addEventListener('input', renderGlobalSearch);
      ui.globalSearch.addEventListener('keydown', event => {
        if (event.key === 'Escape') { closeGlobalResults(); return; }
        if (event.key === 'Enter') {
          const first = ui.globalResults.querySelector('.global-result');
          if (first) { event.preventDefault(); first.click(); }
        }
      });
      document.addEventListener('pointerdown', event => {
        if (!event.target.closest('.global-search-wrap')) closeGlobalResults();
      });
    }

    const dialogClose = $('#dialog-close');
    if (dialogClose && ui.dialog) {
      dialogClose.addEventListener('click', () => ui.dialog.close());
      ui.dialog.addEventListener('click', event => { if (event.target === ui.dialog) ui.dialog.close(); });
    }

    document.addEventListener('keydown', event => {
      if ((ui.dialog && ui.dialog.open) || (ui.assistantDialog && ui.assistantDialog.open) || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
      if (event.key === 'ArrowRight') turnPage(1);
      if (event.key === 'ArrowLeft') turnPage(-1);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openAssistant();
      }
    });

    bindPageDrag();
  }

  function applyMotionState() {
    document.body.classList.toggle('motion-off', !motionEnabled);
    if (ui.motionToggle) {
      ui.motionToggle.setAttribute('aria-pressed', String(motionEnabled));
      ui.motionToggle.textContent = `অ্যানিমেশন: ${motionEnabled ? 'চালু' : 'বন্ধ'}`;
    }
  }

  function openCover() {
    if (coverOpened) {
      $('#reader').scrollIntoView({ behavior: motionEnabled ? 'smooth' : 'auto', block: 'start' });
      return;
    }
    coverOpened = true;
    const face = $('#cover-face');
    const book = $('#cover-book');
    if (motionEnabled && face && face.animate) {
      face.animate([
        { transform: 'rotateY(0deg)', opacity: 1 },
        { transform: 'rotateY(-72deg)', opacity: 1, offset: 0.55 },
        { transform: 'rotateY(-158deg) translateX(-20px)', opacity: 0.1 }
      ], { duration: 950, easing: 'cubic-bezier(.19,.78,.22,1)', fill: 'forwards' });
      if (book && book.animate) {
        book.animate([
          { transform: 'translateY(0) rotateY(-4deg)' },
          { transform: 'translateY(-5px) rotateY(8deg)' }
        ], { duration: 950, easing: 'ease-out', fill: 'forwards' });
      }
    } else if (face) {
      face.style.opacity = '0.12';
      face.style.transform = 'rotateY(-150deg)';
    }
    if (face) face.style.pointerEvents = 'none';
    window.setTimeout(() => {
      const reader = $('#reader');
      if (reader) reader.scrollIntoView({ behavior: motionEnabled ? 'smooth' : 'auto' });
    }, motionEnabled ? 320 : 0);
  }

  function closeGlobalResults() {
    if (!ui.globalResults) return;
    ui.globalResults.hidden = true;
    if (ui.globalSearch) ui.globalSearch.setAttribute('aria-expanded', 'false');
  }

    function renderGlobalSearch() {
    if (!ui.globalSearch || !ui.globalResults) return;
    const query = ui.globalSearch.value.trim();
    if (query.length < 2) { closeGlobalResults(); return; }

    const { raw, tokens, rawNorm } = extractSearchTokens(query);
    const results = [];

    for (const event of events) {
      const hay = eventSearchText(event);
      const hayNorm = normalizeBanglaPhonetics(hay);
      let score = 0;
      if (hay.includes(raw)) score += 100;
      else if (hayNorm.includes(rawNorm)) score += 80;
      const tm = tokens.filter(t => hay.includes(t) || hayNorm.includes(t)).length;
      if (tm > 0) score += tm * 25;
      if (score > 0) {
        results.push({ score, kind: 'ঘটনা', type: 'event', id: event.id, title: event.title, meta: `${event.dateLabel} · ${event.region}` });
      }
    }
    for (const person of people) {
      const hay = [person.name, person.also, person.life, person.role, person.bio, person.lineage, person.region, person.group, ...(person.works || [])].join(' ').toLocaleLowerCase();
      const hayNorm = normalizeBanglaPhonetics(hay);
      let score = 0;
      if (hay.includes(raw)) score += 100;
      else if (hayNorm.includes(rawNorm)) score += 80;
      const tm = tokens.filter(t => hay.includes(t) || hayNorm.includes(t)).length;
      if (tm > 0) score += tm * 30;
      if (score > 0) {
        results.push({ score, kind: 'ব্যক্তি', type: 'person', id: person.id, title: person.name, meta: `${person.life} · ${person.role}` });
      }
    }
    for (const place of places) {
      const hay = [place.name, place.modern, place.description].join(' ').toLocaleLowerCase();
      const hayNorm = normalizeBanglaPhonetics(hay);
      let score = 0;
      if (hay.includes(raw)) score += 100;
      else if (hayNorm.includes(rawNorm)) score += 80;
      const tm = tokens.filter(t => hay.includes(t) || hayNorm.includes(t)).length;
      if (tm > 0) score += tm * 25;
      if (score > 0) {
        results.push({ score, kind: 'স্থান', type: 'place', id: place.id, title: place.name, meta: `${place.modern} · ${bn(linkedEventsForPlace(place.id).length)}টি সংযুক্ত ঘটনা` });
      }
    }

    results.sort((a, b) => b.score - a.score);

    if (!results.length) {
      ui.globalResults.innerHTML = '<p class="global-empty">কোনো ফলাফল পাওয়া যায়নি। অন্য শব্দ দিয়ে চেষ্টা করুন।</p>';
      ui.globalResults.hidden = false;
      return;
    }

    const shown = results.slice(0, 16);
    ui.globalResults.innerHTML = `<p class="global-search-count">${bn(results.length)}টি ফলাফল পাওয়া গেছে</p>` + shown.map(item => `
      <button type="button" class="global-result" data-kind="${item.type}" data-id="${esc(item.id)}">
        <span class="global-kind">${esc(item.kind)}</span>
        <span class="global-result-copy"><b>${esc(item.title)}</b><small>${esc(item.meta)}</small></span>
        <span class="global-arrow">→</span>
      </button>`).join('');

    $$('.global-result', ui.globalResults).forEach(btn => btn.addEventListener('click', () => {
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      closeGlobalResults();
      if (kind === 'event') openEvent(id);
      else if (kind === 'person') openPerson(id);
      else if (kind === 'place') openPlace(id);
    }));
    ui.globalResults.hidden = false;
    ui.globalSearch.setAttribute('aria-expanded', 'true');
  }

  /* ==========================================================================
     Dedicated Smart History Assistant (Chatbot & Search Tool)
     ========================================================================== */
  function bindAssistant() {
    const openBtns = [
      $('#header-assistant-btn'),
      $('#hero-assistant-btn'),
      $('#assistant-fab'),
      $('#assistant-flag-trigger'),
      $('#bottom-assistant-btn'),
      $('#hero-search-trigger')
    ].filter(Boolean);

    openBtns.forEach(btn => {
      btn.addEventListener('click', openAssistant);
      btn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAssistant();
        }
      });
    });

    // Hero quick query chips
    $$('.hero-query-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.query;
        openAssistant();
        if (ui.assistantInput) {
          ui.assistantInput.value = q;
          runAssistantQuery();
        }
      });
    });

    // Hero Era Compass cards
    $$('.era-compass-card').forEach(card => {
      card.addEventListener('click', () => {
        const era = card.dataset.jumpEra;
        if (era) {
          const pill = $(`[data-era-pill="${era}"]`);
          if (pill) {
            pill.click();
          } else {
            activeEra = era;
            refreshEvents(true);
          }
          const reader = $('#reader');
          if (reader) reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    const closeBtn = $('#assistant-close');
    if (closeBtn && ui.assistantDialog) {
      closeBtn.addEventListener('click', () => ui.assistantDialog.close());
      ui.assistantDialog.addEventListener('click', e => { if (e.target === ui.assistantDialog) ui.assistantDialog.close(); });
    }

    if (ui.assistantInput) {
      ui.assistantInput.addEventListener('input', runAssistantQuery);
      ui.assistantInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          if (ui.assistantDialog) ui.assistantDialog.close();
        }
      });
    }

    if (ui.assistantChips) {
      $$('button', ui.assistantChips).forEach(chip => {
        chip.addEventListener('click', () => {
          const q = chip.dataset.query;
          if (ui.assistantInput) {
            ui.assistantInput.value = q;
            runAssistantQuery();
          }
        });
      });
    }
  }

  function openAssistant() {
    if (!ui.assistantDialog) return;
    if (!ui.assistantDialog.open) ui.assistantDialog.showModal();
    if (ui.assistantInput) {
      ui.assistantInput.focus();
      if (ui.assistantInput.value.trim().length >= 2) runAssistantQuery();
    }
  }

    function runAssistantQuery() {
    if (!ui.assistantInput || !ui.assistantResults) return;
    const query = ui.assistantInput.value.trim();
    if (query.length < 2) {
      if (ui.assistantCount) ui.assistantCount.textContent = '';
      ui.assistantResults.innerHTML = '<div class="catalog-empty">অনুসন্ধান ঘরে যেকোনো ঐতিহাসিক ঘটনা, ব্যক্তি, স্থান বা সাল লিখুন।</div>';
      return;
    }

    const { raw, tokens, rawNorm } = extractSearchTokens(query);

    // Score & match Events
    const scoredEvents = [];
    for (const e of events) {
      const hay = eventSearchText(e);
      const hayNorm = normalizeBanglaPhonetics(hay);
      let score = 0;
      if (hay.includes(raw)) score += 100;
      else if (hayNorm.includes(rawNorm)) score += 80;
      let tokenMatches = 0;
      for (const t of tokens) {
        if (hay.includes(t) || hayNorm.includes(t)) tokenMatches++;
      }
      if (tokenMatches > 0) score += tokenMatches * 25;
      if (score > 0) scoredEvents.push({ item: e, score });
    }
    scoredEvents.sort((a, b) => b.score - a.score);
    const matchedEvents = scoredEvents.slice(0, 8).map(x => x.item);

    // Score & match People
    const scoredPeople = [];
    for (const p of people) {
      const hay = [p.name, p.also, p.life, p.role, p.bio, p.lineage, p.region, p.group, ...(p.works || [])].join(' ').toLocaleLowerCase();
      const hayNorm = normalizeBanglaPhonetics(hay);
      let score = 0;
      if (hay.includes(raw)) score += 100;
      else if (hayNorm.includes(rawNorm)) score += 80;
      let tokenMatches = 0;
      for (const t of tokens) {
        if (hay.includes(t) || hayNorm.includes(t)) tokenMatches++;
      }
      if (tokenMatches > 0) score += tokenMatches * 30;
      if (score > 0) scoredPeople.push({ item: p, score });
    }
    scoredPeople.sort((a, b) => b.score - a.score);
    const matchedPeople = scoredPeople.slice(0, 6).map(x => x.item);

    // Score & match Places
    const scoredPlaces = [];
    for (const pl of places) {
      const hay = [pl.name, pl.modern, pl.description].join(' ').toLocaleLowerCase();
      const hayNorm = normalizeBanglaPhonetics(hay);
      let score = 0;
      if (hay.includes(raw)) score += 100;
      else if (hayNorm.includes(rawNorm)) score += 80;
      let tokenMatches = 0;
      for (const t of tokens) {
        if (hay.includes(t) || hayNorm.includes(t)) tokenMatches++;
      }
      if (tokenMatches > 0) score += tokenMatches * 25;
      if (score > 0) scoredPlaces.push({ item: pl, score });
    }
    scoredPlaces.sort((a, b) => b.score - a.score);
    const matchedPlaces = scoredPlaces.slice(0, 4).map(x => x.item);

    // Score & match Unmined Raw Archive
    const scoredUnmined = [];
    if (unminedData && unminedData.unmined_domains) {
      for (const domain of unminedData.unmined_domains) {
        for (const cand of domain.key_candidate_events || []) {
          const candText = [cand.topic, domain.title, domain.source_book].join(' ').toLocaleLowerCase();
          const candNorm = normalizeBanglaPhonetics(candText);
          let score = 0;
          if (candText.includes(raw) || candNorm.includes(rawNorm)) score += 100;
          let tokenMatches = 0;
          for (const t of tokens) {
            if (candText.includes(t) || candNorm.includes(t)) tokenMatches++;
          }
          if (tokenMatches > 0) score += tokenMatches * 20;
          if (score > 0) {
            scoredUnmined.push({
              score,
              item: {
                topic: cand.topic,
                year: cand.approx_year,
                overview: cand.overview || '',
                domainTitle: domain.title,
                sourceBook: domain.source_book,
                pageRange: domain.page_range || domain.scope || ''
              }
            });
          }
        }
      }
    }
    scoredUnmined.sort((a, b) => b.score - a.score);
    const matchedUnmined = scoredUnmined.slice(0, 6).map(x => x.item);

    const totalCount = matchedEvents.length + matchedPeople.length + matchedPlaces.length + matchedUnmined.length;
    if (ui.assistantCount) {
      ui.assistantCount.textContent = `${bn(totalCount)}টি প্রাসঙ্গিক তথ্য ও উৎস পাওয়া গেছে:`;
    }

    if (totalCount === 0) {
      ui.assistantResults.innerHTML = '<div class="catalog-empty">এই অনুসন্ধানে কোনো সক্রিয় বা কাঁচা আর্কাইভ তথ্য মেলেনি। অন্য শব্দ লিখে চেষ্টা করুন।</div>';
      return;
    }

    let html = '';

    // Active Events
    if (matchedEvents.length) {
      html += `<div class="assistant-result-group-title"><span>নথিভুক্ত ঐতিহাসিক ঘটনা (${bn(matchedEvents.length)})</span></div>`;
      html += matchedEvents.map(e => `
        <div class="assistant-card">
          <div class="assistant-card-head">
            <span class="assistant-card-type">ঘটনা · ${esc(categoryLabels[e.category] || 'ইতিহাস')}</span>
            <span class="assistant-card-date">${esc(e.dateLabel)} · ${esc(e.region)}</span>
          </div>
          <h4>${esc(e.title)}</h4>
          <p>${esc(e.summary)}</p>
          <div class="assistant-card-actions">
            <button type="button" class="assistant-action-btn" data-assistant-event="${esc(e.id)}">📖 পাণ্ডুলিপির পাতায় পড়ুন →</button>
          </div>
        </div>
      `).join('');
    }

    // Active People
    if (matchedPeople.length) {
      html += `<div class="assistant-result-group-title"><span>ঐতিহাসিক ব্যক্তিত্ব (${bn(matchedPeople.length)})</span></div>`;
      html += matchedPeople.map(p => `
        <div class="assistant-card">
          <div class="assistant-card-head">
            <span class="assistant-card-type">ব্যক্তিত্ব</span>
            <span class="assistant-card-date">${esc(p.life)}</span>
          </div>
          <h4>${esc(p.name)}</h4>
          <p>${esc(p.role)} · ${esc(p.bio).substring(0, 140)}...</p>
          <div class="assistant-card-actions">
            <button type="button" class="assistant-action-btn" data-assistant-person="${esc(p.id)}">👤 পূর্ণ জীবনী খুলুন →</button>
          </div>
        </div>
      `).join('');
    }

    // Active Places
    if (matchedPlaces.length) {
      html += `<div class="assistant-result-group-title"><span>ভৌগোলিক স্থান (${bn(matchedPlaces.length)})</span></div>`;
      html += matchedPlaces.map(p => `
        <div class="assistant-card">
          <div class="assistant-card-head">
            <span class="assistant-card-type">স্থান</span>
            <span class="assistant-card-date">${esc(p.modern)}</span>
          </div>
          <h4>${esc(p.name)}</h4>
          <p>${esc(p.description)}</p>
          <div class="assistant-card-actions">
            <button type="button" class="assistant-action-btn" data-assistant-place="${esc(p.id)}">📍 স্থানের বিবরণ দেখুন →</button>
            <a class="assistant-action-btn" href="atlas.html">🗺️ পূর্ণ মানচিত্রে দেখুন ↗</a>
          </div>
        </div>
      `).join('');
    }

    // Unmined Raw Archive Leads with Rich Historical Overviews
    if (matchedUnmined.length) {
      html += `<div class="assistant-result-group-title"><span>📜 কাঁচা আর্কাইভ পাণ্ডুলিপি ও ঐতিহাসিক পর্যালোচনা (${bn(matchedUnmined.length)})</span></div>`;
      html += matchedUnmined.slice(0, 6).map(u => `
        <div class="assistant-card unmined-lead">
          <div class="assistant-card-head">
            <span class="assistant-card-type unmined-badge">কাঁচা টেক্সট আর্কাইভ</span>
            ${u.year ? `<span class="assistant-card-date">প্রায় ${bn(u.year)} খ্রি.</span>` : ''}
          </div>
          <h4>${esc(u.topic)}</h4>
          ${u.overview ? `<div class="unmined-overview-box"><p class="unmined-overview-text">${esc(u.overview)}</p></div>` : ''}
          <div class="unmined-meta-row">
            <span class="unmined-meta-item">📖 <strong>মূল আকর গ্রন্থ:</strong> ${esc(u.sourceBook)}</span>
            <span class="unmined-meta-item">📑 <strong>অধ্যায় ও পৃষ্ঠা:</strong> ${esc(u.domainTitle)}${u.pageRange ? ` (${esc(u.pageRange)})` : ''}</span>
          </div>
          <div class="unmined-card-footer">
            <span class="unmined-seal"><svg class="hizb-seal-icon" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="5.5" y="5.5" width="13" height="13" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(45 12 12)"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg> ৬,০০০+ পৃষ্ঠার কাঁচা তথ্যভাণ্ডার থেকে সংকলিত সংক্ষিপ্ত সারসংক্ষেপ</span>
          </div>
        </div>
      `).join('');
    }

    ui.assistantResults.innerHTML = html;

    // Attach click events
    $$('[data-assistant-event]', ui.assistantResults).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.assistantEvent;
        if (ui.assistantDialog) ui.assistantDialog.close();
        openEvent(id);
      });
    });

    $$('[data-assistant-person]', ui.assistantResults).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.assistantPerson;
        if (ui.assistantDialog) ui.assistantDialog.close();
        openPerson(id);
      });
    });

    $$('[data-assistant-place]', ui.assistantResults).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.assistantPlace;
        if (ui.assistantDialog) ui.assistantDialog.close();
        openPlace(id);
      });
    });
  }

  /* ==========================================================================
     Event Rendering & Flipping
     ========================================================================== */
  function eventSearchText(event) {
    const peopleText = (event.people || []).map(id => {
      const p = personMap.get(id);
      return p ? [p.name, p.also || ''].join(' ') : '';
    });
    const placesText = (event.places || []).map(id => {
      const pl = placeMap.get(id);
      return pl ? [pl.name, pl.modern || ''].join(' ') : '';
    });
    return [event.title, event.summary, event.detail, event.region, event.dateLabel, ...peopleText, ...placesText].join(' ').toLocaleLowerCase();
  }

  function refreshEvents(preserveCurrent) {
    const oldId = preserveCurrent ? filteredEvents[activeEventIndex]?.id : null;
    const needle = ui.eventSearch ? ui.eventSearch.value.trim().toLocaleLowerCase() : '';
    const category = activePillCat !== 'all' ? activePillCat : (ui.eventCategory ? ui.eventCategory.value : 'all');
    const scope = ui.eventScope ? ui.eventScope.value : 'all';
    const region = activePillRegion !== 'all' ? activePillRegion : (ui.eventRegion ? ui.eventRegion.value : 'all');
    const maxYear = ui.eventYear ? +ui.eventYear.value : 2024;

    filteredEvents = events.filter(event =>
      event.year <= maxYear &&
      matchesEra(event.year, activeEra) &&
      (category === 'all' || event.category === category) &&
      (scope === 'all' || event.scope === scope) &&
      (region === 'all' || event.region === region) &&
      (!needle || eventSearchText(event).includes(needle))
    );

    if (!filteredEvents.length) {
      if (ui.entries) ui.entries.innerHTML = '<div class="empty-box">এই ফিল্টারে কোনো পাতা মেলেনি। ফিল্টার বদলে দেখুন।</div>';
      if (ui.eventResultCount) ui.eventResultCount.textContent = '০টি নথি';
      if (ui.title) ui.title.textContent = 'পাতা পাওয়া যায়নি';
      if (ui.date) ui.date.textContent = '';
      if (ui.summary) ui.summary.textContent = 'অন্য শব্দ, যুগ বা বিষয় ব্যবহার করুন।';
      if (ui.tags) ui.tags.innerHTML = '';
      if (ui.detail) ui.detail.innerHTML = '';
      if (ui.people) ui.people.innerHTML = '';
      if (ui.places) ui.places.innerHTML = '';
      if (ui.sources) ui.sources.innerHTML = '';
      if (ui.certainty) ui.certainty.textContent = '';
      if (ui.pageCounter) ui.pageCounter.textContent = '০ পাতা';
      if (ui.progress) ui.progress.style.width = '0';
      if (ui.folio) ui.folio.textContent = '০';
      return;
    }

    const found = oldId ? filteredEvents.findIndex(e => e.id === oldId) : -1;
    activeEventIndex = found >= 0 ? found : Math.min(activeEventIndex, filteredEvents.length - 1);
    activeEventIndex = Math.max(0, activeEventIndex);

    if (ui.eventResultCount) {
      ui.eventResultCount.textContent = `${bn(filteredEvents.length)}টি নথি পাওয়া গেছে`;
    }
    drawEntries();
    renderEvent(false);
  }

  function drawEntries() {
    if (!ui.entries) return;
    ui.entries.innerHTML = '';
    filteredEvents.forEach((event, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `entry-button${index === activeEventIndex ? ' active' : ''}`;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === activeEventIndex));
      button.innerHTML = `<span class="entry-year">${esc(event.dateLabel)}</span><span><span class="entry-title">${esc(event.title)}</span><span class="entry-region">${esc(event.region)} · ${esc(scopeLabels[event.scope] || 'স্তর')} · ${esc(categoryLabels[event.category] || 'ইতিহাস')}</span></span>`;
      button.addEventListener('click', () => {
        if (index === activeEventIndex) {
          closeContentsOnMobile();
          return;
        }
        const direction = index > activeEventIndex ? 1 : -1;
        animateToIndex(index, direction);
        closeContentsOnMobile();
      });
      ui.entries.append(button);
    });
    const activeEntry = ui.entries.querySelector('.entry-button.active');
    if (activeEntry) ui.entries.scrollTop = Math.max(0, activeEntry.offsetTop - ui.entries.offsetTop - 90);
  }

  function closeContentsOnMobile() {
    if (!ui.spread) return;
    ui.spread.classList.remove('show-contents');
    const toggle = $('#contents-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'সূচি ☰';
    }
  }

  function sourceItems(ids) {
    return (ids || []).map(id => sourceMap.get(id)).filter(Boolean).map(source => `
      <div class="source-item">
        <a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a>
        <span>${esc(source.publisher)}${source.type ? ` · ${esc(source.type)}` : ''}</span>
        ${source.note ? `<p>${esc(source.note)}</p>` : ''}
      </div>`).join('');
  }

  function renderEvent(animateIn = true) {
    const event = filteredEvents[activeEventIndex];
    if (!event) return;

    if (ui.regionName) ui.regionName.textContent = event.region;
    if (ui.record) ui.record.textContent = `নথি ${bn(activeEventIndex + 1)} / ${bn(filteredEvents.length)}`;
    if (ui.date) ui.date.textContent = event.dateLabel;
    if (ui.title) ui.title.textContent = event.title;
    if (ui.summary) ui.summary.textContent = event.summary;
    if (ui.folio) ui.folio.textContent = bn(activeEventIndex + 1);
    if (ui.pageCounter) ui.pageCounter.textContent = `পাতা ${bn(activeEventIndex + 1)} / ${bn(filteredEvents.length)}`;
    if (ui.progress) ui.progress.style.width = `${((activeEventIndex + 1) / filteredEvents.length) * 100}%`;
    
    if (ui.tags) {
      ui.tags.innerHTML = [
        scopeLabels[event.scope] || 'স্তর',
        categoryLabels[event.category] || 'ইতিহাস',
        dateTypeLabels[event.dateType] || 'তারিখ',
        event.certainty ? `যাচাই: ${event.certainty}` : null
      ].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('');
    }

    if (ui.detail) {
      const scopeNote = event.scopeNote ? `<div class="event-scope-note"><b>কেন এই স্তরে:</b> ${esc(event.scopeNote)}</div>` : '';
      const paragraphs = (event.detail || '').split('\n\n').map(p => `<p>${esc(p)}</p>`).join('');
      ui.detail.innerHTML = `${scopeNote}${paragraphs}`;
    }

    if (ui.people) {
      const linkedPeople = (event.people || []).map(id => personMap.get(id)).filter(Boolean);
      $('#event-people-section').hidden = linkedPeople.length === 0;
      ui.people.innerHTML = linkedPeople.map(p => `
        <button type="button" class="mini-person" data-person-id="${esc(p.id)}">
          <strong>${esc(p.name)}</strong>
          <small>${esc(p.life)} · ${esc(p.role)}</small>
          <span>${esc(p.bio).substring(0, 95)}...</span>
        </button>`).join('');
      $$('[data-person-id]', ui.people).forEach(b => b.addEventListener('click', () => openPerson(b.dataset.personId)));
    }

    if (ui.places) {
      const linkedPlaces = (event.places || []).map(id => placeMap.get(id)).filter(Boolean);
      $('#event-places-section').hidden = linkedPlaces.length === 0;
      ui.places.innerHTML = linkedPlaces.map(p => `
        <button type="button" class="place-chip" data-place-id="${esc(p.id)}">
          ⌖ ${esc(p.name)} (${esc(p.modern)})
        </button>`).join('');
      $$('[data-place-id]', ui.places).forEach(b => b.addEventListener('click', () => openPlace(b.dataset.placeId)));
    }

    if (ui.sources) {
      ui.sources.innerHTML = sourceItems(event.sources) || '<div class="empty-box">কোনো সুনির্দিষ্ট সূত্র এখনো যুক্ত করা হয়নি।</div>';
    }

    if (ui.certainty) {
      ui.certainty.textContent = event.certainty ? `ঐতিহাসিক তথ্যের মান: ${event.certainty}` : '';
      ui.certainty.hidden = !event.certainty;
    }

    if (animateIn && motionEnabled && ui.eventBody) {
      ui.eventBody.classList.remove('content-enter');
      void ui.eventBody.offsetWidth;
      ui.eventBody.classList.add('content-enter');
    }

    $$('.entry-button', ui.entries).forEach((btn, idx) => {
      const active = idx === activeEventIndex;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
  }

  function turnPage(direction) {
    if (turning || !filteredEvents.length) return;
    const target = (activeEventIndex + direction + filteredEvents.length) % filteredEvents.length;
    animateToIndex(target, direction);
  }

  function animateToIndex(targetIndex, direction) {
    if (!motionEnabled || !ui.sheet) {
      activeEventIndex = targetIndex;
      renderEvent(false);
      return;
    }
    turning = true;
    if (ui.prev) ui.prev.disabled = true;
    if (ui.next) ui.next.disabled = true;
    const current = filteredEvents[activeEventIndex];
    if (ui.sheetDate) ui.sheetDate.textContent = current.dateLabel;
    if (ui.sheetTitle) ui.sheetTitle.textContent = current.title;
    ui.sheet.classList.add('active');

    const from = direction === 1 ? 0 : -180;
    const to = direction === 1 ? -180 : 0;
    const animation = animateSheet(from, to, 340);
    window.setTimeout(() => {
      activeEventIndex = targetIndex;
      renderEvent(false);
    }, 150);
    window.setTimeout(() => finishSheet(animation), 350);
  }

  function animateSheet(from, to, duration) {
    return ui.sheet.animate([
      { transform: `rotateY(${from}deg)` },
      { transform: `rotateY(${to}deg)` }
    ], {
      duration,
      easing: 'cubic-bezier(.22,.7,.26,1)',
      fill: 'forwards'
    });
  }

  function finishSheet(animation) {
    animation?.cancel();
    if (ui.sheet) {
      ui.sheet.classList.remove('active');
      ui.sheet.style.transform = '';
    }
    if (ui.prev) ui.prev.disabled = false;
    if (ui.next) ui.next.disabled = false;
    turning = false;
  }

  function bindPageDrag() {
    if (!ui.eventPage || !ui.sheet) return;
    let startX = null, startY = null, dragging = false, dragDirection = 0, dragAnimation = null;

    ui.eventPage.addEventListener('pointerdown', event => {
      if (!motionEnabled || turning || event.target.closest('button, a, input, select')) return;
      startX = event.clientX;
      startY = event.clientY;
      dragging = false;
      dragDirection = 0;
    });

    ui.eventPage.addEventListener('pointermove', event => {
      if (startX === null || turning) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) {
          dragging = true;
          dragDirection = dx < 0 ? 1 : -1;
          const current = filteredEvents[activeEventIndex];
          if (ui.sheetDate) ui.sheetDate.textContent = current?.dateLabel || '';
          if (ui.sheetTitle) ui.sheetTitle.textContent = current?.title || '';
          ui.sheet.classList.add('active');
        } else if (Math.abs(dy) > 14) {
          startX = null;
          return;
        }
      }
      if (!dragging) return;
      const width = Math.max(ui.eventPage.clientWidth, 260);
      let rotation = 0;
      if (dragDirection === 1) rotation = Math.max(-180, Math.min(0, (dx / width) * 180));
      else rotation = Math.max(-180, Math.min(0, -180 + (dx / width) * 180));
      dragAnimation?.cancel();
      ui.sheet.style.transform = `rotateY(${rotation}deg)`;
      event.preventDefault();
    });

    const endDrag = event => {
      if (startX === null) return;
      const dx = event.clientX - startX;
      if (dragging && !turning) {
        const shouldComplete = Math.abs(dx) > 68;
        const from = dragDirection === 1
          ? Math.max(-180, Math.min(0, (dx / Math.max(ui.eventPage.clientWidth, 260)) * 180))
          : Math.max(-180, Math.min(0, -180 + (dx / Math.max(ui.eventPage.clientWidth, 260)) * 180));
        const to = shouldComplete ? (dragDirection === 1 ? -180 : 0) : (dragDirection === 1 ? 0 : -180);
        turning = true;
        if (ui.prev) ui.prev.disabled = true;
        if (ui.next) ui.next.disabled = true;
        const animation = animateSheet(from, to, shouldComplete ? 300 : 240);
        if (shouldComplete) {
          const target = (activeEventIndex + dragDirection + filteredEvents.length) % filteredEvents.length;
          window.setTimeout(() => { activeEventIndex = target; renderEvent(false); }, 130);
        }
        window.setTimeout(() => finishSheet(animation), shouldComplete ? 320 : 260);
      }
      startX = null; startY = null; dragging = false; dragDirection = 0;
    };

    ui.eventPage.addEventListener('pointerup', endDrag);
    ui.eventPage.addEventListener('pointercancel', endDrag);
  }

  function linkedEventsForPerson(personId) {
    return events.filter(event => (event.people || []).includes(personId));
  }

  function linkedEventsForPlace(placeId) {
    return events.filter(event => (event.places || []).includes(placeId));
  }

  /* ==========================================================================
     People & Places Catalog
     ========================================================================== */
  function renderPeople() {
    if (!ui.peopleSearch || !ui.peopleList) return;
    const needle = ui.peopleSearch.value.trim().toLocaleLowerCase();
    const group = ui.peopleGroup ? ui.peopleGroup.value : 'all';
    const result = people.filter(person => {
      const text = [person.name, person.also, person.life, person.role, person.bio, person.lineage, person.region, person.group, ...(person.works || [])]
        .join(' ').toLocaleLowerCase();
      return (group === 'all' || person.group === group) && (!needle || text.includes(needle));
    }).sort((a, b) => (ui.peopleSort && ui.peopleSort.value === 'name')
      ? a.name.localeCompare(b.name, 'bn') : (a.id === 'muhammad' ? -1 : b.id === 'muhammad' ? 1 : (a.sortYear || 9999) - (b.sortYear || 9999)));

    if (ui.peopleResult) ui.peopleResult.textContent = `${bn(result.length)} জন · নাম বেছে পড়ুন`;
    if (!result.some(p => p.id === activePersonId)) activePersonId = result[0]?.id || null;
    ui.peopleList.innerHTML = result.length ? result.map((person, i) =>
      `<button type="button" role="option" aria-selected="${person.id === activePersonId}" class="catalog-entry ${person.id === activePersonId ? 'selected' : ''}" data-person-id="${esc(person.id)}"><span class="catalog-entry-num">${bn(i + 1)}</span><span><b>${esc(person.name)}</b><small>${esc(person.role || person.group || '')}</small></span></button>`
    ).join('') : '<div class="empty-box">এই অনুসন্ধানে কাউকে পাওয়া যায়নি।</div>';

    $$('[data-person-id]', ui.peopleList).forEach(button => button.addEventListener('click', () => {
      activePersonId = button.dataset.personId; renderPeople();
    }));

    const person = people.find(p => p.id === activePersonId);
    if (!person) {
      if (ui.peopleProfile) ui.peopleProfile.innerHTML = '<div class="catalog-empty">এই অনুসন্ধানে কোনো ব্যক্তি নেই। অন্য শব্দ বা ক্ষেত্র বেছে নিন।</div>';
      updateCatalogControls('person', 0, 0); return;
    }
    const position = result.findIndex(p => p.id === person.id);
    const linked = linkedEventsForPerson(person.id);
    const rel = (person.relations || []).map(r => {
      const other = personMap.get(r.person);
      return other ? `<button type="button" class="folio-chip" data-person-related="${esc(other.id)}">${esc(r.label)} · ${esc(other.name)}</button>` : '';
    }).join('');

    if (ui.peopleProfile) {
      ui.peopleProfile.innerHTML = `
        <p class="profile-life">${esc(person.life || '')} <span>·</span> ${esc(person.region || '')}</p>
        <h3>${esc(person.name)}</h3>
        <p class="profile-also">${esc(person.also || '')}</p>
        <p class="profile-role">${esc(person.role || '')}</p>
        <p class="profile-bio">${esc(person.bio || '')}</p>
        ${person.lineage ? `<div class="profile-note"><b>পরিচয় ও বংশধারা</b><p>${esc(person.lineage)}</p></div>` : ''}
        ${(person.works || []).length ? `<div class="profile-block"><h4>কাজ ও অবদান</h4><ul>${person.works.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
        ${rel ? `<div class="profile-block"><h4>সম্পর্ক</h4><div class="folio-chip-row">${rel}</div></div>` : ''}
        <div class="profile-block"><h4>সম্পর্কিত ঘটনা · ${bn(linked.length)}</h4>
          <div class="folio-links">${linked.length ? linked.slice(0, 8).map(e => `<button type="button" class="folio-event" data-person-event="${esc(e.id)}"><b>${esc(e.title)}</b><small>${esc(e.dateLabel)} · ${esc(e.region)}</small></button>`).join('') : '<span class="muted">এখনো কোনো ঘটনা যুক্ত হয়নি।</span>'}</div>
        </div>
        <div class="profile-source">${sourceItems(person.sources) || ''}</div>
      `;
      $$('[data-person-related]', ui.peopleProfile).forEach(b => b.addEventListener('click', () => {
        activePersonId = b.dataset.personRelated;
        if (ui.peopleSearch) ui.peopleSearch.value = '';
        if (ui.peopleGroup) ui.peopleGroup.value = 'all';
        renderPeople();
      }));
      $$('[data-person-event]', ui.peopleProfile).forEach(b => b.addEventListener('click', () => openEvent(b.dataset.personEvent)));
    }

    const reg = $('#person-region'); if (reg) reg.textContent = person.region || person.group || 'জীবনী';
    const num = $('#person-number'); if (num) num.textContent = `ব্যক্তি ${bn(position + 1)} / ${bn(result.length)}`;
    const fol = $('#person-folio'); if (fol) fol.textContent = bn(person.sortYear || position + 1);
    updateCatalogControls('person', position, result.length);
  }

  function stepCatalog(kind, direction) {
    const isPerson = kind === 'person';
    const list = isPerson ? ui.peopleList : ui.placeList;
    const id = isPerson ? activePersonId : activePlaceId;
    if (!list) return;
    const buttons = $$('.catalog-entry', list);
    if (!buttons.length) return;
    let i = buttons.findIndex(b => b.dataset[isPerson ? 'personId' : 'placeId'] === id);
    i = (i + direction + buttons.length) % buttons.length;
    buttons[i].click();
  }

  function updateCatalogControls(kind, index, total) {
    const cap = kind === 'person' ? 'person' : 'place';
    const prev = $(`#${cap}-prev`), next = $(`#${cap}-next`), bar = $(`#${cap}-progress`);
    if (prev && next) prev.disabled = next.disabled = total < 2;
    if (bar) bar.style.width = total ? `${((index + 1) / total) * 100}%` : '0%';
  }

  function toggleCatalogIndex(kind, button) {
    const index = kind === 'people' ? ui.peopleIndex : $('#place-index');
    if (!index) return;
    const open = index.classList.toggle('index-open');
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'সূচি বন্ধ ×' : (kind === 'people' ? 'ব্যক্তি-সূচি ☰' : 'স্থান-সূচি ☰');
  }

  function openPerson(personId) {
    const person = personMap.get(personId);
    if (!person || !ui.dialog || !ui.dialogContent) return;
    const linked = linkedEventsForPerson(person.id);
    const relations = (person.relations || []).map(relation => {
      const other = personMap.get(relation.person);
      return other ? `<button type="button" class="relation-chip" data-dialog-person="${esc(other.id)}">${esc(relation.label)} · ${esc(other.name)}</button>` : '';
    }).join('');

    ui.dialogContent.innerHTML = `
      <p class="dialog-meta">${esc(person.life)} · ${esc(person.role)}</p>
      <h2 class="dialog-title" id="dialog-title">${esc(person.name)}</h2>
      ${person.also ? `<p class="dialog-copy"><b>অন্য নাম/বানান:</b> ${esc(person.also)}</p>` : ''}
      <p class="dialog-copy">${esc(person.bio)}</p>
      <div class="dialog-box"><b>বংশ ও পারিবারিক পরিচয়:</b> ${esc(person.lineage || 'যাচাইকৃত বংশতথ্য লিপিবদ্ধ রয়েছে।')}</div>
      ${(person.works || []).length ? `<div class="dialog-section"><h3>প্রধান কাজ ও অবদান</h3><div class="chip-row">${person.works.map(work => `<span class="relation-chip">${esc(work)}</span>`).join('')}</div></div>` : ''}
      ${relations ? `<div class="dialog-section"><h3>সম্পর্ক</h3><div class="chip-row">${relations}</div></div>` : ''}
      <div class="dialog-section"><h3>যেসব ঘটনার পাতায় আছেন (${bn(linked.length)})</h3>
        <div class="dialog-events">${linked.length ? linked.map(event => `<button type="button" class="dialog-event" data-dialog-event="${esc(event.id)}"><b>${esc(event.title)}</b><span>${esc(event.dateLabel)} · ${esc(event.region)}</span></button>`).join('') : '<div class="empty-box">এখনো কোনো ঘটনার সঙ্গে যুক্ত নয়।</div>'}</div>
      </div>
      <div class="dialog-section"><h3>জীবনীর উৎস</h3><div class="dialog-sources">${sourceItems(person.sources) || '<div class="empty-box">উৎস যুক্ত রয়েছে।</div>'}</div></div>`;

    $$('[data-dialog-person]', ui.dialogContent).forEach(button => button.addEventListener('click', () => openPerson(button.dataset.dialogPerson)));
    $$('[data-dialog-event]', ui.dialogContent).forEach(button => button.addEventListener('click', () => openEvent(button.dataset.dialogEvent)));
    if (!ui.dialog.open) ui.dialog.showModal();
  }

  function openPlace(placeId) {
    const place = placeMap.get(placeId);
    if (!place || !ui.dialog || !ui.dialogContent) return;
    const linked = linkedEventsForPlace(place.id);
    ui.dialogContent.innerHTML = `
      <p class="dialog-meta">${esc(place.modern)} · স্থানাঙ্ক</p>
      <h2 class="dialog-title" id="dialog-title">${esc(place.name)}</h2>
      <p class="dialog-copy">${esc(place.description)}</p>
      <div class="dialog-box">আধুনিক মানচিত্রের আনুমানিক অবস্থান: ${Number(place.lat).toFixed(3)}°, ${Number(place.lon).toFixed(3)}°। এটি ভৌগোলিক অবস্থান নির্দেশ করে।</div>
      <div class="dialog-section"><h3>সংশ্লিষ্ট ঘটনা (${bn(linked.length)})</h3>
        <div class="dialog-events">${linked.length ? linked.map(event => `<button type="button" class="dialog-event" data-dialog-event="${esc(event.id)}"><b>${esc(event.title)}</b><span>${esc(event.dateLabel)} · ${esc(event.region)}</span></button>`).join('') : '<div class="empty-box">এখনো কোনো ঘটনা যুক্ত নয়।</div>'}</div>
      </div>
      <div class="dialog-section"><a class="button secondary" href="atlas.html">পূর্ণাঙ্গ মানচিত্রে অবস্থান দেখুন →</a></div>`;
    $$('[data-dialog-event]', ui.dialogContent).forEach(button => button.addEventListener('click', () => openEvent(button.dataset.dialogEvent)));
    if (!ui.dialog.open) ui.dialog.showModal();
  }

  function openEvent(eventId) {
    const target = eventMap.get(eventId);
    if (!target) return;
    if (ui.dialog && ui.dialog.open) ui.dialog.close();
    if (ui.assistantDialog && ui.assistantDialog.open) ui.assistantDialog.close();

    // Reset filters
    if (ui.eventSearch) ui.eventSearch.value = '';
    if (ui.eventCategory) ui.eventCategory.value = 'all';
    if (ui.eventScope) ui.eventScope.value = 'all';
    if (ui.eventRegion) ui.eventRegion.value = 'all';
    if (ui.eventYear) {
      ui.eventYear.value = '2024';
      if (ui.eventYearLabel) ui.eventYearLabel.textContent = '২০২৪';
    }
    activeEra = 'all';
    activePillRegion = 'all';
    activePillCat = 'all';
    $$('#era-pills .filter-pill').forEach(b => b.classList.toggle('active', b.dataset.era === 'all'));
    $$('#region-pills .filter-pill').forEach(b => b.classList.toggle('active', b.dataset.region === 'all'));
    $$('#category-pills .filter-pill').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));

    refreshEvents(false);
    const index = filteredEvents.findIndex(event => event.id === eventId);
    if (index >= 0) {
      activeEventIndex = index;
      drawEntries();
      renderEvent(false);
      if (motionEnabled && ui.eventBody) {
        ui.eventBody.classList.remove('content-enter');
        void ui.eventBody.offsetWidth;
        ui.eventBody.classList.add('content-enter');
      }
    }
    closeContentsOnMobile();
    const reader = $('#reader');
    if (reader) reader.scrollIntoView({ behavior: motionEnabled ? 'smooth' : 'auto', block: 'start' });
  }

  function renderPlaces() {
    if (!ui.placeSearch || !ui.placeList) return;
    const needle = ui.placeSearch.value.trim().toLocaleLowerCase();
    const result = places.filter(place => !needle || [place.name, place.modern, place.description].join(' ').toLocaleLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'bn'));
    if (ui.placeResult) ui.placeResult.textContent = `${bn(result.length)}টি স্থান · নাম বেছে পড়ুন`;
    if (!result.some(p => p.id === activePlaceId)) activePlaceId = result[0]?.id || null;
    ui.placeList.innerHTML = result.length ? result.map((place, i) =>
      `<button type="button" role="option" aria-selected="${place.id === activePlaceId}" class="catalog-entry ${place.id === activePlaceId ? 'selected' : ''}" data-place-id="${esc(place.id)}"><span class="catalog-entry-num">${bn(i + 1)}</span><span><b>${esc(place.name)}</b><small>${esc(place.modern || '')}</small></span></button>`
    ).join('') : '<div class="empty-box">কোনো স্থান পাওয়া যায়নি।</div>';

    $$('[data-place-id]', ui.placeList).forEach(b => b.addEventListener('click', () => {
      activePlaceId = b.dataset.placeId; renderPlaces();
    }));

    const place = places.find(p => p.id === activePlaceId);
    if (!place) {
      if (ui.placeProfile) ui.placeProfile.innerHTML = '<div class="catalog-empty">এই অনুসন্ধানে কোনো স্থান নেই।</div>';
      updateCatalogControls('place', 0, 0); return;
    }
    const pos = result.findIndex(p => p.id === place.id), linked = linkedEventsForPlace(place.id);
    if (ui.placeProfile) {
      ui.placeProfile.innerHTML = `
        <p class="profile-life">${esc(place.modern || '')} <span>·</span> ভূদৃশ্য</p>
        <h3>${esc(place.name)}</h3>
        <p class="profile-bio">${esc(place.description || '')}</p>
        <div class="place-coordinates">
          <span>আধুনিক মানচিত্রের স্থানাঙ্ক</span>
          <b>${Number(place.lat).toFixed(3)}°, ${Number(place.lon).toFixed(3)}°</b>
          <small>ভৌগোলিক অবস্থানটি আধুনিক প্রক্ষেপণ অনুযায়ী আনুমানিক।</small>
        </div>
        <div class="profile-block">
          <h4>এই স্থানের সঙ্গে যুক্ত ঘটনা · ${bn(linked.length)}</h4>
          <div class="folio-links">${linked.length ? linked.slice(0, 10).map(e => `<button type="button" class="folio-event" data-place-event="${esc(e.id)}"><b>${esc(e.title)}</b><small>${esc(e.dateLabel)} · ${esc(e.region)}</small></button>`).join('') : '<span class="muted">এখনো কোনো ঘটনা যুক্ত হয়নি।</span>'}</div>
        </div>
        <div style="margin-top: 14px;"><a class="button secondary small-link" href="atlas.html">পূর্ণাঙ্গ মানচিত্রে দেখুন ↗</a></div>
      `;
      $$('[data-place-event]', ui.placeProfile).forEach(b => b.addEventListener('click', () => openEvent(b.dataset.placeEvent)));
    }

    const reg = $('#place-region'); if (reg) reg.textContent = place.modern || 'ভূদৃশ্য';
    const num = $('#place-number'); if (num) num.textContent = `স্থান ${bn(pos + 1)} / ${bn(result.length)}`;
    const fol = $('#place-folio'); if (fol) fol.textContent = bn(pos + 1);
    updateCatalogControls('place', pos, result.length);
  }

  function renderSources() {
    if (!ui.sourceList) return;
    ui.sourceList.innerHTML = sources.map(source => `
      <div class="source-item">
        <a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.id)} · ${esc(source.title)} ↗</a>
        <span>${esc(source.publisher)}${source.type ? ` · ${esc(source.type)}` : ''}</span>
        ${source.note ? `<p>${esc(source.note)}</p>` : ''}
      </div>`).join('');
  }

  init();

  /* ==========================================================================
     Mouse-Interactive Ambient Lantern & Parallax Texture
     ========================================================================== */
  if (window.matchMedia('(pointer: fine)').matches && !prefersReduced) {
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
