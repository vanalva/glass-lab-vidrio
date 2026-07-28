/* ════════════════════════════════════════════════════════════════════
   gl-proyecto-animations.js — GSAP animations for Proyecto detail page
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

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

  setTimeout(startPageAnimations, 120);

  function runAnimations() {

    /* ── ENTRANCE ─────────────────────────────────────────────────── */
    const nav = document.querySelector('.gl-home_nav-edge');
    gsap.set(nav, { y: -18 });

    /* Hero — Ken Burns: image scales from 1.05 → 1 */
    const heroImg = document.querySelector('.gl-proyecto_hero_img');
    if (heroImg) {
      gsap.set(heroImg, { scale: 1.06 });
      gsap.to(heroImg, { scale: 1, duration: 1.6, ease: 'power2.out', delay: 0.1 });
    }

    /* Hero overlay text stagger up */
    const heroTitle = document.querySelector('.gl-proyecto_hero_title');
    const heroMeta  = document.querySelector('.gl-proyecto_hero_meta');
    const heroTags  = document.querySelector('.gl-proyecto_hero_tags');
    if (heroTitle) gsap.set(heroTitle, { autoAlpha: 0, y: 24 });
    if (heroMeta)  gsap.set(heroMeta, { autoAlpha: 0, y: 18 });
    if (heroTags)  gsap.set(heroTags, { autoAlpha: 0, y: 14 });

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (heroTitle) tl.to(heroTitle, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.5);
    if (heroMeta)  tl.to(heroMeta,  { autoAlpha: 1, y: 0, duration: 0.6 }, '-=0.4');
    if (heroTags)  tl.to(heroTags,  { autoAlpha: 1, y: 0, duration: 0.5 }, '-=0.35');

    /* ── PRE-HIDE scroll-animated elements ───────────────────────── */
    gsap.set([
      '.gl-proyecto_desc_text',
      '.gl-proyecto_glass_row',
      '.gl-home_footer_col'
    ], { autoAlpha: 0, y: 28 });

    gsap.set('.gl-proyecto_gallery_img-pano, .gl-proyecto_gallery_img-portrait, .gl-proyecto_gallery_img-wide', { autoAlpha: 0, y: 24 });

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    /* Description text */
    gsap.to('.gl-proyecto_desc_text', {
      autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.15,
      scrollTrigger: { trigger: '.gl-proyecto_desc', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Gallery images batch */
    ScrollTrigger.batch(
      '.gl-proyecto_gallery_img-pano, .gl-proyecto_gallery_img-portrait, .gl-proyecto_gallery_img-wide',
      {
        start: 'top 88%',
        onEnter: (els) => gsap.to(els, {
          autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out', overwrite: true
        }),
        once: true
      }
    );

    /* Glass type cells used in project */
    gsap.to('.gl-proyecto_glass_row', {
      autoAlpha: 1, y: 0, duration: 0.7,
      scrollTrigger: { trigger: '.gl-proyecto_glass', start: 'top 82%', toggleActions: 'play none none none' }
    });
    const glassCells = document.querySelectorAll('.gl-proyecto_glass .gl-cell');
    if (glassCells.length) {
      gsap.set(glassCells, { autoAlpha: 0, y: 16 });
      gsap.to(glassCells, {
        autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.09,
        scrollTrigger: { trigger: '.gl-proyecto_glass', start: 'top 80%', toggleActions: 'play none none none' }
      });
    }

    /* Footer */
    gsap.to('.gl-home_footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.gl-home_footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
