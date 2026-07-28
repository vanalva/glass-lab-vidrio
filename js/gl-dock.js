/* ════════════════════════════════════════════════════════════════════
   gl-dock.js — Floating Glass Lab dock. Reveals on scroll (past ~70% of
   the first viewport), same rule as pg-dock.js on the Pernia side. The
   vitrina hover panels live in gl-dock-vitrina.js; its hamburger
   (.gl-dock_toggle) opens the fullscreen menu (wired in gl-menu.js).

   The reveal used to exist only as an inline <script> inside gl-index.html,
   so the dock stayed at opacity:0 / pointer-events:none (project.css
   .gl-dock, revealed by .is-visible) on every other GL page. Running
   alongside that inline copy is harmless — both just toggle the same class.
   No dependencies.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const dock = document.querySelector('.gl-dock');
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
