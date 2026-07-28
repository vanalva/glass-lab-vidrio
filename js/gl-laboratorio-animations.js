/* ════════════════════════════════════════════════════════════════════
   gl-laboratorio-animations.js — GSAP animations for Laboratorio page
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
    const heading = document.querySelector('.gl-lab_hero_heading');
    const sub     = document.querySelector('.gl-lab_hero_sub');

    gsap.set(nav, { y: -18 });
    gsap.set(sub, { y: 14 });

    const headingWords = heading ? splitWords(heading) : [];
    if (headingWords.length) {
      gsap.set(heading, { opacity: 1 });
      /* 3D flip-in: perspective on parent so rotationX renders in 3D space */
      if (heading.parentElement) {
        gsap.set(heading.parentElement, { perspective: 1200 });
      }
      gsap.set(headingWords, { y: 40, autoAlpha: 0, rotationX: 45, transformOrigin: '0% 50% -30px' });
    }

    const tl = gsap.timeline();
    tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (headingWords.length) {
      tl.to(headingWords, { y: 0, autoAlpha: 1, rotationX: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out' }, '-=0.4');
    }
    tl.to(sub, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3');

    /* ── Floating hero images — brightness entrance + parallax scrub ── */
    const floatImgs = document.querySelectorAll('.gl-lab_hero_float_img');
    if (floatImgs.length) {
      /* Brightness lift entrance: each image fades in with a brightness
         transition, scroll-triggered so images below the fold also animate
         correctly when the user scrolls slowly. clearProps:'filter' hands
         control back to CSS after the entrance so the parallax scrub is clean. */
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

    /* ── PRE-HIDE all scroll-animated elements ────────────────────── */
    gsap.set([
      '.gl-statement_header',
      '.gl-statement_body',
      '.gl-statement_cta',
      '.gl-lab_editorial .gl-section-number',
      '.gl-values .gl-section-number',
      '.gl-lab_process .gl-section-number',
      '.gl-lab_stats .gl-section-number',
      '.gl-person .gl-section-number',
      '.gl-testimonial',
      '.gl-lab_cta_heading',
      '.gl-lab_cta_sub',
      '.gl-lab_cta_buttons',
      '.gl-home_footer_col'
    ], { autoAlpha: 0, y: 28 });

    gsap.set('.gl-lab_editorial_block', { autoAlpha: 0 });
    gsap.set('.gl-person_visual', { autoAlpha: 0, x: -40 });
    gsap.set('.gl-values_item', { scale: 0.85 });
    gsap.set('.gl-lab_process_step', { x: -40 });
    /* gl-person_info is NOT pre-hidden globally — individual blocks handle it */

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    /* Manifesto / Statement */
    const statementWords = document.querySelector('.gl-statement_body')
      ? splitWords(document.querySelector('.gl-statement_body')) : [];
    if (statementWords.length) {
      /* Clear the parent's pre-hide visibility:hidden + y-offset. The words
         reveal via autoAlpha (visibility:inherit), so the parent MUST be
         visibility:visible or the words inherit hidden and never show. */
      gsap.set(document.querySelector('.gl-statement_body'), { autoAlpha: 1, y: 0 });
      gsap.set(statementWords, { y: 32, autoAlpha: 0 });
      gsap.to(statementWords, {
        y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.035, ease: 'power3.out',
        scrollTrigger: { trigger: '.gl-statement', start: 'top 80%', toggleActions: 'play none none none' }
      });
    }
    gsap.to('.gl-statement_header', {
      autoAlpha: 1, y: 0, duration: 0.65,
      scrollTrigger: { trigger: '.gl-statement', start: 'top 82%', toggleActions: 'play none none none' }
    });
    gsap.to('.gl-statement_cta', {
      autoAlpha: 1, y: 0, duration: 0.6, delay: 0.2,
      scrollTrigger: { trigger: '.gl-statement', start: 'top 78%', toggleActions: 'play none none none' }
    });

    /* Editorial blocks — alternate left/right slide-in */
    document.querySelectorAll('.gl-lab_editorial_block').forEach((block, i) => {
      const xFrom = i % 2 === 0 ? -40 : 40;
      gsap.set(block, { autoAlpha: 0, x: xFrom });
      gsap.to(block, {
        autoAlpha: 1, x: 0, duration: 0.85,
        scrollTrigger: { trigger: block, start: 'top 82%', toggleActions: 'play none none none' }
      });
    });

    /* Values — each word drops from top with scale */
    gsap.to('.gl-values_item', {
      autoAlpha: 1, scale: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: '.gl-values', start: 'top 80%', toggleActions: 'play none none none' }
    });

    /* Process steps stagger from left */
    gsap.to('.gl-lab_process_step', {
      autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out',
      scrollTrigger: { trigger: '.gl-lab_process', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Stats fade */
    gsap.to('.gl-lab_stat', {
      autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1,
      scrollTrigger: { trigger: '.gl-lab_stats', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* ── Founder: GSAP-pinned portrait + progressive right-side reveal ── */

    const personSection  = document.querySelector('.gl-person');
    const personVisual   = document.querySelector('.gl-person_visual');
    const personInfo     = document.querySelector('.gl-person_info');

    if (personSection && personVisual && personInfo) {

      /* Reveal portrait once section enters viewport */
      gsap.to(personVisual, {
        autoAlpha: 1, x: 0, duration: 0.9,
        scrollTrigger: { trigger: personSection, start: 'top 75%', toggleActions: 'play none none none' }
      });

      /* Pre-hide right column blocks individually */
      const personBlocks = personInfo.querySelectorAll(
        '.gl-person_header, .gl-person_quote, .gl-person_bio, .gl-person_meta'
      );
      gsap.set(personBlocks, { autoAlpha: 0, y: 24 });

      /* CSS sticky handles the text column — see project.css gl-person_info.
         No GSAP pin needed here. */

      /* Reveal each right-column block as it enters viewport */
      personBlocks.forEach(el => {
        gsap.to(el, {
          autoAlpha: 1, y: 0, duration: 0.7,
          scrollTrigger: { trigger: el, start: 'top 84%', toggleActions: 'play none none none' }
        });
      });

      /* Subtle portrait parallax while pinned */
      gsap.to(personVisual.querySelector('.gl-person_portrait'), {
        y: -20, ease: 'none',
        scrollTrigger: {
          trigger: personSection,
          start: 'top center',
          end: 'bottom bottom',
          scrub: 2
        }
      });
    }

    /* Testimonial */
    gsap.to('.gl-testimonial', {
      autoAlpha: 1, y: 0, duration: 0.7,
      scrollTrigger: { trigger: '.gl-testimonial', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* CTA */
    gsap.to('.gl-lab_cta_heading', {
      autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: '.gl-lab_cta', start: 'top 80%', toggleActions: 'play none none none' }
    });
    gsap.to('.gl-lab_cta_sub', {
      autoAlpha: 1, y: 0, duration: 0.65, delay: 0.12,
      scrollTrigger: { trigger: '.gl-lab_cta', start: 'top 80%', toggleActions: 'play none none none' }
    });
    gsap.to('.gl-lab_cta_buttons', {
      autoAlpha: 1, y: 0, duration: 0.65, delay: 0.22,
      scrollTrigger: { trigger: '.gl-lab_cta', start: 'top 80%', toggleActions: 'play none none none' }
    });

    /* Footer columns */
    gsap.to('.gl-home_footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.gl-home_footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
