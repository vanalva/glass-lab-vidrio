/* ===========================================================================
   Lamination scroll — frame-sequence scrubber
   ---------------------------------------------------------------------------
   Shared by gl-index.html and gl-laboratorio.html (they used to carry
   near-identical inline copies, which silently drifted apart).

   WHY A FRAME SEQUENCE INSTEAD OF <video>:
   Scroll-scrubbing a <video> means setting currentTime every frame. Measured on
   this page, that issued 219 seeks in 4s of which only 56 completed — the
   browser cancels superseded seeks — so the picture repainted ~14x/sec. Pacing
   the seeks (one in flight, quantised to the frame grid) fixed the waste but
   still capped out at ~20 repaints/sec, because each seek costs ~25ms of decode.
   A decoded bitmap blitted to a canvas costs well under 1ms, so the sequence
   holds a true 60fps. It is also SMALLER: 96 WebP frames = 3.4MB vs 7.6MB mp4,
   and it removes the byte-range/seekability dependency entirely.

   The <video> is kept purely as a fallback and is never downloaded unless used
   (its src lives in data-src, preload="none").
   =========================================================================== */
(function () {
  var section = document.querySelector('.gl-catalogo_hero-scroll');
  if (!section) return;

  var canvas    = section.querySelector('.gl-catalogo_hero-scroll_canvas');
  var video     = section.querySelector('#glass-video');
  var bubbles   = section.querySelectorAll('.gl-catalogo_bubble');
  var hotspot   = section.querySelector('.gl-catalogo_hero-hotspot');
  var fade      = document.getElementById('hero-fade');
  var finalText = document.getElementById('hero-final');

  /* ── Scroll progress (shared by both render paths) ─────────────────────── */
  var currentProgress = 0;
  // Smoothing applied to scroll position each frame. The picture chases the
  // scrollbar; a low value trails ~0.5s behind and reads as "laggy" even though
  // every frame is drawn on time. 0.22 ≈ 90% catch-up in ~9 frames (~0.15s):
  // tight and responsive but still smoothed. Higher = snappier/steppier,
  // lower = floatier. Keep in sync with the frame count (more frames tolerate
  // a snappier ease without visible stepping on slow scroll).
  var EASE = 0.22;

  function readProgress() {
    var rect = section.getBoundingClientRect();
    var scrollable = section.offsetHeight - window.innerHeight;
    return scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
  }

  /* Everything that is not the picture: labels, fade, final text. */
  function renderOverlays(p) {
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      var idx = parseInt(b.dataset.catBubble, 10);
      var start = 0.35 + (idx - 1) * 0.05;
      var bp = Math.min(1, Math.max(0, (p - start) / 0.1));
      b.style.setProperty('--bubble-opacity', bp);
      b.style.setProperty('--bubble-y', (1 - bp) * 8 + 'px');
    }
    // Label/CTA is hover-revealed; only arm it while the sample is on screen.
    if (hotspot) hotspot.classList.toggle('is-armed', p > 0.05 && p < 0.82);
    if (fade) fade.style.setProperty('--fade-opacity', Math.min(1, Math.max(0, (p - 0.82) / 0.13)));
    if (finalText) finalText.style.setProperty('--final-opacity', Math.min(1, Math.max(0, (p - 0.88) / 0.08)));
  }

  /* Default frame directory. Also load-bearing for deploy: build-web.js copies
     JS-referenced asset directories by scanning for a quoted path ending in "/"
     (JS_ASSET_DIR_RE). The frame filenames are built at runtime, so without this
     literal the whole sequence would be pruned from dist/ and the page would
     silently fall back to the (janky) video. Keep the trailing slash. */
  var FRAME_DIR_DEFAULT = (window.__FLWR_BASE__||"")+'assets/media/scroll-frames/lamination/';
  var FRAME_DIR_MOBILE  = (window.__FLWR_BASE__||"")+'assets/media/scroll-frames/lamination-9x16/';

  /* ── Frame-sequence path ──────────────────────────────────────────────── */
  function startFrameMode() {
    var isMobile = window.matchMedia('(max-width: 767px)').matches ||
                   window.matchMedia('(pointer: coarse)').matches;

    // Portrait 9:16 cut for phones — the 16:9 desktop frames crop badly on tall
    // screens. Falls back to the desktop set if no mobile set is declared.
    var usingMobileSet = isMobile && !!canvas.dataset.framesMobile;
    var dir, count, fw, fh;
    if (usingMobileSet) {
      dir   = canvas.dataset.framesMobile;
      count = parseInt(canvas.dataset.frameCountMobile, 10);
      fw    = parseInt(canvas.dataset.frameWMobile, 10);
      fh    = parseInt(canvas.dataset.frameHMobile, 10);
    } else {
      dir   = canvas.dataset.frames || FRAME_DIR_DEFAULT;
      count = parseInt(canvas.dataset.frameCount, 10);
      fw    = parseInt(canvas.dataset.frameW, 10);
      fh    = parseInt(canvas.dataset.frameH, 10);
    }
    if (!dir || !count) return false;

    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return false;

    // The two sets have different aspect ratios, so the backing store must match
    // the frames — CSS object-fit:cover then handles the on-screen fit.
    if (fw && fh) { canvas.width = fw; canvas.height = fh; }

    // The mobile set is already cut short. Only thin the sequence when a phone
    // is falling back to the (much longer) desktop set, where decode memory bites.
    var step = (isMobile && !usingMobileSet) ? 3 : 1;

    var picked = [];
    for (var i = 0; i < count; i += step) picked.push(i);
    if (picked[picked.length - 1] !== count - 1) picked.push(count - 1);

    var imgs = new Array(picked.length);
    var ready = new Array(picked.length);
    var readyCount = 0;

    function src(frameIndex) {
      return dir + 'f-' + String(frameIndex + 1).padStart(3, '0') + '.webp';
    }

    for (var k = 0; k < picked.length; k++) {
      (function (k) {
        var img = new Image();
        img.decoding = 'async';
        img.onload = function () { ready[k] = true; readyCount++; if (readyCount === 1) drawFrame(0); };
        img.onerror = function () { ready[k] = false; };
        img.src = src(picked[k]);
        imgs[k] = img;
      })(k);
    }

    var lastDrawn = -1;
    function drawFrame(k) {
      // If that exact frame has not arrived yet, show the nearest one that has,
      // so early scrolling still tracks instead of showing a blank canvas.
      var use = -1;
      for (var d = 0; d < imgs.length; d++) {
        if (ready[k - d]) { use = k - d; break; }
        if (ready[k + d]) { use = k + d; break; }
      }
      if (use < 0 || use === lastDrawn) return;
      ctx.drawImage(imgs[use], 0, 0, canvas.width, canvas.height);
      lastDrawn = use;
    }

    function tick() {
      var target = readProgress();
      currentProgress += (target - currentProgress) * EASE;
      if (Math.abs(target - currentProgress) < 0.0005) currentProgress = target;
      var p = currentProgress;

      // The picture occupies the first 80% of the scroll; the rest is the fade.
      var vp = Math.min(1, p / 0.8);
      drawFrame(Math.round(vp * (imgs.length - 1)));
      renderOverlays(p);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    if (video) { video.hidden = true; video.removeAttribute('src'); }
    canvas.hidden = false;
    return true;
  }

  /* ── Fallback: original <video> seek path ─────────────────────────────── */
  function startVideoMode() {
    if (!video) return;
    if (canvas) canvas.hidden = true;
    video.hidden = false;

    var raw = video.dataset.src;
    if (raw && !video.src) video.src = raw;

    // Blob-load so the file is seekable even when the host will not serve byte
    // ranges (otherwise seekable is empty and the video freezes on frame 0).
    try {
      fetch(video.currentSrc || video.src, { cache: 'force-cache' })
        .then(function (r) { return r.ok ? r.blob() : Promise.reject(); })
        .then(function (b) { video.src = URL.createObjectURL(b); video.load(); })
        .catch(function () {});
    } catch (e) {}

    var SRC_FPS = 24;
    var seekPending = false, seekIssuedAt = 0, lastFrame = -1;
    video.addEventListener('seeked', function () { seekPending = false; });

    function canSeek() {
      return video.seekable && video.seekable.length > 0 &&
             video.seekable.end(video.seekable.length - 1) > 0.1;
    }

    function tick() {
      var target = readProgress();
      currentProgress += (target - currentProgress) * EASE;
      if (Math.abs(target - currentProgress) < 0.0005) currentProgress = target;
      var p = currentProgress;

      if (video.duration) {
        if (canSeek()) {
          if (!video.paused) video.pause();
          if (video.loop) video.loop = false;
          var endGuard = video.duration - 0.05;   // never land exactly on duration ("ended" flashes)
          var t = Math.min(Math.min(1, p / 0.8) * video.duration, endGuard);
          var frame = Math.round(t * SRC_FPS);
          if (seekPending && performance.now() - seekIssuedAt > 250) seekPending = false;
          if (!seekPending && frame !== lastFrame) {
            lastFrame = frame; seekPending = true; seekIssuedAt = performance.now();
            video.currentTime = Math.min((frame + 0.5) / SRC_FPS, endGuard);
          }
        } else {
          var inView = p > 0.001 && p < 0.999;
          if (inView && video.paused) { video.loop = true; video.play().catch(function () {}); }
          else if (!inView && !video.paused) { video.pause(); }
        }
      }
      renderOverlays(p);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var ok = false;
  if (canvas) { try { ok = startFrameMode(); } catch (e) { ok = false; } }
  if (!ok) startVideoMode();
})();
