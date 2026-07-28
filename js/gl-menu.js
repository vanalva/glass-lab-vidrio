/* ════════════════════════════════════════════════════════════════════
   gl-menu.js — Fullscreen navigation overlay
   Uses GSAP when available, CSS-only (no animation) as fallback.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Flag touch devices so the hover-only reveals can be switched off in CSS.
     On a touchscreen the browser spends the first tap applying :hover when
     the tap visibly changes something, and withholds the click — which is
     why the dock hamburger and several links needed tapping twice. Set here
     as well as in gl-interactions.js because that file is not on every page,
     and this one is on every page that has the menu. */
  if (window.matchMedia &&
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.documentElement.classList.add('gl-touch');
  }

  const menu     = document.getElementById('gl-menu');
  /* Triggers: the top-nav burger (GL or PG) AND the floating dock hamburger. */
  const burgers  = document.querySelectorAll('.gl-home_nav_burger, .pg-nav_burger, .gl-dock_toggle');
  const closeBtn = document.querySelector('.gl-menu_close');
  const logo     = document.querySelector('.gl-menu_header-logo');
  const footer   = document.querySelector('.gl-menu_footer');
  const items    = document.querySelectorAll('.gl-menu_item');
  const thumbs   = document.querySelectorAll('.gl-menu_thumb');

  if (!menu || !burgers.length) return;

  /* GSAP is optional here. gl-visor.html, gl-blog-post.html and
     gl-vidrio-at.html load this file but ship no gsap.min.js — and the module
     used to throw on the very first burger click, AFTER openMenu() had already
     added .is-open and locked body scroll, but BEFORE anything could undo it
     (the class removal lives in closeMenu's GSAP onComplete). The overlay went
     up over the whole viewport and only a page reload got you out of it.
     Degrade to CSS instead of bailing out — same approach gl-nav-scroll.js
     takes: animate when gsap is there, otherwise just toggle the class. */
  const useGsap = typeof gsap !== 'undefined';

  let isOpen = false;
  let openTl = null;

  /* The CSS ships the logo, the close button and the footer at opacity:0 —
     that's the pre-animation state the timeline tweens back in (project.css:
     .gl-menu_header-logo / .gl-menu_close / .gl-menu_footer). With no GSAP
     nothing ever reveals them, and the menu would open without a visible way
     to close it. Reveal them once, up front. */
  if (!useGsap) {
    [logo, closeBtn, footer].forEach(function (el) {
      if (el) el.style.opacity = '1';
    });
  }

  /* Pre-set link inner transforms for animation */
  function buildTimeline() {
    const tl = gsap.timeline({ paused: true });

    /* 1. Reveal overlay */
    tl.fromTo(menu,
      { clipPath: 'inset(0 0 100% 0)' },
      { clipPath: 'inset(0 0 0% 0)', duration: 0.55, ease: 'power3.inOut' }
    );

    /* 2. Logo + close button */
    tl.fromTo([logo, closeBtn],
      { autoAlpha: 0, y: -8 },
      { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' },
      '-=0.15'
    );

    /* 3. Each menu item slides up from under its border */
    const links = document.querySelectorAll('.gl-menu_link');
    tl.fromTo(links,
      { y: '110%' },
      { y: '0%', duration: 0.65, stagger: 0.055, ease: 'power3.out' },
      '-=0.2'
    );

    /* 3b. Side thumbnails fade in */
    if (thumbs.length) {
      tl.fromTo(thumbs,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' },
        '-=0.45'
      );
    }

    /* 4. Footer */
    tl.fromTo(footer,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' },
      '-=0.25'
    );

    return tl;
  }

  function openMenu() {
    if (isOpen) return;
    isOpen = true;
    menu.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    /* CSS-only: .is-open alone flips visibility + pointer-events, so the
       overlay is already up. Nothing left to animate. */
    if (!useGsap) return;

    if (!openTl) openTl = buildTimeline();
    openTl.play(0);
  }

  function closeMenu() {
    if (!isOpen) return;
    isOpen = false;
    document.body.style.overflow = '';

    /* CSS-only: drop .is-open straight away — there is no wipe to wait for. */
    if (!useGsap) {
      menu.classList.remove('is-open');
      return;
    }

    gsap.to(menu, {
      clipPath: 'inset(0 0 100% 0)',
      duration: 0.4,
      ease: 'power3.inOut',
      onComplete: () => { menu.classList.remove('is-open'); }
    });
  }

  burgers.forEach(b => b.addEventListener('click', openMenu));
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });

  /* Close the menu the instant a link is tapped.
     This MUST be a capture-phase listener on document: gl-page-transition.js
     also intercepts link clicks in capture and calls stopImmediatePropagation,
     which killed the old per-link bubble handler below. The result was that
     tapping a menu link left the overlay covering the screen and the body
     scroll locked while the transition fetched and pre-warmed the next page —
     which on mobile takes long enough to look completely dead, so people
     tapped again, and the transition's inFlight lock swallowed those taps.
     Hence "the menu needs several taps".
     gl-menu.js is loaded before gl-page-transition.js, so this fires first. */
  document.addEventListener('click', function (e) {
    if (!isOpen) return;
    var link = e.target.closest && e.target.closest('.gl-menu_link[href]');
    if (!link) return;
    closeMenu();
    document.body.style.overflow = '';
  }, true);

  /* Chat entry — the vanny widget owns its own toggle element, which lives
     off-screen (see [data-vanny-toggle] in each page). Close the menu first,
     then click it once the overlay has wiped away, so the chat panel doesn't
     open underneath a full-screen overlay. */
  document.querySelectorAll('[data-gl-chat]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeMenu();
      var toggle = document.querySelector('[data-vanny-toggle]');
      if (!toggle) return;
      setTimeout(function () { toggle.click(); }, 420);
    });
  });

  /* Menu link arrow hover — purely decorative, so with no GSAP it simply
     doesn't move (the arrow is display:none at every breakpoint anyway). */
  if (useGsap) {
    document.querySelectorAll('.gl-menu_link').forEach(function(link) {
      var arrow = link.querySelector('.gl-menu_link-arrow');
      if (!arrow) return;
      link.addEventListener('mouseenter', function() {
        gsap.to(arrow, { x: 6, duration: 0.2, ease: 'power2.out' });
      });
      link.addEventListener('mouseleave', function() {
        gsap.to(arrow, { x: 0, duration: 0.25, ease: 'power2.out' });
      });
    });
  }

})();
