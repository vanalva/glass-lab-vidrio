/* gl-back.js: smart back link for the glass page and the visor.
 * Markup: an <a data-gl-back href="(catalogue)"> with a <span data-gl-back-label>.
 * Arrived from inside the site (page-transition pushState, or a same-origin
 * referrer) -> "Volver", goes back in history to wherever the visitor was.
 * Arrived directly (typed, shared link, search, other domain) -> keeps the
 * link to the catalogue and reads "Catálogo completo".
 * Classic script; the SPA page transition re-runs it on every visit.
 */
(function () {
  'use strict';
  var internal = false;
  try {
    if (history.state && history.state.glPt) internal = true;
    else if (document.referrer) {
      var ref = new URL(document.referrer);
      internal = ref.origin === location.origin && ref.href !== location.href;
    }
  } catch (error) { internal = false; }
  if (internal && history.length < 2) internal = false;

  document.querySelectorAll('[data-gl-back]').forEach(function (link) {
    if (link.hasAttribute('data-gl-back-ready')) return;
    link.setAttribute('data-gl-back-ready', '');
    var label = link.querySelector('[data-gl-back-label]');
    if (!internal) {
      if (label) label.textContent = 'Catálogo completo';
      link.setAttribute('aria-label', 'Ver el catálogo completo');
      return;
    }
    if (label) label.textContent = 'Volver';
    link.setAttribute('aria-label', 'Volver a la página anterior');
    // page-transition skips links marked this way; history handles the trip back.
    link.setAttribute('data-no-transition', 'true');
    link.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      history.back();
    });
  });
})();
