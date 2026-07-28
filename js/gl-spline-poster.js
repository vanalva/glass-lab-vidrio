/* ════════════════════════════════════════════════════════════════════
   gl-spline-poster.js — Crossfade the spline hero canvas over its poster.

   The .gl-hero-poster layer paints the scene's captured first frame in
   the exact box (and parallax transform) the spline-viewer occupies.
   This script holds the viewer at opacity 0 (.gl-spline-pending) until
   its canvas has composited a frame, then releases it — the CSS opacity
   transition on .gl-home_hero_bg does the fade. Any residual framing
   drift between the static capture and the live camera dissolves inside
   the crossfade instead of reading as a jump.

   Safe on SPA re-execution: arms whatever viewers exist in the current
   body. If the canvas never appears (offline, blocked CDN), the 15s
   failsafe releases the viewer anyway — worst case the poster keeps
   standing in, which is the intended fallback.

   Re-capture procedure (if the scene's opening state changes): open
   projects/glass-lab/design/spline-capture.html at a 1894x1383
   viewport, wait for the canvas, screenshot the viewport, save as
   src/assets/media/glass-lab/glass-render-hero-poster.jpg.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Touch / <=991px: the 3D viewer is never loaded (gated in the page head),
     so any <spline-viewer> left in the markup is an inert, transparent box.
     Strip it and bail — the static .gl-hero-poster behind it is the intended
     mobile hero. Keeps the whole crossfade/failsafe machinery off on mobile. */
  var STATIC = window.matchMedia('(max-width: 991px)').matches
    || window.matchMedia('(hover: none)').matches
    || window.matchMedia('(pointer: coarse)').matches;
  if (STATIC) {
    document.querySelectorAll('spline-viewer').forEach(function (el) { el.remove(); });
    return;
  }

  function arm(sv) {
    if (sv.__glPosterArmed) return;
    sv.__glPosterArmed = true;
    sv.classList.add('gl-spline-pending');

    var released = false;
    function release() {
      if (released) return;
      released = true;
      /* Two rAFs so the first frame is actually composited before the
         fade starts — fading onto a still-blank canvas would flash. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          sv.classList.remove('gl-spline-pending');
        });
      });
    }

    sv.addEventListener('load-complete', release, { once: true });

    /* Fallback: poll for the canvas inside the shadow root. */
    var t0 = Date.now();
    (function poll() {
      if (released) return;
      var canvas = sv.shadowRoot && sv.shadowRoot.querySelector('canvas');
      if (canvas) { release(); return; }
      if (Date.now() - t0 < 15000) { setTimeout(poll, 150); return; }
      release(); /* failsafe — never trap the scene at opacity 0 */
    })();
  }

  document.querySelectorAll('spline-viewer').forEach(arm);
})();
