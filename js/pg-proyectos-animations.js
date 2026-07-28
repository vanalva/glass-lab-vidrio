/* ════════════════════════════════════════════════════════════════════
   pg-proyectos-animations.js — GSAP animations for Pernia Glass Proyectos page
   Light theme equivalent of gl-proyectos.
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  function splitWords(el) {
    if (!el) return [];
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map(w => `<span class="gsap-word" style="display:inline-block;overflow:hidden;vertical-align:top"><span class="gsap-word-inner" style="display:inline-block">${w}</span></span>`)
      .join(' ');
    return Array.from(el.querySelectorAll('.gsap-word-inner'));
  }

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

    const pageTitle = document.querySelector('.pg-page-header h1, .pg-page-header_title');
    const titleWords = pageTitle ? splitWords(pageTitle) : [];
    if (titleWords.length) {
      gsap.set(pageTitle, { opacity: 1 });
      gsap.set(titleWords, { y: 36, autoAlpha: 0 });
    }

    const filterPills = document.querySelectorAll('.pg-page-header .gl-filter-radio-pill, .pg-page-header .gl-filter-input');
    if (filterPills.length) gsap.set(filterPills, { autoAlpha: 0, x: -10 });

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (titleWords.length) {
      tl.to(titleWords, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.04, ease: 'power3.out' }, '-=0.35');
    }
    if (filterPills.length) {
      tl.to(filterPills, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.06 }, '-=0.3');
    }

    /* ── PRE-HIDE project cards + footer ──────────────────────────── */
    gsap.set('.pg-proyectos_card', { autoAlpha: 0 });
    gsap.set('.pg-footer_col', { autoAlpha: 0, y: 20 });

    /* ── BATCH REVEAL ─────────────────────────────────────────────── */
    ScrollTrigger.batch('.pg-proyectos_card', {
      start: 'top 88%',
      onEnter: (els) => gsap.to(els, {
        autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.1, ease: 'power2.out', overwrite: true
      }),
      once: true
    });

    /* Footer */
    gsap.to('.pg-footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.pg-footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
