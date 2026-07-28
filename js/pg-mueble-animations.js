/* ════════════════════════════════════════════════════════════════════
   pg-mueble-animations.js — GSAP animations for the Pernia mobiliario
   (furniture) detail page. Mirrors pg-sistema-animations, plus in-context
   gallery reveals. Requires: gsap.min.js + ScrollTrigger.min.js first.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  var animationsStarted = false;
  function startPageAnimations() {
    if (animationsStarted) return;
    animationsStarted = true;

    var mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', function () {
      runAnimations();
      return function () { ScrollTrigger.getAll().forEach(function (t) { t.kill(); }); };
    });
    mm.add('(prefers-reduced-motion: reduce)', function () {
      document.documentElement.classList.remove('gl-js');
    });
  }

  /* The detail content is injected by page-mueble.js after GL_DATA resolves,
     so wait for that data before pre-hiding/revealing (otherwise we hide
     nodes that don't exist yet). Fall back to a timeout if GL_DATA is absent. */
  if (window.GL_DATA && window.GL_DATA.then) {
    window.GL_DATA.then(function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(startPageAnimations);
      });
    });
  }
  setTimeout(startPageAnimations, (window.GL_PAGE_OVERLAY && window.GL_PAGE_OVERLAY.entranceDelay) || 400);

  function runAnimations() {

    /* ── ENTRANCE ─────────────────────────────────────────────────── */
    var nav = document.querySelector('.pg-nav-edge');
    if (nav) gsap.set(nav, { y: -18 });

    var heroMedia = document.querySelector('.pg-sistema_hero_media');
    if (heroMedia) gsap.set(heroMedia, { scale: 1.06 });

    var heroTitle    = document.querySelector('.pg-sistema_hero_title');
    var heroTag      = document.querySelector('.pg-sistema_hero_tag');
    if (heroTitle)    gsap.set(heroTitle,    { autoAlpha: 0, y: 20 });
    /* The subtitle is deliberately NOT pre-hidden. It used to be, and its
       reveal tween never landed — the tween sat unplayed while the title and
       tag (scheduled earlier) completed, so the line stayed at autoAlpha 0
       forever. Invisible before, because it was faint light text at the foot
       of a dark gradient; obvious now that the hero is type on cream. Rather
       than race the timeline, it just starts visible. */
    if (heroTag)      gsap.set(heroTag,      { autoAlpha: 0, y: 10 });

    var tl = gsap.timeline();
    if (nav)          tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (heroMedia)    tl.to(heroMedia,    { scale: 1, duration: 1.6, ease: 'power2.out' }, 0.1);
    if (heroTag)      tl.to(heroTag,      { autoAlpha: 1, y: 0, duration: 0.5 }, 0.45);
    if (heroTitle)    tl.to(heroTitle,    { autoAlpha: 1, y: 0, duration: 0.7 }, 0.55);

    /* ── PRE-HIDE scroll elements ─────────────────────────────────── */
    gsap.set('.pg-sistema_overview_text', { autoAlpha: 0, x: -40 });
    gsap.set('.pg-sistema_overview_visual', { autoAlpha: 0, x: 40 });
    gsap.set('.pg-sistema_specs_row', { autoAlpha: 0, x: 20 });
    gsap.set('.pg-sistema_swatches', { autoAlpha: 0, y: 20 });
    gsap.set('.pg-mob_gallery_item', { autoAlpha: 0, y: 36, scale: 0.96 });
    gsap.set('.pg-sistema_related_grid', { autoAlpha: 0, y: 24 });
    gsap.set('.pg-footer_col', { autoAlpha: 0, y: 20 });

    var swatchItems = document.querySelectorAll('.pg-sistema_swatch-item');

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */
    gsap.to('.pg-sistema_overview_text', {
      autoAlpha: 1, x: 0, duration: 0.85,
      scrollTrigger: { trigger: '.pg-sistema_overview', start: 'top 80%', toggleActions: 'play none none none' }
    });
    gsap.to('.pg-sistema_overview_visual', {
      autoAlpha: 1, x: 0, duration: 0.85, delay: 0.1,
      scrollTrigger: { trigger: '.pg-sistema_overview', start: 'top 80%', toggleActions: 'play none none none' }
    });

    gsap.to('.pg-sistema_specs_row', {
      autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.07,
      scrollTrigger: { trigger: '.pg-sistema_specs', start: 'top 82%', toggleActions: 'play none none none' }
    });

    gsap.to('.pg-sistema_swatches', {
      autoAlpha: 1, y: 0, duration: 0.7,
      scrollTrigger: { trigger: '.pg-sistema_colors', start: 'top 82%', toggleActions: 'play none none none' }
    });
    if (swatchItems.length) {
      gsap.set(swatchItems, { autoAlpha: 0, scale: 0.85 });
      gsap.to(swatchItems, {
        autoAlpha: 1, scale: 1, duration: 0.4, stagger: 0.05,
        scrollTrigger: { trigger: '.pg-sistema_colors', start: 'top 80%', toggleActions: 'play none none none' }
      });
    }

    var galleryGrid = document.querySelector('.pg-mob_gallery_grid');
    if (galleryGrid) {
      gsap.to('.pg-mob_gallery_item', {
        autoAlpha: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.08,
        scrollTrigger: { trigger: galleryGrid, start: 'top 80%', toggleActions: 'play none none none' }
      });
    }

    gsap.to('.pg-sistema_related_grid', {
      autoAlpha: 1, y: 0, duration: 0.7,
      scrollTrigger: { trigger: '.pg-sistema_related', start: 'top 82%', toggleActions: 'play none none none' }
    });

    gsap.to('.pg-footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.pg-footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
