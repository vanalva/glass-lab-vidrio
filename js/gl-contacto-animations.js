/* ════════════════════════════════════════════════════════════════════
   gl-contacto-animations.js — GSAP animations for Contacto page
   Elegant, minimal — form-first page.
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
    const nav = document.querySelector('.gl-home_nav-edge');
    gsap.set(nav, { y: -18 });

    /* Header title words stagger up */
    const headerTitle = document.querySelector('.gl-contacto_header_title');
    const titleWords = headerTitle ? splitWords(headerTitle) : [];
    if (titleWords.length) {
      gsap.set(headerTitle, { opacity: 1 });
      gsap.set(titleWords, { y: 36, autoAlpha: 0 });
    }

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (titleWords.length) {
      tl.to(titleWords, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.04, ease: 'power3.out' }, '-=0.35');
    }

    /* ── PRE-HIDE scroll-animated elements ───────────────────────── */
    const formRows = document.querySelectorAll('.gl-contacto_form_row, .gl-contacto_form_double');
    if (formRows.length) gsap.set(formRows, { autoAlpha: 0, x: -20 });

    const formTextarea = document.querySelector('.gl-contacto_form_row:has(.gl-contacto_form_textarea), .gl-contacto_form_textarea');
    const formSubmit = document.querySelector('.gl-contacto_form_submit');
    if (formSubmit) gsap.set(formSubmit, { autoAlpha: 0, y: 14 });

    gsap.set('.gl-contacto_info', { autoAlpha: 0, x: 30 });

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    /* Form fields stagger from left */
    if (formRows.length) {
      gsap.to(formRows, {
        autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.08,
        scrollTrigger: { trigger: '.gl-contacto_form', start: 'top 82%', toggleActions: 'play none none none' }
      });
    }
    if (formSubmit) {
      gsap.to(formSubmit, {
        autoAlpha: 1, y: 0, duration: 0.55, delay: 0.3,
        scrollTrigger: { trigger: '.gl-contacto_form', start: 'top 82%', toggleActions: 'play none none none' }
      });
    }

    /* Info section slides from right */
    gsap.to('.gl-contacto_info', {
      autoAlpha: 1, x: 0, duration: 0.8,
      scrollTrigger: { trigger: '.gl-contacto_split', start: 'top 80%', toggleActions: 'play none none none' }
    });

    /* Info groups stagger */
    const infoGroups = document.querySelectorAll('.gl-contacto_info_group');
    if (infoGroups.length) {
      gsap.set(infoGroups, { autoAlpha: 0, y: 12 });
      gsap.to(infoGroups, {
        autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1,
        scrollTrigger: { trigger: '.gl-contacto_info', start: 'top 80%', toggleActions: 'play none none none' }
      });
    }

    /* Footer */
    gsap.to('.gl-home_footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.gl-home_footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
