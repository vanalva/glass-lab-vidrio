/* ════════════════════════════════════════════════════════════════════
   gl-theme-transition.js — reusable SVG "theme transition" section.

   A full-viewport section whose SVG bars converge on scroll while the
   section cross-fades from the page's base theme into the OPPOSITE
   theme, bridging visually into the (statically opposite-themed)
   footer that follows. This is the generalised, direction-aware,
   SVG-swappable version of the home page's inline statement-bars effect
   (gl-index.html keeps its own inline copy — this module is for every
   other main page).

   ── USAGE — drop the section immediately before the page <footer>:

     <section class="gl-theme-transition is-to-light">   ← dark → light  (Glass Lab)
     <section class="gl-theme-transition is-to-dark">    ← light → dark  (Pernia)
       <svg class="gl-tt_bg" viewBox="0 0 3141.44 1107.24" aria-hidden="true"> … bars … </svg>
       <div class="gl-tt_center"><p class="gl-tt_quote">…</p></div>
     </section>

   …and give that page's <footer> the OPPOSITE theme class so the page
   visually ends in the flipped theme:
       Glass Lab pages → <footer class="gl-home_footer u-theme-light">
       Pernia    pages → <footer class="pg-footer u-theme-dark">

   ── SWAPPING THE SVG (the whole point of this component):
   The module animates ANY descendant carrying `.gl-bar` plus a
   direction class (`.gl-bar-l` slides from the left, `.gl-bar-r` from
   the right). Fill colour, background and quote colour are driven
   generically from the direction class — nothing here hardcodes the
   bar geometry. To use a different graphic later, replace the <svg>
   inner content with any shapes tagged `class="gl-bar gl-bar-l|gl-bar-r"`
   and the choreography keeps working unchanged.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Theme endpoints — must match --swatch--dark-900 / --swatch--light-100. */
  var DARK = '#0B0B0B';
  var LIGHT = '#ede7dd';
  var DARK_70 = 'rgba(11,11,11,0.7)';
  var LIGHT_70 = 'rgba(237,231,221,0.7)';

  /* Travel of the bars across the pin (percent of view-box). Identical to
     the home statement effect so the two read the same. */
  var COMPACT_PCT = 18;    // bars overlapping at centre (end of pin)
  var SEPARATE_PCT = 65;   // bars driven off-screen (start of pin)
  var OUT_PCT = 130;       // bars cleared past the opposite edge (post-pin)

  function initOne(section) {
    if (section.dataset.ttInit === 'true') return;
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') return;
    section.dataset.ttInit = 'true';

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    /* Direction. `is-to-light` = the page starts dark and ends light
       (Glass Lab). Anything else = light → dark (Pernia). */
    var toLight = section.classList.contains('is-to-light');
    var baseHex = toLight ? DARK : LIGHT;   // background starts here
    var endHex = toLight ? LIGHT : DARK;    // background ends here (= footer theme)
    var endRgba = toLight ? LIGHT_70 : DARK_70;
    var baseRgba = toLight ? DARK_70 : LIGHT_70;

    var bgInterp = gsap.utils.interpolate(baseHex, endHex);   // bg: base → end
    var fillInterp = gsap.utils.interpolate(endHex, baseHex); // bars: end → base (always contrast)
    var textInterp = gsap.utils.interpolate(endRgba, baseRgba);

    var bars = Array.prototype.slice.call(section.querySelectorAll('.gl-bar')).map(function (b) {
      return { el: b, sign: b.classList.contains('gl-bar-r') ? -1 : 1 };
    });
    if (!bars.length) return;
    bars.forEach(function (b) { b.el.style.transition = 'none'; });
    var quoteEl = section.querySelector('.gl-tt_quote');

    /* Pinned phase: bars travel from off-screen (-SEPARATE) through their
       natural position to overlapping at centre (COMPACT). The theme
       cross-fade waits until the bars are ~90% converged, then ramps over
       the final 10% of the pin so the section lands on the footer theme. */
    var pinST = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=100%',
      pin: true,
      scrub: 0.6,
      onUpdate: function (self) {
        var p = self.progress;
        var offsetPct = -SEPARATE_PCT + (COMPACT_PCT + SEPARATE_PCT) * p;
        var tColor = p < 0.9 ? 0 : (p - 0.9) / 0.1;
        var fillColor = fillInterp(tColor);
        section.style.backgroundColor = bgInterp(tColor);
        if (quoteEl) quoteEl.style.color = textInterp(tColor);
        for (var i = 0; i < bars.length; i++) {
          bars[i].el.style.transform = 'translateX(' + (bars[i].sign * offsetPct) + '%)';
          bars[i].el.style.fill = fillColor;
        }
      }
    });

    /* Post-pin continuation: once the pin releases, keep driving the bars
       in the same direction so they cross centre and clear the opposite
       edge as the footer scrolls into view. */
    ScrollTrigger.create({
      trigger: section,
      start: function () { return pinST.end; },
      end: function () { return pinST.end + window.innerHeight; },
      scrub: 0.6,
      onUpdate: function (self) {
        var offsetPct = COMPACT_PCT + (OUT_PCT - COMPACT_PCT) * self.progress;
        for (var i = 0; i < bars.length; i++) {
          bars[i].el.style.transform = 'translateX(' + (bars[i].sign * offsetPct) + '%)';
        }
      }
    });
  }

  function initAll() {
    var sections = document.querySelectorAll('.gl-theme-transition');
    for (var i = 0; i < sections.length; i++) initOne(sections[i]);
  }

  /* Reduced motion: skip the scroll choreography and present the END
     state (opposite-theme background, bars converged at centre) so the
     section still bridges into the flipped footer. */
  function settleReduced() {
    var sections = document.querySelectorAll('.gl-theme-transition');
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (s.dataset.ttInit === 'true') continue;
      s.dataset.ttInit = 'true';
      var toLight = s.classList.contains('is-to-light');
      s.style.backgroundColor = toLight ? LIGHT : DARK;
      var bars = s.querySelectorAll('.gl-bar');
      for (var j = 0; j < bars.length; j++) {
        bars[j].style.transition = 'none';
        bars[j].style.transform = 'translateX(0)';
        bars[j].style.fill = toLight ? DARK : LIGHT;
      }
      var q = s.querySelector('.gl-tt_quote');
      if (q) q.style.color = toLight ? DARK_70 : LIGHT_70;
    }
  }

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var boot = REDUCED ? settleReduced : initAll;

  /* Scripts load at the end of <body>, so the section already exists —
     run immediately, and again on DOMContentLoaded as a safety net.
     Idempotent (per-section dataset guard), so the re-execution that
     gl-page-transition triggers after each SPA swap re-arms the new
     page's section without double-initialising anything. */
  boot();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
