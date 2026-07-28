/* ════════════════════════════════════════════════════════════════════
   cross-brand.js — resolves links that point at the OTHER brand's site.

   Glass Lab and Pernia Glass share one src/ but publish as two independent
   sites (see .flowriter-versions.json). The `vidrio` build drops every
   pg-*.html; the `pernia` build drops every gl-*.html. The build's
   `retargetLink` op rewrites <a href> inside the HTML — but it cannot see a
   URL that a page script builds inside a JS template literal, so those links
   kept pointing at pages the sibling build had deleted (404s).

   The rule, deliberately trivial:

       window.GL_CROSS_BRAND_BASE unset  →  return the path untouched
                                            (relative — the `full` build, where
                                            both brands ship side by side, plus
                                            local development)
       window.GL_CROSS_BRAND_BASE set    →  join it to the front of the path

   FOLLOW-UP (build step, per profile): inject the global before the page
   scripts run, so cross-brand hrefs leave to the sibling domain:

       vidrio  →  window.GL_CROSS_BRAND_BASE = 'https://perniaglass.com/';
       pernia  →  window.GL_CROSS_BRAND_BASE = 'https://glasslb.com/';
       full    →  leave unset

   One global per build is enough: a page belongs to exactly one brand, so
   "cross-brand" always means the other one.

   No dependencies. Safe to load anywhere, in any order.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Already installed (this file loaded twice, or an SPA swap re-ran it) —
     leave the existing function alone. */
  if (window.glCrossBrandHref) return;

  window.glCrossBrandHref = function (path) {
    var base = window.GL_CROSS_BRAND_BASE || '';
    if (!base) return path;
    return base.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
  };

})();
