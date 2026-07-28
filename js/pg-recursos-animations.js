/* ════════════════════════════════════════════════════════════════════
   pg-recursos-animations.js — GSAP animations for Pernia Glass Recursos
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  var animationsStarted = false;
  function startPageAnimations() {
    if (animationsStarted) return;
    animationsStarted = true;

    var mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', function () {
      runAnimations();
      return function () { ScrollTrigger.getAll().forEach(function (t) { t.kill(); }); };
    });
    mm.add('(prefers-reduced-motion: reduce)', function () {
      document.documentElement.classList.remove('gl-js');
    });
  }

  setTimeout(startPageAnimations, (window.GL_PAGE_OVERLAY && window.GL_PAGE_OVERLAY.entranceDelay) || 180);

  function splitWords(el) {
    if (!el) return [];
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) {
      return '<span class="gl-word" style="display:inline-block; overflow:hidden"><span class="gl-word-inner" style="display:inline-block">' + w + '</span></span>';
    }).join(' ');
    return Array.from(el.querySelectorAll('.gl-word-inner'));
  }

  function runAnimations() {

    /* ── ENTRANCE ─────────────────────────────────────────────────── */
    var nav       = document.querySelector('.pg-nav-edge');
    var titleEl   = document.querySelector('.pg-page-header_title');
    var descEl    = document.querySelector('.pg-page-header_desc');
    var filterBar = document.querySelector('.pg-filter-bar');

    if (nav) gsap.set(nav, { y: -18 });

    var tl = gsap.timeline();
    if (nav) tl.to(nav, { opacity: 1, y: 0, duration: 0.65 });

    /* Section number label */
    var sectionNum = document.querySelector('.pg-page-header .gl-section-number');
    if (sectionNum) {
      gsap.set(sectionNum, { autoAlpha: 0, y: 10 });
      tl.to(sectionNum, { autoAlpha: 1, y: 0, duration: 0.45 }, 0.3);
    }

    /* Title — word split stagger */
    if (titleEl) {
      var words = splitWords(titleEl);
      if (words.length > 0) {
        gsap.set(words, { autoAlpha: 0, y: '100%' });
        tl.to(words, { autoAlpha: 1, y: '0%', duration: 0.6, stagger: 0.05 }, 0.35);
      } else {
        gsap.set(titleEl, { autoAlpha: 0, y: 20 });
        tl.to(titleEl, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.35);
      }
    }

    if (descEl) {
      gsap.set(descEl, { autoAlpha: 0, y: 14 });
      tl.to(descEl, { autoAlpha: 1, y: 0, duration: 0.5 }, '-=0.3');
    }

    if (filterBar) {
      var filterItems = filterBar.querySelectorAll('.gl-filter-input');
      if (filterItems.length) {
        gsap.set(filterItems, { autoAlpha: 0, y: 10 });
        tl.to(filterItems, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06 }, '-=0.2');
      } else {
        gsap.set(filterBar, { autoAlpha: 0, y: 10 });
        tl.to(filterBar, { autoAlpha: 1, y: 0, duration: 0.4 }, '-=0.2');
      }
    }

    /* ── PRE-HIDE scroll elements ─────────────────────────────────── */
    gsap.set('.pg-recursos_card', { autoAlpha: 0 });
    gsap.set('.pg-recursos_general_heading', { autoAlpha: 0, y: 20 });
    gsap.set('.pg-recursos_general_item', { autoAlpha: 0, x: -20 });
    gsap.set('.pg-footer_col', { autoAlpha: 0, y: 20 });

    /* ── SCROLL REVEALS ───────────────────────────────────────────── */

    /* Resource cards — batch reveal (gl listing-page values) */
    ScrollTrigger.batch('.pg-recursos_card', {
      start: 'top 88%', once: true,
      onEnter: function (els) {
        gsap.to(els, {
          autoAlpha: 1, y: 0, duration: 0.65,
          stagger: 0.1, ease: 'power2.out', overwrite: true
        });
      }
    });

    /* General downloads section heading */
    gsap.to('.pg-recursos_general_heading', {
      autoAlpha: 1, y: 0, duration: 0.65,
      scrollTrigger: { trigger: '.pg-recursos_general', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* General download list items stagger in */
    gsap.to('.pg-recursos_general_item', {
      autoAlpha: 1, x: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.pg-recursos_general_list', start: 'top 82%', toggleActions: 'play none none none' }
    });

    /* Footer columns */
    gsap.to('.pg-footer_col', {
      autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08,
      scrollTrigger: { trigger: '.pg-footer', start: 'top 90%', toggleActions: 'play none none none' }
    });

    ScrollTrigger.refresh();
  }

})();
