/* ════════════════════════════════════════════════════════════════════
   gl-index-animations.js
   Entrance sequence + scroll-driven animations for gl-index.
   Entrance fires when the preloader signals 'gl:preloader-exiting'.
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  /* ── Word-split helper ────────────────────────────────────────── */
  function splitWords(el) {
    if (!el) return [];
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map(w => `<span class="gsap-word" style="display:inline-block;overflow:hidden;vertical-align:top"><span class="gsap-word-inner" style="display:inline-block">${w}</span></span>`)
      .join(' ');
    return Array.from(el.querySelectorAll('.gsap-word-inner'));
  }

  /* ── Lock entrance-animated elements into their initial state ASAP ──
     Done outside the matchMedia block + before the preloader exits, so
     the moment the preloader lifts the user sees the staged frame
     (everything off-screen) before the timeline plays — no flash of
     fully-visible content. */
  const heroTitle = document.querySelector('.gl-home_hero_title');
  let titleWords = [];
  if (window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set('.gl-home_nav-edge',     { opacity: 0, y: -18 });
    gsap.set('.gl-home_hero_sub',     { opacity: 0, y: 14 });
    gsap.set('.gl-home_hero_right',   { opacity: 0, scale: 0.97 });
    if (heroTitle) {
      titleWords = splitWords(heroTitle);
      gsap.set(heroTitle, { opacity: 1 });
      if (heroTitle.parentElement) gsap.set(heroTitle.parentElement, { perspective: 1200 });
      gsap.set(titleWords, { y: 40, autoAlpha: 0, rotationX: 45, transformOrigin: '0% 50% -30px' });
    }
  }

  function boot() {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      runAnimations();
      return () => ScrollTrigger.getAll().forEach(t => t.kill());
    });

    /* Reduced motion: do nothing — page renders fully visible by default. */
  }

  function runAnimations() {

    /* ── ENTRANCE SEQUENCE ──────────────────────────────────────
       Initial states were locked at script-load time (above) so the
       moment the preloader lifts, the user sees the staged frame,
       not a flash of fully-visible content. This timeline plays them
       in. */
    const tl = gsap.timeline();
    tl.to('.gl-home_nav-edge', { opacity: 1, y: 0, duration: 0.65 });
    if (titleWords.length) {
      tl.to(titleWords, {
        y: 0, autoAlpha: 1, rotationX: 0, duration: 0.6,
        stagger: 0.045, ease: 'power3.out'
      }, '-=0.5');
    }
    tl.to('.gl-home_hero_sub',   { opacity: 1, y: 0, duration: 0.6 }, '-=0.35');
    tl.to('.gl-home_hero_right', { opacity: 1, scale: 1, duration: 0.9 }, 0.15);

    /* ── Pre-hide all scroll-animated elements ───────────────────
       Must happen before any scroll tweens are created so elements
       aren't visible then instantly jump to hidden on trigger fire. */
    gsap.set([
      '.gl-home_manifesto_text',
      '.gl-home_catalog_header',
      '.gl-home_projects .gl-section-number',
      '.gl-home_cta_heading',
      '.gl-home_cta_sub',
      '.gl-home_cta_buttons',
      '.gl-home_footer_col'
    ], { autoAlpha: 0, y: 28 });

    gsap.set('.gl-home_manifesto_corners span', { autoAlpha: 0 });
    gsap.set('.gl-home_crossbrand_text', { autoAlpha: 0, x: -30 });
    gsap.set('.gl-home_crossbrand_img',  { autoAlpha: 0, x: 30 });

    /* ── PARALLAX (scrub) — desktop only ─────────────────────────
       Per-frame scrub recomputes transforms on every scroll frame; on mobile
       GPUs that stutters the whole page and the motion is barely perceptible
       on a small screen. Skipping it leaves elements static — reads the same. */
    var GL_HEAVY_OK = !window.matchMedia('(max-width: 991px)').matches
      && !window.matchMedia('(hover: none)').matches
      && !window.matchMedia('(pointer: coarse)').matches;
    if (GL_HEAVY_OK) {

    gsap.to('.gl-home_hero_zoom', {
      y: -80, ease: 'none',
      scrollTrigger: { trigger: '.gl-home_hero', start: 'top top', end: 'bottom top', scrub: 1.5 }
    });

    gsap.to('.gl-home_catalog_visual', {
      y: -40, ease: 'none',
      scrollTrigger: { trigger: '.gl-home_catalog', start: 'top bottom', end: 'bottom top', scrub: 2 }
    });

    gsap.to('.gl-home_crossbrand_img', {
      y: -30, ease: 'none',
      scrollTrigger: { trigger: '.gl-home_crossbrand', start: 'top bottom', end: 'bottom top', scrub: 2 }
    });

    } /* end GL_HEAVY_OK parallax */

    /* ── SCROLL REVEALS ─────────────────────────────────────────── */

    function reveal(selector, opts) {
      const el = document.querySelector(selector);
      if (!el) return;
      gsap.to(selector, {
        autoAlpha: 1,
        y: 0, x: 0,
        duration: opts.duration ?? 0.7,
        delay: opts.delay ?? 0,
        stagger: opts.stagger ?? 0,
        ease: opts.ease ?? 'power2.out',
        scrollTrigger: {
          trigger: opts.trigger || el,
          start: opts.start ?? 'top 82%',
          toggleActions: 'play none none none'
        }
      });
    }

    reveal('.gl-home_manifesto_text', { trigger: '.gl-home_manifesto', y: 30 });
    reveal('.gl-home_manifesto_corners span', {
      trigger: '.gl-home_manifesto', y: 0, duration: 0.5, stagger: 0.15
    });
    reveal('.gl-home_catalog_header', { trigger: '.gl-home_catalog' });

    gsap.set('.gl-home_catalog_grid .gl-cell', { autoAlpha: 0 });
    ScrollTrigger.batch('.gl-home_catalog_grid .gl-cell', {
      start: 'top 88%',
      onEnter: (els) => gsap.to(els, {
        autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.04, ease: 'power2.out', overwrite: true
      }),
      once: true
    });

    /* Cell hover is handled in CSS now (transform + transition) — compositor-thread
       only, no per-cell JS listeners, no GSAP tween churn when sweeping the cursor
       across the grid. */

    reveal('.gl-home_projects .gl-section-number', { trigger: '.gl-home_projects' });

    gsap.set('.gl-home_projects_card', { autoAlpha: 0 });
    ScrollTrigger.batch('.gl-home_projects_card', {
      start: 'top 85%',
      onEnter: (els) => gsap.to(els, {
        autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.12, ease: 'power2.out', overwrite: true
      }),
      once: true
    });

    /* Project card hover */
    document.querySelectorAll('.gl-home_projects_card, .gl-proj_card').forEach(card => {
      card.addEventListener('mouseenter', function () {
        gsap.to(this, { y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
      card.addEventListener('mouseleave', function () {
        gsap.to(this, { y: 0, duration: 0.35, ease: 'power2.inOut', overwrite: 'auto' });
      });
    });

    gsap.to('.gl-home_crossbrand_text', {
      autoAlpha: 1, x: 0, duration: 0.8,
      scrollTrigger: { trigger: '.gl-home_crossbrand', start: 'top 80%', toggleActions: 'play none none none' }
    });
    gsap.to('.gl-home_crossbrand_img', {
      autoAlpha: 1, x: 0, duration: 0.8, delay: 0.1,
      scrollTrigger: { trigger: '.gl-home_crossbrand', start: 'top 80%', toggleActions: 'play none none none' }
    });

    reveal('.gl-home_cta_heading', {
      trigger: '.gl-home_cta', y: 35, duration: 0.8, ease: 'power3.out', start: 'top 80%'
    });
    reveal('.gl-home_cta_sub',     { trigger: '.gl-home_cta', delay: 0.15, start: 'top 80%' });
    reveal('.gl-home_cta_buttons', { trigger: '.gl-home_cta', delay: 0.25, start: 'top 80%' });

    reveal('.gl-home_footer_col', {
      trigger: '.gl-home_footer', stagger: 0.08, y: 20, start: 'top 90%'
    });

    ScrollTrigger.refresh();
  }

  /* ── Boot when the preloader hands off ────────────────────────────
     The preloader fires 'gl:preloader-exiting' at the start of its
     fade-out. We boot then, so the hero animations play during the
     fade — by the time the overlay is gone, the page is already
     in motion. If the preloader is missing or already gone (e.g. SPA
     re-entry, dev refresh after exit), boot immediately. */
  function whenPreloaderDone(cb) {
    const pl = document.querySelector('.gl-preloader');
    if (!pl || pl.style.display === 'none' || getComputedStyle(pl).display === 'none') {
      cb();
      return;
    }
    let fired = false;
    function once() { if (fired) return; fired = true; cb(); }
    window.addEventListener('gl:preloader-exiting', once, { once: true });
    /* Failsafe — if the event never fires (script ordering issue,
       preloader stuck), don't trap the page forever. */
    setTimeout(once, 3500);
  }

  function bootWhenReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { whenPreloaderDone(boot); });
    } else {
      whenPreloaderDone(boot);
    }
  }
  bootWhenReady();

})();
