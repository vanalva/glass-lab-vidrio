/* ════════════════════════════════════════════════════════════════════
   pg-proyecto-animations.js — GSAP animations for Pernia Glass Proyecto detail
   Light theme equivalent of gl-proyecto.
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
    const heroMedia = document.querySelector('.pg-proyecto_hero_media');
    if (heroMedia) {
      gsap.set(heroMedia, { scale: 1.06 });
      gsap.to(heroMedia, { scale: 1, duration: 1.6, ease: 'power2.out', delay: 0.1 });
    }

    /* Hero overlay text — same cadence as gl-proyecto (title → meta → tags) */
    const heroCrumb = document.querySelector('.pg-proyecto_hero_breadcrumb');
    const heroTitle = document.querySelector('.pg-proyecto_hero_title');
    const heroLoc   = document.querySelector('.pg-proyecto_hero_location');
    const heroTags  = document.querySelector('.pg-proyecto_hero_tags');
    if (heroCrumb) gsap.set(heroCrumb, { autoAlpha: 0, y: 18 });
    if (heroTitle) gsap.set(heroTitle, { autoAlpha: 0, y: 24 });
    if (heroLoc)   gsap.set(heroLoc,   { autoAlpha: 0, y: 18 });
    if (heroTags)  gsap.set(heroTags,  { autoAlpha: 0, y: 14 });

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (heroCrumb) tl.to(heroCrumb, { autoAlpha: 1, y: 0, duration: 0.55 }, 0.45);
    if (heroTitle) tl.to(heroTitle, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.5);
    if (heroLoc)   tl.to(heroLoc,   { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.4');
    if (heroTags)  tl.to(heroTags,  { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.35');

    /* ── PRE-HIDE scroll-animated elements ───────────────────────── */
    gsap.set('.pg-proyecto_description_text', { autoAlpha: 0, y: 28 });
    gsap.set('.pg-proyecto_system-ref', { autoAlpha: 0, y: 20 });
    gsap.set('.pg-proyecto_gallery_img-pano, .pg-proyecto_gallery_img-half', { autoAlpha: 0 });
    gsap.set('.pg-footer_col', { autoAlpha: 0, y: 20 });

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    gsap.to('.pg-proyecto_description_text', {
      autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.15,
      scrollTrigger: { trigger: '.pg-proyecto_description', start: 'top 82%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.batch('.pg-proyecto_gallery_img-pano, .pg-proyecto_gallery_img-half', {
      start: 'top 88%',
      onEnter: (els) => gsap.to(els, {
        autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out', overwrite: true
      }),
      once: true
    });

    gsap.to('.pg-proyecto_system-ref', {
      autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.1,
      scrollTrigger: { trigger: '.pg-proyecto_systems', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Footer */
    gsap.to('.pg-footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.pg-footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
