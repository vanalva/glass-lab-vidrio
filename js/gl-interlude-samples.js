/* ════════════════════════════════════════════════════════════════════
   gl-interlude-samples.js — section-anchored decorative lenses on the
   "Vidrio que recuerda la luz" Interlude section.

   These are REAL lenses spawned through glLente.spawn() with a
   `bounds` option that clamps their drag/resize to the interlude
   <section> and makes them follow the section on scroll. They behave
   exactly like normal lenses (draggable, editable via the panel
   editor) but cannot be moved outside the section.

   Each sample loads a REAL catalog preset from window.GL_LENTE_PRESETS
   (one of the 51 Glass Lab products), picked fresh at random every load —
   so the section reads as an actual shelf of the catalog rather than
   procedurally-generated glass. Desktop and mobile both draw from the
   same catalog pool; only the anchor positions/sizes differ.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* ── Preset-driven composition ───────────────────────────────────────
     Samples are REAL catalog glasses, not random layer soup. Each sample
     loads one preset from window.GL_LENTE_PRESETS (built from the Glass Lab
     catalog) so the scatter reads as an actual shelf of products. A fresh
     random selection is drawn every load. */
  function presetPool() {
    var all = window.GL_LENTE_PRESETS || [];
    /* Skip the near-invisible clear glasses so the scatter isn't dotted with
       empty circles — every other catalog product is fair game. */
    var EXCLUDE = { 'vidrio-claro': 1, 'vidrio-ultraclaro': 1 };
    var pool = all.filter(function (p) { return p && p.layers && p.layers.length && !EXCLUDE[p.id]; });
    return pool.length ? pool : all;
  }
  /* n distinct presets, shuffled fresh each call (wraps if n > pool size). */
  function pickPresets(n) {
    var pool = presetPool().slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    var out = [];
    for (var k = 0; k < n; k++) out.push(pool[k % pool.length]);
    return out;
  }

  /* Spawn one sample lens from a catalog preset — loads the preset's exact
     layer stack (glass + feature + cap, incl. mesh skins) so the decorative
     sample IS the real product. With suppressSpawn=true the lens is created
     invisible and revealed on scroll. */
  function spawnSample(boundsEl, anchorPx, sizePx, suppressSpawn, preset) {
    if (!preset || !preset.layers || !preset.layers.length) return null;
    var layers = preset.layers;
    var spawnOpts = Object.assign({}, layers[0], {
      bounds: boundsEl,
      anchorX: anchorPx.x,
      anchorY: anchorPx.y,
      size: sizePx
    });
    if (suppressSpawn) spawnOpts.suppressSpawnAnim = true;
    var lens = window.glLente.spawn(spawnOpts);
    if (!lens) return null;
    /* Add remaining layers — addLayer() inherits the lens's preHidden flag. */
    for (var i = 1; i < layers.length; i++) {
      window.glLente.addLayer(layers[i]);
    }
    /* Tag the lens with its catalog identity (for labels / analytics). */
    lens.presetId = preset.id;
    lens.presetCode = preset.code;
    return lens;
  }

  var IS_TOUCH = window.matchMedia('(hover: none)').matches
    || window.matchMedia('(pointer: coarse)').matches;
  var VW = window.innerWidth;

  /* Wide layouts (real-mouse desktop + wide-touch/iPad) keep their
     hand-tuned scatter — the positions were art-directed around the
     centered heading, so they stay fixed. Sizes clamped so a sample +
     its -21% skin bleed never crosses the viewport edge. */
  var STATIC_ANCHORS = IS_TOUCH ? [
    { fx: 0.14, fy: 0.28, size: 188 },
    { fx: 0.50, fy: 0.15, size: 148 },
    { fx: 0.86, fy: 0.32, size: 172 },
    { fx: 0.30, fy: 0.72, size: 196 },
    { fx: 0.72, fy: 0.78, size: 180 }
  ] : [
    { fx: 0.11, fy: 0.30, size: 220 },
    { fx: 0.49, fy: 0.14, size: 170 },
    { fx: 0.85, fy: 0.34, size: 200 },
    { fx: 0.29, fy: 0.68, size: 260 },
    { fx: 0.13, fy: 0.88, size: 170 },
    { fx: 0.66, fy: 0.80, size: 230 },
    { fx: 0.92, fy: 0.76, size: 190 }
  ];

  /* Mobile / small-tablet (<=991px): positions are GENERATED FRESH each
     load — stratified-random, so the scatter is well spread yet never the
     same twice. Samples sit in a TOP band and a BOTTOM band, leaving the
     vertical centre clear for the heading. Within each band they're split
     into equal horizontal columns (one sample per column → they can't
     clump), then jittered inside the column with a randomised size. Every
     placement is padded by the sample's ~21% skin bleed (half-extent
     ~0.72×size) so nothing clips the viewport edge. Now that mobile lenses
     ride native scroll with no backdrop-filter, a few more samples are
     cheap, so the count ticks up from the old flat 3. */
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  function buildMobileAnchors(rect) {
    var W = rect.width, H = rect.height;
    var isPhone = VW <= 478;
    var count  = isPhone ? randInt(3, 4) : randInt(4, 5);
    var sizeLo = isPhone ? 96  : 128;
    var sizeHi = isPhone ? 132 : 184;
    var bands  = [ [0.04, 0.27], [0.73, 0.96] ];   /* top / bottom, heading-safe */

    /* Split `count` across the two bands as evenly as possible. */
    var perBand = bands.map(function () { return 0; });
    for (var i = 0; i < count; i++) perBand[i % bands.length]++;

    var anchors = [];
    for (var b = 0; b < bands.length; b++) {
      var n = perBand[b];
      if (!n) continue;
      var band = bands[b];
      /* Shuffle column order so the left/right ordering isn't predictable
         between the top and bottom bands. */
      var cols = [];
      for (var c = 0; c < n; c++) cols.push(c);
      for (var s = cols.length - 1; s > 0; s--) {
        var j = Math.floor(Math.random() * (s + 1));
        var tmp = cols[s]; cols[s] = cols[j]; cols[j] = tmp;
      }
      var cellW = W / n;
      for (var k = 0; k < n; k++) {
        var size  = randInt(sizeLo, sizeHi);
        var bleed = size * 0.72;                 /* half-extent incl. skin bleed */
        var col   = cols[k];
        var cxMin = col * cellW + bleed;
        var cxMax = (col + 1) * cellW - bleed;
        var cx = cxMax > cxMin ? rand(cxMin, cxMax)
                               : Math.min(Math.max(col * cellW + cellW / 2, bleed), W - bleed);
        var byMin = band[0] * H + bleed;
        var byMax = band[1] * H - bleed;
        var cy = byMax > byMin ? rand(byMin, byMax) : (byMin + byMax) / 2;
        anchors.push({ fx: cx / W, fy: cy / H, size: size });
      }
    }
    return anchors;
  }

  /* Assigned in init() once the section rect is known: mobile widths
     generate from the live rect; wider layouts use the static scatter. */
  var ANCHORS = null;

  /* Pre-spawn every sample lens in the BACKGROUND via requestIdleCallback
     so the heavy backdrop-filter compositing happens off the critical
     path. Each lens is created invisible (opacity 0, visibility hidden)
     so the user never sees them being built. When the section scrolls
     into view, a separate reveal step fades them in cheaply (just an
     opacity tween — no spawn cost). */
  function preSpawnAllSamples(section, rect, onAllDone) {
    var spawned = [];
    /* One catalog preset per anchor, freshly shuffled this load. */
    var presets = pickPresets(ANCHORS.length);
    var i = 0;
    function next() {
      if (i >= ANCHORS.length) { onAllDone(spawned); return; }
      var a = ANCHORS[i];
      var lens = spawnSample(section, {
        x: a.fx * rect.width  - a.size / 2,
        y: a.fy * rect.height - a.size / 2
      }, a.size, /* suppressSpawn */ true, presets[i]);
      i++;
      if (lens) spawned.push(lens);
      /* Yield to the browser between spawns. requestIdleCallback is
         best — runs in spare frame time so we don't compete with
         scroll handlers or other rendering. Falls back to a short
         setTimeout where IC isn't available (Safari < 17). */
      if (window.requestIdleCallback) {
        window.requestIdleCallback(next, { timeout: 600 });
      } else {
        setTimeout(next, 24); /* ~1.5 frames at 60fps */
      }
    }
    next();
  }

  function revealAllSamples(samples) {
    samples.forEach(function (lens, i) {
      /* Stagger the reveal with a soft 110ms gap. The reveal itself
         is just a 0.7s opacity fade per lens — the rendering work has
         already been done during pre-spawn. */
      setTimeout(function () { window.glLente.reveal(lens); }, i * 110);
    });
  }

  function init() {
    var section = document.querySelector('.gl-home_interlude');
    if (!section || !window.glLente) return;
    /* Wait until the section is in the DOM with measurable dimensions. */
    var rect = section.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      requestAnimationFrame(init);
      return;
    }

    /* Mobile/tablet generate a fresh stratified-random scatter from the
       live section box; wider layouts use the art-directed static set. */
    ANCHORS = (VW <= 991) ? buildMobileAnchors(rect) : STATIC_ANCHORS;

    /* If we get here AFTER the user has already scrolled past the
       trigger point (e.g. page loaded with a hash deep-link), don't
       bother with the deferred pre-spawn dance — just reveal
       everything immediately. */
    var triggered = false;
    var samples = [];

    preSpawnAllSamples(section, rect, function (allLenses) {
      samples = allLenses;
      /* If the section is ALREADY in view by the time pre-spawning
         finishes (slow device, very fast user), reveal immediately. */
      if (triggered) revealAllSamples(samples);
    });

    if (window.gsap && window.ScrollTrigger) {
      window.ScrollTrigger.create({
        trigger: section,
        start: 'top 85%',
        once: true,
        onEnter: function () {
          triggered = true;
          /* If pre-spawn already finished, samples[] is populated and
             we can reveal now. Otherwise the preSpawn callback above
             will reveal when it finishes. */
          if (samples.length) revealAllSamples(samples);
        }
      });
    } else {
      /* No ScrollTrigger — fall back to revealing as soon as
         pre-spawn finishes (no scroll-based delay). */
      triggered = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
