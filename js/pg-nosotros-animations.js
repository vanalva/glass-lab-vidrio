/* ════════════════════════════════════════════════════════════════════
   pg-nosotros-animations.js — GSAP animations for Pernia Glass Nosotros page
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

    /* Hero — split entrance: image from left, text from right */
    const heroVisual = document.querySelector('.pg-nosotros_hero_visual');
    const heroText   = document.querySelector('.pg-nosotros_hero_text');
    if (heroVisual) gsap.set(heroVisual, { autoAlpha: 0, x: -40 });
    if (heroText)   gsap.set(heroText,   { autoAlpha: 0, x: 40 });

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (heroVisual) tl.to(heroVisual, { autoAlpha: 1, x: 0, duration: 0.9, ease: 'power3.out' }, 0.15);
    if (heroText)   tl.to(heroText,   { autoAlpha: 1, x: 0, duration: 0.9, ease: 'power3.out', delay: 0.08 }, 0.15);

    /* ── PRE-HIDE scroll elements ─────────────────────────────────── */
    gsap.set('.gl-statement_header', { autoAlpha: 0, y: 24 });
    gsap.set('.gl-person_visual', { autoAlpha: 0, x: -40 });
    gsap.set('.gl-person_info', { autoAlpha: 0, x: 40 });
    gsap.set('.pg-nosotros_mission_content', { autoAlpha: 0, y: 28 });
    gsap.set('.pg-nosotros_lab_visual', { autoAlpha: 0, x: -40 });
    gsap.set('.pg-nosotros_lab_text', { autoAlpha: 0, x: 40 });
    gsap.set('.pg-nosotros_cert-item', { autoAlpha: 0, y: 24 });
    gsap.set('.gl-testimonial', { autoAlpha: 0, y: 24 });
    gsap.set('.gl-statement_cta', { autoAlpha: 0, y: 14 });
    gsap.set('.gl-values_item', { autoAlpha: 0, scale: 0.85 });
    gsap.set('.pg-footer_col', { autoAlpha: 0, y: 20 });

    /* Vision statement — large display text, words stagger dramatically */
    const statementBody = document.querySelector('.gl-statement_body');
    if (statementBody) {
      const stWords = splitWords(statementBody);
      if (stWords.length) {
        gsap.set(statementBody, { opacity: 1 });
        gsap.set(stWords, { y: 40, autoAlpha: 0 });
        gsap.to(stWords, {
          y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.035, ease: 'power3.out',
          scrollTrigger: { trigger: '.gl-statement', start: 'top 78%', toggleActions: 'play none none none' }
        });
      }
    }

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    gsap.to('.gl-statement_header', {
      autoAlpha: 1, y: 0, duration: 0.65,
      scrollTrigger: { trigger: '.gl-statement', start: 'top 82%', toggleActions: 'play none none none' }
    });
    gsap.to('.gl-statement_cta', {
      autoAlpha: 1, y: 0, duration: 0.6, delay: 0.2,
      scrollTrigger: { trigger: '.gl-statement', start: 'top 78%', toggleActions: 'play none none none' }
    });

    /* Mission */
    gsap.to('.pg-nosotros_mission_content', {
      autoAlpha: 1, y: 0, duration: 0.75,
      scrollTrigger: { trigger: '.pg-nosotros_mission', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Founder — portrait from left, text from right */
    gsap.to('.gl-person_visual', {
      autoAlpha: 1, x: 0, duration: 0.85,
      scrollTrigger: { trigger: '.gl-person', start: 'top 80%', toggleActions: 'play none none none' }
    });
    gsap.to('.gl-person_info', {
      autoAlpha: 1, x: 0, duration: 0.85, delay: 0.1,
      scrollTrigger: { trigger: '.gl-person', start: 'top 80%', toggleActions: 'play none none none' }
    });

    /* Values — words drop from top with scale */
    gsap.to('.gl-values_item', {
      autoAlpha: 1, scale: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: '.gl-values', start: 'top 80%', toggleActions: 'play none none none' }
    });

    /* Lab section — Glass Lab crosslink */
    gsap.to('.pg-nosotros_lab_visual', {
      autoAlpha: 1, x: 0, duration: 0.85,
      scrollTrigger: { trigger: '.pg-nosotros_lab', start: 'top 80%', toggleActions: 'play none none none' }
    });
    gsap.to('.pg-nosotros_lab_text', {
      autoAlpha: 1, x: 0, duration: 0.85, delay: 0.1,
      scrollTrigger: { trigger: '.pg-nosotros_lab', start: 'top 80%', toggleActions: 'play none none none' }
    });

    /* Certifications grid */
    gsap.to('.pg-nosotros_cert-item', {
      autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1,
      scrollTrigger: { trigger: '.pg-nosotros_certs', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Testimonial */
    gsap.to('.gl-testimonial', {
      autoAlpha: 1, y: 0, duration: 0.7,
      scrollTrigger: { trigger: '.gl-testimonial', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Footer */
    gsap.to('.pg-footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.pg-footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
