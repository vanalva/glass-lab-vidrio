/* ════════════════════════════════════════════════════════════════════
   gl-instalaciones-animations.js — GSAP animations for Instalaciones
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.

   The hero reuses the .gl-lab_hero_* markup from Laboratorio, so the
   entrance matches that page exactly (word flip-in + brightness lift on
   the floating images).

   ⚠ The archive grid is OFF LIMITS to transform tweens. gl-instalaciones.js
   writes style.transform on every tile itself and runs a continuous drift /
   inertia rAF loop, so anything GSAP puts on the plane or the tiles gets
   fought over frame by frame. The gallery is revealed with opacity only.
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

  /* Small delay so fonts/layout settle */
  setTimeout(startPageAnimations, (window.GL_PAGE_OVERLAY && window.GL_PAGE_OVERLAY.entranceDelay) || 180);

  function runAnimations() {

    /* ── ENTRANCE ─────────────────────────────────────────────────── */
    const nav     = document.querySelector('.gl-home_nav-edge');
    const eyebrow = document.querySelector('.gl-lab_hero_content .gl-section-number');
    const heading = document.querySelector('.gl-lab_hero_heading');
    const sub     = document.querySelector('.gl-lab_hero_sub');

    gsap.set(nav, { y: -18 });
    gsap.set([eyebrow, sub], { autoAlpha: 0, y: 14 });

    const headingWords = heading ? splitWords(heading) : [];
    if (headingWords.length) {
      gsap.set(heading, { opacity: 1 });
      /* perspective on the parent so rotationX renders in 3D space */
      if (heading.parentElement) {
        gsap.set(heading.parentElement, { perspective: 1200 });
      }
      gsap.set(headingWords, { y: 40, autoAlpha: 0, rotationX: 45, transformOrigin: '0% 50% -30px' });
    }

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    tl.to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.5 }, '-=0.35');
    if (headingWords.length) {
      tl.to(headingWords, { y: 0, autoAlpha: 1, rotationX: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out' }, '-=0.3');
    }
    tl.to(sub, { autoAlpha: 1, y: 0, duration: 0.6 }, '-=0.3');

    /* ── Floating hero images — brightness entrance + parallax scrub ── */
    const floatImgs = document.querySelectorAll('.gl-lab_hero_float_img');
    if (floatImgs.length) {
      gsap.utils.toArray('.gl-lab_hero_float_img').forEach(function (img, i) {
        gsap.fromTo(img,
          { autoAlpha: 0, y: 30, filter: 'brightness(0.5)' },
          {
            autoAlpha: 1,
            y: 0,
            filter: 'brightness(1)',
            duration: 1.2,
            delay: 0.15 * i,
            ease: 'power3.out',
            clearProps: 'filter',
            scrollTrigger: {
              trigger: img,
              start: 'top 85%',
              toggleActions: 'play none none none'
            }
          }
        );
      });

      /* Each floater moves at a slightly different parallax rate */
      floatImgs.forEach((img, i) => {
        const speed = 30 + i * 18;
        gsap.to(img, {
          y: -speed, ease: 'none',
          scrollTrigger: {
            trigger: '.gl-lab_hero',
            start: 'top top', end: 'bottom top',
            scrub: 1.5 + i * 0.3
          }
        });
      });
    }

    /* ── PRE-HIDE scroll-animated elements ────────────────────────── */
    gsap.set([
      '.gl-installations_intro .gl-section-number',
      '.gl-installations_heading',
      '.gl-installations_sub',
      '.gl-installations_controls',
      '.gl-home_footer_col'
    ], { autoAlpha: 0, y: 28 });

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    /* Archive header — eyebrow, heading, sub, then the view controls */
    const introBlocks = [
      '.gl-installations_intro .gl-section-number',
      '.gl-installations_heading',
      '.gl-installations_sub'
    ];
    introBlocks.forEach((sel, i) => {
      gsap.to(sel, {
        autoAlpha: 1, y: 0, duration: 0.65, delay: 0.08 * i,
        scrollTrigger: { trigger: '.gl-installations_header', start: 'top 82%', toggleActions: 'play none none none' }
      });
    });
    gsap.to('.gl-installations_controls', {
      autoAlpha: 1, y: 0, duration: 0.6, delay: 0.28,
      scrollTrigger: { trigger: '.gl-installations_header', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Gallery — opacity ONLY, and clearProps afterwards so the drag/drift
       loop and the view-toggle's panel-hidden class own the element again.
       No y/scale here: a transform on the stage would be inherited by the
       tiles that gl-instalaciones.js is positioning every frame. */
    const gridStage = document.querySelector('.gl-installations_grid-stage');
    if (gridStage) {
      gsap.fromTo(gridStage,
        { opacity: 0 },
        {
          opacity: 1, duration: 0.9, ease: 'power2.out', clearProps: 'opacity',
          scrollTrigger: { trigger: '.gl-installations_grid-panel', start: 'top 88%', toggleActions: 'play none none none' }
        }
      );
    }

    /* Footer columns */
    gsap.to('.gl-home_footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.gl-home_footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
