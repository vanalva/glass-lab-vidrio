/* ════════════════════════════════════════════════════════════════════
   gl-preloader.js — Logo preloader for heavy pages (home + catalog).

   Gating rules:
     • Minimum visible time: 450ms (so the logo registers)
     • Required signal: DOMContentLoaded fires (HTML + blocking CSS/JS
       ready — this is the moment the page is structurally paintable).
     • Hard failsafe: 3000ms

     We deliberately do NOT wait for `window.load`. On heavy pages the
     spline scene + assorted images keep `load` from firing for 10+
     seconds while the page itself has been painted since ~LCP (~160ms).
     Gating on `load` would trap the user behind the preloader for the
     entire spline download. Spline keeps streaming behind the fading
     preloader instead — it pops in within ~1s on a warm cache.

   Runs on initial page load only. SPA-transitioned arrivals to these
   pages take a hard navigation instead (see gl-page-transition.js),
   so this script always runs on a fresh document.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__GL_PRELOADER_BOOTED__) {
    /* SPA re-entry: the swapped-in body may carry a fresh preloader div,
       but the page-transition wipe already covered the load. Drop it
       instantly — no fade — and release any scroll lock. */
    var spaPl = document.querySelector('.gl-preloader');
    if (spaPl) spaPl.style.display = 'none';
    document.documentElement.classList.remove('gl-preloading');
    return;
  }
  window.__GL_PRELOADER_BOOTED__ = true;

  var preloader = document.querySelector('.gl-preloader');
  if (!preloader) {
    // No preloader on this page — drop the scrollbar lock that lives
    // on <html> by default (set inline so it applies from frame 1).
    document.documentElement.classList.remove('gl-preloading');
    return;
  }

  /* `gl-preloading` is set inline on <html> in heavy-page markup so the
     scrollbar is hidden from the very first paint (this script runs at
     the bottom of body, by which point the scrollbar would already be
     visible if we relied only on JS to add the class). */

  var MIN_DURATION = 450;
  var MAX_DURATION = 3000;
  var FADE_MS      = 500;
  var pageLoaded   = false;
  var timerDone    = false;
  var hasExited    = false;

  /* The logo is visible from first paint (CSS opacity: 1). The only
     animation is the exit fade — one smooth motion, no in-then-out
     two-step. */

  setTimeout(function () { timerDone = true; tryExit(); }, MIN_DURATION);
  setTimeout(function () { pageLoaded = true; timerDone = true; tryExit(); }, MAX_DURATION);

  // DOMContentLoaded fires when HTML is parsed + render-blocking
  // resources are in. Spline scene / images keep streaming in the
  // background after we exit — they're not gating the preloader.
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    pageLoaded = true;
    requestAnimationFrame(tryExit);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      pageLoaded = true;
      tryExit();
    });
  }

  function tryExit() {
    if (hasExited) return;
    if (!timerDone || !pageLoaded) return;
    hasExited = true;

    /* Release the scroll lock NOW, BEFORE the fade starts. The
       scrollbar reappears (with its tiny gutter reflow) behind the
       still-opaque preloader, so the user never sees the shift. */
    document.documentElement.classList.remove('gl-preloading');

    /* Notify page-level scripts (entrance animations) that the cover
       is lifting. Firing AT the start of the exit fade lets the hero
       animations begin while the overlay is still fading — by the
       time the overlay is gone, the page is already in motion. */
    try { window.dispatchEvent(new CustomEvent('gl:preloader-exiting')); } catch (_) {}

    if (typeof gsap !== 'undefined') {
      gsap.to(preloader, {
        opacity: 0,
        duration: FADE_MS / 1000,
        ease: 'power2.inOut',
        onComplete: function () { preloader.style.display = 'none'; }
      });
    } else {
      preloader.style.transition = 'opacity ' + FADE_MS + 'ms cubic-bezier(.4, 0, .2, 1)';
      preloader.style.opacity    = '0';
      setTimeout(function () { preloader.style.display = 'none'; }, FADE_MS + 50);
    }
  }
})();
