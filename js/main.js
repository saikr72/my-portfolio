/* ==========================================================================
   main.js — scroll engine, loader, nav, cursor and the hero's DOM layer.
   Classic script. The WebGL scenes live in three-scenes.js (ES module) and
   plug in through window.SITE.
   ========================================================================== */
(function () {
  'use strict';

  const D = window.PORTFOLIO;
  const root = document.documentElement;
  const reduced = root.classList.contains('reduced');
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  const mqMobile = window.matchMedia('(max-width: 760px)');

  /* ---------- helpers ---------- */
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const range = (p, a, b) => clamp01((p - a) / (b - a));
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeIn = t => t * t * t;
  const backOut = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  /* "*word*" in copy -> <em>word</em>. Built with text nodes, never innerHTML. */
  function rich(el, str) {
    el.textContent = '';
    str.split(/(\*[^*]+\*)/).forEach(part => {
      if (!part) return;
      if (part.length > 2 && part[0] === '*' && part[part.length - 1] === '*') el.appendChild(h('em', null, part.slice(1, -1)));
      else el.appendChild(document.createTextNode(part));
    });
    return el;
  }
  const plain = str => str.replace(/\*/g, '');


  const webgl = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  })();

  const SITE = (window.SITE = {
    data: D, reduced, webgl,
    isMobile: () => mqMobile.matches,
    dprCap: () => Math.min(window.devicePixelRatio || 1, mqMobile.matches ? 1.5 : 2)
  });

  /* ==========================================================================
     Static DOM from data
     ========================================================================== */
  /* SAI▍ logo: one inline copy in the loader, cloned wherever else it appears. */
  const logoSrc = $('#logo-src svg');
  $$('[data-logo]').forEach(el => el.appendChild(logoSrc.cloneNode(true)));

  const navList = $('#nav-links');
  const menuList = $('#menu-links');
  D.NAV.forEach((item, i) => {
    const li = h('li');
    const a = h('a', null, item.label);
    a.href = item.href;
    li.appendChild(a);
    navList.appendChild(li);

    const mli = h('li');
    const ma = h('a');
    ma.href = item.href;
    ma.append(h('span', null, String(i + 1).padStart(2, '0')), item.label);
    mli.appendChild(ma);
    menuList.appendChild(mli);
  });

  /* ==========================================================================
     Scroll engine
     ========================================================================== */
  let lenis = null;
  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
    // no automatic refresh on 'load': the page refreshes once, after fonts + loader
    ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,resize' });
    if (!reduced && window.Lenis) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }
  SITE.lenis = lenis;

  /**
   * scrub(trigger, opts, onProgress)
   * Wraps a ScrollTrigger. A per-scene value lerps toward the trigger's
   * progress on the GSAP ticker (factor 0.12 at 60fps, frame-rate corrected),
   * and onProgress(value) only fires when the value moved > 0.0005 — so an
   * idle page does no render work. State must be a pure function of value.
   */
  function scrub(trigger, opts, onProgress) {
    const s = { target: 0, value: 0, last: -1, force: true };
    const st = ScrollTrigger.create(Object.assign({ trigger, start: 'top bottom', end: 'bottom top' }, opts, {
      onUpdate: self => { s.target = self.progress; },
      onRefresh: self => { s.target = self.progress; }
    }));
    s.st = st;
    s.target = s.value = st.progress;
    s.tick = () => {
      const k = 1 - Math.pow(1 - 0.12, gsap.ticker.deltaRatio(60));
      let v = s.value + (s.target - s.value) * k;
      if (Math.abs(s.target - v) < 1e-4) v = s.target;
      s.value = v;
      if (s.force || Math.abs(v - s.last) > 0.0005 || (v === s.target && v !== s.last)) {
        s.force = false;
        s.last = v;
        onProgress(v);
      }
    };
    s.invalidate = () => { s.force = true; };
    s.kill = () => { gsap.ticker.remove(s.tick); st.kill(); };
    gsap.ticker.add(s.tick);
    return s;
  }
  SITE.scrub = scrub;

  /* ==========================================================================
     Loader — gated on fonts + the hero scene's first frame, capped at 4s.
     ========================================================================== */
  const loader = (() => {
    const el = $('#loader');
    const fill = $('.loader-fill', el);
    const countEl = $('#loader-count');
    const msgEl = $('#loader-msg');
    const msgs = D.LOADER.messages;
    const weights = { fonts: 30, three: 25, scene: 25, frame: 20 };
    const done = {};
    const CAP = 4000;
    const t0 = performance.now();
    let shown = 0, finished = false, resolveReady;
    const ready = new Promise(r => (resolveReady = r));

    function target() {
      let t = 0;
      for (const k in done) t += weights[k];
      const elapsed = performance.now() - t0;
      if (elapsed >= CAP) return 100;
      // creep so the counter never sits still while a step is pending
      return Math.max(t, Math.min(88, (elapsed / CAP) * 88));
    }
    function draw() {
      const n = Math.floor(shown);
      countEl.textContent = String(n).padStart(3, '0');
      fill.style.clipPath = 'inset(' + (100 - shown).toFixed(2) + '% 0 0 0)';
      msgEl.textContent = msgs[Math.min(msgs.length - 1, Math.floor((shown / 100.0001) * msgs.length))];
    }
    function tick() {
      const t = target();
      shown += (t - shown) * 0.12 + (t > shown ? 0.25 : 0);
      if (shown > t) shown = t;
      draw();
      if (t >= 100 && shown >= 99.6) { shown = 100; draw(); finish(); }
    }
    function finish() {
      if (finished) return;
      finished = true;
      if (hasGSAP) gsap.ticker.remove(tick);
      const done = () => { el.remove(); };
      if (hasGSAP && !reduced) {
        // the filled SAI▍ blinks its cursor twice, then the loader slides away
        el.classList.add('is-done');
        gsap.to(el, { yPercent: -100, duration: 0.95, ease: 'expo.inOut', delay: 0.8, onStart: resolveReady, onComplete: done });
      } else {
        resolveReady();
        if (hasGSAP) gsap.to(el, { opacity: 0, duration: 0.2, onComplete: done });
        else done();
      }
    }
    draw();
    if (hasGSAP) gsap.ticker.add(tick);
    else finish();

    return {
      ready,
      step(name) { if (weights[name] && !done[name]) done[name] = true; },
      get finished() { return finished; }
    };
  })();
  SITE.loader = loader;

  const fontsReady = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
    .then(() => Promise.all([
      document.fonts.load('900 100px Satoshi'),
      document.fonts.load('italic 400 100px "Instrument Serif"'),
      document.fonts.load('500 12px "JetBrains Mono"')
    ]).catch(() => {}))
    .then(() => loader.step('fonts'));
  if (lenis) { lenis.stop(); loader.ready.then(() => lenis.start()); }

  /* ==========================================================================
     Hero
     ========================================================================== */
  const hero = (() => {
    const P = D.PROFILE;
    const stage = $('#hero-stage');
    const pin = $('#hero-pin');
    const wrap = $('#hero-canvas-wrap');
    const nameEl = $('.hero-name');
    const first = $('#hero-first');
    const last = $('#hero-last');
    const kicker = $('#hero-kicker');
    const cue = $('#hero-cue');
    const fallback = $('#hero-fallback');
    const tagLayer = $('#hero-tags');

    first.textContent = P.first;
    last.textContent = P.last;
    $('#hero-title-text').textContent = P.name + ', ' + P.role;
    kicker.lastElementChild.textContent = P.kicker;

    const layersText = $('#hero-layers-text');
    D.LAYERS.forEach(l => layersText.appendChild(h('li', null, l.label + ' — ' + l.tag)));

    /* Tags: dot + pointer + dark mono pill, one per layer. */
    const tags = D.LAYERS.map(l => {
      const t = h('div', 'tag tag--right');
      t.style.setProperty('--c', l.colour);
      const inner = h('div', 'tag-inner');
      const pill = h('span', 'tag-pill');
      pill.append(l.label, h('small', null, l.tag));
      inner.append(h('span', 'tag-dot'), h('span', 'tag-line'), pill);
      t.appendChild(inner);
      tagLayer.appendChild(t);
      return { el: t, inner, side: 'right', shown: -1 };
    });

    /* Headline + CTAs below the card */
    const headline = rich($('#hero-headline'), P.heroLine);
    $('#hero-sub').textContent = P.sub;
    const stackList = $('#hero-stack');
    P.heroStack.forEach(s => stackList.appendChild(h('li', 'pill', s)));
    const ctas = $('#hero-ctas');
    const cta = (label, href, cls) => {
      const a = h('a', 'btn ' + cls);
      a.href = href;
      a.append(label, h('span', 'arrow', '→'));
      a.lastChild.setAttribute('aria-hidden', 'true');
      return a;
    };
    ctas.append(cta('Explore my work', '#work', 'btn-primary'), cta("Let's talk", '#contact', 'btn-ghost'));
    if (P.links.resume) {
      const r = cta('Download resume', P.links.resume, 'btn-ghost');
      r.setAttribute('download', '');
      ctas.appendChild(r);
    }

    /* Static frame used for reduced motion: exploded, tags shown, full-size stage. */
    const STATIC_P = 0.64;

    let scene = null;
    let fallbackOn = false;
    let progress = reduced ? STATIC_P : 0;
    let driver = null;      // scrub handle
    let flyDist = 0;
    let laidOut = false;

    /* ---- fallback (no WebGL): styled static SVG of the exploded stack ---- */
    function buildFallback() {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 640 620');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Exploded diagram of the stack: ' + D.LAYERS.map(l => l.label).join(', '));
      const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
      const cx = 230, hw = 150, hd = 46, th = 16, step = 70, y0 = 60;
      D.LAYERS.forEach((l, i) => {
        const y = y0 + i * step;
        const g = mk('g', {});
        g.append(
          mk('polygon', { points: `${cx - hw},${y} ${cx},${y + hd} ${cx},${y + hd + th} ${cx - hw},${y + th}`, fill: '#0f1216' }),
          mk('polygon', { points: `${cx},${y + hd} ${cx + hw},${y} ${cx + hw},${y + th} ${cx},${y + hd + th}`, fill: '#14181e' }),
          mk('polygon', { points: `${cx},${y - hd} ${cx + hw},${y} ${cx},${y + hd} ${cx - hw},${y}`, fill: '#1b1f26', stroke: 'rgba(245,247,250,.12)' }),
          mk('polyline', { points: `${cx - hw},${y + th * 0.45} ${cx},${y + hd + th * 0.45} ${cx + hw},${y + th * 0.45}`, fill: 'none', stroke: l.colour, 'stroke-width': 1.6 })
        );
        if (i < D.LAYERS.length - 1) {
          g.appendChild(mk('circle', { cx: cx + (i % 2 ? -40 : 34), cy: y + hd + th + 12, r: 3, fill: i % 3 ? '#4F8EF7' : '#3F8C67' }));
        }
        const tx = cx + hw + 26;
        g.append(
          mk('line', { x1: cx + hw + 4, y1: y + 8, x2: tx - 6, y2: y + 8, stroke: l.colour, 'stroke-width': 1 }),
          mk('circle', { cx: cx + hw + 4, cy: y + 8, r: 3.5, fill: l.colour })
        );
        const label = mk('text', { x: tx, y: y + 12, fill: '#F5F7FA', 'font-family': 'JetBrains Mono, monospace', 'font-size': 13 });
        label.textContent = l.label;
        const tag = mk('tspan', { fill: '#5B6472' });
        tag.textContent = '  / ' + l.tag;
        label.appendChild(tag);
        g.appendChild(label);
        svg.appendChild(g);
      });
      fallback.appendChild(svg);
      fallback.appendChild(h('p', null, '3D view unavailable on this device — showing a static diagram of the stack.'));
    }
    function showFallback() {
      if (fallbackOn || scene) return;
      fallbackOn = true;
      if (!fallback.firstChild) buildFallback();
      fallback.hidden = false;
      tagLayer.hidden = true;
      $('#hero-canvas').hidden = true;
      ['three', 'scene', 'frame'].forEach(s => loader.step(s));
      layout();
      invalidate();
    }

    /* ---- SAI / KUMAR: sized to the free space around the projected monolith ---- */
    let w100 = null;
    function measureWords() {
      // width of each word at 100px, read once fonts are in
      const prev = [first.style.fontSize, last.style.fontSize];
      first.style.fontSize = last.style.fontSize = '100px';
      w100 = { first: first.offsetWidth / 100, last: last.offsetWidth / 100 };
      first.style.fontSize = prev[0];
      last.style.fontSize = prev[1];
    }

    function monolithBounds() {
      // In stage px, independent of the stage's current scale.
      if (scene) {
        const b = scene.measure();
        if (!b) return null;
        const ox = wrap.offsetLeft, oy = wrap.offsetTop;
        return { l: b.l + ox, r: b.r + ox, t: b.t + oy, b: b.b + oy };
      }
      if (fallbackOn) {
        const svg = $('svg', fallback);
        const sr = stage.getBoundingClientRect(), r = svg.getBoundingClientRect();
        const k = sr.width / stage.offsetWidth || 1;
        const x = (r.left - sr.left) / k, y = (r.top - sr.top) / k, w = r.width / k, hh = r.height / k;
        // slabs start at x 80 of the 640-wide viewBox; labels run to ~610.
        // The bottom edge includes the fallback message so KUMAR clears it on phones.
        const msg = $('p', fallback).getBoundingClientRect();
        return { l: x + w * (80 / 640), r: x + w * (610 / 640), t: y + hh * 0.015, b: (msg.bottom - sr.top) / k };
      }
      return null;
    }

    function layout() {
      const b = monolithBounds();
      if (!b) return;
      if (!w100) measureWords();
      const W = stage.offsetWidth, H = stage.offsetHeight;
      const capH = 0.72; // Satoshi cap height (em)
      let fs;
      if (mqMobile.matches) {
        const navClear = 72, kickerClear = 44, gap = Math.max(10, H * 0.012);
        const above = b.t - navClear - gap, below = H - b.b - kickerClear - gap;
        fs = Math.min((W - 32) / w100.last, Math.min(above, below) / capH);
        const cx = (b.l + b.r) / 2;
        gsap.set(first, { left: cx, top: b.t - gap, xPercent: -50, yPercent: -100 });
        gsap.set(last, { left: cx, top: b.b + gap, xPercent: -50, yPercent: 0 });
      } else {
        const gap = Math.max(20, W * 0.022), margin = Math.max(24, W * 0.035);
        const avail = Math.min(b.l - gap - margin, W - b.r - gap - margin);
        fs = Math.min(avail / w100.last, ((b.b - b.t) * 0.42) / capH);
        const cy = (b.t + b.b) / 2;
        gsap.set(first, { left: b.l - gap, top: cy, xPercent: -100, yPercent: -50 });
        gsap.set(last, { left: b.r + gap, top: cy, xPercent: 0, yPercent: -50 });
      }
      fs = Math.max(36, fs);
      first.style.fontSize = last.style.fontSize = fs.toFixed(1) + 'px';
      flyDist = W * 0.62;
      nameEl.classList.add('is-laid-out');
      laidOut = true;
    }

    /* ---- one frame of the hero, a pure function of p ---- */
    function apply(p) {
      progress = p;

      // SAI / KUMAR fly out sideways
      if (!reduced) {
        const fly = easeIn(range(p, 0.03, 0.3));
        const fade = 1 - range(p, 0.12, 0.3);
        gsap.set(first, { x: -fly * flyDist, opacity: fade });
        gsap.set(last, { x: fly * flyDist, opacity: fade });
        const meta = 1 - range(p, 0, 0.06);
        kicker.style.opacity = meta;
        cue.style.opacity = meta;

        // stage -> rounded card
        const s = easeInOut(range(p, 0.7, 0.94));
        gsap.set(stage, { scale: 1 - 0.26 * s, borderRadius: 30 * s });
        stage.style.setProperty('--card-line', s.toFixed(3));
      }

      // 3D scene + projected tags
      if (scene) {
        const anchors = scene.render(p);
        if (anchors) drawTags(anchors, p);
      }
    }

    function drawTags(anchors, p) {
      for (let i = 0; i < tags.length; i++) {
        const t = tags[i], a = anchors[i];
        if (!a) continue;
        const k = reduced ? 1 : range(p, 0.46 + i * 0.022, 0.51 + i * 0.022);
        if (a.side !== t.side) {
          t.el.classList.toggle('tag--left', a.side === 'left');
          t.el.classList.toggle('tag--right', a.side === 'right');
          t.side = a.side;
        }
        if (k <= 0) {
          if (t.shown !== 0) { t.el.style.visibility = 'hidden'; t.shown = 0; }
          continue;
        }
        if (t.shown !== 1) { t.el.style.visibility = 'visible'; t.shown = 1; }
        t.el.style.transform = 'translate3d(' + a.x.toFixed(1) + 'px,' + a.y.toFixed(1) + 'px,0)';
        const s = 0.55 + 0.45 * backOut(k);
        t.inner.style.opacity = Math.min(1, k * 1.6).toFixed(3);
        t.inner.style.transform = 'translateY(-50%) scale(' + s.toFixed(3) + ')';
      }
    }

    function invalidate() {
      if (driver) driver.invalidate();
      else apply(progress);
    }

    function start() {
      if (!hasGSAP) { $('#hero-intro').style.visibility = 'visible'; return; }
      if (!reduced) {
        driver = scrub(pin, { start: 'top top', end: '+=300%', pin: true, anticipatePin: 1 }, apply);
      }
      $('#hero-intro').style.visibility = 'visible';
      fontsReady.then(() => {
        measureWords();
        layout();
        invalidate();
      });
    }

    /* Resize: the scene owns its canvas size and calls back; DOM-only path below. */
    let rT;
    window.addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => { if (!scene) { layout(); invalidate(); } }, 120);
    });

    return {
      stage, wrap, tags, STATIC_P,
      get progress() { return driver ? driver.value : progress; },
      start, invalidate, layout, showFallback,
      attachScene(api) {
        scene = api;
        if (fallbackOn) {
          fallbackOn = false;
          fallback.hidden = true;
          tagLayer.hidden = false;
          $('#hero-canvas').hidden = false;
        }
        loader.step('scene');
        fontsReady.then(() => { layout(); invalidate(); });
      },
      onSceneResize() { if (laidOut || scene) { layout(); invalidate(); } },
      sceneFailed() { scene = null; showFallback(); }
    };
  })();
  SITE.hero = hero;

  /* Headline under the card: SplitText word masks, scrubbed. */
  function heroHeadline() {
    const intro = $('#hero-intro');
    const head = $('#hero-headline');
    if (!hasGSAP || reduced || !window.SplitText) return;
    fontsReady.then(() => {
      const split = SplitText.create(head, { type: 'words', wordsClass: 'w', mask: 'words' });
      const rest = [$('#hero-sub'), $('#hero-stack'), $('#hero-ctas')];
      const tl = gsap.timeline({ paused: true })
        .fromTo(split.words, { yPercent: 118 }, { yPercent: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07 }, 0)
        .fromTo(rest, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.1 }, 0.35);
      scrub(intro, { start: 'top 96%', end: 'top 42%' }, p => tl.progress(p));
    });
  }

  if (hasGSAP) {
    hero.start();
    heroHeadline();
    if (!webgl) hero.showFallback();
    // Module never arrived (CDN down, import failed): fall back rather than leave a blank stage.
    loader.ready.then(() => { setTimeout(() => { if (!SITE.heroScene) { hero.showFallback(); about.useFallback(); toolset.sceneFailed(); } }, 300); });
  }

  /* ==========================================================================
     Shared chapter helpers
     ========================================================================== */
  function eyebrow(el, ch) {
    el.textContent = '';
    el.append(h('span', 'eyebrow-label', ch.label), h('span', 'eyebrow-name', ch.name));
    return el;
  }
  /* Headline rising through word masks, scrubbed between start and end. `extra` fades in after. */
  /* run setup work one macrotask at a time, so several splits never form one long task */
  const later = (() => { let q = Promise.resolve(); return fn => { q = q.then(() => new Promise(r => setTimeout(() => { fn(); r(); }, 0))); }; })();
  function riseHeadline(el, trigger, start, end, extra) {
    if (!hasGSAP || reduced || !window.SplitText) return;
    fontsReady.then(() => later(() => {
      const split = SplitText.create(el, { type: 'words', wordsClass: 'w', mask: 'words' });
      const tl = gsap.timeline({ paused: true })
        .fromTo(split.words, { yPercent: 118 }, { yPercent: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 0);
      if (extra && extra.length) tl.fromTo(extra, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.1 }, 0.3);
      scrub(trigger, { start, end }, p => tl.progress(p));
    }));
  }

  /* ==========================================================================
     3. Marquee — speed, direction and skew follow scroll velocity.
     ========================================================================== */
  (function marquee() {
    const sec = $('#marquee');
    const items = D.MARQUEE;
    const list = $('#marquee-list');
    items.forEach(t => list.appendChild(h('li', null, t)));
    const makeSet = () => {
      const g = h('div', 'marquee-set');
      items.forEach(t => g.append(h('span', 'marquee-item', t), h('span', 'marquee-star', '✦')));
      return g;
    };
    const bands = $$('.marquee-band', sec).map(band => {
      const track = $('.marquee-track', band);
      track.appendChild(makeSet());
      return { track, skew: $('.marquee-skew', band), back: band.classList.contains('marquee-band--back'), x: 0, w: 0 };
    });
    function measure() {
      bands.forEach(m => {
        const first = m.track.firstElementChild;
        m.w = first.offsetWidth;
        const need = Math.ceil((sec.offsetWidth * 1.4) / Math.max(1, m.w)) + 1;
        while (m.track.children.length < need) m.track.appendChild(first.cloneNode(true));
      });
    }
    fontsReady.then(measure);
    window.addEventListener('resize', measure);
    if (!hasGSAP || reduced) return;

    let dir = 1, skew = 0, on = false;
    function tick() {
      const v = lenis ? lenis.velocity : 0;
      if (v > 0.2) dir = 1; else if (v < -0.2) dir = -1;
      const dr = gsap.ticker.deltaRatio(60);
      const speed = (0.8 + Math.min(Math.abs(v) * 0.45, 18)) * dr;
      skew += (Math.max(-9, Math.min(9, v * 0.4)) - skew) * Math.min(1, 0.12 * dr);
      bands.forEach(m => {
        if (!m.w) return;
        m.x -= speed * dir * (m.back ? -0.6 : 1); // back band runs the other way, slower
        m.x = ((m.x % m.w) - m.w) % m.w;          // keep in (-w, 0]
        gsap.set(m.track, { x: m.x });
        gsap.set(m.skew, { skewX: (m.back ? 0.6 : -1) * skew });
      });
    }
    new IntersectionObserver(es => {
      const v = es[0].isIntersecting;
      if (v && !on) gsap.ticker.add(tick);
      if (!v && on) gsap.ticker.remove(tick);
      on = v;
    }).observe(sec);
  })();

  /* ==========================================================================
     4. Ch 01 — About (pinned). Each area card lights its layers on a
     reassembled copy of the hero monolith (same scene, re-framed).
     ========================================================================== */
  const about = (() => {
    const A = D.ABOUT, ch = D.CHAPTERS.about;
    const idx = {};
    D.LAYERS.forEach((l, i) => { idx[l.id] = i; });
    eyebrow($('#about-eyebrow'), ch);
    const title = rich($('#about-title'), ch.title);
    const copy = $('#about-copy');
    copy.textContent = A.copy;

    const list = $('#about-cards');
    const dotsEl = $('#about-dots');
    const cards = A.areas.map(a => {
      const li = h('li', 'about-card');
      const top = h('div', 'about-card-top');
      top.appendChild(h('span', 'about-card-num', a.num));
      const lay = h('span', 'about-card-layers');
      a.layers.forEach(id => {
        const l = D.LAYERS[idx[id]];
        const sp = h('span', null, l.label);
        sp.style.setProperty('--c', l.colour);
        lay.appendChild(sp);
      });
      top.appendChild(lay);
      li.append(top, h('h3', 'about-card-title', a.title), h('p', 'about-card-text', a.text));
      list.appendChild(li);
      const dot = h('span');
      dotsEl.appendChild(dot);
      return { li, dot };
    });

    const fb = $('#about-fallback');
    const fbItems = D.LAYERS.map(l => {
      const li = h('li', null, l.label);
      li.style.setProperty('--c', l.colour);
      fb.appendChild(li);
      return li;
    });
    const caption = $('#about-caption');
    let captionText = '';

    const N = A.areas.length, START = 0.06, SPAN = 0.2, ALL = START + N * SPAN;
    let view = null, useFb = false, last = { p: reduced ? 1 : 0, mode: 'static' };

    /* Card k is active across [START + k*SPAN, START + (k+1)*SPAN]; then everything lights. */
    function apply(p, mode) {
      last = { p, mode };
      const all = range(p, ALL + 0.01, ALL + 0.08);
      const w = A.areas.map((a, k) => {
        const s = START + k * SPAN, e = s + SPAN;
        return Math.min(range(p, s - 0.03, s + 0.02), k === N - 1 ? 1 : 1 - range(p, e - 0.02, e + 0.03));
      });
      cards.forEach((c, k) => {
        const s = START + k * SPAN;
        const on = Math.max(w[k], all).toFixed(3);
        c.li.style.setProperty('--on', on);
        c.dot.style.setProperty('--on', on);
        if (mode === 'desk') {
          const inn = easeOut(range(p, s - 0.08, s));
          gsap.set(c.li, { y: (1 - inn) * 36, opacity: inn });
        } else if (mode === 'mob') {
          const inn = k === 0 ? 1 : range(p, s - 0.04, s + 0.02);
          const out = k === N - 1 ? 0 : range(p, s + SPAN - 0.04, s + SPAN + 0.02);
          gsap.set(c.li, { xPercent: (1 - inn) * 40 - out * 40, opacity: inn * (1 - out) });
        }
      });

      const glow = D.LAYERS.map(() => 0), lift = glow.slice();
      A.areas.forEach((a, k) => a.layers.forEach(id => {
        const i = idx[id];
        glow[i] = Math.max(glow[i], w[k]);
        lift[i] = Math.max(lift[i], w[k]);
      }));
      for (let i = 0; i < glow.length; i++) { glow[i] = Math.max(glow[i], all); lift[i] *= 1 - all; }

      if (view) view.render({ rot: lerp(-0.62, 0.3, easeInOut(p)), glow, lift });
      else if (useFb) fbItems.forEach((li, i) => li.style.setProperty('--on', glow[i].toFixed(3)));

      const litNames = D.LAYERS.filter((l, i) => glow[i] > 0.5).map(l => l.label);
      const text = all > 0.5 ? 'All ' + D.LAYERS.length + ' layers' : litNames.join(' · ');
      if (text !== captionText) { caption.textContent = text; captionText = text; }
    }

    function start() {
      riseHeadline(title, $('#about-head'), 'top 85%', 'top 30%', [copy]);
      if (!hasGSAP || reduced) { apply(1, 'static'); return; }
      gsap.matchMedia().add({ desk: '(min-width: 761px)', mob: '(max-width: 760px)' }, c => {
        const desk = c.conditions.desk;
        const mode = desk ? 'desk' : 'mob';
        const s = scrub(desk ? $('#about-pin') : $('#about-body'),
          { start: 'top top', end: desk ? '+=220%' : '+=240%', pin: true, anticipatePin: 1 },
          p => apply(p, mode));
        return () => { s.kill(); gsap.set(cards.map(x => x.li), { clearProps: 'transform,opacity' }); };
      });
    }

    return {
      start,
      attachView(v) { view = v; apply(last.p, last.mode); },
      useFallback() {
        if (view || useFb) return;
        useFb = true;
        $('#about-canvas').hidden = true;
        fb.hidden = false;
        apply(last.p, last.mode);
      }
    };
  })();
  SITE.about = about;
  about.start();
  if (!webgl) about.useFallback();

  /* ==========================================================================
     5. Ch 02 — The toolset panel. The 3D constellation (three-scenes.js)
     listens to 'select' and 'focus' events from here.
     ========================================================================== */
  const toolset = (() => {
    const ch = D.CHAPTERS.stack;
    eyebrow($('#tools-eyebrow'), ch);
    const title = rich($('#tools-title'), ch.title);
    const sub = $('#tools-sub');
    sub.textContent = ch.sub;
    riseHeadline(title, $('#stack .tools-head'), 'top 85%', 'top 40%', [sub]);

    const subs = [];
    const chipsEl = $('#tools-chips');
    const listEl = $('#tools-list');
    const wrap = $('#tools-canvas-wrap');
    const pad = n => String(n).padStart(2, '0');
    const T = {
      selected: -1,
      on(fn) { subs.push(fn); },
      emit(type, v) { subs.forEach(fn => fn(type, v)); },
      sceneReady() { wrap.classList.add('is-ready'); },
      sceneFailed() {
        if (wrap.classList.contains('is-fallback')) return;
        wrap.classList.add('is-fallback');
        wrap.removeAttribute('tabindex');
        wrap.removeAttribute('role');
        wrap.removeAttribute('aria-label');
        wrap.removeAttribute('data-cursor');
        $('#tools-fallback').hidden = false;
      }
    };

    const chip = (label, gi, colour) => {
      const b = h('button', 'chip');
      b.type = 'button';
      b.dataset.g = gi;
      b.setAttribute('aria-pressed', gi === -1 ? 'true' : 'false');
      if (colour) b.style.setProperty('--c', colour);
      b.append(h('span', 'chip-dot'), label);
      b.firstChild.setAttribute('aria-hidden', 'true');
      chipsEl.appendChild(b);
      return b;
    };
    const chips = [chip('All', -1, null)].concat(D.SKILLS.map((g, gi) => chip(g.group, gi, g.colour)));

    const toolBtn = (label, gi, j) => {
      const li = h('li');
      const b = h('button', 'tool', label);
      b.type = 'button';
      b.dataset.g = gi;
      b.dataset.j = j;
      b.style.setProperty('--c', D.SKILLS[gi].colour);
      li.appendChild(b);
      return li;
    };
    function renderList(gi) {
      listEl.textContent = '';
      if (gi < 0) {
        const total = D.SKILLS.reduce((n, g) => n + g.items.length, 0);
        listEl.appendChild(h('p', 'tools-count', pad(total) + ' tools · ' + pad(D.SKILLS.length) + ' groups'));
        D.SKILLS.forEach((g, k) => {
          const sec = h('div', 'tools-group');
          const hd = h('h3', 'tools-group-name', g.group);
          hd.style.setProperty('--c', g.colour);
          const ul = h('ul', 'tools-items');
          g.items.forEach((t, j) => ul.appendChild(toolBtn(t, k, j)));
          sec.append(hd, ul);
          listEl.appendChild(sec);
        });
      } else {
        const g = D.SKILLS[gi];
        listEl.appendChild(h('p', 'tools-count', pad(g.items.length) + ' tools'));
        const hd = h('h3', 'tools-focus-name', g.group);
        hd.style.setProperty('--c', g.colour);
        const ul = h('ul', 'tools-items tools-items--big');
        g.items.forEach((t, j) => ul.appendChild(toolBtn(t, gi, j)));
        listEl.append(hd, ul);
        if (hasGSAP && !reduced) gsap.from($$('li', ul), { y: 14, opacity: 0, duration: 0.45, ease: 'power3.out', stagger: 0.04 });
      }
    }
    function select(gi) {
      T.selected = gi;
      chips.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.g === gi)));
      renderList(gi);
      T.emit('select', gi);
    }
    chipsEl.addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (b) select(+b.dataset.g);
    });
    const toolOf = e => e.target.closest && e.target.closest('.tool');
    const focusTool = b => T.emit('focus', b ? [+b.dataset.g, +b.dataset.j] : null);
    listEl.addEventListener('focusin', e => { const b = toolOf(e); if (b) focusTool(b); });
    listEl.addEventListener('focusout', e => { if (toolOf(e) && !listEl.contains(e.relatedTarget)) focusTool(null); });
    listEl.addEventListener('pointerover', e => { const b = toolOf(e); if (b) focusTool(b); });
    listEl.addEventListener('pointerout', e => {
      if (!toolOf(e) || (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.tool'))) return;
      const a = document.activeElement;
      focusTool(a && a.classList && a.classList.contains('tool') ? a : null);
    });
    listEl.addEventListener('click', e => { const b = toolOf(e); if (b) focusTool(b); });
    renderList(-1);
    if (!webgl) T.sceneFailed();
    return T;
  })();
  SITE.toolset = toolset;

  /* ==========================================================================
     6. Ch 03 — Selected work. One pinned theatre: four layers on their own
     colours, each wiping up over the last. Every frame is a pure f(progress).
     ========================================================================== */
  const work = (() => {
    const ch = D.CHAPTERS.work;
    const P = D.PROJECTS;
    const N = P.length;
    const pad = n => String(n).padStart(2, '0');
    eyebrow($('#work-eyebrow'), ch);
    const mega = rich($('#work-title'), ch.title);
    const sub = $('#work-sub');
    sub.textContent = ch.sub;
    riseHeadline(mega, $('#work-intro'), 'top 80%', 'top 25%', [sub]);

    const theatre = $('#theatre');
    const layersEl = $('#theatre-layers');
    const rail = $('#theatre-rail');
    const NS = 'http://www.w3.org/2000/svg';

    const layers = P.map((p, k) => {
      const L = h('article', 'theatre-layer');
      L.style.setProperty('--bg', p.colour);
      L.style.setProperty('--fg', p.textColour);
      L.dataset.cursor = 'Open';
      L.setAttribute('aria-labelledby', 'work-p' + k);
      const inner = h('div', 'theatre-inner container');

      const copy = h('div', 'theatre-copy');
      const items = [
        h('p', 't-count', pad(k + 1) + ' / ' + pad(N)),
        h('p', 't-cat', p.category),
        h('h3', 't-title display', p.title),
        h('p', 't-problem', p.problem)
      ];
      items[2].id = 'work-p' + k;
      const pills = h('ul', 't-stack');
      p.stack.slice(0, 3).forEach(s => pills.appendChild(h('li', 'pill', s)));
      const open = h('button', 'btn t-open');
      open.type = 'button';
      open.append('Open case study', h('span', 'arrow', '→'));
      open.lastChild.setAttribute('aria-hidden', 'true');
      open.addEventListener('click', e => { e.stopPropagation(); drawer.open(k, open); });
      items.push(pills, open);
      copy.append(...items);

      /* Diagram: the project's flow as nodes (DOM) + edges and packets (SVG). */
      const dia = h('div', 'theatre-diagram');
      dia.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 't-edges');
      dia.appendChild(svg);
      const n = p.flow.length;
      const edges = [], packets = [];
      for (let i = 0; i < n - 1; i++) {
        const path = document.createElementNS(NS, 'path');
        svg.appendChild(path);
        edges.push(path);
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', '3.5');
        svg.appendChild(c);
        packets.push(c);
      }
      const nodes = p.flow.map((label, i) => {
        const el = h('div', 't-node');
        el.append(h('span', 't-node-i', pad(i + 1)), label);
        dia.appendChild(el);
        return { el, w: 0, cur: { x: 0, y: 0, w: 0 } };
      });

      inner.append(dia, copy);
      L.appendChild(inner);
      L.addEventListener('click', e => { if (!e.target.closest('button, a')) drawer.open(k, open); });
      layersEl.appendChild(L);

      const railBtn = h('button', 'rail-item');
      railBtn.type = 'button';
      railBtn.append(h('span', 'rail-i', pad(k + 1)), h('span', 'rail-name', p.title));
      railBtn.addEventListener('click', () => goTo(k));
      rail.appendChild(railBtn);

      return { L, copy, items, dia, svg, edges, packets, nodes, open, railBtn, box: { w: 1, h: 1 }, nodeH: 40, shown: true };
    });
    const railBar = h('span', 'rail-bar');
    railBar.appendChild(h('span'));
    rail.appendChild(railBar);

    /* measure natural node widths + diagram box (on fonts ready and resize) */
    function measure() {
      layers.forEach(l => {
        l.box = { w: l.dia.clientWidth || 1, h: l.dia.clientHeight || 1 };
        l.nodes.forEach(nd => { nd.el.style.width = ''; nd.w = nd.el.offsetWidth; });
        l.nodeH = l.nodes[0].el.offsetHeight || 40;
        l.svg.setAttribute('viewBox', '0 0 ' + l.box.w + ' ' + l.box.h);
      });
    }

    /* diagram for explode amount e (0 compact block -> 1 exploded chain), packets at phase t */
    function diagram(l, e, t) {
      const { w, h: H } = l.box, n = l.nodes.length, nh = l.nodeH;
      const blockW = Math.min(w * 0.62, 320), slabH = nh * 0.78, gap = 4;
      const narrow = w < 480;
      const span = H * 0.86 - nh, top = H * 0.07 + nh / 2;
      l.nodes.forEach((nd, i) => {
        const k = Math.abs(i - (n - 1) / 2);
        const st = 0.18 * (1 - k / ((n - 1) / 2 || 1));   // outer nodes lead, like the hero
        const ei = easeInOut(clamp01((e - st) / (1 - st)));
        const cx = w / 2, cy = H / 2 + (i - (n - 1) / 2) * (slabH + gap);
        const ex = w / 2 + (i % 2 ? 1 : -1) * w * (narrow ? 0.16 : 0.2), ey = top + (n > 1 ? i * span / (n - 1) : 0);
        const x = lerp(cx, ex, ei), y = lerp(cy, ey, ei);
        const ww = lerp(blockW, nd.w, ei), hh = lerp(slabH, nh, ei);
        nd.cur = { x, y, w: ww, h: hh };
        nd.el.style.width = ww.toFixed(1) + 'px';
        nd.el.style.height = hh.toFixed(1) + 'px';
        nd.el.style.transform = 'translate3d(' + (x - ww / 2).toFixed(1) + 'px,' + (y - hh / 2).toFixed(1) + 'px,0)';
      });
      const eo = range(e, 0.55, 0.95), po = range(e, 0.8, 1);
      l.edges.forEach((path, i) => {
        const a = l.nodes[i].cur, b = l.nodes[i + 1].cur;
        const x1 = a.x, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y - b.h / 2, dy = Math.max(8, (y2 - y1) * 0.6);
        path.setAttribute('d', 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'C' + x1.toFixed(1) + ' ' + (y1 + dy).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + (y2 - dy).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1));
        path.style.opacity = eo.toFixed(3);
        // packet: position on the cubic at u, a pure function of t
        const u = (t * 2.4 + i * 0.37) % 1, v = 1 - u;
        const px = v * v * v * x1 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x2;
        const py = v * v * v * y1 + 3 * v * v * u * (y1 + dy) + 3 * v * u * u * (y2 - dy) + u * u * u * y2;
        const c = l.packets[i];
        c.setAttribute('cx', px.toFixed(1));
        c.setAttribute('cy', py.toFixed(1));
        c.style.opacity = (po * Math.min(1, u / 0.08, (1 - u) / 0.08)).toFixed(3);
      });
    }

    /* Layer k (k >= 1) wipes in over [k/N - WIPE, k/N]; layer k explodes across its own segment. */
    const SEG = 1 / N, WIPE = 0.07;
    let lastP = reduced ? 1 : 0, mode = reduced ? 'static' : 'pin', railActive = -1;
    function apply(p) {
      lastP = p;
      layers.forEach((l, k) => {
        const wIn = k === 0 ? 1 : easeInOut(range(p, k * SEG - WIPE, k * SEG));
        const wNext = k === N - 1 ? 0 : easeInOut(range(p, (k + 1) * SEG - WIPE, (k + 1) * SEG));
        const visible = wIn > 0 && wNext < 1;
        if (!visible) { if (l.shown) { l.L.style.visibility = 'hidden'; l.shown = false; } return; }
        if (!l.shown) { l.L.style.visibility = 'visible'; l.shown = true; }
        // wipe with a rounded top edge that flattens as it lands
        const r = 44 * (1 - wIn * wIn);
        l.L.style.clipPath = k === 0 ? 'none' : 'inset(' + ((1 - wIn) * 100).toFixed(2) + '% 0 0 0 round ' + r.toFixed(1) + 'px ' + r.toFixed(1) + 'px 0 0)';
        // copy rises in with the wipe, lifts away as the next layer arrives
        l.items.forEach((it, i) => {
          const inn = k === 0 ? 1 : easeOut(range(wIn, 0.35 + i * 0.08, 0.8 + i * 0.04));
          gsap.set(it, { y: (1 - inn) * 46 - wNext * 90, opacity: Math.min(inn, 1 - wNext * 1.4) });
        });
        gsap.set(l.dia, { y: -wNext * 50 });
        // explode across the layer's own segment, from compact (block) to the full chain
        const t = range(p, k * SEG - (k ? 0.02 : 0), (k + 1) * SEG);
        diagram(l, range(p, k * SEG - (k ? 0.02 : 0), k * SEG + SEG * 0.62), t);
      });
      const active = Math.min(N - 1, Math.floor(p * N + WIPE * N * 0.5));
      if (active !== railActive) {
        railActive = active;
        layers.forEach((l, k) => {
          l.railBtn.classList.toggle('is-active', k === active);
          if (k === active) l.railBtn.setAttribute('aria-current', 'step'); else l.railBtn.removeAttribute('aria-current');
        });
        rail.style.setProperty('--rail-fg', P[active].textColour);
      }
      railBar.firstChild.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }

    /* Reduced motion: every layer stacked in flow, diagrams fully exploded. */
    function applyStatic() {
      layers.forEach(l => {
        l.L.style.visibility = 'visible'; l.L.style.clipPath = 'none'; l.shown = true;
        l.items.forEach(it => gsap.set(it, { clearProps: 'transform,opacity' }));
        diagram(l, 1, 0.3);
      });
    }

    let driver = null;
    function goTo(k) {
      if (!driver) { layers[k].L.scrollIntoView(); return; }
      const st = driver.st, y = st.start + (st.end - st.start) * Math.min(1, k * SEG + 0.02);
      if (lenis) lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo(0, y);
    }

    function start() {
      if (!hasGSAP || reduced) {
        theatre.classList.add('is-static');
        fontsReady.then(() => { measure(); applyStatic(); });
      } else {
        // created synchronously so pins are registered in page order; measured once fonts are in
        driver = scrub(theatre, { start: 'top top', end: '+=' + (N * 100) + '%', pin: true, anticipatePin: 1 }, apply);
        fontsReady.then(() => { measure(); driver.invalidate(); });
      }
      let rT;
      window.addEventListener('resize', () => {
        clearTimeout(rT);
        rT = setTimeout(() => { measure(); if (driver) driver.invalidate(); else applyStatic(); }, 150);
      });
    }
    return { start, layers };
  })();

  /* ==========================================================================
     Case-study drawer — full-screen dialog. Focus moves in and is trapped,
     Esc closes, page scroll is locked and the page behind is inert.
     ========================================================================== */
  const drawer = (() => {
    const el = $('#case');
    const panel = $('#case-panel');
    const body = $('#case-body');
    const count = $('#case-count');
    const closeBtn = $('#case-close');
    const P = D.PROJECTS;
    const pad = n => String(n).padStart(2, '0');
    const behind = [$('main'), $('#site-header')];
    let isOpen = false, opener = null, current = -1;

    const flow = (arr, cls) => {
      const ol = h('ol', 'cs-flow ' + (cls || ''));
      arr.forEach((step, i) => {
        const li = h('li', 'cs-flow-node');
        li.append(h('span', 'cs-flow-i', pad(i + 1)), step);
        ol.appendChild(li);
      });
      return ol;
    };
    const section = (title, ...kids) => {
      const s = h('section', 'cs-sec');
      s.append(h('h3', 'cs-sec-title', title), ...kids);
      return s;
    };

    function render(k) {
      const p = P[k];
      current = k;
      count.textContent = 'Case study ' + pad(k + 1) + ' / ' + pad(P.length);
      el.style.setProperty('--bg', p.colour);
      el.style.setProperty('--fg', p.textColour);
      body.textContent = '';

      const head = h('header', 'cs-head');
      const title = h('h2', 'cs-title display', p.title);
      title.id = 'case-title';
      title.tabIndex = -1;
      const meta = h('dl', 'cs-meta');
      [['Role', p.role], ['Category', p.category]].forEach(([k2, v]) => { meta.append(h('dt', null, k2), h('dd', null, v)); });
      head.append(h('p', 'cs-cat', p.category), title, h('p', 'cs-problem', p.problem), meta);

      const feats = h('ul', 'cs-features');
      p.features.forEach(f => feats.appendChild(h('li', null, f)));
      const tech = h('ul', 'cs-tech');
      p.stack.forEach(t => tech.appendChild(h('li', 'pill', t)));

      const next = (k + 1) % P.length;
      const nextBtn = h('button', 'cs-next');
      nextBtn.type = 'button';
      nextBtn.append(h('span', 'cs-next-label', 'Next case study'), h('span', 'cs-next-title', P[next].title + ' →'));
      nextBtn.addEventListener('click', () => { render(next); panel.scrollTop = 0; $('#case-title').focus(); });

      body.append(
        head,
        section('Workflow', flow(p.flow)),
        section('Architecture', flow(p.architecture, 'cs-flow--arch')),
        section('Features', feats),
        section('Challenge & solution', h('p', 'cs-text', p.challenge)),
        section('Result', h('p', 'cs-text', p.result)),
        section('Technology', tech),
        nextBtn
      );
    }

    function open(k, from) {
      opener = from || document.activeElement;
      render(k);
      if (isOpen) return;
      isOpen = true;
      el.hidden = false;
      panel.scrollTop = 0;
      behind.forEach(b => { if (b) b.inert = true; });
      if (lenis) lenis.stop();
      root.style.overflow = 'hidden';
      if (hasGSAP && !reduced) gsap.fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: 'expo.out' });
      $('#case-title').focus({ preventScroll: true });
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      const done = () => {
        el.hidden = true;
        behind.forEach(b => { if (b) b.inert = false; });
        if (lenis) lenis.start();
        root.style.overflow = '';
        if (opener && opener.focus) opener.focus({ preventScroll: true });
      };
      if (hasGSAP && !reduced) gsap.to(panel, { yPercent: 100, duration: 0.5, ease: 'expo.in', onComplete: done });
      else done();
    }
    closeBtn.addEventListener('click', close);
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('button, a[href], [tabindex]:not([tabindex="-1"])', el).filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $('#case-title'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    return { open, close, get isOpen() { return isOpen; }, get current() { return current; } };
  })();
  SITE.drawer = drawer;
  work.start();

  /* ==========================================================================
     Terminals — type their script once, on first view, at human speed.
     Screen readers get the full script immediately (the typed copy is aria-hidden).
     ========================================================================== */
  function terminal(el, T) {
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Terminal: ' + T.title);
    const bar = h('div', 'term-bar');
    bar.setAttribute('aria-hidden', 'true');
    bar.append(h('span', 'term-dot'), h('span', 'term-dot'), h('span', 'term-dot'), h('span', 'term-title', T.title));
    const full = h('pre', 'sr-only', T.lines.map(l => (l.prompt ? l.prompt + ' ' : '') + l.text).join('\n'));
    const screen = h('div', 'term-body');
    screen.setAttribute('aria-hidden', 'true');
    const cursor = h('span', 'term-cursor');
    el.append(bar, full, screen);

    const line = l => {
      const row = h('div', 'term-line' + (l.prompt ? '' : ' term-out'));
      if (l.prompt) row.appendChild(h('span', 'term-prompt', l.prompt + ' '));
      const txt = h('span', 'term-text');
      row.appendChild(txt);
      screen.appendChild(row);
      return { row, txt };
    };
    if (reduced || !('IntersectionObserver' in window)) {
      T.lines.forEach(l => { line(l).txt.textContent = l.text; });
      screen.lastChild.appendChild(cursor);
      return;
    }
    // reserve the final height so the layout never jumps while typing
    T.lines.forEach(l => { line(l).txt.textContent = l.text; });
    screen.style.minHeight = screen.offsetHeight + 'px';
    screen.textContent = '';
    screen.appendChild(cursor);

    function run() {
      let i = 0;
      const next = () => {
        if (i >= T.lines.length) return;
        const l = T.lines[i++];
        const { row, txt } = line(l);
        row.appendChild(cursor);
        if (!l.prompt) { txt.textContent = l.text; setTimeout(next, 170); return; }
        let c = 0;
        const type = () => {
          txt.textContent = l.text.slice(0, ++c);
          if (c < l.text.length) setTimeout(type, 34 + ((c * 37) % 41)); // ~45ms/char with a deterministic stutter
          else setTimeout(next, 420);
        };
        setTimeout(type, 260);
      };
      next();
    }
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { io.disconnect(); fontsReady.then(run); }
    }, { threshold: 0.45 });
    io.observe(el);
  }

  /* ==========================================================================
     7. Ch 04 — A request's path (pinned). One packet travels Browser -> AWS,
     scrubbed by scroll; each layer lights as it passes.
     ========================================================================== */
  const path = (() => {
    const ch = D.CHAPTERS.path, T = D.TERMINALS.api;
    eyebrow($('#path-eyebrow'), ch);
    const title = rich($('#path-title'), ch.title);
    const sub = $('#path-sub');
    sub.textContent = ch.sub;
    $('#path-term-title').textContent = T.heading;
    $('#path-term-sub').textContent = T.sub;
    terminal($('#api-terminal'), T);
    riseHeadline(title, $('#path-head'), 'top 85%', 'top 30%', [sub]);

    const list = $('#path-layers');
    const stack = $('#path-stack');
    const packet = $('#path-packet');
    const fill = $('.path-rail-fill');
    const rows = D.LAYERS.map((l, i) => {
      const li = h('li', 'path-layer');
      li.style.setProperty('--c', l.colour);
      li.append(h('span', 'pl-i', String(i + 1).padStart(2, '0')), h('span', 'pl-label', l.label), h('span', 'pl-tag', l.tag));
      list.appendChild(li);
      return { li, c: 0 };
    });
    let centers = [], top = 0, bottom = 1;
    function measure() {
      const s = stack.getBoundingClientRect();
      centers = rows.map(r => { const b = r.li.getBoundingClientRect(); return b.top - s.top + b.height / 2; });
      top = centers[0]; bottom = centers[centers.length - 1];
    }
    function apply(p) {
      if (!centers.length) measure();
      const t = easeInOut(range(p, 0.06, 0.9));
      const y = lerp(top, bottom, t);
      const pitch = (bottom - top) / (rows.length - 1 || 1);
      packet.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
      packet.style.opacity = (range(p, 0.02, 0.08) * (1 - range(p, 0.94, 1) * 0.6)).toFixed(3);
      fill.style.transform = 'scaleY(' + (y / (stack.offsetHeight || 1)).toFixed(4) + ')';
      rows.forEach((r, i) => {
        const near = 1 - clamp01(Math.abs(y - centers[i]) / (pitch * 0.75));
        const passed = clamp01((y - centers[i]) / (pitch * 0.5));
        const on = Math.max(near, passed * 0.32) * range(p, 0.02, 0.08);
        r.li.style.setProperty('--on', on.toFixed(3));
      });
    }
    function start() {
      fontsReady.then(measure);
      if (!hasGSAP || reduced) { fontsReady.then(() => { measure(); rows.forEach(r => r.li.style.setProperty('--on', '0.32')); fill.style.transform = 'scaleY(1)'; packet.style.opacity = 0; }); return; }
      gsap.matchMedia().add({ desk: '(min-width: 761px)', mob: '(max-width: 760px)' }, c => {
        const s = scrub(c.conditions.desk ? $('#path-pin') : $('#path-body'),
          { start: 'top top', end: '+=180%', pin: true, anticipatePin: 1, onRefreshInit: () => { centers = []; } }, apply);
        return () => s.kill();
      });
      window.addEventListener('resize', () => { centers = []; });
    }
    return { start };
  })();

  /* ==========================================================================
     8. Ch 05 — The data model. Relationship lines draw in with scroll
     (stroke-dashoffset); hover or focus an entity to trace its relations.
     ========================================================================== */
  const erd = (() => {
    const ch = D.CHAPTERS.data, E = D.ERD;
    eyebrow($('#data-eyebrow'), ch);
    const title = rich($('#data-title'), ch.title);
    const sub = $('#data-sub');
    sub.textContent = ch.sub;
    riseHeadline(title, $('#data-head'), 'top 85%', 'top 45%', [sub]);
    const wrap = $('#erd-wrap');
    const legend = $('#erd-legend');
    E.legend.forEach(t => legend.appendChild(h('li', null, t)));
    const NS = 'http://www.w3.org/2000/svg';
    const byId = {};
    E.entities.forEach(e => { byId[e.id] = e; });
    const related = id => E.links.filter(l => l[0] === id || l[1] === id).map(l => l[0] === id ? l[1] : l[0]);

    // text equivalent of the diagram
    const srList = h('ul', 'sr-only');
    E.entities.forEach(e => srList.appendChild(h('li', null, e.label + ' relates to ' + related(e.id).map(r => byId[r].label).join(', '))));
    wrap.after(srList);

    let svg, lines = [], ents = [], drawn = reduced ? 1 : 0, tall = null;
    const mk = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

    function build() {
      tall = mqMobile.matches;
      wrap.textContent = '';
      // phones: transpose the layout (columns become rows) so labels stay legible
      const W = tall ? 100 : 110, H = 40;
      const pos = e => tall ? { x: e.y - 40, y: e.x } : { x: e.x, y: e.y };
      svg = mk('svg', { viewBox: tall ? '0 0 400 810' : E.viewBox, class: 'erd' + (tall ? ' erd--tall' : '') });
      svg.setAttribute('aria-hidden', 'true');
      const gl = mk('g', { class: 'erd-lines' }), ge = mk('g', { class: 'erd-ents' });
      svg.append(gl, ge);
      lines = E.links.map(([a, b]) => {
        const A = pos(byId[a]), B = pos(byId[b]);
        const ac = { x: A.x + W / 2, y: A.y + H / 2 }, bc = { x: B.x + W / 2, y: B.y + H / 2 };
        let d;
        if (Math.abs(bc.x - ac.x) >= Math.abs(bc.y - ac.y)) {
          const s = bc.x > ac.x ? 1 : -1, x1 = ac.x + s * W / 2, x2 = bc.x - s * W / 2, mx = (x1 + x2) / 2;
          d = `M${x1} ${ac.y}C${mx} ${ac.y} ${mx} ${bc.y} ${x2} ${bc.y}`;
        } else {
          const s = bc.y > ac.y ? 1 : -1, y1 = ac.y + s * H / 2, y2 = bc.y - s * H / 2, my = (y1 + y2) / 2;
          d = `M${ac.x} ${y1}C${ac.x} ${my} ${bc.x} ${my} ${bc.x} ${y2}`;
        }
        const p = mk('path', { d, pathLength: 1, class: 'erd-line' });
        gl.appendChild(p);
        return { p, a, b };
      });
      // the focusable entities live in the DOM over the SVG, positioned in viewBox percentages
      const layer = h('div', 'erd-hit');
      const vb = svg.getAttribute('viewBox').split(' ').map(Number);
      ents = E.entities.map(e => {
        const P = pos(e);
        const g = mk('g', { class: 'erd-ent' });
        g.append(mk('rect', { x: P.x, y: P.y, width: W, height: H, rx: 8 }), mk('text', { x: P.x + W / 2, y: P.y + H / 2 + 4, 'text-anchor': 'middle' }));
        g.lastChild.textContent = e.label;
        ge.appendChild(g);
        const btn = h('button', 'erd-btn');
        btn.type = 'button';
        btn.setAttribute('aria-label', e.label + ': relates to ' + related(e.id).map(r => byId[r].label).join(', '));
        Object.assign(btn.style, { left: (P.x / vb[2] * 100) + '%', top: (P.y / vb[3] * 100) + '%', width: (W / vb[2] * 100) + '%', height: (H / vb[3] * 100) + '%' });
        const on = () => trace(e.id), off = () => trace(null);
        btn.addEventListener('pointerenter', on); btn.addEventListener('pointerleave', off);
        btn.addEventListener('focus', on); btn.addEventListener('blur', off);
        layer.appendChild(btn);
        return { id: e.id, g };
      });
      wrap.append(svg, layer);
      draw(drawn);
    }
    function trace(id) {
      svg.classList.toggle('is-tracing', !!id);
      const rel = id ? related(id) : [];
      ents.forEach(x => x.g.classList.toggle('is-on', x.id === id || rel.includes(x.id)));
      lines.forEach(l => l.p.classList.toggle('is-on', !!id && (l.a === id || l.b === id)));
    }
    /* lines draw in one after another; entities fade up just ahead of them */
    function draw(p) {
      drawn = p;
      const n = lines.length;
      lines.forEach((l, i) => { l.p.style.strokeDashoffset = (1 - easeInOut(range(p, 0.15 + i * 0.07, 0.4 + i * 0.07))).toFixed(4); });
      ents.forEach((x, i) => { x.g.style.opacity = (0.15 + 0.85 * range(p, i * 0.06, 0.2 + i * 0.06)).toFixed(3); });
    }
    function start() {
      build();
      mqMobile.addEventListener('change', build);
      if (!hasGSAP || reduced) { draw(1); return; }
      scrub(wrap, { start: 'top 88%', end: 'center 50%' }, draw);
    }
    return { start };
  })();

  /* ==========================================================================
     9. Ch 06 — Journey (pinned, horizontal). The heading band stays solid
     while the cards slide under it, each settling from a lift and a tilt.
     ========================================================================== */
  const journey = (() => {
    const ch = D.CHAPTERS.journey, TL = D.TIMELINE;
    eyebrow($('#journey-eyebrow'), ch);
    rich($('#journey-title'), ch.title);
    $('#journey-range').textContent = TL[0].year + ' → ' + TL[TL.length - 1].year.split('–').pop().trim();
    const pin = $('#journey-pin');
    const track = $('#journey-track');
    const bar = $('.journey-progress span');
    const cards = TL.map((t, i) => {
      const li = h('li', 'j-card');
      const inner = h('div', 'j-inner');
      inner.append(h('span', 'j-i', String(i + 1).padStart(2, '0')), h('p', 'j-year', t.year), h('h3', 'j-title', t.title), h('p', 'j-text', t.text));
      li.appendChild(inner);
      track.appendChild(li);
      return { li, inner, left: 0 };
    });
    let dist = 0, vw = 1;
    const band = $('#journey-band');
    function measure() {
      vw = pin.clientWidth;
      pin.style.setProperty('--band-h', band.offsetHeight + 'px'); // phones: cards sit below the band
      gsap.set(track, { x: 0 });
      dist = Math.max(0, track.scrollWidth - vw);
      cards.forEach(c => { c.left = c.li.offsetLeft; });
    }
    function apply(p) {
      const x = -p * dist;
      gsap.set(track, { x });
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      cards.forEach(c => {
        const left = c.left + x;
        const e = easeOut(clamp01((vw - left) / (vw * 0.42)));
        gsap.set(c.inner, { y: -(1 - e) * 56, rotation: (1 - e) * 5, opacity: 0.25 + 0.75 * e, visibility: e > 0 ? 'visible' : 'hidden' });
      });
    }
    function start() {
      if (!hasGSAP || reduced) { pin.classList.add('is-static'); return; }
      measure();
      const s = scrub(pin, {
        start: 'top top', end: () => '+=' + Math.round(dist * 1.1), pin: true, anticipatePin: 1,
        invalidateOnRefresh: true, onRefreshInit: measure
      }, apply);
      fontsReady.then(() => s.invalidate()); // the post-loader refresh re-measures (onRefreshInit)
    }
    return { start };
  })();

  /* ==========================================================================
     10. Experience (+ the seven-step process and the whoami terminal)
     ========================================================================== */
  (function experience() {
    const ch = D.CHAPTERS.experience;
    eyebrow($('#exp-eyebrow'), ch);
    riseHeadline(rich($('#exp-title'), ch.title), $('#exp-head'), 'top 85%', 'top 45%');
    const list = $('#exp-list');
    const rows = D.EXPERIENCE.map(x => {
      const li = h('li', 'exp-row');
      const body = h('div', 'exp-body');
      const ul = h('ul', 'exp-points');
      x.points.forEach(pt => ul.appendChild(h('li', null, pt)));
      const st = h('ul', 'exp-stack');
      x.stack.forEach(s => st.appendChild(h('li', 'pill', s)));
      body.append(h('h3', 'exp-name', x.title), h('p', 'exp-role', x.role), ul, st);
      li.append(h('p', 'exp-period', x.period), body);
      list.appendChild(li);
      return li;
    });
    const P = D.PROCESS;
    $('#process-title').textContent = P.title;
    $('#process-sub').textContent = P.sub;
    const steps = $('#process-steps');
    P.steps.forEach(s => {
      const li = h('li', 'process-step');
      li.append(h('span', 'process-num', s.num), h('h4', 'process-name', s.title), h('p', 'process-text', s.text));
      steps.appendChild(li);
    });
    terminal($('#whoami-terminal'), D.TERMINALS.whoami);
    if (!hasGSAP || reduced) return;
    [...rows, $('#process')].forEach(el => {
      scrub(el, { start: 'top 90%', end: 'top 62%' }, p => { const e = easeOut(p); gsap.set(el, { y: (1 - e) * 40, opacity: e }); });
    });
  })();

  /* ==========================================================================
     11. Contact + footer
     ========================================================================== */
  (function contact() {
    const ch = D.CHAPTERS.contact, PF = D.PROFILE, L = PF.links;
    eyebrow($('#contact-eyebrow'), ch);
    const title = rich($('#contact-title'), ch.title);
    const sub = $('#contact-sub');
    sub.textContent = ch.sub;
    const links = $('#contact-links');
    const item = (label, value, href, external) => {
      if (!href) return;
      const li = h('li');
      const a = h('a', 'contact-link');
      a.href = href;
      if (external) { a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', label + ', ' + value + ' (opens in a new tab)'); }
      a.append(h('span', 'cl-label', label), h('span', 'cl-value', value), h('span', 'cl-arrow', external ? '↗' : '→'));
      a.lastChild.setAttribute('aria-hidden', 'true');
      li.appendChild(a);
      links.appendChild(li);
    };
    const short = u => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    item('Email', PF.email, L.email, false);
    item('LinkedIn', L.linkedin && short(L.linkedin), L.linkedin, true);
    item('GitHub', L.github && short(L.github), L.github, true);
    if (L.resume) {
      const more = $('#contact-more');
      const a = h('a', 'btn btn-ghost');
      a.href = L.resume;
      a.setAttribute('download', '');
      a.append('Download resume', h('span', 'arrow', '↓'));
      more.append(h('p', null, D.CONTACT.resumeHeading), a);
      more.hidden = false;
    }
    riseHeadline(title, $('#contact'), 'top 80%', 'top 30%', [sub, links]);

    // footer: giant name; letters rise in, and tilt on hover (on the inner span)
    const word = $('#footer-word');
    const letters = [];
    [PF.first, PF.last].forEach((w, wi) => {
      if (wi) word.appendChild(h('span', 'fw-gap'));
      [...w].forEach(ch2 => {
        const outer = h('span', 'fw-l');
        outer.appendChild(h('span', 'fw-i', ch2));
        word.appendChild(outer);
        letters.push(outer);
      });
    });
    function fit() {
      // size the name to the footer's inner width: measure the letters' span at 100px, then scale
      word.style.fontSize = '100px';
      const cs = getComputedStyle(word);
      const inner = word.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const span = letters[letters.length - 1].getBoundingClientRect().right - letters[0].getBoundingClientRect().left;
      word.style.fontSize = (100 * inner / span * 0.99).toFixed(2) + 'px';
    }
    fontsReady.then(fit);
    window.addEventListener('resize', fit);
    $('#footer-copy').textContent = '© ' + new Date().getFullYear() + ' ' + PF.name;
    $('#footer-stack').textContent = PF.footerStack;
    if (!hasGSAP || reduced) return;
    scrub($('#site-footer'), { start: 'top bottom', end: 'bottom bottom' }, p => {
      letters.forEach((l, i) => {
        const e = easeOut(range(p, i * 0.05, 0.45 + i * 0.05));
        gsap.set(l, { yPercent: (1 - e) * 105 });
      });
    });
  })();

  path.start();
  erd.start();
  journey.start();

  /* ==========================================================================
     Nav: active section, hide on scroll down, smooth anchors, mobile menu
     ========================================================================== */
  const header = $('#site-header');
  const pill = $('#nav-pill');
  const navLinks = $$('a', navList);

  function setActive(href) {
    navLinks.forEach(a => {
      const on = a.getAttribute('href') === href;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }

  if (hasGSAP) {
    D.NAV.forEach(item => {
      const sec = document.querySelector(item.href);
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: 'top 55%', end: 'bottom 55%',
        onToggle: self => { if (self.isActive) setActive(item.href); else if (navLinks.some(a => a.classList.contains('is-active') && a.getAttribute('href') === item.href)) setActive(null); }
      });
    });

    let hidden = false;
    const showNav = show => {
      if (show === !hidden) return;
      hidden = !show;
      gsap.to(pill, { yPercent: show ? 0 : -170, duration: 0.45, ease: show ? 'power3.out' : 'power3.in', overwrite: true });
    };
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: self => {
        if (pill.contains(document.activeElement)) return showNav(true);
        if (self.direction === 1 && self.scroll() > 140) showNav(false);
        else if (self.direction === -1) showNav(true);
      }
    });
    pill.addEventListener('focusin', () => showNav(true));
  }

  /* Smooth in-page anchors through Lenis */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 ? document.querySelector(id) : null;
    if (!target) return;
    e.preventDefault();
    if (menu.isOpen) menu.close(false);
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView();
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    history.replaceState(null, '', id);
  });

  const menu = (() => {
    const el = $('#menu');
    const toggle = $('#nav-toggle');
    const closeBtn = $('#menu-close');
    let isOpen = false;
    const focusables = () => $$('a[href], button:not([disabled])', el);

    function open() {
      if (isOpen) return;
      isOpen = true;
      el.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      if (lenis) lenis.stop();
      document.body.style.overflow = 'hidden';
      if (hasGSAP && !reduced) {
        gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.6, ease: 'expo.out' });
        gsap.fromTo($$('.menu-links li', el), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.05, delay: 0.1 });
      }
      $('a', menuList).focus();
    }
    function close(returnFocus = true) {
      if (!isOpen) return;
      isOpen = false;
      el.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (lenis) lenis.start();
      document.body.style.overflow = '';
      if (returnFocus) toggle.focus();
    }
    toggle.addEventListener('click', open);
    closeBtn.addEventListener('click', () => close());
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      const firstEl = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    });
    mqMobile.addEventListener('change', () => { if (!window.matchMedia('(max-width: 900px)').matches) close(false); });
    return { open, close, get isOpen() { return isOpen; } };
  })();

  /* ==========================================================================
     Cursor (pointer:fine only). data-cursor="Open" / "Drag" shows a label.
     ========================================================================== */
  (function cursor() {
    if (!hasGSAP || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const el = $('#cursor');
    const label = $('.cursor-label', el);
    root.classList.add('has-cursor');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' });
    let seen = false;
    window.addEventListener('pointermove', e => {
      if (!seen) { gsap.set(el, { x: e.clientX, y: e.clientY, opacity: 1 }); seen = true; }
      xTo(e.clientX); yTo(e.clientY);
    }, { passive: true });
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor], a, button');
      const text = t && t.dataset.cursor;
      el.classList.toggle('is-label', !!text);
      el.classList.toggle('is-link', !!t && !text);
      if (text) label.textContent = text;
    });
    document.addEventListener('pointerleave', () => gsap.set(el, { opacity: 0 }));
    document.addEventListener('pointerenter', () => gsap.set(el, { opacity: 1 }));
  })();

  /* ==========================================================================
     Intro — runs after the loader. Animates parent elements only so it never
     fights the scroll timelines (which drive the children).
     ========================================================================== */
  loader.ready.then(() => {
    if (hasGSAP) { ScrollTrigger.sort(); ScrollTrigger.refresh(); }
    if (!hasGSAP || reduced) { if (SITE.heroScene) SITE.heroScene.setIntro(1); hero.invalidate(); return; }
    const atTop = hero.progress < 0.02;
    const d = 0.35;
    gsap.from(header, { y: -40, opacity: 0, duration: 0.9, ease: 'power3.out', delay: d + 0.5 });
    if (atTop) {
      gsap.from('.hero-name', { opacity: 0, y: 40, duration: 1.2, ease: 'power3.out', delay: d + 0.45 });
      gsap.from('#hero-meta', { opacity: 0, duration: 0.8, delay: d + 0.9 });
    }
    const sc = SITE.heroScene;
    if (sc) {
      if (atTop) {
        const o = { v: 0 };
        gsap.to(o, { v: 1, duration: 1.8, ease: 'none', delay: d, onUpdate: () => { sc.setIntro(o.v); hero.invalidate(); } });
      } else { sc.setIntro(1); hero.invalidate(); }
    }
  });
})();
