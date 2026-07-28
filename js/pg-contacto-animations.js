/* ════════════════════════════════════════════════════════════════════
   pg-contacto-animations.js — GSAP animations for Pernia Glass Contacto page
   Light theme equivalent of gl-contacto. Elegant, minimal.
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

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (titleWords.length) {
      tl.to(titleWords, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.04, ease: 'power3.out' }, '-=0.35');
    }

    /* ── PRE-HIDE scroll-animated elements ───────────────────────── */
    const formFields = document.querySelectorAll('.pg-contacto_form-field, .pg-contacto_form-row');
    if (formFields.length) gsap.set(formFields, { autoAlpha: 0, x: -20 });

    const formSubmit = document.querySelector('.pg-contacto_form-submit, [type="submit"]');
    if (formSubmit) gsap.set(formSubmit, { autoAlpha: 0, y: 14 });

    gsap.set('.pg-contacto_info', { autoAlpha: 0, x: 30 });
    gsap.set('.pg-footer_col', { autoAlpha: 0, y: 20 });

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    /* Form fields stagger from left */
    if (formFields.length) {
      gsap.to(formFields, {
        autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.08,
        scrollTrigger: { trigger: '.pg-contacto_form', start: 'top 82%', toggleActions: 'play none none none' }
      });
    }
    if (formSubmit) {
      gsap.to(formSubmit, {
        autoAlpha: 1, y: 0, duration: 0.55, delay: 0.3,
        scrollTrigger: { trigger: '.pg-contacto_form', start: 'top 82%', toggleActions: 'play none none none' }
      });
    }

    /* Info section slides from right */
    gsap.to('.pg-contacto_info', {
      autoAlpha: 1, x: 0, duration: 0.8,
      scrollTrigger: { trigger: '.pg-contacto_split', start: 'top 80%', toggleActions: 'play none none none' }
    });

    const infoGroups = document.querySelectorAll('.pg-contacto_info-group, .pg-contacto_info_group');
    if (infoGroups.length) {
      gsap.set(infoGroups, { autoAlpha: 0, y: 12 });
      gsap.to(infoGroups, {
        autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1,
        scrollTrigger: { trigger: '.pg-contacto_info', start: 'top 80%', toggleActions: 'play none none none' }
      });
    }

    /* Footer */
    gsap.to('.pg-footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.pg-footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
