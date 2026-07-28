/* ════════════════════════════════════════════════════════════════════
   pg-dock.js — Floating Pernia dock. Reveals on scroll (past ~70% of the
   first viewport) and its hamburger (.gl-dock_toggle) opens the fullscreen
   menu (wired in gl-menu.js). No vitrina / lens — that's Glass-Lab only.
   No dependencies.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const dock = document.querySelector('.pg-dock');
  if (!dock) return;

  const threshold = () => window.innerHeight * 0.7;
  let visible = false;

  const update = () => {
    const shouldShow = window.scrollY > threshold();
    if (shouldShow !== visible) {
      visible = shouldShow;
      dock.classList.toggle('is-visible', shouldShow);
    }
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();
