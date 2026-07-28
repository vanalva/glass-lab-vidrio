/* ════════════════════════════════════════════════════════════════════
   gl-page-transition.js — SPA page transitions via View Transitions API.

   Same SPA pattern as fluid.glass (fetch destination, swap DOM, animate
   the visual change) but the visual is driven by the browser's
   View Transitions API — meaning the OLD page is captured as a flat
   snapshot (live WebGL, spline-viewer, animations all frozen) and the
   diagonal clip-path runs against that snapshot. No double-rendering,
   no spline-viewer fighting the wipe.

   Animation: the OLD snapshot's clip-path animates L→R off the screen,
   revealing the NEW page (already in the DOM, fully rendered) behind it.

   Browser support: Chrome 111+, Edge 111+, Safari 18+. On unsupported
   browsers we fall back to a direct DOM swap with no animation (still
   no full page reload — just instant content change).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__GL_PT_BOOTED__) return;
  window.__GL_PT_BOOTED__ = true;

  /* Defeat the browser's automatic scroll restoration. With 'auto' (the
     default), the browser may re-apply a previously-captured scrollY for
     the destination URL after our pushState — even after applySwap()
     calls scrollTo(0). Locking it to 'manual' makes our scroll deterministic. */
  try {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  } catch (_) {}

  var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Timing & shape ─────────────────────────────────────────────── */
  var DUR_MS  = 700;
  var EASE    = 'cubic-bezier(.77, 0, .175, 1)';
  var SLANT   = 25; // % of viewport width — diagonal slant
  var FROM    = 'polygon(-' + SLANT + '% 0%, 200% 0%, 200% 100%, 0% 100%)';
  var TO      = 'polygon(100% 0%, 200% 0%, 200% 100%, ' + (100 + SLANT) + '% 100%)';

  /* ── Inject the CSS that drives the diagonal wipe ───────────────── */
  function injectStyles() {
    if (document.getElementById('gl-pt-styles')) return;
    var s = document.createElement('style');
    s.id = 'gl-pt-styles';
    s.textContent = [
      /* Stack old on top, new behind. No default cross-fade. */
      '::view-transition-image-pair(root) { isolation: auto; }',
      '::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }',
      '::view-transition-new(root) { z-index: 1; }',
      '::view-transition-old(root) {',
      '  z-index: 2;',
      '  animation: gl-pt-wipe ' + DUR_MS + 'ms ' + EASE + ' forwards;',
      '}',
      '@keyframes gl-pt-wipe {',
      '  from { clip-path: ' + FROM + '; -webkit-clip-path: ' + FROM + '; }',
      '  to   { clip-path: ' + TO   + '; -webkit-clip-path: ' + TO   + '; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
  injectStyles();

  /* ── Loader script detection (so we don't move/dupe ourselves) ─── */
  function isLoaderScript(node) {
    if (!node || node.nodeType !== 1 || node.tagName !== 'SCRIPT') return false;
    var src = node.getAttribute('src') || '';
    return src.indexOf('gl-page-transition') !== -1;
  }

  /* ── Cross-origin (CDN) library tracking ─────────────────────────
     SPA re-execution must NOT re-download + re-run third-party CDN
     bundles (GSAP, ScrollTrigger, Spline, Swiper). They define globals
     once; re-running them re-defines window.gsap mid-flight and, because
     dynamically-inserted scripts are async, races the local init scripts
     that guard on `typeof gsap` — the cursor/animations/carousels bail
     before GSAP is ready. We evaluate each cross-origin src exactly once
     per document lifetime. */
  var loadedScriptSrcs = new Set();
  function resolveSrc(src) {
    try { return new URL(src, location.href).href; } catch (_) { return src; }
  }
  function isCrossOrigin(resolved) {
    try { return new URL(resolved, location.href).origin !== location.origin; }
    catch (_) { return false; }
  }
  /* Seed from the initial synchronous load — those scripts have already run. */
  Array.prototype.forEach.call(document.querySelectorAll('script[src]'), function (s) {
    loadedScriptSrcs.add(resolveSrc(s.getAttribute('src')));
  });

  /* ── Re-execute scripts in newly-injected content ────────────────
     innerHTML and DocumentFragment insertion do not run <script> tags.
     We clone each script (attrs + textContent) and append a fresh node,
     which triggers execution. */
  function reexecScripts(root) {
    var scripts = Array.prototype.slice.call(root.querySelectorAll('script'));
    for (var i = 0; i < scripts.length; i++) {
      var old = scripts[i];
      if (isLoaderScript(old)) {
        if (old.parentNode) old.parentNode.removeChild(old);
        continue;
      }
      var src = old.getAttribute('src');
      if (src) {
        var resolved = resolveSrc(src);
        /* Already-evaluated cross-origin CDN bundle: it's resident on
           window — drop the inert node instead of re-running it. */
        if (isCrossOrigin(resolved) && loadedScriptSrcs.has(resolved)) {
          if (old.parentNode) old.parentNode.removeChild(old);
          continue;
        }
        loadedScriptSrcs.add(resolved);
      }
      var s = document.createElement('script');
      for (var a = 0; a < old.attributes.length; a++) {
        s.setAttribute(old.attributes[a].name, old.attributes[a].value);
      }
      /* Dynamically-inserted src scripts default to async — they execute in
         network-completion order, NOT document order. Force ordered execution
         so a CDN lib (e.g. a newly-introduced Swiper) always finishes before
         the local script that consumes it. */
      if (old.src) s.async = false;
      if (!old.src) s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    }
  }

  /* ── Tear down lingering GSAP ScrollTriggers + dispose WebGL ─────
     Spline-viewer holds a WebGL context that keeps rendering until
     explicitly disposed. We dispose BEFORE removal so the resource is
     freed cleanly — otherwise the browser logs framebuffer errors as
     the canvas shrinks to 0×0 mid-removal, and on heavy pages the
     lingering rAF tick fights the transition. */
  function tearDownOld() {
    try {
      if (window.ScrollTrigger && typeof window.ScrollTrigger.getAll === 'function') {
        window.ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
      }
      if (window.gsap && window.gsap.globalTimeline) {
        window.gsap.globalTimeline.clear();
      }
    } catch (_) {}
    try {
      document.querySelectorAll('spline-viewer').forEach(function (sv) {
        if (typeof sv.dispose === 'function') sv.dispose();
      });
    } catch (_) {}
  }

  /* ── Pre-warm the destination's head assets and heavy media ──────
     Critical for pages with spline-viewer: we have to (1) load the
     spline-viewer module so the custom element is registered before
     the snapshot is captured, and (2) prime the browser cache with the
     .splinecode scene file so the live page can render it in the same
     frame the wipe completes. Without this, the snapshot is captured
     while spline-viewer is an inert stub and the user sees a blank
     hero behind the wipe followed by a 1-2s pop-in. */
  var loadedHeadSrcs = null;
  function ensureHeadIndex() {
    if (loadedHeadSrcs) return;
    loadedHeadSrcs = new Set();
    Array.prototype.forEach.call(document.head.querySelectorAll('script[src]'), function (s) {
      loadedHeadSrcs.add(s.src);
    });
    Array.prototype.forEach.call(document.head.querySelectorAll('link[rel=stylesheet][href]'), function (l) {
      loadedHeadSrcs.add(l.href);
    });
  }

  function loadHeadScript(src, attrs) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) s.setAttribute(k, attrs[k]);
      }
      s.src = src;
      s.onload = s.onerror = function () { loadedHeadSrcs.add(src); resolve(); };
      document.head.appendChild(s);
    });
  }

  function loadHeadStylesheet(href, attrs) {
    return new Promise(function (resolve) {
      var l = document.createElement('link');
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) l.setAttribute(k, attrs[k]);
      }
      l.href = href;
      l.onload = l.onerror = function () { loadedHeadSrcs.add(href); resolve(); };
      document.head.appendChild(l);
    });
  }

  function prewarmDestination(doc) {
    ensureHeadIndex();
    var work = [];

    // Head scripts not already loaded
    Array.prototype.forEach.call(doc.head.querySelectorAll('script[src]'), function (s) {
      var resolved = new URL(s.getAttribute('src'), doc.baseURI || location.href).href;
      if (loadedHeadSrcs.has(resolved)) return;
      var attrs = {};
      for (var i = 0; i < s.attributes.length; i++) {
        if (s.attributes[i].name !== 'src') attrs[s.attributes[i].name] = s.attributes[i].value;
      }
      work.push(loadHeadScript(resolved, attrs));
    });

    // Head stylesheets not already loaded
    Array.prototype.forEach.call(doc.head.querySelectorAll('link[rel=stylesheet][href]'), function (l) {
      var resolved = new URL(l.getAttribute('href'), doc.baseURI || location.href).href;
      if (loadedHeadSrcs.has(resolved)) return;
      var attrs = {};
      for (var i = 0; i < l.attributes.length; i++) {
        if (l.attributes[i].name !== 'href') attrs[l.attributes[i].name] = l.attributes[i].value;
      }
      work.push(loadHeadStylesheet(resolved, attrs));
    });

    // Spline scenes — fetch the .splinecode bytes so the cache is warm
    // when spline-viewer hits them. no-cors is fine; we just need the
    // browser to keep the response.
    Array.prototype.forEach.call(doc.querySelectorAll('spline-viewer[url]'), function (el) {
      var url = el.getAttribute('url');
      if (!url) return;
      work.push(fetch(url, { mode: 'no-cors', credentials: 'omit' }).catch(function () {}));
    });

    // Hero posters and other assets marked data-pt-prewarm — these paint
    // the spline hero's first frame, so they must be cached before the
    // post-swap snapshot is captured.
    Array.prototype.forEach.call(doc.querySelectorAll('[data-pt-prewarm]'), function (el) {
      var src = el.getAttribute('data-pt-prewarm');
      if (!src) return;
      var resolved = new URL(src, location.href).href;
      work.push(fetch(resolved, { mode: 'no-cors', credentials: 'omit' }).catch(function () {}));
    });

    return Promise.all(work).then(function () {
      // Ensure the custom element is actually registered before we let
      // the View Transition capture the post-swap snapshot.
      //
      // MUST NOT await this unconditionally. whenDefined() returns a promise
      // that only ever RESOLVES — if spline-viewer.js is never loaded it stays
      // pending forever, and .catch() cannot save us because nothing rejects.
      // On phones/touch the spline gate (see gl-index/gl-catalogo head) never
      // injects the module, yet the destination HTML still contains a
      // <spline-viewer> element. Awaiting it there hung navigate() forever,
      // leaving inFlight stuck true — after which EVERY link on the site
      // silently stopped navigating. Two guards: skip entirely when the gate
      // is static, and race a timeout so no future path can wedge the SPA.
      if (window.__glSplineStatic) return;
      if (doc.querySelector('spline-viewer') && window.customElements) {
        return Promise.race([
          window.customElements.whenDefined('spline-viewer'),
          new Promise(function (res) { setTimeout(res, 1200); })
        ]).catch(function () {});
      }
    });
  }

  /* ── Merge runtime-managed classes into the destination's class list ──
     On a Webflow build, several <html>/<body> classes are added at RUNTIME
     (not present in the static fetched HTML): `w-mod-js`, `w-mod-ix3`
     (Webflow's IX engine flag), and the JS-enhancement flag `gl-js`. Blindly
     copying the destination's static className DROPS these — which silently
     breaks IX3 + every `gl-js`-gated style/behaviour after a swap. We union
     the destination's classes with the runtime-managed ones from the live
     document. Theme (`u-theme-*`) is taken from the destination when it
     specifies one (cross-brand dark↔light), otherwise carried over. */
  function mergeRuntimeClasses(currentCls, fetchedCls) {
    var cur = (currentCls || '').split(/\s+/).filter(Boolean);
    var fet = (fetchedCls || '').split(/\s+/).filter(Boolean);
    var fetHasTheme = fet.some(function (c) { return c.indexOf('u-theme-') === 0; });
    var keep = cur.filter(function (c) {
      if (c.indexOf('w-mod-') === 0 || c === 'gl-js') return true;
      if (c.indexOf('u-theme-') === 0) return !fetHasTheme;
      return false;
    });
    var seen = {}, out = [];
    fet.concat(keep).forEach(function (c) { if (c && !seen[c]) { seen[c] = 1; out.push(c); } });
    return out.join(' ');
  }

  /* ── Re-arm the page after a swap ────────────────────────────────
     A hand-rolled SPA on Webflow has to re-initialise what Webflow's
     runtime normally sets up once per full load:
       1. Webflow widgets + IX engine (forms, nav, IX2/IX3 binding) — they
          don't auto-bind to swapped-in DOM. destroy()+ready() re-runs init.
       2. GSAP ScrollTrigger start/end positions — the new page's reveals are
          created asynchronously (via the flwr-gsap bridge), and triggers
          built mid-view-transition measure against a transitioning layout.
          refresh() recomputes them; we refresh next-frame AND after a short
          settle to catch late (bridge-deferred) registrations.
     All guarded so a differing API shape can never throw and abort navigation. */
  function afterSwap() {
    try {
      if (window.Webflow && typeof window.Webflow.destroy === 'function') {
        window.Webflow.destroy();
        window.Webflow.ready();
      }
    } catch (_) {}
    /* Re-assert scroll top on the next frame and after ScrollTrigger.refresh
       so entrance animations / re-executed page scripts can't drag the
       page down. The applySwap pass already zeroed scroll twice; this is
       a belt-and-suspenders pass for late-booting scripts. */
    var refresh = function () {
      try { if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') window.ScrollTrigger.refresh(); } catch (_) {}
      scrollToTopHard();
    };
    if (window.requestAnimationFrame) requestAnimationFrame(refresh); else refresh();
    setTimeout(refresh, 450);
  }

  /* ── DOM swap only — NO body-script execution ────────────────────
     Runs inside the View Transition callback. We keep this as light
     as possible because the browser captures the post-swap snapshot
     immediately after this returns. Body script re-execution is deferred
     to post-snapshot so heavy GSAP/Spline init doesn't block the wipe. */
  function applySwap(doc, href) {
    tearDownOld();

    document.body.className = mergeRuntimeClasses(document.body.className, doc.body.className);
    var bodyStyle = doc.body.getAttribute('style');
    if (bodyStyle) document.body.setAttribute('style', bodyStyle);
    else document.body.removeAttribute('style');

    /* Sync <html> class + background with the destination so cross-brand
       (dark ↔ light) swaps paint correctly and `gl-js`-gated styles
       (custom cursor) follow the page. `gl-preloading` is stripped —
       SPA arrivals never show a preloader, so no scroll lock. */
    var fetchedHtmlCls = (doc.documentElement.className || '').replace(/\bgl-preloading\b/g, '').trim();
    document.documentElement.className = mergeRuntimeClasses(document.documentElement.className, fetchedHtmlCls);
    var htmlBg = doc.documentElement.style.backgroundColor;
    if (htmlBg) document.documentElement.style.backgroundColor = htmlBg;

    var kids = Array.prototype.slice.call(document.body.childNodes);
    for (var i = 0; i < kids.length; i++) {
      if (!isLoaderScript(kids[i])) kids[i].remove ? kids[i].remove() : document.body.removeChild(kids[i]);
    }

    // Move new nodes from the parsed document into our body. <script>
    // tags are imported but not run — we'll re-execute them after the
    // browser has snapshotted the new state.
    var newKids = Array.prototype.slice.call(doc.body.childNodes);
    var frag = document.createDocumentFragment();
    for (var j = 0; j < newKids.length; j++) {
      if (isLoaderScript(newKids[j])) continue;
      frag.appendChild(newKids[j]);
    }
    document.body.insertBefore(frag, document.body.firstChild);

    /* Heavy pages (home, catalog) ship a preloader div for fresh loads.
       On SPA arrival the wipe covers the load instead — hide it before
       the snapshot is captured and before page scripts query it (their
       entrance animations boot immediately when it reads display:none). */
    var swappedPl = document.body.querySelector('.gl-preloader');
    if (swappedPl) swappedPl.style.display = 'none';

    document.title = doc.title || document.title;
    /* Reset scroll BEFORE pushing state so browsers that snapshot scroll
       on history mutation capture (0, 0). */
    scrollToTopHard();
    window.history.pushState({ glPt: true }, '', href);
    scrollToTopHard();
  }

  /* Force scroll to (0, 0) with instant behaviour, ignoring any
     `scroll-behavior: smooth` declared in CSS and any in-flight smooth
     scrolls. Hits documentElement + body to cover quirks-mode + iOS. */
  function scrollToTopHard() {
    try {
      if (typeof window.scrollTo === 'function') {
        try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
        catch (_) { window.scrollTo(0, 0); }
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    } catch (_) {}
  }

  var inFlight = false;

  function navigate(href) {
    if (inFlight) return;
    inFlight = true;

    /* Watchdog. inFlight is a hard gate: while it is true every click is a
       no-op. Any await inside this function that never settles therefore
       bricks navigation for the whole session, with no error to show for it
       (this is exactly what the spline whenDefined() hang did on phones).
       If we haven't completed in time, stop trying to be clever and just do
       a normal browser navigation. */
    var watchdog = setTimeout(function () {
      if (!inFlight) return;
      inFlight = false;
      if (location.href !== href) window.location.href = href;
    }, 6000);
    var clearWatchdog = function () { clearTimeout(watchdog); };

    // If hover-prefetch already cached this destination's HTML, parse
    // it fresh (cheap) instead of refetching. Each navigation gets a
    // virgin Document so applySwap can move its body children.
    var cachedHtml = prefetchCache.get(href);
    var docPromise = cachedHtml
      ? Promise.resolve(new DOMParser().parseFromString(cachedHtml, 'text/html'))
      : fetch(href, { credentials: 'same-origin' })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
          })
          .then(function (html) {
            prefetchCache.set(href, html);
            return new DOMParser().parseFromString(html, 'text/html');
          });

    docPromise
      .then(function (doc) {

        // Pre-warm head scripts + heavy media (spline scenes) BEFORE
        // starting the transition. This ensures the post-swap snapshot
        // captures a fully-ready page, so the wipe doesn't reveal a
        // blank hero that pops in a second later.
        return prewarmDestination(doc).then(function () {
          if (REDUCED_MOTION || !document.startViewTransition) {
            applySwap(doc, href);
            reexecScripts(document.body);
            afterSwap();
            inFlight = false;
            return;
          }

          var t = document.startViewTransition(function () { applySwap(doc, href); });

          // Once snapshots are captured and the wipe has started, kick
          // off body-script execution. The wipe is GPU-driven; JS work
          // during it doesn't stall the animation.
          t.ready.then(function () {
            reexecScripts(document.body);
            afterSwap();
          });

          return t.finished
            .catch(function () {})
            .then(function () { clearWatchdog(); inFlight = false; });
        });
      })
      .catch(function (err) {
        console.warn('[gl-page-transition] fetch failed, falling back:', err);
        clearWatchdog();
        window.location.href = href;
      });
  }

  /* ── Hover prefetch ─────────────────────────────────────────────
     When the mouse enters an internal link, fetch the destination HTML
     + warm its head assets + warm its spline scenes. By the time the
     user actually clicks (~150-500ms later), the page is fully primed
     and the click→wipe-start latency disappears.

     We cache the HTML STRING, not the parsed Document. applySwap moves
     nodes (not clones), so caching the Document and reusing it would
     gut the cache on first navigation and leave the second visit with
     an empty body — that's the "page goes black" bug. Re-parsing on
     each navigation costs ~1-2ms, the network round-trip is what we
     actually save. */
  var prefetchedHrefs = new Set();
  var prefetchCache = new Map(); // href → html string
  function prefetch(href) {
    if (prefetchedHrefs.has(href)) return;
    prefetchedHrefs.add(href);
    fetch(href, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        prefetchCache.set(href, html);
        // Pre-warm using a throwaway parse — the doc is GC'd after.
        return prewarmDestination(new DOMParser().parseFromString(html, 'text/html'));
      })
      .catch(function () {});
  }

  /* Cross-brand jumps (pg- ↔ gl-) can't ride the in-place SPA swap: the two
     brands differ in theme, head assets, and hero (spline vs none), so the
     swap throws mid-flight — the click appears to do nothing AND leaves the
     navigation lock (inFlight) stuck, blocking every later link (logo
     included). Detect the brand switch from the pg-/gl- filename prefix and
     let the browser do a normal full page load instead. */
  function isCrossBrand(href) {
    var cur = /(?:^|\/)(pg|gl)-/.exec(location.pathname);
    var dst = /(?:^|\/)(pg|gl)-/.exec(href);
    return !!(cur && dst && cur[1] !== dst[1]);
  }

  document.addEventListener('mouseover', function (e) {
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
    if (link.target === '_blank') return;
    if (isCrossBrand(href)) return;
    prefetch(link.href);
  }, { passive: true });

  /* ── Browser back/forward — hard reload keeps history simple ────── */
  window.addEventListener('popstate', function () {
    window.location.reload();
  });

  /* ── Spline pages and the wipe ──────────────────────────────────
     Home and catalog used to take a hard navigation (exit shield +
     logo preloader) because the SPA snapshot couldn't capture their
     Spline scenes in time. They now ride the wipe like every other
     page: hover-prefetch warms the spline-viewer module, the
     .splinecode scene, and the hero poster (data-pt-prewarm), and the
     hero paints the poster as its background until the live canvas
     takes over. The logo preloader still covers fresh/external loads. */

  /* ── Intercept internal link clicks ─────────────────────────────── */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    /* Opt-out: links with data-no-transition act as JS triggers, not
       navigation. The link's own click handler runs in the bubble
       phase; without this guard, page-transition would intercept in
       capture phase and call stopImmediatePropagation, blocking the
       handler from ever firing. Used by the dock logo (which spawns
       a glass lens instead of navigating). */
    if (link.dataset.noTransition === 'true') return;
    var href = link.getAttribute('href');
    if (!href) return;
    if (href.charAt(0) === '#') return;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
    if (link.target === '_blank') return;
    if (isCrossBrand(href)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    navigate(link.href);
  }, true);
})();
