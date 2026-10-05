/* Sam Bracke: rendert alles uit data/strava.json en data/content.json.
   Elke pagina gebruikt dit script; renderers draaien alleen als hun element bestaat.
   Ontbrekende data = sectie blijft verborgen. Test-overrides: ?content=pad&strava=pad */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var CONTENT_URL = safePath(params.get('content')) || 'data/content.json';
  var STRAVA_URL = safePath(params.get('strava')) || 'data/strava.json';
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var nf0 = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var DEFAULTS = { stepsPerKm: 1000, antwerpAmsterdamKm: 156, pieterpadKm: 498, shoeKm: 700 };

  function safePath(p) { return p && /^[\w./-]+$/.test(p) && p.indexOf('..') === -1 ? p : null; }
  function safeUrl(u) {
    if (typeof u !== 'string' || !u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[\w./-]+$/.test(u) && u.indexOf('..') === -1) return u;
    return null;
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function show(id) { var s = $(id); if (s) s.hidden = false; }
  function arr(x) { return Array.isArray(x) && x.length ? x : null; }
  function str(x) { return typeof x === 'string' && x.trim() ? x.trim() : null; }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function fmtDate(iso, withYear) {
    var d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear === false ? '' : ' ' + d.getFullYear());
  }
  function extLink(a) { if (/^https?:/i.test(a.href)) { a.target = '_blank'; a.rel = 'noopener'; } return a; }
  function stripQuotes(q) { return q.replace(/^["“„']+|["”']+$/g, ''); }
  function smooth() { return mqReduce.matches ? 'auto' : 'smooth'; }

  initMenu();

  Promise.all([getJSON(STRAVA_URL), getJSON(CONTENT_URL)]).then(function (res) {
    var strava = res[0] || {}, content = res[1] || {};
    var jobs = [
      function () { renderHero(content); },
      function () { renderTimer(strava); },
      function () { renderAbout(content); },
      function () { renderStories(content); },
      function () { renderInstagram(content); },
      function () { renderHeatmap(strava, content); },
      function () { renderYear(strava, content); },
      function () { renderPitch(content); },
      function () { renderImpact(content); },
      function () { renderTestimonials(content); },
      function () { renderPrs(content); },
      function () { renderTimeline(content); },
      function () { renderStravaEmbed(content); },
      function () { renderFacts(content); }
    ];
    jobs.forEach(function (j) { try { j(); } catch (e) { console.warn(e); } });
    var kal = $('kalender'), tel = $('tellers');
    if ((kal && !kal.hidden) || (tel && !tel.hidden)) show('kilometers');
    var fd = $('footer-data');
    if (fd) {
      if (str(strava.note)) { var nt = strava.note.trim(); fd.textContent = 'Data: ' + nt.charAt(0).toLowerCase() + nt.slice(1); }
      else if (strava.sample === false) fd.textContent = 'Data: Strava';
    }
  });

  /* ---------- Menu ---------- */
  function initMenu() {
    var btn = document.querySelector('.menu-btn'), nav = $('site-nav'), bar = $('topbar');
    if (bar && document.body.classList.contains('page-home')) {
      var onScroll = function () { bar.classList.toggle('is-solid', window.scrollY > 40); };
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }
    if (!btn || !nav) return;
    var lbl = btn.querySelector('.menu-btn__lbl');
    function links() { return nav.querySelectorAll('a'); }
    function setOpen(open, returnFocus) {
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
      if (lbl) lbl.textContent = open ? 'Sluit' : 'Menu';
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      if (open) { var l = links(); if (l[0]) l[0].focus(); }
      else if (returnFocus) btn.focus();
    }
    btn.setAttribute('aria-label', 'Menu openen');
    btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a') && nav.classList.contains('is-open')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (e.key === 'Escape') { setOpen(false, true); return; }
      if (e.key === 'Tab') { // focus binnen menu + knop houden
        var l = links(), first = btn, last = l[l.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var mq = window.matchMedia('(min-width: 960px)');
    var onMq = function () { if (mq.matches && nav.classList.contains('is-open')) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
  }

  /* ---------- Hero ---------- */
  function renderHero(c) {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    var srcs = [safeUrl(c.heroImg), 'img/hero.jpg'].filter(Boolean);
    if (str(c.heroPos)) hero.style.setProperty('--hero-pos', c.heroPos);
    if (str(c.heroAlt)) { var alt = el('p', 'sr-only', 'Foto: ' + c.heroAlt.trim()); hero.querySelector('.hero__inner').prepend(alt); }
    if (str(c.heroCredit) && $('hero-credit')) { $('hero-credit').textContent = 'Foto: ' + c.heroCredit.trim().replace(/^foto:\s*/i, ''); show('hero-credit'); }
    (function tryNext(i) {
      if (i >= srcs.length) return; // gradient blijft staan
      var im = new Image();
      im.onload = function () { hero.style.setProperty('--hero-img', 'url("' + srcs[i].replace(/"/g, '') + '")'); };
      im.onerror = function () { tryNext(i + 1); };
      im.src = srcs[i];
    })(0);
  }

  /* ---------- Sinds de laatste run ---------- */
  function renderTimer(strava) {
    if (!$('sinds')) return;
    var lr = strava.lastRun;
    if (!lr || !lr.end || isNaN(new Date(lr.end))) return;
    var end = new Date(lr.end).getTime();
    var nodes = {};
    document.querySelectorAll('[data-t]').forEach(function (n) { nodes[n.getAttribute('data-t')] = n; });
    var bits = [];
    if (lr.name) bits.push(lr.name);
    if (typeof lr.km === 'number') bits.push(nf1.format(lr.km) + ' km');
    bits.push(fmtDate(lr.end));
    $('lastrun').textContent = bits.join(' · ');
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    function tick() {
      var diff = Math.max(0, Math.floor((Date.now() - end) / 1000));
      var d = Math.floor(diff / 86400), h = Math.floor(diff % 86400 / 3600), m = Math.floor(diff % 3600 / 60), s = diff % 60;
      nodes.d.textContent = pad(d); nodes.h.textContent = pad(h); nodes.m.textContent = pad(m); nodes.s.textContent = pad(s);
      $('quip').textContent = quip(diff / 3600);
    }
    tick();
    setInterval(tick, 1000);
    show('sinds');
  }
  function quip(hours) {
    if (hours < 1) return 'Schoenen nog niet uit.';
    if (hours < 12) return 'Benen nog warm.';
    if (hours < 24) return 'Slapen, eten, slapen.';
    if (hours < 48) return 'De trap af gaat achteruit.';
    if (hours < 96) return 'Herstel of taper?';
    return 'Ergens loopt hij nu, zonder horloge.';
  }

  /* ---------- Het verhaal van Sam ---------- */
  function renderAbout(c) {
    if (!$('verhaal')) return;
    var a = c.about;
    if (!a || typeof a !== 'object') return;
    var paras = Array.isArray(a.paragraphs) ? a.paragraphs.filter(str) : (str(a.paragraphs) ? [a.paragraphs] : []);
    var quote = str(a.quote);
    if (!paras.length && !quote) return;

    var text = $('about-text');
    paras.forEach(function (p) { text.appendChild(el('p', null, p.trim())); });
    if (!paras.length) text.hidden = true;

    var src = safeUrl(typeof a.img === 'object' && a.img ? a.img.src : a.img);
    var fig = $('about-photo'), grid = fig.parentNode;
    if (src) {
      var img = el('img');
      img.src = src; img.loading = 'lazy'; img.decoding = 'async';
      img.alt = str(a.imgAlt) || 'Portret van Sam Bracke';
      img.onerror = function () { fig.hidden = true; grid.classList.add('about__grid--solo'); };
      fig.appendChild(img);
      if (str(a.imgCredit)) fig.appendChild(el('figcaption', null, a.imgCredit));
      fig.hidden = false;
    } else {
      grid.classList.add('about__grid--solo');
    }
    if (!paras.length && !src) grid.hidden = true;

    if (quote) {
      $('about-quote-text').textContent = stripQuotes(quote);
      if (str(a.quoteSource)) { var cap = $('about-quote-src'); cap.textContent = a.quoteSource.trim(); cap.hidden = false; }
      show('about-quote');
    }
    show('verhaal');
  }

  /* ---------- Verhalen-slider ---------- */
  function renderStories(c) {
    var track = $('stories-track');
    if (!track) return;
    var stories = arr(c.stories);
    if (!stories) return;
    stories = stories.filter(function (s) { return s && (s.title || s.quote); })
      .map(function (s, i) { return { s: s, i: i }; })
      .sort(function (a, b) { return (b.s.featured === true) - (a.s.featured === true) || a.i - b.i; })
      .map(function (x) { return x.s; });
    if (!stories.length) return;
    var n = stories.length;

    stories.forEach(function (s, i) {
      var slide = el('div', 'slide');
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'dia');
      slide.setAttribute('aria-label', (i + 1) + ' van ' + n + (s.title ? ': ' + s.title : ''));
      var k = el('article', 'story');
      var media = el('div', 'story__media');
      var year = s.date ? String(s.date).slice(0, 4) : '';
      var placeholder = function () { media.innerHTML = ''; media.appendChild(el('span', 'story__ph', year)).setAttribute('aria-hidden', 'true'); if (flag) media.appendChild(flag); };
      var flag = null; // volgorde doet het werk: uitgelichte verhalen staan vooraan
      var src = safeUrl(s.img);
      if (src) {
        var img = el('img');
        img.src = src; img.loading = 'lazy'; img.decoding = 'async';
        img.alt = str(s.imgAlt) || ('Foto bij het verhaal ' + (s.title || ''));
        img.onerror = placeholder;
        if (str(s.imgPos)) img.style.objectPosition = s.imgPos.trim();
        media.appendChild(img);
        if (str(s.imgCredit)) media.appendChild(el('span', 'story__credit', s.imgCredit.trim()));
        if (flag) media.appendChild(flag);
      } else placeholder();
      k.appendChild(media);

      var b = el('div', 'story__body');
      var meta = [s.race, s.date ? fmtDate(s.date) : null].filter(Boolean).join(' · ');
      if (meta) b.appendChild(el('p', 'meta', meta));
      if (s.title) b.appendChild(el('h3', 'story__title', s.title));
      if (str(s.quote)) {
        var sq = el('blockquote', 'story__quote', '“' + stripQuotes(s.quote.trim()) + '”');
        if (str(s.translation)) { sq.lang = str(s.lang) || 'en'; var st = el('span', 'story__tr', s.translation.trim()); st.lang = 'nl'; sq.appendChild(st); }
        b.appendChild(sq);
      }
      var u = safeUrl(s.url);
      if (u) {
        var a = el('a', 'story__link', 'Lees het hele verhaal');
        a.href = u; extLink(a);
        if (s.title) a.setAttribute('aria-label', 'Lees het hele verhaal: ' + s.title);
        b.appendChild(a);
      }
      k.appendChild(b);
      slide.appendChild(k);
      track.appendChild(slide);
    });
    show('verhalen');

    var prev = $('slider-prev'), next = $('slider-next'), dotsBox = $('slider-dots'), ctrl = $('slider-ctrl');
    var slides = track.children, positions = 1, current = -1;
    function step() { return slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth; }
    function maxScroll() { return track.scrollWidth - track.clientWidth; }
    function go(i) {
      i = Math.max(0, Math.min(positions - 1, i));
      var target = i === positions - 1 ? maxScroll() : i * step();
      track.scrollTo({ left: target, behavior: smooth() });
    }
    function idx() { return maxScroll() - track.scrollLeft < 4 ? positions - 1 : Math.round(track.scrollLeft / step()); }
    function buildDots() {
      var visible = Math.max(1, Math.round((track.clientWidth + 1) / step()));
      var p = Math.max(1, n - visible + 1);
      if (maxScroll() < 4) p = 1;
      if (p === positions && dotsBox.children.length) return;
      positions = p; current = -1;
      dotsBox.innerHTML = '';
      var hide = positions < 2;
      dotsBox.hidden = hide; if (ctrl) ctrl.style.visibility = hide ? 'hidden' : '';
      for (var i = 0; i < positions; i++) {
        var d = el('button', 'slider__dot');
        d.type = 'button';
        d.setAttribute('aria-label', 'Ga naar verhaal ' + (i + 1));
        d.addEventListener('click', go.bind(null, i));
        dotsBox.appendChild(d);
      }
      sync();
    }
    function sync() {
      var i = idx();
      if (i === current) return;
      current = i;
      Array.prototype.forEach.call(dotsBox.children, function (d, j) { d.setAttribute('aria-current', j === i ? 'true' : 'false'); });
      prev.disabled = i <= 0; next.disabled = i >= positions - 1;
    }
    var raf = 0;
    track.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; sync(); }); }, { passive: true });
    prev.addEventListener('click', function () { go(idx() - 1); });
    next.addEventListener('click', function () { go(idx() + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.target !== track) return;
      var map = { ArrowRight: idx() + 1, ArrowLeft: idx() - 1, Home: 0, End: positions - 1 };
      if (e.key in map) { e.preventDefault(); go(map[e.key]); }
    });
    window.addEventListener('resize', function () { buildDots(); sync(); });
    buildDots();
  }

  /* ---------- Instagram ---------- */
  function renderInstagram(c) {
    var box = $('ig-list');
    if (!box) return;
    var ig = arr(c.instagram);
    if (!ig) return;
    var count = 0;
    ig.forEach(function (p, i) {
      if (!p) return;
      var src = safeUrl(p.img), u = safeUrl(p.url) || 'https://www.instagram.com/brackesam/';
      if (!src) return;
      var a = el('a'); a.href = u; extLink(a);
      a.setAttribute('aria-label', 'Instagram-post ' + (i + 1) + ' van Sam openen (nieuw venster)');
      var img = el('img'); img.src = src; img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
      img.onerror = function () { a.remove(); };
      a.appendChild(img); box.appendChild(a); count++;
    });
    if (count) show('instagram');
  }

  /* ---------- Jaarkalender met popover ---------- */
  function raceIndex(c) {
    var list = [];
    (arr(c.timeline) || []).forEach(function (t) { if (t && str(t.date) && str(t.title)) list.push({ date: t.date, title: t.title, prio: 0 }); });
    (arr(c.stories) || []).forEach(function (s) { if (s && str(s.date) && str(s.title)) list.push({ date: s.date, title: s.title, prio: 1 }); });
    list.sort(function (a, b) { return a.prio - b.prio; });
    return function (iso, km) {
      var t = Date.parse(iso + 'T12:00:00Z'), hit = null;
      list.forEach(function (r) {
        if (hit) return;
        var dt = (t - Date.parse(r.date + 'T12:00:00Z')) / 864e5;
        if (dt === 0 || (km >= 40 && dt > 0 && dt <= 4)) hit = r.title;
      });
      return hit;
    };
  }

  function renderHeatmap(strava, c) {
    var grid = $('heat-grid');
    if (!grid) return;
    var days = arr(strava.days);
    if (!days) return;
    var map = {};
    days.forEach(function (d) { if (d && d.date) map[d.date] = Number(d.km) || 0; });
    var last = days[days.length - 1].date;
    var year = Number(last.slice(0, 4));
    var raceOf = raceIndex(c);
    // drempels: gewone trainingsdagen vullen 1-3, racedagen springen eruit
    function level(km) { if (!km) return 0; if (km < 12) return 1; if (km < 22) return 2; if (km < 40) return 3; return 4; }

    var months = $('heat-months');
    var jan1 = new Date(Date.UTC(year, 0, 1));
    var offset = (jan1.getUTCDay() + 6) % 7; // maandag = 0
    var frag = document.createDocumentFragment();
    for (var i = 0; i < offset; i++) frag.appendChild(el('span', 'day day--blank'));
    var d = new Date(jan1), monthCols = {}, idx = offset, buttons = [];
    while (d.getUTCFullYear() === year) {
      var iso = d.toISOString().slice(0, 10);
      var col = Math.floor(idx / 7);
      if (monthCols[d.getUTCMonth()] === undefined) monthCols[d.getUTCMonth()] = col;
      if (iso <= last) {
        var km = map[iso] || 0;
        var race = km > 0 ? raceOf(iso, km) : null;
        var b = el('button', 'day');
        b.type = 'button'; b.tabIndex = -1;
        b.setAttribute('data-l', level(km));
        b.setAttribute('data-date', iso);
        b.setAttribute('data-km', km);
        if (race) b.setAttribute('data-race', race);
        b.setAttribute('aria-label', fmtDate(iso) + ': ' + (km ? nf1.format(km) + ' km' : 'rustdag') + (race ? ', ' + race : ''));
        frag.appendChild(b); buttons.push(b);
      } else {
        var f = el('span', 'day day--future');
        f.setAttribute('aria-hidden', 'true');
        frag.appendChild(f);
      }
      d.setUTCDate(d.getUTCDate() + 1); idx++;
    }
    grid.appendChild(frag);
    Object.keys(monthCols).forEach(function (m) {
      var s = el('span', null, MONTHS[m]);
      s.style.gridColumn = (monthCols[m] + 1) + ' / span 4';
      s.style.gridRow = '1';
      months.appendChild(s);
    });
    if (!buttons.length) return;
    var roving = buttons[buttons.length - 1];
    roving.tabIndex = 0;

    var wrap = $('heat-wrap'), heat = $('heat'), pop = $('heat-pop');
    var active = null, pinned = null;
    function place(btn) {
      var wr = wrap.getBoundingClientRect(), br = btn.getBoundingClientRect();
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      var cx = br.left + br.width / 2 - wr.left;
      var left = Math.max(0, Math.min(wr.width - pw, cx - pw / 2));
      var below = br.top - ph - 12 < 70; // te weinig plek boven (topbar)
      var top = below ? br.bottom - wr.top + 10 : br.top - wr.top - ph - 10;
      pop.classList.toggle('is-below', below);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
      pop.style.setProperty('--arrow-x', Math.max(10, Math.min(pw - 10, cx - left)) + 'px');
    }
    function open(btn) {
      if (active && active !== btn) active.classList.remove('is-active');
      active = btn; btn.classList.add('is-active');
      var km = Number(btn.getAttribute('data-km')), race = btn.getAttribute('data-race');
      pop.innerHTML = '';
      pop.appendChild(el('span', 'pop__date', fmtDate(btn.getAttribute('data-date'))));
      pop.appendChild(el('span', 'pop__km', km ? nf1.format(km) + ' km' : 'Rustdag'));
      if (race) pop.appendChild(el('span', 'pop__race', race));
      pop.hidden = false;
      place(btn);
    }
    function close() {
      pop.hidden = true; pinned = null;
      if (active) { active.classList.remove('is-active'); active = null; }
    }
    function setRoving(btn) { if (roving !== btn) { roving.tabIndex = -1; btn.tabIndex = 0; roving = btn; } }
    function dayBtn(t) { return t && t.closest ? t.closest('button.day') : null; }

    grid.addEventListener('click', function (e) {
      var t = dayBtn(e.target); if (!t) return;
      if (pinned === t) { close(); return; }
      setRoving(t); open(t); pinned = t;
    });
    grid.addEventListener('mouseover', function (e) { var t = dayBtn(e.target); if (t) open(t); });
    grid.addEventListener('mouseleave', function () { if (pinned) open(pinned); else close(); });
    grid.addEventListener('focusin', function (e) { var t = dayBtn(e.target); if (t) { setRoving(t); open(t); } });
    grid.addEventListener('focusout', function (e) { if (!grid.contains(e.relatedTarget)) close(); });
    grid.addEventListener('keydown', function (e) {
      var t = dayBtn(e.target); if (!t) return;
      var i = buttons.indexOf(t), j = i;
      if (e.key === 'ArrowDown') j = i + 1; else if (e.key === 'ArrowUp') j = i - 1;
      else if (e.key === 'ArrowRight') j = i + 7; else if (e.key === 'ArrowLeft') j = i - 7;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = buttons.length - 1;
      else if (e.key === 'Escape') { close(); return; }
      else return;
      e.preventDefault();
      j = Math.max(0, Math.min(buttons.length - 1, j));
      buttons[j].focus({ preventScroll: false });
    });
    document.addEventListener('click', function (e) { if (!pop.hidden && !grid.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) close(); });
    heat.addEventListener('scroll', function () { if (active) { if (pinned || document.activeElement === active) place(active); else close(); } }, { passive: true });
    window.addEventListener('resize', function () { if (active) place(active); });

    show('kalender');
    // op mobiel: naar de meest recente weken scrollen
    requestAnimationFrame(function () {
      var lastBtn = buttons[buttons.length - 1];
      if (heat.scrollWidth > heat.clientWidth) heat.scrollLeft = Math.max(0, lastBtn.offsetLeft - heat.clientWidth + 60);
    });
  }

  /* ---------- Dit jaar gelopen ---------- */
  function renderYear(strava, c) {
    if (!$('tellers')) return;
    var days = arr(strava.days);
    var km = strava.year && Number(strava.year.km);
    if (!km && days) km = days.reduce(function (s, x) { return s + (Number(x.km) || 0); }, 0);
    if (!km) return;
    var totalEl = $('km-total');
    totalEl.textContent = nf0.format(km);
    totalEl.setAttribute('data-to', km);

    var subBits = [];
    if (days) {
      var runDays = days.filter(function (x) { return Number(x.km) > 0; }).length;
      subBits.push(runDays + ' loopdagen');
      var lastD = days[days.length - 1].date;
      subBits.push('1 jan t/m ' + fmtDate(lastD));
    }
    $('km-sub').textContent = subBits.join(' · ');

    // per maand
    var list = $('months');
    if (days) {
      var tot = {}, maxM = 0, lastMonth = Number(days[days.length - 1].date.slice(5, 7)) - 1;
      days.forEach(function (x) { if (x && x.date) { var m = Number(x.date.slice(5, 7)) - 1; tot[m] = (tot[m] || 0) + (Number(x.km) || 0); } });
      for (var m = 0; m <= lastMonth; m++) if ((tot[m] || 0) > maxM) maxM = tot[m];
      for (m = 0; m <= lastMonth; m++) {
        var v = tot[m] || 0;
        var li = el('li', 'month' + (v === maxM && maxM > 0 ? ' month--max' : ''));
        li.appendChild(el('span', 'month__lbl', MONTHS[m]));
        var bar = el('span', 'month__bar'); var fill = el('i');
        fill.style.setProperty('--w', (maxM ? v / maxM * 100 : 0).toFixed(1) + '%');
        bar.appendChild(fill); bar.setAttribute('aria-hidden', 'true');
        li.appendChild(bar);
        li.appendChild(el('span', 'month__val', nf0.format(v) + ' km'));
        li.setAttribute('aria-label', MONTHS_LONG[m] + ': ' + nf0.format(v) + ' km' + (m === lastMonth ? ' (lopende maand)' : ''));
        list.appendChild(li);
      }
    } else list.hidden = true;

    var cmp = Object.assign({}, DEFAULTS, c.comparisons || {});
    var rows = [
      ['Stappen', '≈ ' + nf1.format(km * cmp.stepsPerKm / 1e6) + ' miljoen'],
      ['Antwerpen–Amsterdam (' + nf0.format(cmp.antwerpAmsterdamKm) + ' km)', nf0.format(Math.floor(km / cmp.antwerpAmsterdamKm)) + ' keer'],
      ['Het Pieterpad (' + nf0.format(cmp.pieterpadKm) + ' km)', nf0.format(Math.floor(km / cmp.pieterpadKm)) + ' keer'],
      ['Versleten schoenen (± ' + nf0.format(cmp.shoeKm) + ' km per paar)', nf0.format(Math.round(km / cmp.shoeKm)) + ' paar']
    ];
    var ul = $('compare');
    rows.forEach(function (r) { var li = el('li'); li.appendChild(el('span', null, r[0])); li.appendChild(el('b', null, r[1])); ul.appendChild(li); });
    var at = strava.allTime, atKm = at && Number(at.km), EARTH = 40075;
    if (atKm > 0 && $('alltime')) {
      var laps = atKm / EARTH;
      var cmpTxt = laps >= 2 ? 'meer dan ' + Math.floor(laps) + ' keer rond de aarde' : laps >= 1 ? 'meer dan één keer rond de aarde' : nf0.format(laps * 100) + '% van een rondje om de aarde';
      $('alltime').textContent = 'Sinds hij op Strava zit: ' + nf0.format(Math.round(atKm)) + ' km, ' + cmpTxt + ' (' + nf0.format(EARTH) + ' km).';
      show('alltime');
    }
    show('tellers');
    if ($('compare') && $('compare').children.length) show('km-extra');

    // bij in beeld komen: teller optellen + balkjes groeien
    if (mqReduce.matches || !('IntersectionObserver' in window)) return;
    list.classList.add('is-pre');
    totalEl.textContent = '0';
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (en) { return en.isIntersecting; })) return;
      io.disconnect();
      requestAnimationFrame(function () { list.classList.remove('is-pre'); });
      var t0 = performance.now(), dur = 1400;
      (function stepFn(t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        totalEl.textContent = nf0.format(Math.round(km * e));
        if (p < 1) requestAnimationFrame(stepFn);
      })(t0);
    }, { threshold: 0.25 });
    io.observe($('tellers'));
  }

  /* ---------- Strava-embed (officieel formaat) ---------- */
  function renderStravaEmbed(c) {
    var box = $('strava-box');
    if (!box) return;
    var list = (arr(c.stravaEmbeds) || (c.stravaEmbed ? [c.stravaEmbed] : [])).filter(function (e) {
      return e && /^\d+$/.test(String(e.id || '')) && /^[\w-]+$/.test(String(e.token || ''));
    });
    if (!list.length) return;
    var lead = $('strava-lead');
    if (lead) lead.textContent = list.length > 1 ? 'Kies een race en loop mee over de route.' : (str(list[0].title) || list[0].label || '');
    var tabs = el('div', 'strava-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Races op Strava');
    var frame = el('div', 'strava-frame');
    frame.setAttribute('role', 'tabpanel');
    function load(i) {
      var e = list[i];
      Array.prototype.forEach.call(tabs.children, function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
      frame.innerHTML = '';
      var ph = el('div', 'strava-embed-placeholder');
      ph.setAttribute('data-embed-type', 'activity');
      ph.setAttribute('data-embed-id', String(e.id));
      ph.setAttribute('data-style', 'standard');
      ph.setAttribute('data-from-embed', 'false');
      ph.setAttribute('data-token', String(e.token));
      frame.appendChild(ph);
      var old = document.getElementById('strava-embed-js');
      if (old) old.remove();
      var sc = document.createElement('script');
      sc.id = 'strava-embed-js';
      sc.src = 'https://strava-embeds.com/embed.js' + (old ? '?r=' + Date.now() : '');
      sc.async = true;
      document.body.appendChild(sc);
    }
    if (list.length > 1) {
      list.forEach(function (e, i) {
        var b = el('button', 'strava-tab');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.appendChild(el('strong', null, e.label || ('Race ' + (i + 1))));
        if (str(e.sub)) b.appendChild(el('span', null, e.sub));
        b.addEventListener('click', function () { load(i); });
        b.addEventListener('keydown', function (ev) {
          var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          ev.preventDefault();
          var j = (i + d + list.length) % list.length;
          load(j); tabs.children[j].focus();
        });
        tabs.appendChild(b);
      });
      box.appendChild(tabs);
    }
    box.appendChild(frame);
    show('strava');
    load(0);
  }

  function renderFacts(c) {
    var ul = $('facts-list');
    if (!ul) return;
    var facts = arr(c.funFacts);
    if (!facts) return;
    facts.forEach(function (f) {
      var t = typeof f === 'string' ? f : f && f.text;
      if (str(t)) ul.appendChild(el('li', null, t.trim()));
    });
    if (ul.children.length) show('funfacts');
  }

  /* ---------- Pitch / Waarom Sam / Records / Tijdlijn ---------- */
  function renderPitch(c) { if ($('pitch') && str(c.pitch)) $('pitch').textContent = c.pitch.trim(); }

  function renderImpact(c) {
    var box = $('impact-list');
    if (box) {
      var impact = arr(c.impact);
      if (impact) {
        impact.forEach(function (i) {
          if (!i || !i.value) return;
          var d = el('div', 'impact__item');
          var v = el('span', 'impact__value'), mm = /^(\S+)\s+(km|uur)$/.exec(String(i.value).trim());
          if (mm) { v.appendChild(document.createTextNode(mm[1] + '\u00a0')); v.appendChild(el('small', null, mm[2])); }
          else v.textContent = i.value;
          d.appendChild(v);
          if (i.label) d.appendChild(el('span', 'impact__label', i.label));
          box.appendChild(d);
        });
        if (box.children.length) show('bereik');
      }
    }
    var pl = $('press-list');
    if (pl && renderPress(pl, c)) show('press-wrap');
  }

  /* ---------- Bekend van: organisator + perslogo's ---------- */
  function renderPress(box, c) {
    var count = 0, org = c.organizer;
    if (org && str(org.name)) {
      var ou = safeUrl(org.url), oa = el(ou ? 'a' : 'div', 'known__org');
      if (ou) { oa.href = ou; extLink(oa); }
      var seal = safeUrl(org.logo);
      if (seal) { var si = el('img', 'known__seal'); si.src = seal; si.alt = ''; si.decoding = 'async'; si.onerror = function () { si.remove(); }; oa.appendChild(si); }
      var ot = el('span', 'known__org-txt');
      ot.appendChild(el('strong', null, org.name.trim()));
      if (str(org.label)) ot.appendChild(el('span', null, org.label.trim()));
      oa.appendChild(ot);
      box.appendChild(oa); count++;
    }
    var press = arr(c.press);
    if (press) {
      var ul = el('ul', 'logos');
      press.forEach(function (p) {
        if (!p || !str(p.name)) return;
        var li = el('li'), u = safeUrl(p.url), name = p.name.trim();
        var a = el(u ? 'a' : 'span', 'logos__item');
        if (u) { a.href = u; extLink(a); }
        var src = safeUrl(p.logo), r = Number(p.logoRatio);
        function asText() { a.innerHTML = ''; a.classList.add('logos__item--txt'); a.textContent = name; }
        if (src) {
          var im = el('img'); im.src = src; im.alt = str(p.logoAlt) || name; im.decoding = 'async'; im.loading = 'lazy';
          if (r > 0) {
            // optisch gelijke hoogte: brede woordmerken iets lager, compacte logo's iets hoger
            var sc = Number(p.logoScale) > 0 ? Number(p.logoScale) : 1;
            a.style.setProperty('--f', (Math.max(.8, Math.min(1.25, Math.pow(4.2 / r, .3))) * sc).toFixed(3));
            a.style.setProperty('--r', r);
          }
          im.onerror = asText;
          a.appendChild(im);
        } else asText();
        if (u) a.setAttribute('title', name);
        li.appendChild(a); ul.appendChild(li); count++;
      });
      if (ul.children.length) box.appendChild(ul);
    }
    return count;
  }

  /* ---------- Wat anderen zeggen ---------- */
  function quoteCard(t, full) {
    var fig = el('figure', 'tq');
    var bq = el('blockquote', 'tq__quote', '“' + stripQuotes(t.quote.trim()) + '”');
    if (str(t.lang)) bq.lang = t.lang.trim();
    else if (str(t.translation)) bq.lang = 'fr';
    fig.appendChild(bq);
    if (str(t.translation)) fig.appendChild(el('p', 'tq__tr', 'Vertaald: ' + t.translation.trim()));
    var cap = el('figcaption', 'tq__who');
    cap.appendChild(el('strong', null, str(t.who) || str(t.source) || ''));
    var u = safeUrl(t.url);
    if (u) {
      var lbl = full && str(t.sourceNote) ? t.sourceNote.trim() : (str(t.source) && t.source !== t.who) ? t.source : 'Lees het artikel';
      var a = el('a', 'tq__src', lbl);
      a.href = u; extLink(a);
      cap.appendChild(a);
    } else if (str(t.source) && t.source !== t.who) cap.appendChild(el('span', 'tq__src', t.source));
    fig.appendChild(cap);
    return fig;
  }

  function renderTestimonials(c) {
    var list = (arr(c.testimonials) || []).filter(function (t) { return t && str(t.quote) && (str(t.who) || str(t.source)); });
    var box = $('tq-list');
    if (box && list.length) {
      list.forEach(function (t) { box.appendChild(quoteCard(t, true)); });
      show('anderen');
    }
    var home = $('tq-home');
    if (home && list.length) {
      var picks = list.filter(function (t) { return t.home === true; });
      if (!picks.length) picks = list;
      picks.slice(0, 3).forEach(function (t) { home.appendChild(quoteCard(t)); });
      var known = $('tq-known');
      if (known && renderPress(known, c)) known.hidden = false;
      show('anderen-home');
    }
  }

  function renderPrs(c) {
    var box = $('prs-list');
    if (!box) return;
    var prs = arr(c.prs);
    if (!prs) return;
    prs.forEach(function (p) {
      if (!p) return;
      var k = el('div', 'card');
      if (p.label) k.appendChild(el('h3', 'card__label', p.label));
      if (p.value) k.appendChild(el('p', 'card__value', p.value));
      if (p.detail) k.appendChild(el('p', 'card__detail', p.detail));
      box.appendChild(k);
    });
    show('prs');
  }

  function renderTimeline(c) {
    var ol = $('timeline');
    if (!ol) return;
    var tl = arr(c.timeline);
    if (!tl) return;
    tl.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }).forEach(function (t) {
      if (!t) return;
      var li = el('li');
      if (t.date) { var tm = el('time', null, fmtDate(t.date)); tm.dateTime = t.date; li.appendChild(tm); }
      if (t.title) li.appendChild(el('strong', null, t.title));
      if (t.detail) li.appendChild(el('span', null, t.detail));
      ol.appendChild(li);
    });
    show('tijdlijn');
  }
})();
