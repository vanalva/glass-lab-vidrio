/* ════════════════════════════════════════════════════════════════════
   gl-blog-animations.js — GSAP animations for Blog (Bitacora) page
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

    const blogTitle = document.querySelector('.gl-blog_header_title');
    const titleWords = blogTitle ? splitWords(blogTitle) : [];
    if (titleWords.length) {
      gsap.set(blogTitle, { opacity: 1 });
      gsap.set(titleWords, { y: 36, autoAlpha: 0 });
    }

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (titleWords.length) {
      tl.to(titleWords, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out' }, '-=0.35');
    }

    /* ── PRE-HIDE blog cards ─────────────────────────────────────── */

    /* ── BATCH REVEAL — blog cards ───────────────────────────────── */
    ScrollTrigger.batch('.gl-blog_card', {
      start: 'top 88%',
      onEnter: (els) => gsap.to(els, {
        autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.1, ease: 'power2.out', overwrite: true
      }),
      once: true
    });

    /* Footer */
    gsap.to('.gl-home_footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.gl-home_footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
