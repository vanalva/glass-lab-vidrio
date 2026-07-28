// gl-interactions.js — shared hover interactions
(function() {
  'use strict';

  /* Touch devices get no hover interactions at all.
     On a touchscreen the first tap is spent applying :hover — the browser
     withholds the click when the tap visibly changes the element. Every
     handler below transforms its target (scale 1.03 / 1.07), so on mobile
     the first tap only grew the tile and the second one navigated. That is
     the "needs two taps to open a link" bug.
     The same flag drives the CSS that neutralises the hover-only popovers
     (dock + navbars), which stole taps the same way. */
  var canHover = !window.matchMedia ||
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!canHover) document.documentElement.classList.add('gl-touch');

  if (typeof gsap === 'undefined') return;
  if (!canHover) return;

  function initInteractions() {
    // ── Skew button hover ────────────────────────────────────────────
    // Glass Lab only. Pernia (u-theme-light body) keeps its skew buttons
    // static — the expanding hover is GL's button language; PG buttons
    // still get the CSS fill-swap on hover.
    var isPernia = document.body.classList.contains('u-theme-light');
    if (!isPernia) document.querySelectorAll('.gl-btn_skew_wrap').forEach(function(wrap) {
      var shape = wrap.querySelector('.gl-btn_skew_shape');
      var text  = wrap.querySelector('.gl-btn_skew_text');

      wrap.addEventListener('mouseenter', function() {
        if (shape) gsap.to(shape, { scale: 1.03, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
        if (text)  gsap.to(text,  { x: 3, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
      });
      wrap.addEventListener('mouseleave', function() {
        if (shape) gsap.to(shape, { scale: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
        if (text)  gsap.to(text,  { x: 0, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
      });
    });

    // ── Catalog cell hover — scale + equalize corners ────────────────
    // The inline neighbor-detection script sets individual borderRadius
    // properties on each cell. We snapshot those before GSAP touches
    // them on first mouseenter, then restore directly on mouseleave
    // (bypassing GSAP clearProps which can race or wipe the script values).
    document.querySelectorAll('.gl-cell_filled').forEach(function(cell) {
      cell.addEventListener('mouseenter', function() {
        // Snapshot inline corner radii once, before GSAP modifies them
        if (!cell._snapRadius) {
          cell._snapRadius = {
            tl: cell.style.borderTopLeftRadius,
            tr: cell.style.borderTopRightRadius,
            bl: cell.style.borderBottomLeftRadius,
            br: cell.style.borderBottomRightRadius
          };
        }
        gsap.to(cell, { scale: 1.07, zIndex: 1, borderRadius: '4px', backgroundColor: '#1a1a1a', duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
      });

      cell.addEventListener('mouseleave', function() {
        var s = cell._snapRadius || {};
        // Release GSAP's ownership of all radius + bg + zIndex inline properties
        gsap.set(cell, { clearProps: 'borderRadius,borderTopLeftRadius,borderTopRightRadius,borderBottomLeftRadius,borderBottomRightRadius,backgroundColor,zIndex' });
        // Immediately restore the neighbor-detection script's inline values
        cell.style.borderTopLeftRadius     = s.tl !== undefined ? s.tl : '';
        cell.style.borderTopRightRadius    = s.tr !== undefined ? s.tr : '';
        cell.style.borderBottomLeftRadius  = s.bl !== undefined ? s.bl : '';
        cell.style.borderBottomRightRadius = s.br !== undefined ? s.br : '';
        // Animate only scale back
        gsap.to(cell, { scale: 1, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractions);
  } else {
    initInteractions();
  }
})();
