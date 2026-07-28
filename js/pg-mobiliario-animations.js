/* ════════════════════════════════════════════════════════════════════
   pg-mobiliario-animations.js — GSAP scroll animations for the Pernia
   Mobiliario (furniture collection) page.

   Same motion vocabulary as the Laboratorio page: a shared reveal()
   helper (pre-hide + scroll-triggered fade/slide), a 3D word-flip hero
   entrance, and parallax on feature media. Respects reduced-motion.
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out', duration: 0.75 });

  /* ── Word-split helper (for the hero heading) ─────────────────────── */
  function splitWords(el) {
    if (!el) return [];
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map(w => '<span class="gsap-word" style="display:inline-block;overflow:hidden;vertical-align:top"><span class="gsap-word-inner" style="display:inline-block">' + w + '</span></span>')
      .join(' ');
    return Array.from(el.querySelectorAll('.gsap-word-inner'));
  }

  /* ── Shared reveal: pre-hide, then fade/slide in on scroll ────────── */
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

  let started = false;
  function startPageAnimations() {
    if (started) return;
    started = true;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      runAnimations();
      return () => ScrollTrigger.getAll().forEach(t => t.kill());
    });
    mm.add('(prefers-reduced-motion: reduce)', () => {
      document.documentElement.classList.remove('gl-js');
    });
  }
  /* Boot the same way the Laboratorio page does, and also when the
     preloader hands off (in case one is present on a fresh load). */
  setTimeout(startPageAnimations, (window.GL_PAGE_OVERLAY && window.GL_PAGE_OVERLAY.entranceDelay) || 180);
  window.addEventListener('gl:preloader-exiting', startPageAnimations, { once: true });

  function runAnimations() {

    /* Heavy per-frame scrub parallax runs on desktop only — it stutters
       mobile GPUs and is barely perceptible on a small screen. */
    var GL_HEAVY_OK = !window.matchMedia('(max-width: 991px)').matches
      && !window.matchMedia('(hover: none)').matches
      && !window.matchMedia('(pointer: coarse)').matches;

    /* ── HERO — centered text + overlapping tinted glass panes ────── */
    const nav     = document.querySelector('.pg-nav-edge');
    const heading = document.querySelector('.gl-lab_hero_heading');
    const sub     = document.querySelector('.gl-lab_hero_sub');
    const eyebrow = document.querySelector('.gl-lab_hero_content .gl-section-number');

    if (nav) gsap.set(nav, { y: -18 });
    if (sub) gsap.set(sub, { y: 14 });
    if (eyebrow) gsap.set(eyebrow, { autoAlpha: 0, y: 12 });

    const headingWords = heading ? splitWords(heading) : [];
    if (headingWords.length) {
      gsap.set(heading, { opacity: 1 });
      if (heading.parentElement) gsap.set(heading.parentElement, { perspective: 1200 });
      gsap.set(headingWords, { y: 40, autoAlpha: 0, rotationX: 45, transformOrigin: '0% 50% -30px' });
    }

    const tl = gsap.timeline();
    if (nav) tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });
    if (eyebrow) tl.to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.5 }, '-=0.4');
    if (headingWords.length) {
      tl.to(headingWords, { y: 0, autoAlpha: 1, rotationX: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' }, '-=0.3');
    }
    if (sub) tl.to(sub, { opacity: 1, y: 0, duration: 0.6 }, '-=0.35');

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
      if (GL_HEAVY_OK) {
        floatImgs.forEach(function (img, i) {
          var speed = 30 + i * 18;
          gsap.to(img, {
            y: -speed, ease: 'none',
            scrollTrigger: { trigger: '.pg-mobh_hero', start: 'top top', end: 'bottom top', scrub: 1.5 + i * 0.3 }
          });
        });
      }
    }

    /* The carousel section fades up as a whole. */
    reveal(document.querySelector('.pg-index_find'), '.pg-index_find', { y: 30, duration: 0.8, start: 'top 90%' });

    /* ── MANIFESTO — word-by-word reveal ──────────────────────────── */
    const manifesto = document.querySelector('.pg-mob_manifesto');
    if (manifesto) {
      reveal(manifesto.querySelector('.gl-section-number'), manifesto, { start: 'top 85%' });
      const body = manifesto.querySelector('.pg-mob_manifesto_body');
      const words = body ? splitWords(body) : [];
      if (words.length) {
        gsap.set(body, { autoAlpha: 1, y: 0 });
        gsap.set(words, { y: 30, autoAlpha: 0 });
        gsap.to(words, {
          y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.025, ease: 'power3.out',
          scrollTrigger: { trigger: manifesto, start: 'top 78%', toggleActions: 'play none none none' }
        });
      }
      reveal(manifesto.querySelector('.pg-mob_manifesto_cta'), manifesto, { y: 24, delay: 0.15, start: 'top 72%' });
    }

    /* ── COLLECTION GRID — header + batch card reveal ─────────────── */
    const gridHead = document.querySelector('.pg-page-header_title');
    if (gridHead) {
      const gwords = splitWords(gridHead);
      gsap.set(gridHead, { opacity: 1 });
      gsap.set(gwords, { y: 30, autoAlpha: 0 });
      gsap.to(gwords, {
        y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.05, ease: 'power3.out',
        scrollTrigger: { trigger: '.pg-page-header', start: 'top 82%', toggleActions: 'play none none none' }
      });
    }
    reveal(document.querySelector('.pg-page-header_desc'), '.pg-page-header', { y: 18, delay: 0.1, start: 'top 80%' });

    const collectionCards = gsap.utils.toArray('.pg-mob_collection-grid .pg-sistemas_card');
    if (collectionCards.length) {
      gsap.set(collectionCards, { autoAlpha: 0, y: 24 });
      ScrollTrigger.batch('.pg-mob_collection-grid .pg-sistemas_card', {
        start: 'top 90%',
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out', overwrite: true }),
        once: true
      });
    }

    /* ── FEATURES — alternating slide-in + media parallax ─────────── */
    document.querySelectorAll('.pg-mob_feature').forEach((sec, i) => {
      const media = sec.querySelector('.pg-mob_feature_media');
      const text  = sec.querySelector('.pg-mob_feature_text');
      const fromLeft = !sec.classList.contains('is-reverse');

      if (media) {
        gsap.set(media, { autoAlpha: 0, x: fromLeft ? -40 : 40 });
        gsap.to(media, {
          autoAlpha: 1, x: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: sec, start: 'top 80%', toggleActions: 'play none none none' }
        });
        const inner = media.querySelector('.pg-mob_feature_img');
        if (inner && GL_HEAVY_OK) {
          gsap.fromTo(inner, { y: -16 }, {
            y: 16, ease: 'none',
            scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 1.2 }
          });
        }
      }
      if (text) {
        reveal(text.querySelector('.gl-section-number'), sec, { start: 'top 82%' });
        reveal(text.querySelector('.pg-mob_feature_title'), sec, { y: 24, delay: 0.05, start: 'top 80%' });
        reveal(text.querySelector('.pg-mob_feature_body'), sec, { y: 24, delay: 0.1, start: 'top 78%' });
        reveal(text.querySelectorAll('.gl-spec-row'), sec, { y: 16, stagger: 0.06, duration: 0.5, delay: 0.15, start: 'top 76%' });
        reveal(text.querySelector('.pg-mob_feature_link'), sec, { y: 16, delay: 0.2, start: 'top 74%' });
      }
    });

    /* ── GALLERY — heading + staggered tiles ──────────────────────── */
    const gallery = document.querySelector('.pg-mob_gallery');
    if (gallery) {
      reveal(gallery.querySelector('.gl-section-number'), gallery, { start: 'top 85%' });
      reveal(gallery.querySelector('.pg-mob_gallery_title'), gallery, { y: 24, delay: 0.05, start: 'top 82%' });
      reveal(gallery.querySelectorAll('.pg-mob_gallery_item'), gallery.querySelector('.pg-mob_gallery_grid'), {
        y: 36, fromScale: 0.96, stagger: 0.08, duration: 0.7, start: 'top 80%'
      });
    }

    /* ── COLORWAYS ────────────────────────────────────────────────── */
    const colors = document.querySelector('.pg-mob_colors');
    if (colors) {
      reveal(colors.querySelector('.gl-section-number'), colors, { start: 'top 85%' });
      reveal(colors.querySelector('.pg-mob_colors_title'), colors, { y: 24, delay: 0.05, start: 'top 82%' });
      reveal(colors.querySelectorAll('.pg-mob_colors_item'), colors.querySelector('.pg-mob_colors_grid'), {
        y: 28, fromScale: 0.92, stagger: 0.1, duration: 0.7, start: 'top 80%'
      });
    }

    /* ── CTA ──────────────────────────────────────────────────────── */
    const cta = document.querySelector('.pg-mob_cta');
    if (cta) {
      reveal(cta.querySelector('.gl-section-number'), cta, { start: 'top 84%' });
      reveal(cta.querySelector('.pg-mob_cta_heading'), cta, { duration: 0.8, start: 'top 80%' });
      reveal(cta.querySelector('.pg-mob_cta_sub'), cta, { duration: 0.65, delay: 0.12, start: 'top 80%' });
      reveal(cta.querySelector('.pg-mob_cta_buttons'), cta, { duration: 0.65, delay: 0.22, start: 'top 80%' });
    }

    /* ── Footer columns ───────────────────────────────────────────── */
    reveal(document.querySelectorAll('.pg-footer_col'), '.pg-footer', { stagger: 0.08, duration: 0.55, start: 'top 90%' });
  }
})();
