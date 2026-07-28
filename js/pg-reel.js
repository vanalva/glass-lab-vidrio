/* ════════════════════════════════════════════════════════════════════
   pg-reel.js — Lazy, gated playback for the Proyectos reel marquee.

   The reel is 14 <video> elements (7 clips, each duplicated for the
   seamless loop) totalling ~17.7 MB. They used to be autoplay +
   preload="auto", so every visitor — a phone on cellular included —
   paid the full 17.7 MB before the section was ever scrolled to.
   This module makes the files load only where they are actually
   watchable, and only when they are actually on screen.

   The markup carries no src at all: each <video> holds a data-src, so
   nothing is fetched until this script assigns it.

   Touch / <=991px: the files are never requested. No poster stills
   exist, so the empty reel section is hidden (.is-empty).

   Mouse desktop: an IntersectionObserver assigns src on a card's first
   intersection and plays it, and pauses it when it leaves. Under
   prefers-reduced-motion the clip is pulled metadata-only and left
   standing on its first frame — a still, not a loop.

   The marquee's own rAF auto-scroll / drag physics stay inline in
   pg-proyectos.html; playback is owned here so the two never fight.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    var marquee = document.querySelector('.pg-reel_marquee');
    if (!marquee) return;

    var videos = marquee.querySelectorAll('video[data-src]');
    if (!videos.length) return;

    /* The same three-clause gate the rest of the site uses for heavy
       effects (gl-dock-vitrina.js, gl-spline-poster.js,
       gl-index-animations.js): <=991px, no hover, or a coarse pointer —
       an iPad Pro reporting a desktop width still counts as touch. */
    var STATIC = window.matchMedia('(max-width: 991px)').matches
      || window.matchMedia('(hover: none)').matches
      || window.matchMedia('(pointer: coarse)').matches;

    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ─── Touch / small screens: never fetch a byte of video ─────────── */
    if (STATIC) {
      Array.prototype.forEach.call(videos, function (v) {
        v.removeAttribute('data-src');   /* nothing can lazily kick in later */
      });
      var section = marquee.closest('.pg-reel');
      if (section) section.classList.add('is-empty');
      return;
    }

    /* ─── Mouse desktop: load + play on demand ───────────────────────── */
    function load(v) {
      if (v.__pgReelLoaded) return;
      v.__pgReelLoaded = true;
      v.preload = REDUCED ? 'metadata' : 'auto';
      v.src = v.getAttribute('data-src');
      v.load();
    }

    function play(v) {
      load(v);
      if (REDUCED) return;             /* still frame only — no loop */
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }

    /* No observer (very old browser): keep the files unloaded rather
       than restore the former 14-video initial payload. */
    if (!('IntersectionObserver' in window)) {
      return;
    }

    /* Root is the viewport, but .pg-reel_marquee's overflow:hidden clips
       the intersection rect too — so a card only counts as visible once
       it has actually slid into the marquee window. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) play(v);
        else if (v.__pgReelLoaded && !v.paused) v.pause();
      });
    }, { root: null, threshold: 0 });

    Array.prototype.forEach.call(videos, function (v) { io.observe(v); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
