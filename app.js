/* Sam Bracke: rendert alles uit data/strava.json en data/content.json.
   Ontbrekende data = sectie blijft verborgen. Test-overrides: ?content=pad&strava=pad */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var CONTENT_URL = safePath(params.get('content')) || 'data/content.json';
  var STRAVA_URL = safePath(params.get('strava')) || 'data/strava.json';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf0 = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
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
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function fmtDate(iso, withYear) {
    var d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear === false ? '' : ' ' + d.getFullYear());
  }
  function extLink(a) { if (/^https?:/i.test(a.href)) { a.target = '_blank'; a.rel = 'noopener'; } return a; }

  // Hero-foto: alleen gebruiken als hij echt laadt, anders blijft de gradient staan
  var heroImg = new Image();
  heroImg.onload = function () { document.querySelector('.hero').style.setProperty('--hero-img', 'url("img/hero.jpg")'); };
  heroImg.src = 'img/hero.jpg';

  Promise.all([getJSON(STRAVA_URL), getJSON(CONTENT_URL)]).then(function (res) {
    var strava = res[0] || {}, content = res[1] || {};
    try { renderTimer(strava); } catch (e) { console.warn(e); }
    try { renderHeatmap(strava); } catch (e) { console.warn(e); }
    try { renderCounters(strava, content); } catch (e) { console.warn(e); }
    try { renderContent(content); } catch (e) { console.warn(e); }
    if (strava.sample === false) $('footer-data').textContent = 'Data: Strava';
  });

  /* ---------- 2. Sinds de laatste run ---------- */
  function renderTimer(strava) {
    var lr = strava.lastRun;
    if (!lr || !lr.end || isNaN(new Date(lr.end))) return;
    var end = new Date(lr.end).getTime();
    var nodes = {};
    document.querySelectorAll('[data-t]').forEach(function (n) { nodes[n.getAttribute('data-t')] = n; });
    var bits = [];
    if (lr.name) bits.push(lr.name);
    if (typeof lr.km === 'number') bits.push(nf1.format(lr.km) + ' km');
    bits.push(fmtDate(lr.end));
    $('lastrun').textContent = 'Laatste run: ' + bits.join(' · ');
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

  /* ---------- 3. Jaarkalender ---------- */
  function renderHeatmap(strava) {
    var days = arr(strava.days);
    if (!days) return;
    var map = {};
    days.forEach(function (d) { if (d && d.date) map[d.date] = Number(d.km) || 0; });
    var year = Number(days[days.length - 1].date.slice(0, 4));
    var last = days[days.length - 1].date;
    var max = 0;
    Object.keys(map).forEach(function (k) { if (map[k] > max) max = map[k]; });
    // drempels: gewone trainingsdagen vullen 1-3, racedagen springen eruit
    function level(km) { if (!km) return 0; if (km < 12) return 1; if (km < 22) return 2; if (km < 40) return 3; return 4; }

    var grid = $('heat-grid'), months = $('heat-months');
    var jan1 = new Date(Date.UTC(year, 0, 1));
    var offset = (jan1.getUTCDay() + 6) % 7; // maandag = 0
    var frag = document.createDocumentFragment();
    for (var i = 0; i < offset; i++) frag.appendChild(el('span', 'day day--blank'));
    var d = new Date(jan1), col, monthCols = {};
    var idx = offset;
    while (d.getUTCFullYear() === year) {
      var iso = d.toISOString().slice(0, 10);
      col = Math.floor(idx / 7);
      if (monthCols[d.getUTCMonth()] === undefined) monthCols[d.getUTCMonth()] = col;
      if (iso <= last) {
        var km = map[iso] || 0;
        var b = el('button', 'day');
        b.type = 'button';
        b.setAttribute('data-l', level(km));
        b.setAttribute('data-date', iso);
        b.setAttribute('data-km', km);
        var lbl = fmtDate(iso) + ': ' + (km ? nf1.format(km) + ' km' : 'rustdag');
        b.setAttribute('aria-label', lbl);
        b.title = lbl;
        frag.appendChild(b);
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
    var info = $('heat-info'), active = null;
    function pick(btn) {
      if (active) active.classList.remove('is-active');
      active = btn; btn.classList.add('is-active');
      var km = Number(btn.getAttribute('data-km'));
      info.textContent = fmtDate(btn.getAttribute('data-date')) + ': ' + (km ? nf1.format(km) + ' km' : 'rustdag');
    }
    grid.addEventListener('click', function (e) { var t = e.target.closest('button.day'); if (t) pick(t); });
    grid.addEventListener('mouseover', function (e) { var t = e.target.closest('button.day'); if (t) pick(t); });
    grid.addEventListener('focusin', function (e) { var t = e.target.closest('button.day'); if (t) pick(t); });

    var total = days.reduce(function (s, x) { return s + (Number(x.km) || 0); }, 0);
    var runDays = days.filter(function (x) { return x.km > 0; }).length;
    $('kal-sum').textContent = nf0.format(total) + ' km · ' + runDays + ' loopdagen · ' + year;
    show('kalender');
    // op mobiel: scroll naar de meest recente weken
    var heat = document.querySelector('.heat');
    requestAnimationFrame(function () {
      var lastBtn = grid.querySelector('button.day:last-of-type');
      if (lastBtn && heat.scrollWidth > heat.clientWidth) heat.scrollLeft = Math.max(0, lastBtn.offsetLeft - heat.clientWidth + 60);
    });
  }

  /* ---------- 4. Tellers ---------- */
  function renderCounters(strava, content) {
    var km = strava.year && Number(strava.year.km);
    if (!km && arr(strava.days)) km = strava.days.reduce(function (s, x) { return s + (Number(x.km) || 0); }, 0);
    if (!km) return;
    var c = Object.assign({}, DEFAULTS, content.comparisons || {});
    var items = [
      { v: km, dec: 0, lbl: 'kilometer gelopen in ' + (arr(strava.days) ? strava.days[0].date.slice(0, 4) : 'dit jaar'), wide: true },
      { v: km * c.stepsPerKm / 1e6, dec: 1, suffix: ' mln', lbl: 'stappen (± ' + nf0.format(c.stepsPerKm) + ' per km)' },
      { v: km / c.antwerpAmsterdamKm, dec: 1, lbl: '× Antwerpen–Amsterdam (' + nf0.format(c.antwerpAmsterdamKm) + ' km)' },
      { v: km / c.pieterpadKm, dec: 1, lbl: '× het Pieterpad (' + nf0.format(c.pieterpadKm) + ' km)' },
      { v: km / c.shoeKm, dec: 1, lbl: 'paar schoenen versleten (' + nf0.format(c.shoeKm) + ' km per paar)' }
    ];
    var box = $('stats');
    items.forEach(function (it) {
      var s = el('div', 'stat' + (it.wide ? ' stat--wide' : ''));
      var n = el('span', 'stat__num', fmt(it.v, it.dec) + (it.suffix || ''));
      n.setAttribute('data-to', it.v); n.setAttribute('data-dec', it.dec); n.setAttribute('data-suffix', it.suffix || '');
      s.appendChild(n); s.appendChild(el('span', 'stat__lbl', it.lbl));
      box.appendChild(s);
    });
    show('tellers');
    countUp(box.querySelectorAll('.stat__num'));
  }
  function fmt(v, dec) { return dec ? nf1.format(v) : nf0.format(Math.round(v)); }
  function countUp(nodes) {
    if (reduceMotion || !('IntersectionObserver' in window) || !nodes.length) return; // eindwaarden staan er al
    nodes.forEach(function (n) { n.textContent = fmt(0, Number(n.getAttribute('data-dec'))) + n.getAttribute('data-suffix'); });
    function run() {
      var t0 = performance.now(), dur = 1600;
      (function step(t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        nodes.forEach(function (n) { n.textContent = fmt(Number(n.getAttribute('data-to')) * e, Number(n.getAttribute('data-dec'))) + n.getAttribute('data-suffix'); });
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }
    var box = nodes[0].closest('.stats');
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { threshold: 0.2 });
    io.observe(box);
  }

  /* ---------- 5-9. Content ---------- */
  function renderContent(c) {
    if (typeof c.tagline === 'string' && c.tagline.trim()) { var tg = $('hero-tag'); tg.textContent = c.tagline; tg.hidden = false; }
    if (typeof c.pitch === 'string' && c.pitch.trim()) $('pitch').textContent = c.pitch;

    var prs = arr(c.prs);
    if (prs) {
      prs.forEach(function (p) {
        var k = el('div', 'card');
        if (p.label) k.appendChild(el('p', 'card__label', p.label));
        if (p.value) k.appendChild(el('p', 'card__value', p.value));
        if (p.detail) k.appendChild(el('p', 'card__detail', p.detail));
        $('prs-list').appendChild(k);
      });
      show('prs');
    }

    var impact = arr(c.impact), press = arr(c.press);
    if (impact) {
      impact.forEach(function (i) {
        var d = el('div', 'impact__item');
        d.appendChild(el('span', 'impact__value', i.value));
        d.appendChild(el('span', 'impact__label', i.label));
        $('impact-list').appendChild(d);
      });
    }
    if (press) {
      press.forEach(function (p) {
        var li = el('li'), u = safeUrl(p.url);
        if (u) { var a = el('a', null, p.name); a.href = u; li.appendChild(extLink(a)); }
        else li.appendChild(el('span', null, p.name));
        $('press-list').appendChild(li);
      });
      show('press-wrap');
    }
    if (impact || press) show('bereik');

    var stories = arr(c.stories), tl = arr(c.timeline);
    if (stories) {
      stories.forEach(function (s) {
        var k = el('article', 'card story');
        var src = safeUrl(s.img);
        if (src) {
          var img = el('img', 'story__img');
          img.src = src; img.loading = 'lazy'; img.alt = s.imgAlt || ('Foto bij ' + (s.title || 'het verhaal'));
          img.onerror = function () { img.remove(); };
          k.appendChild(img);
        }
        var b = el('div', 'story__body');
        var meta = [s.race, s.date ? fmtDate(s.date) : null].filter(Boolean).join(' · ');
        if (meta) b.appendChild(el('p', 'meta', meta)).style.margin = '0';
        if (s.title) b.appendChild(el('h3', 'story__title', s.title));
        if (s.quote) b.appendChild(el('blockquote', 'story__quote', '“' + s.quote.replace(/^["“]|["”]$/g, '') + '”'));
        var u = safeUrl(s.url);
        if (u) { var a = el('a', 'story__link', 'Lees het hele verhaal'); a.href = u; b.appendChild(extLink(a)); }
        k.appendChild(b);
        $('stories-list').appendChild(k);
      });
    }
    if (tl) {
      tl.forEach(function (t) {
        var li = el('li');
        if (t.date) { var tm = el('time', null, fmtDate(t.date)); tm.dateTime = t.date; li.appendChild(tm); }
        if (t.title) li.appendChild(el('strong', null, t.title));
        if (t.detail) li.appendChild(el('span', null, t.detail));
        $('timeline').appendChild(li);
      });
      show('timeline');
    }
    if (stories || tl) show('verhalen');

    var ig = arr(c.instagram);
    if (ig) {
      var n = 0;
      ig.forEach(function (p, i) {
        var src = safeUrl(p.img), u = safeUrl(p.url) || 'https://www.instagram.com/brackesam/';
        if (!src) return;
        var a = el('a'); a.href = u; extLink(a);
        a.setAttribute('aria-label', 'Instagram-post ' + (i + 1) + ' van Sam openen');
        var img = el('img'); img.src = src; img.loading = 'lazy'; img.alt = p.alt || ('Instagram-foto ' + (i + 1) + ' van Sam Bracke');
        img.onerror = function () { a.remove(); };
        a.appendChild(img); $('ig-list').appendChild(a); n++;
      });
      if (n) show('instagram');
    }
  }
})();
