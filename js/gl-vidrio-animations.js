/* ════════════════════════════════════════════════════════════════════
   gl-vidrio-animations.js — GSAP animations for Glass Detail page
   Dynamic page: hero content populated by page-vidrio.js from GL_DATA.
   Requires: gsap.min.js + ScrollTrigger.min.js
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  /* SYNCHRONOUS: hide static nav before first paint — only when the reveal
     will run (under prefers-reduced-motion the reveal never fires, so hiding
     here would leave the navbar invisible). */
  var nav = document.querySelector('.gl-home_nav-edge');
  if (nav && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) gsap.set(nav, { autoAlpha: 0, y: -18 });

  var mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', function () {
    if (nav) gsap.to(nav, { autoAlpha: 1, y: 0, duration: 0.65 });

    /* Hero content is dynamic — wait for GL_DATA before animating */
    var glData = window.GL_DATA;
    if (glData && typeof glData.then === 'function') {
      glData.then(function () { setTimeout(runHeroAnimations, 80); });
    } else {
      setTimeout(runHeroAnimations, 250);
    }

    setTimeout(runScrollAnimations, 350);
    return function () { ScrollTrigger.getAll().forEach(function (t) { t.kill(); }); };
  });

  mm.add('(prefers-reduced-motion: reduce)', function () {
    if (nav) gsap.set(nav, { clearProps: 'all' });
  });

  function runHeroAnimations() {
    var heroVisual  = document.querySelector('.gl-vidrio_hero_visual');
    var heroSymbol  = document.querySelector('.gl-hero-symbol');
    var heroName    = document.querySelector('.gl-vidrio_hero_name');
    var heroSpecs   = document.querySelector('.gl-vidrio_hero_info');
    var heroActions = document.querySelector('.gl-vidrio_hero_actions');

    if (heroVisual)  gsap.set(heroVisual,  { autoAlpha: 0, scale: 0.96 });
    if (heroSymbol)  gsap.set(heroSymbol,  { autoAlpha: 0, scale: 0.85, rotation: -15 });
    if (heroName)    gsap.set(heroName,    { autoAlpha: 0, y: 20 });
    if (heroSpecs)   gsap.set(heroSpecs,   { autoAlpha: 0, x: 30 });
    if (heroActions) gsap.set(heroActions, { autoAlpha: 0, y: 16 });

    requestAnimationFrame(function () {
      var tl = gsap.timeline();
      if (heroVisual)  tl.to(heroVisual,  { autoAlpha: 1, scale: 1, duration: 1.0, ease: 'power3.out' }, 0);
      if (heroSymbol)  tl.to(heroSymbol,  { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.6)' }, 0.2);
      if (heroName)    tl.to(heroName,    { autoAlpha: 1, y: 0, duration: 0.65 }, '-=0.5');
      if (heroSpecs)   tl.to(heroSpecs,   { autoAlpha: 1, x: 0, duration: 0.7 },  '-=0.5');
      if (heroActions) tl.to(heroActions, { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.35');
    });
  }

  /* Scroll reveals: gsap.from + immediateRender:false — no pre-hiding needed */
  function runScrollAnimations() {
    ScrollTrigger.batch('.gl-vidrio_prop-card', {
      start: 'top 88%', once: true,
      onEnter: function (els) {
        gsap.from(els, {
          autoAlpha: 0,
          y: 20,
          filter: 'blur(8px)',
          duration: 0.65,
          stagger: 0.08,
          ease: 'power2.out',
          clearProps: 'filter',
          immediateRender: false
        });
      }
    });
    gsap.from('.gl-vidrio_hero_specs .gl-spec-row', {
      autoAlpha: 0,
      x: 20,
      duration: 0.45,
      stagger: { each: 0.07, from: 'start' },
      immediateRender: false,
      scrollTrigger: {
        trigger: '.gl-vidrio_hero_specs',
        start: 'top 85%',
        once: true
      }
    });
    ScrollTrigger.batch('.gl-vidrio_gallery_img', {
      start: 'top 88%', once: true,
      onEnter: function (els) { gsap.from(els, { autoAlpha: 0, x: 30, duration: 0.65, stagger: 0.1, immediateRender: false }); }
    });
    gsap.from('.gl-vidrio_related_row', { autoAlpha: 0, y: 24, duration: 0.7, immediateRender: false,
      scrollTrigger: { trigger: '.gl-vidrio_related_row', start: 'top 85%', toggleActions: 'play none none none' }
    });

    // Section 05 — Pernia Glass
    var perniaSection = document.querySelector('.gl-vidrio_pernia');
    if (perniaSection) {
      gsap.from('.gl-vidrio_pernia_header', {
        autoAlpha: 0, y: 20, duration: 0.7, immediateRender: false,
        scrollTrigger: { trigger: '.gl-vidrio_pernia', start: 'top 82%', once: true }
      });
      gsap.from('.gl-vidrio_pernia_desc', {
        autoAlpha: 0, y: 14, duration: 0.6, delay: 0.1, immediateRender: false,
        scrollTrigger: { trigger: '.gl-vidrio_pernia', start: 'top 82%', once: true }
      });
      ScrollTrigger.batch('.gl-vidrio_pernia_grid .gl-cell, .gl-vidrio_pernia_grid .pg-sistemas_card', {
        start: 'top 88%', once: true,
        onEnter: function (els) {
          gsap.from(els, {
            autoAlpha: 0, y: 16, scale: 0.96, duration: 0.55,
            stagger: 0.08, ease: 'power2.out', immediateRender: false
          });
        }
      });
    }

    gsap.from('.gl-vidrio_cta_heading', { autoAlpha: 0, y: 24, duration: 0.7, immediateRender: false,
      scrollTrigger: { trigger: '.gl-vidrio_cta', start: 'top 85%', toggleActions: 'play none none none' }
    });
    gsap.from('.gl-vidrio_cta .gl-mono_muted, .gl-vidrio_cta p', {
      autoAlpha: 0, y: 12, duration: 0.5, delay: 0.15, immediateRender: false,
      scrollTrigger: { trigger: '.gl-vidrio_cta', start: 'top 85%', once: true }
    });
    gsap.from('.gl-vidrio_cta_actions', {
      autoAlpha: 0, y: 12, duration: 0.5, delay: 0.25, immediateRender: false,
      scrollTrigger: { trigger: '.gl-vidrio_cta', start: 'top 85%', once: true }
    });

    ScrollTrigger.batch('.gl-home_footer_col', {
      start: 'top 90%', once: true,
      onEnter: function (els) { gsap.from(els, { autoAlpha: 0, y: 20, duration: 0.5, stagger: 0.08, immediateRender: false }); }
    });
    ScrollTrigger.refresh();
  }
})();
