/* ════════════════════════════════════════════════════════════════════
   gl-nav-scroll.js — Scroll-aware sticky nav for all GL pages.
   Hides on scroll-down, reveals on scroll-up with a push animation.
   Uses GSAP when available, CSS transitions as fallback.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const nav = document.querySelector('.gl-home_nav-edge, .pg-nav-edge');
  if (!nav) return;
  // Only run the scroll-aware hide on the fixed nav variant.
  // The static variant lives in document flow and shouldn't transform.
  if (!nav.classList.contains('is-fixed')) return;

  const useGsap      = typeof gsap !== 'undefined';
  let   hidden       = false;
  let   lastY        = window.scrollY;
  let   ticking      = false;
  const THRESHOLD    = 80; /* px scrolled before hide activates */
  const TOP          = 8;  /* px from the top where the bg fades back out */

  function showNav() {
    hidden = false;
    if (useGsap) {
      gsap.to(nav, { yPercent: 0, duration: 0.55, ease: 'expo.out', overwrite: true });
    } else {
      nav.classList.remove('nav--scroll-hide');
    }
    /* Revealed by scrolling up while away from the top → solid background. */
    if (window.scrollY > TOP) nav.classList.add('is-solid');
  }

  function hideNav() {
    hidden = true;
    if (useGsap) {
      gsap.to(nav, { yPercent: -105, duration: 0.35, ease: 'power2.in', overwrite: true });
    } else {
      nav.classList.add('nav--scroll-hide');
    }
  }

  function update() {
    const y     = window.scrollY;
    const delta = y - lastY;

    if (delta > 4 && y > THRESHOLD && !hidden) {
      hideNav();
    } else if (delta < -2 && hidden) {
      showNav();
    }

    /* Back at the very top → fade the background out again. */
    if (y <= TOP) nav.classList.remove('is-solid');

    lastY   = y;
    ticking = false;
  }

  /* Delay so entrance animations run first */
  setTimeout(function () {
    lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
  }, 600);
})();
