/* Something Ventured — interactions. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduceMotion = mq('(prefers-reduced-motion: reduce)');

  /* ---------- Opening countdown (Library, Hangzhou — 2026.12.15, UTC+8) ---------- */
  var OPENING = Date.parse('2026-12-15T00:00:00+08:00');
  function updateCountdown() {
    var days = Math.ceil((OPENING - Date.now()) / 86400000);
    $$('[data-countdown]').forEach(function (el) {
      if (days > 0) {
        el.setAttribute('data-state', 'before');
        var d = $('[data-days]', el);
        if (d) d.textContent = String(days);
      } else {
        el.setAttribute('data-state', 'open');
      }
    });
  }
  updateCountdown();
  setInterval(updateCountdown, 60 * 60 * 1000);

  /* ---------- Reveal on scroll ---------- */
  var targets = $$('.reveal, [data-inview]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Folded building (scroll-driven) ---------- */
  var fold = (function () {
    var section = $('.fold');
    if (!section || reduceMotion || !('CSS' in window && CSS.supports && CSS.supports('container-type: inline-size'))) return null;

    var track = $('.fold__track', section);
    var stage = $('.fold__stage', section);
    var units = $$('.unit', stage);
    var steps = $$('.fold__step', section);
    var roof = $('.fold__roof', section);
    var glStreet = $('.fold__gl--street', section);
    var glBldg = $('.fold__gl--bldg', section);
    if (!track || !stage || units.length !== 3) return null;

    section.classList.add('is-live');

    var W = 0, uw = 0, uh = 0, lastStep = -1;
    // Which unit moves first: 2F rises, then 3F swings over, then 1F slides in underneath.
    var START = { 1: 0.3, 2: 0, 3: 0.15 };
    var SPAN = 0.7;
    var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

    function measure() {
      W = stage.clientWidth;
      uw = units[0].offsetWidth;
      uh = units[0].offsetHeight;
    }

    function render(t) {
      units.forEach(function (u) {
        var street = +u.getAttribute('data-street');
        var floor = +u.getAttribute('data-floor');
        var lt = clamp((t - START[floor]) / SPAN, 0, 1);
        var sx = street * (W - uw) / 2;
        var fx = (W - uw) / 2;
        var x = sx + (fx - sx) * easeInOut(lt);
        var y = (floor - 1) * uh * easeOut(lt);
        var tilt = street === 2 ? -7 : street === 0 ? 5 : 0;
        var r = Math.sin(lt * Math.PI) * tilt;
        u.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (-y).toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg)';
      });
      roof.style.opacity = clamp((t - 0.86) / 0.14, 0, 1).toFixed(3);
      glStreet.style.opacity = (1 - clamp(t / 0.15, 0, 1)).toFixed(3);
      glBldg.style.opacity = clamp((t - 0.86) / 0.14, 0, 1).toFixed(3);

      var s = t < 0.12 ? 0 : t < 0.86 ? 1 : 2;
      if (s !== lastStep) {
        steps.forEach(function (el, i) { el.classList.toggle('is-active', i === s); });
        lastStep = s;
      }
    }

    function update() {
      var rect = track.getBoundingClientRect();
      var total = track.offsetHeight - window.innerHeight;
      var p = total > 0 ? clamp(-rect.top / total, 0, 1) : 1;
      render(clamp((p - 0.1) / 0.75, 0, 1));
    }

    measure();
    update();
    window.addEventListener('resize', function () { measure(); update(); });
    return { update: update };
  })();

  /* ---------- Nav state, progress bar ---------- */
  var nav = $('.nav');
  var bar = $('.progress span');
  var hero = $('.hero');
  var ticking = false;

  function onFrame() {
    ticking = false;
    var y = window.pageYOffset || root.scrollTop;
    var max = root.scrollHeight - window.innerHeight;
    if (nav && hero) nav.classList.toggle('is-solid', y > hero.offsetHeight * 0.45);
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4) + ')';
    if (fold) fold.update();
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onFrame); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onFrame();

  /* ---------- Library: day / night ---------- */
  var lib = $('#library');
  if (lib) {
    var modeBtns = $$('[data-mode-btn]', lib);
    modeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        lib.setAttribute('data-mode', btn.getAttribute('data-mode-btn'));
        modeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      });
    });
  }

  /* ---------- Apply form + live member card ---------- */
  var form = $('#apply-form');
  if (form) {
    var applySection = $('#apply');
    var cardName = $('[data-card-name]');
    var cardSector = $('[data-card-sector]');
    var cardBase = $('[data-card-base]');
    var cardLead = $('[data-card-lead]');
    var defaults = {
      name: cardName.textContent,
      sector: cardSector.textContent,
      base: cardBase.textContent
    };
    var errBox = $('.sheet__err', form);
    var done = $('.sheet__done', form);
    var submitBtn = $('button[type="submit"]', form);

    var val = function (name) {
      var el = form.elements[name];
      if (!el) return '';
      if (el.length !== undefined && !el.tagName) { // RadioNodeList
        var checked = form.querySelector('input[name="' + name + '"]:checked');
        return checked ? checked.value : '';
      }
      return (el.value || '').trim();
    };

    function syncCard() {
      cardName.textContent = val('name') || defaults.name;
      cardSector.textContent = val('sector') || defaults.sector;
      cardBase.textContent = val('base') || defaults.base;
      var lead = val('lead');
      cardLead.hidden = !lead;
      $('span', cardLead).textContent = lead;
    }
    form.addEventListener('input', syncCard);
    form.addEventListener('change', syncCard);

    function markField(el, ok) {
      var field = el.closest('.field');
      if (field) field.classList.toggle('is-invalid', !ok);
      if (el.setAttribute) el.setAttribute('aria-invalid', String(!ok));
    }

    function validate() {
      var firstBad = null;
      ['name', 'venture', 'contact'].forEach(function (n) {
        var el = form.elements[n];
        var ok = val(n).length > 0;
        markField(el, ok);
        if (!ok && !firstBad) firstBad = el;
      });
      var sectorGroup = $('[aria-labelledby="g-sector"]', form);
      var sectorOk = !!val('sector');
      sectorGroup.classList.toggle('is-invalid', !sectorOk);
      if (!sectorOk && !firstBad) firstBad = $('input[name="sector"]', form);
      return firstBad;
    }

    // clear the error state as soon as a field is fixed
    form.addEventListener('input', function (e) {
      var field = e.target.closest && e.target.closest('.field.is-invalid');
      if (field && (e.target.value || '').trim()) {
        field.classList.remove('is-invalid');
        e.target.setAttribute('aria-invalid', 'false');
      }
    });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'sector') {
        var g = e.target.closest('.field');
        if (g) g.classList.remove('is-invalid');
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (val('company_website')) return; // honeypot

      var bad = validate();
      if (bad) {
        errBox.textContent = '请补全标 * 的信息。';
        bad.focus();
        return;
      }
      errBox.textContent = '';

      var payload = {
        name: val('name'),
        venture: val('venture'),
        sector: val('sector'),
        base: val('base'),
        lead: val('lead'),
        contact: val('contact'),
        thesis: val('thesis'),
        submitted_at: new Date().toISOString(),
        page: location.href
      };

      var endpoint = (form.getAttribute('data-endpoint') || '').trim();
      submitBtn.disabled = true;

      var request = endpoint
        ? fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); })
        : new Promise(function (resolve) {
            // Demo mode: no endpoint configured, nothing is sent anywhere.
            if (window.console) console.info('[Something Ventured] data-endpoint is empty; application not sent.', payload);
            setTimeout(resolve, 650);
          });

      request.then(function () {
        form.classList.add('is-sent');
        if (applySection) applySection.classList.add('is-sent');
        done.focus({ preventScroll: true });
        var r = done.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) {
          done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
      }).catch(function () {
        errBox.textContent = '提交没有成功，请稍后再试。';
      }).then(function () {
        submitBtn.disabled = false;
      });
    });
  }

  /* ---------- Member card tilt ---------- */
  var tilt = $('[data-tilt]');
  if (tilt && !reduceMotion && mq('(hover: hover) and (pointer: fine)')) {
    var inner = $('.mcard__inner', tilt);
    tilt.addEventListener('pointermove', function (e) {
      var r = tilt.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      inner.style.setProperty('--ry', (px * 14).toFixed(2) + 'deg');
      inner.style.setProperty('--rx', (-py * 10).toFixed(2) + 'deg');
      inner.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%');
      inner.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
    });
    tilt.addEventListener('pointerleave', function () {
      inner.style.setProperty('--rx', '0deg');
      inner.style.setProperty('--ry', '0deg');
    });
  }
})();
