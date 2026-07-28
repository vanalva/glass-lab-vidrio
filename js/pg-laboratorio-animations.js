/* ════════════════════════════════════════════════════════════════════
   pg-laboratorio-animations.js — GSAP animations for the Pernia
   Laboratorio page. Mirrors gl-laboratorio-animations.js (same entrance,
   hero word-flip, floating-image parallax, scroll reveals) but adapted to
   Pernia selectors (.pg-nav-edge / .pg-footer) and scoped per-section so
   the reused .gl-values / .gl-lab_process sections (which appear twice on
   this page) each animate on their own trigger. Adds reveals for the
   specs + profile-colors sections that the Glass Lab page doesn't have.

   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   Load BEFORE gl-wavy-bend.js (wavy-bend defers 800ms and skips elements
   already split into child spans, so the hero word-split wins cleanly).
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

  /* ── Generic pre-hide + scroll-reveal helper ──────────────────────
     Accepts a selector string, a NodeList, a single element, or null.
     Silently no-ops on empty so missing sections never break the page. */
  function reveal(targets, trigger, opts) {
    opts = opts || {};
    let els;
    if (typeof targets === 'string') els = gsap.utils.toArray(targets);
    else if (!targets) els = [];
    else if (targets.length != null) els = Array.prototype.slice.call(targets);
    else els = [targets];
    els = els.filter(Boolean);
    if (!els.length) return;
    gsap.set(els, {
      autoAlpha: 0,
      y: (opts.y != null ? opts.y : 28),
      x: (opts.x || 0),
      scale: (opts.fromScale != null ? opts.fromScale : 1)
    });
    gsap.to(els, {
      autoAlpha: 1, y: 0, x: 0, scale: 1,
      duration: opts.duration || 0.7,
      stagger: opts.stagger || 0,
      delay: opts.delay || 0,
      ease: opts.ease || 'power3.out',
      scrollTrigger: {
        trigger: trigger || els[0],
        start: opts.start || 'top 82%',
        toggleActions: 'play none none none'
      }
    });
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
    const nav     = document.querySelector('.pg-nav-edge');
    const heading = document.querySelector('.gl-lab_hero_heading');
    const sub     = document.querySelector('.gl-lab_hero_sub');

    if (nav) gsap.set(nav, { y: -18 });
    if (sub) gsap.set(sub, { y: 14 });

    const headingWords = heading ? splitWords(heading) : [];
    if (headingWords.length) {
      gsap.set(heading, { opacity: 1 });
      /* 3D flip-in: perspective on parent so rotationX renders in 3D space */
      if (heading.parentElement) gsap.set(heading.parentElement, { perspective: 1200 });
      gsap.set(headingWords, { y: 40, autoAlpha: 0, rotationX: 45, transformOrigin: '0% 50% -30px' });
    }

    const tl = gsap.timeline();
    if (nav) tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (headingWords.length) {
      tl.to(headingWords, { y: 0, autoAlpha: 1, rotationX: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out' }, '-=0.4');
    }
    if (sub) tl.to(sub, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3');

    /* ── Floating hero images — brightness entrance + parallax scrub ── */
    const floatImgs = document.querySelectorAll('.gl-lab_hero_float_img');
    if (floatImgs.length) {
      gsap.utils.toArray('.gl-lab_hero_float_img').forEach(function (img, i) {
        gsap.fromTo(img,
          { autoAlpha: 0, y: 30, filter: 'brightness(0.5)' },
          {
            autoAlpha: 1, y: 0, filter: 'brightness(1)',
            duration: 1.2, delay: 0.15 * i, ease: 'power3.out',
            clearProps: 'filter',
            scrollTrigger: { trigger: img, start: 'top 85%', toggleActions: 'play none none none' }
          }
        );
      });
      floatImgs.forEach((img, i) => {
        const speed = 30 + i * 18;
        gsap.to(img, {
          y: -speed, ease: 'none',
          scrollTrigger: { trigger: '.gl-lab_hero', start: 'top top', end: 'bottom top', scrub: 1.5 + i * 0.3 }
        });
      });
    }

    /* ── STATEMENT — word-reveal body + header + cta ──────────────── */
    const statement = document.querySelector('.gl-statement');
    if (statement) {
      const body = statement.querySelector('.gl-statement_body');
      const statementWords = body ? splitWords(body) : [];
      if (statementWords.length) {
        gsap.set(body, { autoAlpha: 1, y: 0 });
        gsap.set(statementWords, { y: 32, autoAlpha: 0 });
        gsap.to(statementWords, {
          y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.035, ease: 'power3.out',
          scrollTrigger: { trigger: statement, start: 'top 80%', toggleActions: 'play none none none' }
        });
      }
      reveal(statement.querySelector('.gl-statement_header'), statement, { duration: 0.65, start: 'top 82%' });
      reveal(statement.querySelector('.gl-statement_cta'), statement, { duration: 0.6, delay: 0.2, start: 'top 78%' });
    }

    /* ── EDITORIAL — alternate left/right slide-in blocks ─────────── */
    const editorial = document.querySelector('.gl-lab_editorial');
    if (editorial) {
      reveal(editorial.querySelector('.gl-section-number'), editorial, { start: 'top 85%' });
      editorial.querySelectorAll('.gl-lab_editorial_block').forEach((block, i) => {
        const xFrom = i % 2 === 0 ? -40 : 40;
        gsap.set(block, { autoAlpha: 0, x: xFrom });
        gsap.to(block, {
          autoAlpha: 1, x: 0, duration: 0.85,
          scrollTrigger: { trigger: block, start: 'top 82%', toggleActions: 'play none none none' }
        });
      });
    }

    /* ── VALUES sections (Fundamentos + Tipos de vidrio) ──────────── */
    document.querySelectorAll('.gl-values').forEach(sec => {
      reveal(sec.querySelector('.gl-section-number'), sec, { start: 'top 85%' });
      reveal(sec.querySelector('.gl-lab_editorial_title'), sec, { y: 24, start: 'top 82%' });
      reveal(sec.querySelector('.gl-lab_editorial_body'), sec, { y: 24, delay: 0.05, start: 'top 82%' });
      reveal(sec.querySelectorAll('.gl-values_item'), sec, {
        fromScale: 0.85, y: 0, stagger: 0.12, duration: 0.7, start: 'top 80%'
      });
      reveal(sec.querySelector('.gl-statement_cta'), sec, { y: 24, delay: 0.15, start: 'top 78%' });
    });

    /* ── PROCESS sections (Configuraciones + El proceso) ──────────── */
    document.querySelectorAll('.gl-lab_process').forEach(sec => {
      reveal(sec.querySelector('.gl-section-number'), sec, { start: 'top 85%' });
      reveal(sec.querySelector('.gl-lab_editorial_title'), sec, { y: 24, start: 'top 84%' });
      reveal(sec.querySelectorAll('.gl-lab_process_step'), sec, {
        x: -40, y: 0, stagger: 0.1, duration: 0.7, ease: 'power2.out', start: 'top 82%'
      });
      reveal(sec.querySelector('.gl-lab_editorial_body'), sec, { y: 24, delay: 0.1, start: 'top 78%' });
      reveal(sec.querySelector('.gl-statement_cta'), sec, { y: 24, delay: 0.15, start: 'top 78%' });
    });

    /* ── SPECS — ficha técnica universal ──────────────────────────── */
    const specs = document.querySelector('.pg-sistema_specs');
    if (specs) {
      reveal(specs.querySelector('.pg-sistema_specs_label'), specs, { start: 'top 85%' });
      reveal(specs.querySelector('.pg-sistema_specs_heading'), specs, { y: 24, delay: 0.05, start: 'top 82%' });
      reveal(specs.querySelectorAll('.pg-sistema_specs_row'), specs, { y: 18, stagger: 0.05, duration: 0.5, start: 'top 80%' });
    }

    /* ── COLORS — profile photo + swatch legend ───────────────────── */
    const colors = document.querySelector('.pg-sistema_colors');
    if (colors) {
      reveal(colors.querySelector('.pg-sistema_colors_label'), colors, { start: 'top 85%' });
      reveal(colors.querySelector('.pg-sistema_colors_heading'), colors, { y: 24, delay: 0.05, start: 'top 82%' });
      reveal(colors.querySelector('.pg-lab_perfiles-photo'), colors, { y: 30, duration: 0.9, delay: 0.1, start: 'top 80%' });
      reveal(colors.querySelectorAll('.pg-sistema_swatch-item'), colors, { y: 18, fromScale: 0.8, stagger: 0.05, duration: 0.5, start: 'top 78%' });
    }

    /* ── FOUNDER — portrait slide-in + progressive right-column reveal ── */
    const personSection = document.querySelector('.gl-person');
    const personVisual  = document.querySelector('.gl-person_visual');
    const personInfo    = document.querySelector('.gl-person_info');
    if (personSection && personVisual && personInfo) {
      reveal(personSection.querySelector('.gl-section-number'), personSection, { start: 'top 85%' });

      /* Portrait column slides in from the left */
      reveal(personVisual, personSection, { x: -40, y: 0, duration: 0.9, start: 'top 75%' });

      /* Right column blocks reveal individually as each enters the viewport
         (the CSS-sticky text column means they scroll past one at a time) */
      personInfo.querySelectorAll('.gl-person_header, .gl-person_quote, .gl-person_bio, .gl-person_meta')
        .forEach(el => reveal(el, el, { y: 24, start: 'top 84%' }));

      /* Subtle portrait parallax */
      const portrait = personVisual.querySelector('.gl-person_portrait');
      if (portrait) {
        gsap.to(portrait, {
          y: -20, ease: 'none',
          scrollTrigger: { trigger: personSection, start: 'top center', end: 'bottom bottom', scrub: 2 }
        });
      }
    }

    /* ── CTA ──────────────────────────────────────────────────────── */
    const cta = document.querySelector('.gl-lab_cta');
    if (cta) {
      reveal(cta.querySelector('.gl-section-number'), cta, { start: 'top 84%' });
      reveal(cta.querySelector('.gl-lab_cta_heading'), cta, { duration: 0.8, start: 'top 80%' });
      reveal(cta.querySelector('.gl-lab_cta_sub'), cta, { duration: 0.65, delay: 0.12, start: 'top 80%' });
      reveal(cta.querySelector('.gl-lab_cta_buttons'), cta, { duration: 0.65, delay: 0.22, start: 'top 80%' });
    }

    /* ── FOOTER columns ───────────────────────────────────────────── */
    reveal(document.querySelectorAll('.pg-footer_col'), '.pg-footer', { stagger: 0.08, duration: 0.55, start: 'top 90%' });

    ScrollTrigger.refresh();
  }

})();
