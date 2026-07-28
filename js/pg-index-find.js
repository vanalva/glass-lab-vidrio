/* ════════════════════════════════════════════════════════════════════
   pg-index-find.js — "Acabados" carousel.
   Same custom rAF engine as the pg-reel video carousel (smooth, seamless
   infinite loop, throw/inertia physics, horizontal wheel, no text-select,
   no library). Two modes share one track:
     • marquee — clones the set and auto-scrolls in a seamless loop; pauses
                 on hover; drag/throw both directions.
     • search  — when the field has a query the clones are removed and the
                 carousel becomes a filtered, draggable (clamped) list with
                 an empty state. Clearing the field restores the marquee.
   Search is accent-insensitive (name / system / finish).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var section = document.querySelector('.pg-index_find');
  if (!section) return;
  var viewport = section.querySelector('.pg-index_find_swiper');
  var track    = section.querySelector('.pg-index_find_track');
  var input    = section.querySelector('[data-find-search]');
  var empty    = section.querySelector('[data-find-empty]');
  var count    = section.querySelector('[data-find-count]');
  var resetBtn = section.querySelector('[data-find-reset]');
  if (!viewport || !track) return;

  var originals = Array.prototype.slice.call(track.querySelectorAll('.pg-index_find_card'));
  if (!originals.length) return;

  var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

  var SPEED = 0.045;     // auto-scroll px/ms
  var FRICTION = 0.94;   // inertia decay per ~16ms frame
  var MIN_V = 0.015;     // px/ms threshold to end a throw
  var offset = 0, half = 0, minOffset = 0;
  var mode = 'marquee';
  var paused = false, dragging = false, velocity = 0, lastT = null, moved = false;

  track.style.transitionDuration = '0s';   // neutralize any inherited transition

  function clearClones() {
    var clones = track.querySelectorAll('[data-find-clone]');
    for (var i = 0; i < clones.length; i++) clones[i].remove();
  }
  function addClones() {
    clearClones();
    originals.forEach(function (card) {
      var c = card.cloneNode(true);
      c.setAttribute('data-find-clone', '');
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('tabindex', '-1');
      track.appendChild(c);
    });
  }
  function measure() {
    if (mode === 'marquee') {
      half = track.scrollWidth / 2;
    } else {
      minOffset = Math.min(0, viewport.clientWidth - track.scrollWidth);
    }
  }
  function wrap() {
    if (mode === 'marquee') {
      if (half <= 0) return;
      while (offset <= -half) offset += half;
      while (offset > 0) offset -= half;
    } else {
      if (offset > 0) offset = 0;
      if (offset < minOffset) offset = minOffset;
    }
  }
  function paint() { track.style.transform = 'translateX(' + offset + 'px)'; }

  function frame(t) {
    if (lastT === null) lastT = t;
    var dt = t - lastT; lastT = t;
    if (dt > 100) dt = 16;                 // guard against tab-refocus jumps
    if (dragging) {
      // drag handler paints directly
    } else if (Math.abs(velocity) > MIN_V) {
      offset += velocity * dt;             // throw / inertia
      velocity *= Math.pow(FRICTION, dt / 16);
      wrap(); paint();
    } else if (mode === 'marquee' && !paused) {
      velocity = 0;
      offset -= SPEED * dt;                // idle auto-scroll
      wrap(); paint();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Hover stops the marquee; resume on leave (an active throw still finishes)
  viewport.addEventListener('mouseenter', function () { paused = true; });
  viewport.addEventListener('mouseleave', function () { paused = false; lastT = null; });

  // Horizontal wheel / trackpad scroll (vertical intent scrolls the page)
  viewport.addEventListener('wheel', function (e) {
    var horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!horiz) return;
    e.preventDefault();
    velocity = 0;
    offset -= horiz;
    wrap(); paint();
  }, { passive: false });

  // Drag + throw (pointer events: mouse + touch)
  var startX = 0, startOffset = 0, lastX = 0, lastMoveT = 0, dragCaptured = false, dragPointerId = null;
  viewport.addEventListener('pointerdown', function (e) {
    dragging = true; moved = false; velocity = 0; dragCaptured = false; dragPointerId = e.pointerId;
    startX = lastX = e.clientX; startOffset = offset; lastMoveT = now();
    e.preventDefault();                    // block text / native image drag
    /* NOTE: do NOT setPointerCapture here. Capturing on pointerdown retargets
       the follow-up `click` to this viewport <div>, so a genuine tap on a card
       never reaches its <a> and navigation silently no-ops. Capture is deferred
       to pointermove (below) so it only engages once a real drag begins. */
  });
  viewport.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var tn = now(), dx = e.clientX - lastX, dtm = tn - lastMoveT;
    if (Math.abs(e.clientX - startX) > 4) {
      moved = true;
      // Real drag started — capture now (keeps drag alive if the pointer
      // leaves the viewport). A tap never reaches this branch, so its click
      // still targets the card's <a>.
      if (!dragCaptured) { try { viewport.setPointerCapture(dragPointerId); dragCaptured = true; } catch (err) {} }
    }
    if (dtm > 0) velocity = dx / dtm;      // signed px/ms → carries into the throw
    lastX = e.clientX; lastMoveT = tn;
    offset = startOffset + (e.clientX - startX);
    wrap(); paint();
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false; lastT = null;
    if (now() - lastMoveT > 80) velocity = 0;   // released after a pause → no throw
    if (dragCaptured) { try { viewport.releasePointerCapture(dragPointerId); } catch (err) {} dragCaptured = false; }
  }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* Suppress the click that ends a drag so a card's link doesn't navigate.
     Capture phase + registered before gl-page-transition's document listener
     (this file loads first), so a real drag is blocked; a genuine tap passes. */
  document.addEventListener('click', function (e) {
    if (moved && viewport.contains(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    moved = false;
  }, true);

  // ── Search / filter ──────────────────────────────────────────────
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function setMode(m) {
    if (mode === m) return;
    mode = m;
    if (m === 'marquee') addClones(); else clearClones();
    offset = 0; velocity = 0; lastT = null;
    measure(); wrap(); paint();
  }
  function applyFilter(raw) {
    var query = norm(raw.trim());
    if (query) {
      setMode('search');
      var visible = 0;
      originals.forEach(function (card) {
        var hay = norm(card.dataset.findText || card.textContent);
        var match = hay.indexOf(query) !== -1;
        card.classList.toggle('is-filtered', !match);
        if (match) visible++;
      });
      if (empty) empty.classList.toggle('is-shown', visible === 0);
      if (count) count.textContent = visible + (visible === 1 ? ' resultado' : ' resultados');
      offset = 0; measure(); wrap(); paint();
    } else {
      originals.forEach(function (card) { card.classList.remove('is-filtered'); });
      if (empty) empty.classList.remove('is-shown');
      if (count) count.textContent = 'Destacados';
      setMode('marquee');
    }
  }
  if (input) input.addEventListener('input', function () { applyFilter(input.value); });
  if (resetBtn) resetBtn.addEventListener('click', function () {
    if (input) { input.value = ''; input.focus(); }
    applyFilter('');
  });

  window.addEventListener('resize', function () { measure(); wrap(); paint(); });

  // ── Cursor-following hover preview (light-mode, like the catalog) ──
  (function initPreview() {
    var preview = document.createElement('div');
    preview.className = 'pg-find_preview';
    preview.innerHTML =
      '<div class="pg-find_preview_media"><img class="pg-find_preview_img" src="" alt=""></div>' +
      '<span class="pg-find_preview_name"></span>' +
      '<span class="gl-mono gl-mono_muted pg-find_preview_sub"></span>' +
      '<div class="pg-find_preview_tags"></div>';
    document.body.appendChild(preview);
    var imgEl  = preview.querySelector('.pg-find_preview_img');
    var nameEl = preview.querySelector('.pg-find_preview_name');
    var subEl  = preview.querySelector('.pg-find_preview_sub');
    var tagsEl = preview.querySelector('.pg-find_preview_tags');
    var active = false;

    function populate(card) {
      var img  = card.querySelector('.pg-index_find_card-img');
      var name = card.querySelector('.pg-index_find_card-title');
      var sub  = card.querySelector('.gl-mono_muted');
      var zoom = card.dataset.zoom;   // dedicated high-res zoom shot, falls back to the card image
      imgEl.src = zoom || (img ? (img.currentSrc || img.src) : '');
      imgEl.alt = (img && img.alt) || (name && name.textContent) || '';
      nameEl.textContent = name ? name.textContent : '';
      subEl.textContent  = sub ? sub.textContent : '';
      tagsEl.innerHTML = '';
      card.querySelectorAll('.pg-index_find_card-tags .gl-tag').forEach(function (t) {
        var s = document.createElement('span');
        s.className = 'gl-tag';
        s.textContent = t.textContent;
        tagsEl.appendChild(s);
      });
    }
    function show() { active = true; preview.style.display = 'block'; requestAnimationFrame(function () { preview.style.opacity = '1'; }); }
    function hide() { active = false; preview.style.opacity = '0'; setTimeout(function () { if (!active) preview.style.display = 'none'; }, 160); }

    viewport.addEventListener('mouseover', function (e) {
      var card = e.target.closest('.pg-index_find_card');
      if (!card) return;
      populate(card);
      show();
    });
    viewport.addEventListener('mouseleave', hide);
    viewport.addEventListener('pointerdown', hide);   // don't cover the carousel while dragging
    document.addEventListener('mousemove', function (e) {
      if (!active) return;
      var pad = 18, w = preview.offsetWidth || 280, h = preview.offsetHeight || 360;
      var x = e.clientX + pad, y = e.clientY + pad;
      if (x + w > window.innerWidth)  x = e.clientX - w - pad;
      if (y + h > window.innerHeight) y = e.clientY - h - pad;
      /* keep fully on-screen even when taller/wider than the cursor's margin */
      x = Math.max(pad, Math.min(x, window.innerWidth  - w - pad));
      y = Math.max(pad, Math.min(y, window.innerHeight - h - pad));
      preview.style.left = x + 'px';
      preview.style.top  = y + 'px';
    });
  })();

  // init — marquee
  addClones();
  measure();
  requestAnimationFrame(function () { measure(); });   // re-measure after layout settles
})();
