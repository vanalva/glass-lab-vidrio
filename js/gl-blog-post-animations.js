/* ════════════════════════════════════════════════════════════════════
   gl-blog-post-animations.js — GSAP animations for Glass Lab blog post
   Requires: gsap.min.js + ScrollTrigger.min.js loaded before this.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.75 });

  /* SYNCHRONOUS: hide nav before first paint — only when the reveal will
     run (under prefers-reduced-motion the reveal never fires, so hiding
     here would leave the navbar invisible). */
  var nav = document.querySelector('.gl-home_nav-edge');
  if (nav && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) gsap.set(nav, { autoAlpha: 0, y: -18 });

  var mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', function () {
    runEntrance();
    setTimeout(runScrollAnimations, 300);
    return function () { ScrollTrigger.getAll().forEach(function (t) { t.kill(); }); };
  });

  mm.add('(prefers-reduced-motion: reduce)', function () {
    if (nav) gsap.set(nav, { clearProps: 'all' });
  });

  function splitWords(el) {
    if (!el) return [];
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) {
      return '<span class="gl-word" style="display:inline-block; overflow:hidden"><span class="gl-word-inner" style="display:inline-block">' + w + '</span></span>';
    }).join(' ');
    return Array.from(el.querySelectorAll('.gl-word-inner'));
  }

  function runEntrance() {
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    var breadcrumb = document.querySelector('.gl-post_breadcrumb');
    var titleEl    = document.querySelector('.gl-post_header_title');
    var metaEl     = document.querySelector('.gl-post_header_meta');
    var heroImg    = document.querySelector('.gl-post_hero_img');

    /* Nav */
    if (nav) tl.to(nav, { autoAlpha: 1, y: 0, duration: 0.65 }, 0.1);

    /* Breadcrumb */
    if (breadcrumb) {
      gsap.set(breadcrumb, { autoAlpha: 0, x: -12 });
      tl.to(breadcrumb, { autoAlpha: 1, x: 0, duration: 0.5 }, 0.3);
    }

    /* Title — word split stagger */
    if (titleEl) {
      var words = splitWords(titleEl);
      if (words.length > 0) {
        gsap.set(words, { autoAlpha: 0, y: '100%' });
        tl.to(words, { autoAlpha: 1, y: '0%', duration: 0.6, stagger: 0.04 }, 0.4);
      } else {
        gsap.set(titleEl, { autoAlpha: 0, y: 20 });
        tl.to(titleEl, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.4);
      }
    }

    /* Meta (date, tag, read time) */
    if (metaEl) {
      gsap.set(metaEl, { autoAlpha: 0, y: 12 });
      tl.to(metaEl, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.6);
    }

    /* Hero image block */
    if (heroImg) {
      gsap.set(heroImg, { autoAlpha: 0, scale: 1.04 });
      tl.to(heroImg, { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 0.5);
    }
  }

  function runScrollAnimations() {
    /* Body paragraphs — staggered fade up */
    gsap.utils.toArray('.gl-post_body_text').forEach(function (el) {
      gsap.from(el, {
        autoAlpha: 0, y: 16, duration: 0.6,
        immediateRender: false,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    /* Body headings */
    gsap.utils.toArray('.gl-post_body_h2').forEach(function (el) {
      gsap.from(el, {
        autoAlpha: 0, y: 14, duration: 0.55,
        immediateRender: false,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    /* Pull quote */
    var pullquote = document.querySelector('.gl-post_pullquote');
    if (pullquote) {
      gsap.from(pullquote, {
        autoAlpha: 0, x: -20, duration: 0.8, ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: { trigger: pullquote, start: 'top 82%', once: true }
      });
    }

    /* Glass row — batch reveal the cells */
    var glassRow = document.querySelector('.gl-post_glass_row');
    if (glassRow) {
      ScrollTrigger.batch(glassRow.querySelectorAll('.gl-cell, .gl-cell_filled'), {
        start: 'top 88%', once: true,
        onEnter: function (els) {
          gsap.from(els, {
            autoAlpha: 0, y: 16, scale: 0.96, duration: 0.55,
            stagger: 0.07, ease: 'power2.out', immediateRender: false
          });
        }
      });
    }

    /* Glass section heading */
    gsap.from('.gl-post_glass .gl-section-number', {
      autoAlpha: 0, y: 10, duration: 0.5,
      immediateRender: false,
      scrollTrigger: { trigger: '.gl-post_glass', start: 'top 88%', once: true }
    });

    /* Prev / next navigation */
    var prevnext = document.querySelector('.gl-proyecto_prevnext');
    if (prevnext) {
      var items = prevnext.querySelectorAll('.gl-proyecto_prevnext_item');
      if (items.length) {
        gsap.from(items, {
          autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.12,
          immediateRender: false,
          scrollTrigger: { trigger: prevnext, start: 'top 88%', once: true }
        });
      }
    }

    /* Reading progress bar */
    var progressBar = document.getElementById('gl-reading-progress');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.id = 'gl-reading-progress';
      progressBar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:2px;background:var(--_theme---text,#fff);transform-origin:left center;transform:scaleX(0);z-index:9999;opacity:0.5;';
      document.body.prepend(progressBar);
    }
    gsap.to(progressBar, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0
      }
    });

    /* Footer columns */
    ScrollTrigger.batch('.gl-home_footer_col', {
      start: 'top 90%', once: true,
      onEnter: function (els) {
        gsap.from(els, { autoAlpha: 0, y: 20, duration: 0.5, stagger: 0.08, immediateRender: false });
      }
    });

    ScrollTrigger.refresh();
  }
})();
