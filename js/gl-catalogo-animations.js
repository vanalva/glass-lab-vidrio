/* ════════════════════════════════════════════════════════════════════
   gl-catalogo-animations.js — GSAP animations for Catalogo page
   The hero video scroll animation is managed by inline JS — do not touch.
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  /* ── PRE-HIDE CELLS SYNCHRONOUSLY ──────────────────────────────
     body is opacity:0 when this script runs (inline style on <body>)
     so this set() is completely invisible — no flash possible.
     clearProps after animation hands opacity back to CSS so the
     filter system (.gl-cell_filtered-out) can work unobstructed.
     Only pre-hide when the entrance animation will actually run —
     under prefers-reduced-motion the reveal never fires, so hiding
     here would leave the whole grid invisible. */
  if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    gsap.set('.gl-catalogo_grid .gl-cell', { autoAlpha: 0, y: 12 });
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

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });

    /* Filter bar slides down */
    const filterArea = document.querySelector('.gl-catalogo_filters');
    const monogramCell = document.querySelector('.gl-catalogo_monogram-cell');
    if (filterArea) {
      gsap.set(filterArea, { autoAlpha: 0, y: -12 });
      tl.to(filterArea, { autoAlpha: 1, y: 0, duration: 0.6 }, '-=0.3');
    }
    if (monogramCell) {
      gsap.set(monogramCell, { autoAlpha: 0, scale: 0.92 });
      tl.to(monogramCell, { autoAlpha: 1, scale: 1, duration: 0.65 }, '-=0.4');
    }

    /* Filter pills stagger in */
    const pills = document.querySelectorAll('.gl-filter-radio-pill');
    if (pills.length) {
      gsap.set(pills, { autoAlpha: 0, x: -10 });
      tl.to(pills, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.04 }, '-=0.3');
    }

    /* ── PRE-HIDE scroll-animated elements ───────────────────────── */
    gsap.set('.gl-catalogo_legend', { autoAlpha: 0, y: 20 });

    /* Pre-hide periodic table cells for batch reveal */

    /* ── BATCH REVEAL — periodic table cells ─────────────────────── */
    /* Cells pre-hidden synchronously at script load (above, while body
       is invisible). Batch animates them in with stagger. clearProps
       removes GSAP inline opacity after each batch so the filter system
       (.gl-cell_filtered-out CSS class) can take back opacity control. */
    ScrollTrigger.batch('.gl-catalogo_grid .gl-cell', {
      start: 'top 92%',
      onEnter: function (els) {
        gsap.to(els, {
          autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.02, ease: 'power2.out',
          onComplete: function () {
            gsap.set(els, { clearProps: 'opacity,visibility,transform,y' });
          }
        });
      },
      once: true
    });

    /* Legend appears after the grid */
    gsap.to('.gl-catalogo_legend', {
      autoAlpha: 1, y: 0, duration: 0.65,
      scrollTrigger: { trigger: '.gl-catalogo_legend', start: 'top 88%', toggleActions: 'play none none none' }
    });

    /* ── Proximas adiciones section ───────────────────────────────── */
    const proximasSection = document.querySelector('.gl-catalogo_proximas');
    if (proximasSection) {
      const proximasHead = proximasSection.querySelector('h2, .gl-catalogo_proximas_heading');
      if (proximasHead) {
        gsap.set(proximasHead, { autoAlpha: 0, y: 24 });
        gsap.to(proximasHead, {
          autoAlpha: 1, y: 0, duration: 0.75,
          scrollTrigger: { trigger: proximasSection, start: 'top 82%', toggleActions: 'play none none none' }
        });
      }
      const proximasCells = proximasSection.querySelectorAll('.gl-cell');
      if (proximasCells.length) {
        gsap.set(proximasCells, { autoAlpha: 0, y: 16 });
        gsap.to(proximasCells, {
          autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05,
          scrollTrigger: { trigger: proximasSection, start: 'top 82%', toggleActions: 'play none none none' }
        });
      }
    }

    /* ── Footer ─────────────────────────────────────────────────── */
    gsap.to('.gl-home_footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.gl-home_footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();

    /* ── Filter cascade — GSAP-powered reveal on filter state change ────────────
       Fires when the flwr list system dispatches 'flwr:list:filtered' on the grid.
       Filtered-out cells shrink + desaturate; visible cells cascade back in. */
    (function () {
      const grid = document.querySelector('#gl-catalogo-grid');
      if (!grid) return;

      grid.addEventListener('flwr:list:filtered', function () {
        const filtered = grid.querySelectorAll('.gl-cell_filtered-out');
        const visible  = grid.querySelectorAll('.gl-cell:not(.gl-cell_filtered-out)');

        const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

        /* Filtered-out cells: shrink + desaturate */
        if (filtered.length) {
          tl.to(filtered, {
            autoAlpha: 0.12,
            scale: 0.96,
            duration: 0.22,
            stagger: { amount: 0.15, from: 'random' }
          }, 0);
        }

        /* Visible cells: cascade back in from top-left */
        if (visible.length) {
          tl.fromTo(visible,
            { autoAlpha: 0, y: 6, filter: 'brightness(0.7)' },
            {
              autoAlpha: 1,
              y: 0,
              filter: 'brightness(1)',
              duration: 0.35,
              stagger: { amount: 0.5, from: 'start', grid: 'auto', axis: 'x' },
              clearProps: 'filter,transform'
            },
            0.1
          );
        }
      });

      /* Animate the active filter pill on change */
      document.querySelectorAll('.gl-filter-input').forEach(function (pill) {
        pill.addEventListener('change', function () {
          gsap.fromTo(this,
            { scale: 0.94 },
            { scale: 1, duration: 0.3, ease: 'back.out(2)' }
          );
        });
      });
    })();
  }

})();
