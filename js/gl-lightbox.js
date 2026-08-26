/* ════════════════════════════════════════════════════════════════════
   gl-lightbox.js — THE photo viewer for both sites (Glass Lab + Pernia)

   One implementation, one set of styles (.gl-lightbox* in project.css):
   dark backdrop, image contained at its real ratio, set label + counter,
   close / prev / next, keyboard (Esc, arrows, Tab trap) and touch swipe.
   The "Archivo en obra" grid (gl-instalaciones.js) opens this same viewer
   programmatically; every other gallery opts in with one attribute.

   Opt-in per container OR per image:

     <div class="pg-mob_gallery_grid" data-gl-lightbox="Galería"></div>
     <img class="pg-nosotros_lab_img" data-gl-lightbox src="…">

   · Every eligible <img> inside a [data-gl-lightbox] container becomes a
     trigger (click, Enter, Space). Images injected later (data-driven
     pages fill their grids after a fetch) are picked up by a
     MutationObserver; an opted-in <img> whose src arrives later is
     re-evaluated when the src changes.
   · data-gl-lightbox="…" is the set label shown in the caption. If the
     value is a CSS selector that matches something (e.g.
     ".pg-proyecto_hero_title" or "[data-bind=name]"), that element's text
     is used instead — handy on data-driven pages where the title arrives
     with the data. Empty value → the page <h1>.
   · Eligible = a real content image. Skipped automatically: images inside
     a link (the link wins), aria-hidden decoration, data: URIs, empty
     sources, anything under [data-gl-lightbox-skip], and SVGs inside a
     container (logos/icons) — an SVG that is itself the opted-in element
     (a technical drawing) is allowed. Duplicate sources inside one
     container (marquee clones) collapse to a single slide.
   · <img data-gl-lightbox-src="…"> (or data-zoom="…") shows that file in
     the viewer instead of the thumbnail it renders with.
   · Eligible images get data-gl-lightbox-item (project.css keys the
     zoom-in cursor + focus ring off it), tabindex, role=button, aria-label.

   Programmatic: window.GLLightbox.open([{src, alt, label}], index, {label}).

   SPA-safe: gl-page-transition.js re-runs body scripts after every swap
   and replaces every body child, so this file executes several times per
   document lifetime. State lives on window.GLLightbox; re-runs only bind
   the freshly swapped-in containers, and open() re-attaches the viewer
   element if the swap removed it.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.GLLightbox && window.GLLightbox.__v === 3) {
    window.GLLightbox.bindAll();
    return;
  }

  var items = [];
  var index = 0;
  var isOpen = false;
  var lastFocused = null;
  var touchX = null;

  function modulo(value, length) {
    return ((value % length) + length) % length;
  }

  function padNumber(value) {
    return String(value).padStart(2, '0');
  }

  /* ── Viewer element (built once, re-attached as needed) ─────── */
  var lb = document.createElement('div');
  /* u-theme-dark: the viewer chrome is always dark, but Pernia pages run on
     u-theme-light, where the caption + close label (.gl-mono_label / _muted
     derive their colour from --_theme---text) would resolve to dark-on-dark
     and vanish. The theme class re-scopes those variables for the viewer. */
  lb.className = 'gl-lightbox u-theme-dark';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Visor de fotografías');
  lb.hidden = true;
  lb.innerHTML =
    '<div class="gl-lightbox_backdrop" data-lb-close></div>' +
    '<div class="gl-lightbox_frame">' +
      '<figure class="gl-lightbox_figure">' +
        '<img class="gl-lightbox_image" alt="" decoding="async">' +
        '<figcaption class="gl-lightbox_caption">' +
          '<span class="gl-mono gl-mono_label gl-lightbox_set"></span>' +
          '<span class="gl-mono gl-mono_muted gl-lightbox_count"></span>' +
        '</figcaption>' +
      '</figure>' +
    '</div>' +
    '<button type="button" class="gl-lightbox_close" data-lb-close aria-label="Cerrar visor">' +
      '<span class="gl-mono gl-mono_label gl-lightbox_close-label">Cerrar</span>' +
      '<span class="gl-lightbox_close-icon" aria-hidden="true"></span>' +
    '</button>' +
    '<button type="button" class="gl-lightbox_nav gl-lightbox_nav-prev" data-lb-prev aria-label="Fotografía anterior">' +
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '</button>' +
    '<button type="button" class="gl-lightbox_nav gl-lightbox_nav-next" data-lb-next aria-label="Siguiente fotografía">' +
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 4L14 10L8 16" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '</button>';

  var lbImage  = lb.querySelector('.gl-lightbox_image');
  var lbSet    = lb.querySelector('.gl-lightbox_set');
  var lbCount  = lb.querySelector('.gl-lightbox_count');
  var lbFigure = lb.querySelector('.gl-lightbox_figure');
  var lbPrev   = lb.querySelector('[data-lb-prev]');
  var lbNext   = lb.querySelector('[data-lb-next]');
  var lbClose  = lb.querySelector('.gl-lightbox_close');
  var setLabel = '';

  function attach() {
    if (!document.body.contains(lb)) document.body.appendChild(lb);
  }

  function preload(i) {
    var item = items[modulo(i, items.length)];
    if (item && item.src) { var img = new Image(); img.src = item.src; }
  }

  function render() {
    var item = items[modulo(index, items.length)];
    if (!item) return;
    lbFigure.classList.add('gl-lightbox_figure-loading');
    /* Technical drawings are SVGs with dark strokes and no intrinsic size:
       on the dark backdrop they would vanish and render at 300×150. The
       plate class (project.css) gives them a light board and a real width. */
    lbFigure.classList.toggle('gl-lightbox_figure-plate', /\.svg(\?|#|$)/i.test(item.src));
    lbImage.src = item.src;
    lbImage.alt = item.alt || item.label || setLabel || '';
    lbSet.textContent = item.label || setLabel || '';
    lbCount.textContent = padNumber(modulo(index, items.length) + 1) + ' / ' + padNumber(items.length);
    /* Warm the neighbours so "pasar con →" never waits on the network. */
    preload(index + 1);
    preload(index - 1);
  }

  lbImage.addEventListener('load', function () {
    lbFigure.classList.remove('gl-lightbox_figure-loading');
    /* Hand the real ratio to CSS so the frame hugs the photo whatever its
       shape — portraits stay portraits, nothing is cropped. */
    if (lbImage.naturalWidth && lbImage.naturalHeight) {
      lbFigure.style.setProperty('--lb-ratio', lbImage.naturalWidth + ' / ' + lbImage.naturalHeight);
    }
  });

  function open(list, start, opts) {
    if (!Array.isArray(list) || !list.length) return;
    items = list;
    index = modulo(start || 0, items.length);
    setLabel = (opts && opts.label) || '';
    var single = items.length < 2;
    lbPrev.hidden = single;
    lbNext.hidden = single;
    lastFocused = document.activeElement;
    attach();
    lb.hidden = false;
    isOpen = true;
    document.body.classList.add('gl-lightbox-lock');
    render();
    /* Force a style pass with opacity 0 applied, then flip the class so the
       0.2s fade runs. A reflow is deterministic; rAF is not (throttled in
       background tabs, which made this look inert in automated checks). */
    void lb.offsetWidth;
    lb.classList.add('gl-lightbox-visible');
    lbClose.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    lb.classList.remove('gl-lightbox-visible');
    document.body.classList.remove('gl-lightbox-lock');
    window.setTimeout(function () { if (!isOpen) lb.hidden = true; }, 200);
    if (lastFocused && lastFocused.focus && document.body.contains(lastFocused)) lastFocused.focus();
  }

  function go(step) {
    if (!isOpen || items.length < 2) return;
    index = modulo(index + step, items.length);
    render();
  }

  lb.addEventListener('click', function (event) {
    if (event.target.closest('[data-lb-close]')) close();
    else if (event.target.closest('[data-lb-prev]')) go(-1);
    else if (event.target.closest('[data-lb-next]')) go(1);
  });

  document.addEventListener('keydown', function (event) {
    if (!isOpen) return;
    if (event.key === 'Escape') { close(); }
    else if (event.key === 'ArrowLeft') { go(-1); }
    else if (event.key === 'ArrowRight') { go(1); }
    else if (event.key === 'Tab') {
      var focusables = Array.prototype.filter.call(lb.querySelectorAll('button'), function (b) { return !b.hidden; });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
      else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
    }
  });

  lb.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });

  /* ── Eligibility ─────────────────────────────────────────────── */
  function sourceOf(img) {
    var explicit = img.getAttribute('data-gl-lightbox-src') || img.getAttribute('data-zoom');
    if (explicit) return explicit;
    /* An empty src attribute resolves img.src to the page URL — never treat
       that as a picture (data-driven pages ship <img src=""> shells). */
    var attr = (img.getAttribute('src') || '').trim();
    if (!attr) return '';
    return img.currentSrc || img.src || attr;
  }

  /* container === null means the image itself is the opted-in element. */
  function eligible(img, container) {
    if (!img || img.tagName !== 'IMG') return false;
    if (img.closest('[data-gl-lightbox-skip]')) return false;
    if (img.getAttribute('aria-hidden') === 'true') return false;
    if (img.closest('.gl-lightbox')) return false;
    /* A linked image navigates — the link wins, always. */
    var link = img.closest('a');
    if (link && (!container || container.contains(link))) return false;
    var src = sourceOf(img);
    if (!src) return false;
    if (/^data:/i.test(src)) return false;
    /* SVGs inside a container are logos/icons; an SVG that was opted in on
       its own (a technical drawing) is content. */
    if (container && /\.svg(\?|#|$)/i.test(src)) return false;
    return true;
  }

  function imagesIn(container) {
    if (container.tagName === 'IMG') return eligible(container, null) ? [container] : [];
    return Array.prototype.filter.call(container.querySelectorAll('img'), function (img) {
      return eligible(img, container);
    });
  }

  /* One slide per distinct source — marquee tracks clone their cards. */
  function collect(container) {
    var seen = {};
    var list = [];
    imagesIn(container).forEach(function (img) {
      var src = sourceOf(img);
      if (seen[src]) { seen[src].els.push(img); return; }
      var item = { src: src, alt: img.alt || '', els: [img] };
      seen[src] = item;
      list.push(item);
    });
    return list;
  }

  function labelFor(container) {
    var value = (container.getAttribute('data-gl-lightbox') || '').trim();
    if (value) {
      var el = null;
      try { el = document.querySelector(value); } catch (e) { el = null; }
      if (el && el !== container) return el.textContent.replace(/\s+/g, ' ').trim();
      return value;
    }
    var h1 = document.querySelector('h1');
    return h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function mark(img, i, total) {
    img.setAttribute('data-gl-lightbox-item', '');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Ampliar fotografía ' + (i + 1) + ' de ' + total);
  }

  function unmark(img) {
    img.removeAttribute('data-gl-lightbox-item');
    img.removeAttribute('tabindex');
    img.removeAttribute('role');
    img.removeAttribute('aria-label');
  }

  /* (Re)apply the trigger attributes to exactly the eligible images. */
  function decorate(container) {
    var list = collect(container);
    var keep = [];
    list.forEach(function (item, i) {
      item.els.forEach(function (img) { mark(img, i, list.length); keep.push(img); });
    });
    var marked = container.tagName === 'IMG'
      ? [container]
      : Array.prototype.slice.call(container.querySelectorAll('img[data-gl-lightbox-item]'));
    marked.forEach(function (img) {
      if (keep.indexOf(img) === -1 && img.hasAttribute('data-gl-lightbox-item')) unmark(img);
    });
  }

  function openFrom(container, img) {
    var list = collect(container);
    var i = -1;
    for (var k = 0; k < list.length; k++) {
      if (list[k].els.indexOf(img) !== -1) { i = k; break; }
    }
    if (i < 0) return;
    open(list, i, { label: labelFor(container) });
  }

  function triggerFrom(container, target) {
    var img = target.closest('img');
    if (!img) return null;
    if (container.tagName === 'IMG') return img === container && eligible(img, null) ? img : null;
    return container.contains(img) && eligible(img, container) ? img : null;
  }

  function bind(container) {
    if (container.__glLightbox) return;
    container.__glLightbox = true;

    container.addEventListener('click', function (event) {
      var img = triggerFrom(container, event.target);
      if (!img) return;
      event.preventDefault();
      openFrom(container, img);
    });

    container.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var img = triggerFrom(container, event.target);
      if (!img) return;
      event.preventDefault();
      openFrom(container, img);
    });

    decorate(container);
    if ('MutationObserver' in window) {
      var redo = function () { decorate(container); };
      if (container.tagName === 'IMG') {
        new MutationObserver(redo).observe(container, { attributes: true, attributeFilter: ['src', 'data-gl-lightbox-src', 'data-zoom'] });
      } else {
        new MutationObserver(redo).observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
      }
    }
  }

  function bindAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-gl-lightbox]'), bind);
  }

  window.GLLightbox = { __v: 3, open: open, close: close, bindAll: bindAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll);
  } else {
    bindAll();
  }
})();
