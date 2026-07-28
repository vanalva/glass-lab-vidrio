/* ════════════════════════════════════════════════════════════════════
   pg-sistema-animations.js — GSAP animations for Pernia Glass Sistema detail
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  let animationsStarted = false;
  function startPageAnimations() {
    if (animationsStarted) return;
    animationsStarted = true;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      runAnimations();
      return () => ScrollTrigger.getAll().forEach(t => t.kill());
    });
    mm.add('(prefers-reduced-motion: reduce)', () => {
      document.documentElement.classList.remove('gl-js');
    });
  }

  setTimeout(startPageAnimations, (window.GL_PAGE_OVERLAY && window.GL_PAGE_OVERLAY.entranceDelay) || 180);

  function runAnimations() {

    /* ── ENTRANCE ─────────────────────────────────────────────────── */
    const nav = document.querySelector('.pg-nav-edge');
    gsap.set(nav, { y: -18 });

    /* Hero — Ken Burns */
    const heroMedia = document.querySelector('.pg-sistema_hero_media');
    if (heroMedia) gsap.set(heroMedia, { scale: 1.06 });

    const heroTitle    = document.querySelector('.pg-sistema_hero_title');
    if (heroTitle)    gsap.set(heroTitle,    { autoAlpha: 0, y: 20 });
    /* The subtitle is deliberately NOT pre-hidden. It used to be, and its
       reveal tween never landed — the tween sat unplayed while the title and
       tag (scheduled earlier) completed, so the line stayed at autoAlpha 0
       forever. Invisible before, because it was faint light text at the foot
       of a dark gradient; obvious now that the hero is type on cream. Rather
       than race the timeline, it just starts visible. */

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (heroMedia)    tl.to(heroMedia,    { scale: 1, duration: 1.6, ease: 'power2.out' }, 0.1);
    if (heroTitle)    tl.to(heroTitle,    { autoAlpha: 1, y: 0, duration: 0.7 }, 0.5);

    /* ── PRE-HIDE scroll elements ─────────────────────────────────── */
    gsap.set('.pg-sistema_overview_text', { autoAlpha: 0, x: -40 });
    gsap.set('.pg-sistema_overview_visual', { autoAlpha: 0, x: 40 });
    gsap.set('.pg-sistema_specs_row', { autoAlpha: 0, x: 20 });
    gsap.set('.pg-sistema_swatches', { autoAlpha: 0, y: 20 });
    gsap.set('.pg-sistema_related_grid', { autoAlpha: 0, y: 24 });
    gsap.set('.pg-footer_col', { autoAlpha: 0, y: 20 });

    /* Profile color swatches individually */
    const swatchItems = document.querySelectorAll('.pg-sistema_swatch, [class*="swatch"]');

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    /* Overview — sticky-style: image pins while text alongside */
    gsap.to('.pg-sistema_overview_text', {
      autoAlpha: 1, x: 0, duration: 0.85,
      scrollTrigger: { trigger: '.pg-sistema_overview', start: 'top 80%', toggleActions: 'play none none none' }
    });
    gsap.to('.pg-sistema_overview_visual', {
      autoAlpha: 1, x: 0, duration: 0.85, delay: 0.1,
      scrollTrigger: { trigger: '.pg-sistema_overview', start: 'top 80%', toggleActions: 'play none none none' }
    });

    /* Specs table rows stagger in */
    gsap.to('.pg-sistema_specs_row', {
      autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.07,
      scrollTrigger: { trigger: '.pg-sistema_specs', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Profile colors */
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

    /* Downloads section */
    const downloadCards = document.querySelectorAll('.pg-sistema_download-card');
    if (downloadCards.length) {
      gsap.set(downloadCards, { autoAlpha: 0, y: 20 });
      gsap.to(downloadCards, {
        autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
        scrollTrigger: { trigger: '.pg-sistema_downloads', start: 'top 82%', toggleActions: 'play none none none' }
      });
    }

    /* Related systems */
    gsap.to('.pg-sistema_related_grid', {
      autoAlpha: 1, y: 0, duration: 0.7,
      scrollTrigger: { trigger: '.pg-sistema_related', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Footer */
    gsap.to('.pg-footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.pg-footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
