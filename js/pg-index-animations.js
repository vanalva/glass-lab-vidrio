/* ════════════════════════════════════════════════════════════════════
   pg-index-animations.js — GSAP animations for Pernia Glass home page.
   Mirrors gl-index-animations.js: entrance fires when the preloader
   signals 'gl:preloader-exiting'; same motion vocabulary (3D word-split
   hero, multi-layer parallax scrub, batch card reveals, GSAP card lift).
   Light theme — colors untouched, motion only.
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  /* ── Word-split helper (preserves explicit <br> line breaks) ────── */
  function splitWords(el) {
    if (!el) return [];
    const wrap = w => `<span class="gsap-word" style="display:inline-block;overflow:hidden;vertical-align:top"><span class="gsap-word-inner" style="display:inline-block">${w}</span></span>`;
    const lines = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = lines
      .map(line => line.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).map(wrap).join(' '))
      .join('<br>');
    return Array.from(el.querySelectorAll('.gsap-word-inner'));
  }

  /* ── Lock entrance-animated elements into their initial state ASAP ──
     Done before the preloader exits so the moment it lifts the user
     sees the staged frame, not a flash of fully-visible content. */
  const heroTitle = document.querySelector('.pg-index_hero_heading');
  let titleWords = [];
  if (window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set('.pg-nav-edge',           { opacity: 0, y: -18 });
    gsap.set('.pg-index_hero_media',   { scale: 1.06 });
    gsap.set(['.pg-index_hero_sub', '.pg-index_hero_nav', '.pg-index_hero_card'], { opacity: 0, y: 14 });
    gsap.set('.pg-index_hero_dots', { opacity: 0 });
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

    /* ── ENTRANCE SEQUENCE ────────────────────────────────────────── */
    const tl = gsap.timeline();
    tl.to('.pg-nav-edge', { opacity: 1, y: 0, duration: 0.65 });
    tl.to('.pg-index_hero_media', { scale: 1, duration: 1.6, ease: 'power2.out' }, 0.1);
    if (titleWords.length) {
      tl.to(titleWords, {
        y: 0, autoAlpha: 1, rotationX: 0, duration: 0.6,
        stagger: 0.045, ease: 'power3.out'
      }, '-=1.3');
    }
    tl.to('.pg-index_hero_sub', { opacity: 1, y: 0, duration: 0.6 }, '-=0.35');
    tl.to(['.pg-index_hero_nav', '.pg-index_hero_card'], { opacity: 1, y: 0, duration: 0.55, stagger: 0.08 }, '-=0.3');
    tl.to('.pg-index_hero_dots', { opacity: 1, duration: 0.5 }, '-=0.25');

    /* ── Pre-hide all scroll-animated elements ────────────────────── */
    gsap.set([
      '.pg-index_systems_heading',
      '.pg-index_projects_heading',
      '.pg-index_cta_heading',
      '.pg-index_cta_sub',
      '.pg-index_cta_buttons',
      '.pg-footer_col'
    ], { autoAlpha: 0, y: 28 });

    gsap.set('.pg-index_stats_item', { autoAlpha: 0, y: 20 });
    gsap.set('.pg-index_featured_visual', { autoAlpha: 0, x: -30 });
    gsap.set('.pg-index_featured_info',   { autoAlpha: 0, x: 30 });

    /* ── PARALLAX (scrub) — desktop only (skipped on mobile for perf) ──
       Per-frame scrub stutters mobile GPUs and is barely visible on a phone. */
    var GL_HEAVY_OK = !window.matchMedia('(max-width: 991px)').matches
      && !window.matchMedia('(hover: none)').matches
      && !window.matchMedia('(pointer: coarse)').matches;
    if (GL_HEAVY_OK) {

    gsap.to('.pg-index_hero_media', {
      y: -80, ease: 'none',
      scrollTrigger: { trigger: '.pg-index_hero', start: 'top top', end: 'bottom top', scrub: 1.5 }
    });

    gsap.to('.pg-index_featured_img', {
      y: -40, ease: 'none',
      scrollTrigger: { trigger: '.pg-index_featured', start: 'top bottom', end: 'bottom top', scrub: 2 }
    });

    } /* end GL_HEAVY_OK parallax */

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

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

    /* Find-project section — reveal the search header (Swiper owns the cards) */
    reveal('.pg-index_find_inner', { trigger: '.pg-index_find', y: 24 });

    reveal('.pg-index_systems_heading', { trigger: '.pg-index_systems' });

    gsap.set('.pg-index_systems_card', { autoAlpha: 0 });
    ScrollTrigger.batch('.pg-index_systems_card', {
      start: 'top 85%',
      onEnter: (els) => gsap.to(els, {
        autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.12, ease: 'power2.out', overwrite: true
      }),
      once: true
    });

    /* Featured system — text/image counter-slide (gl-home_crossbrand) */
    gsap.to('.pg-index_featured_visual', {
      autoAlpha: 1, x: 0, duration: 0.8,
      scrollTrigger: { trigger: '.pg-index_featured', start: 'top 80%', toggleActions: 'play none none none' }
    });
    gsap.to('.pg-index_featured_info', {
      autoAlpha: 1, x: 0, duration: 0.8, delay: 0.1,
      scrollTrigger: { trigger: '.pg-index_featured', start: 'top 80%', toggleActions: 'play none none none' }
    });

    reveal('.pg-index_projects_heading', { trigger: '.pg-index_projects' });

    gsap.set('.pg-index_projects_card', { autoAlpha: 0 });
    ScrollTrigger.batch('.pg-index_projects_card', {
      start: 'top 85%',
      onEnter: (els) => gsap.to(els, {
        autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.12, ease: 'power2.out', overwrite: true
      }),
      once: true
    });

    /* Card hover lift — same GSAP values as gl-home_projects_card */
    document.querySelectorAll('.pg-index_projects_card, .pg-index_systems_card, .pg-index_find_card').forEach(card => {
      card.addEventListener('mouseenter', function () {
        gsap.to(this, { y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
      card.addEventListener('mouseleave', function () {
        gsap.to(this, { y: 0, duration: 0.35, ease: 'power2.inOut', overwrite: 'auto' });
      });
    });

    reveal('.pg-index_stats_item', {
      trigger: '.pg-index_stats', duration: 0.6, stagger: 0.1
    });

    reveal('.pg-index_cta_heading', {
      trigger: '.pg-index_cta', y: 35, duration: 0.8, ease: 'power3.out', start: 'top 80%'
    });
    reveal('.pg-index_cta_sub',     { trigger: '.pg-index_cta', delay: 0.15, start: 'top 80%' });
    reveal('.pg-index_cta_buttons', { trigger: '.pg-index_cta', delay: 0.25, start: 'top 80%' });

    reveal('.pg-footer_col', {
      trigger: '.pg-footer', stagger: 0.08, y: 20, start: 'top 90%'
    });

    ScrollTrigger.refresh();
  }

  /* ── Boot when the preloader hands off (same contract as GL) ────── */
  function whenPreloaderDone(cb) {
    const pl = document.querySelector('.gl-preloader');
    if (!pl || pl.style.display === 'none' || getComputedStyle(pl).display === 'none') {
      cb();
      return;
    }
    let fired = false;
    function once() { if (fired) return; fired = true; cb(); }
    window.addEventListener('gl:preloader-exiting', once, { once: true });
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
