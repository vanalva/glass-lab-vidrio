/* ════════════════════════════════════════════════════════════════════
   page-catalogo.js — stamps cell data attrs + hover preview

   Filter logic is now handled by data-flwr="list" in the HTML, powered
   by the flwr runtime's initList() module.
   ════════════════════════════════════════════════════════════════════ */

window.GL_DATA.then(function (data) {
  var glass = data.glass;
  var helpers = data.helpers;
  console.log('[page-catalogo] data loaded, stamping cells + wiring hover preview');

  /* Stamp each cell with searchable data attributes from JSON.
     In Webflow this step disappears — CMS bindings produce these attrs directly.
     Only writes attrs not already present, so CMS-baked HTML wins. */
  stampCells(glass.products);

  /* Update legend count whenever the list filter fires */
  var grid = document.getElementById('gl-catalogo-grid');
  var legendCount = document.getElementById('gl-legend-count');
  var legendOriginal = legendCount ? legendCount.textContent : '';

  if (grid && legendCount) {
    grid.addEventListener('flwr:list:filtered', function (e) {
      var detail = e.detail || {};
      var visible = detail.visible;
      var total = detail.total;
      var hasActiveFilters = Object.keys(detail.state || {}).some(function (k) {
        return detail.state[k].values && detail.state[k].values.length > 0;
      });

      if (hasActiveFilters) {
        legendCount.textContent = visible + ' de ' + total + ' vidrios visibles · clic para limpiar filtros';
        legendCount.style.cursor = 'pointer';
      } else {
        legendCount.textContent = legendOriginal;
        legendCount.style.cursor = '';
      }
    });

    /* Click legend count → clear all filters */
    legendCount.addEventListener('click', function () {
      if (grid.__flwrList) grid.__flwrList.clear();
    });
  }

  /* ── Filter hint: empty state placeholder / clear button ── */
  var filterHint = document.getElementById('gl-filter-hint');

  if (grid && filterHint) {
    grid.addEventListener('flwr:list:filtered', function (e) {
      var detail = e.detail || {};
      var isFiltered = typeof detail.visible === 'number' && detail.visible < detail.total;

      if (isFiltered) {
        filterHint.textContent = 'Limpiar búsqueda';
        filterHint.classList.add('is-active');
      } else {
        filterHint.textContent = 'Selecciona un filtro';
        filterHint.classList.remove('is-active');
      }
    });

    filterHint.addEventListener('click', function () {
      if (filterHint.classList.contains('is-active')) {
        if (grid.__flwrList) grid.__flwrList.clear();
        /* Also clear the text search input */
        var searchInput = document.querySelector('.gl-filter-search-input');
        if (searchInput) { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); }
      }
    });
  }

  /* ── Hover preview ───────────────────────────────────── */
  initHoverPreview(helpers);
}).catch(function (err) {
  console.error('[page-catalogo] failed to initialize:', err);
  console.error('Are you opening this page via file://? Use http://localhost:8765/pages/gl-catalogo.html instead.');
});

/* ── Stamp cells with searchable data attrs (dev only) ────
   Reads products from JSON and writes data-* attrs onto each cell.
   In Webflow, CMS bindings produce these attrs natively — this function
   becomes a no-op or gets removed entirely.
   Only writes attrs that aren't already present, so CMS-baked HTML wins. */
function stampCells(products) {
  var byCode = new Map(products.map(function (p) { return [p.code, p]; }));
  document.querySelectorAll('.gl-catalogo_grid .gl-cell_filled[data-code]').forEach(function (cell) {
    var p = byCode.get(cell.dataset.code);
    if (!p) return;
    var a = p.attributes || {};

    function set(key, val) {
      if (cell.dataset[key] || val == null || val === '') return;
      cell.dataset[key] = String(val);
    }

    set('subcategory',           p.subcategory);
    // "Semitransparentes serian solo mallas no? Quizas poner Malla" — Guillermo.
    // Derived from subcategory rather than stored, so the mesh series stay the
    // single source of truth and the filter can never drift from them.
    set('familia',               /^mallas-/.test(p.subcategory || '') ? 'malla' : '');
    set('name',                  p.name && p.name.es);
    set('shortName',             p.shortName && p.shortName.es);
    set('colorBase',             a.colorBase);
    set('transparencia',         a.transparencia);
    set('disponibilidad',        a.disponibilidad);
    set('patron',                a.patron);
    set('personalizacionColor',  a.personalizacionColor);
    set('tier',                  a.tier);
    set('acabado',               Array.isArray(a.acabado) ? a.acabado.join(',') : a.acabado);
    set('tags',                  Array.isArray(p.tags) ? p.tags.join(',') : (p.tags || ''));
  });
}

function initHoverPreview(helpers) {
  /* Build floating preview element once, append to body */
  var preview = document.createElement('div');
  preview.className = 'gl-catalogo_preview';
  preview.style.cssText = [
    'position:fixed;pointer-events:none;z-index:1000;',
    'width:280px;padding:1rem;',
    'background-color:var(--swatch--dark-800,#1a1a1a);',
    'border:1px solid var(--swatch--brand-500,#1400FF);',
    'border-top-left-radius:var(--radius--subtle,4px);',
    'border-top-right-radius:var(--radius--subtle,4px);',
    'border-bottom-left-radius:var(--radius--subtle,4px);',
    'border-bottom-right-radius:var(--radius--subtle,4px);',
    'color:var(--swatch--light-100,#fff);',
    'display:none;transition:opacity 120ms ease;opacity:0;'
  ].join('');
  preview.innerHTML = [
    '<div style="position:relative;aspect-ratio:1/1;background:rgba(255,255,255,0.05);overflow:hidden;margin-bottom:.75rem;border-top-left-radius:var(--radius--subtle,4px);border-top-right-radius:var(--radius--subtle,4px);border-bottom-left-radius:var(--radius--subtle,4px);border-bottom-right-radius:var(--radius--subtle,4px);">',
      '<img class="gl-catalogo_preview_img gl-catalogo_preview_imgA" src="" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:1;transition:opacity 420ms ease;">',
      '<img class="gl-catalogo_preview_img gl-catalogo_preview_imgB" src="" alt="" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity 420ms ease;">',
    '</div>',
    '<div class="gl-catalogo_preview_top" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.5rem;">',
      '<span class="gl-cell_symbol gl-catalogo_preview_symbol" style="font-size:2rem;line-height:1;">—</span>',
      '<span class="gl-mono gl-mono_muted gl-catalogo_preview_slot" style="font-size:0.5625rem;">—</span>',
    '</div>',
    '<div class="gl-catalogo_preview_name gl-mono" style="margin-bottom:.5rem;font-size:0.75rem;">—</div>',
    '<div class="gl-catalogo_preview_tags" style="display:flex;gap:.25rem;flex-wrap:wrap;"></div>'
  ].join('');
  document.body.appendChild(preview);

  var imgA   = preview.querySelector('.gl-catalogo_preview_imgA');
  var imgB   = preview.querySelector('.gl-catalogo_preview_imgB');
  var symEl  = preview.querySelector('.gl-catalogo_preview_symbol');
  var slotEl = preview.querySelector('.gl-catalogo_preview_slot');
  var nameEl = preview.querySelector('.gl-catalogo_preview_name');
  var tagsEl = preview.querySelector('.gl-catalogo_preview_tags');

  var activeCell = null;

  /* Auto-cross-fade the glass's heroSlides (angles → detail → environment →
     application) while a cell is hovered, so the preview "moves" — the 3D-ish
     reveal Guillermo remembers. Two stacked <img> layers crossfade; a single
     slide (or none) just shows statically.
     The cycle only starts after CYCLE_DELAY of hovering the SAME cell — a
     quick sweep across the grid shows each glass's cover still, and only a
     deliberate pause begins the slideshow (Guillermo, 2026-07-22). */
  var CYCLE_DELAY = 5000; // ms of steady hover before slides start moving
  var CYCLE_STEP  = 600;  // ms between crossfades once running
  var frontA = true, slideTimer = null, cycleDelayTimer = null;
  function stopCycle() {
    if (cycleDelayTimer) { clearTimeout(cycleDelayTimer); cycleDelayTimer = null; }
    if (slideTimer) { clearInterval(slideTimer); slideTimer = null; }
  }
  function setSlides(slides, alt) {
    stopCycle();
    imgA.src = slides[0] || ''; imgA.alt = alt || '';
    imgA.style.opacity = '1'; imgB.style.opacity = '0'; frontA = true;
    if (slides.length < 2) return;
    slides.forEach(function (s) { var im = new Image(); im.src = s; }); // preload
    var i = 0;
    cycleDelayTimer = setTimeout(function () {
      cycleDelayTimer = null;
      slideTimer = setInterval(function () {
        i = (i + 1) % slides.length;
        var incoming = frontA ? imgB : imgA;
        var outgoing = frontA ? imgA : imgB;
        incoming.src = slides[i];
        var reveal = function () { incoming.style.opacity = '1'; outgoing.style.opacity = '0'; frontA = !frontA; };
        if (incoming.decode) { incoming.decode().then(reveal).catch(reveal); } else { reveal(); }
      }, CYCLE_STEP);
    }, CYCLE_DELAY);
  }

  document.querySelectorAll('.gl-catalogo_grid .gl-cell_filled[data-code]').forEach(function (cell) {
    cell.addEventListener('mouseenter', function () {
      var code = cell.dataset.code;
      var p = helpers.getProduct(code);
      if (!p) return;
      activeCell = cell;

      var slides = (p.media && Array.isArray(p.media.heroSlides) && p.media.heroSlides.length)
        ? p.media.heroSlides
        : (p.media && p.media.hero ? [p.media.hero] : []);
      setSlides(slides, (p.name && p.name.es) || code);
      symEl.textContent  = p.code;
      slotEl.textContent = String(p.slot).padStart(3, '0');
      nameEl.textContent = (p.name && p.name.es) || (p.shortName && p.shortName.es) || p.code;

      tagsEl.innerHTML = '';
      var cat = helpers.getCategory(p.category);
      if (cat) addTag(tagsEl, cat.name.es);
      var sub = helpers.getSubcategory(p.category, p.subcategory);
      if (sub) addTag(tagsEl, sub.name.es);
      var a = p.attributes || {};
      if (a.tier) addTag(tagsEl, a.tier === 'premium' ? 'Premium' : 'Alternativa');
      if (a.personalizacionColor === '300-colores') addTag(tagsEl, '300 colores');
      if (a.disponibilidad === 'custom')        addTag(tagsEl, 'Custom');
      if (a.disponibilidad === 'proximamente')  addTag(tagsEl, 'Próximamente');

      preview.style.display = 'block';
      requestAnimationFrame(function () { preview.style.opacity = '1'; });
    });

    cell.addEventListener('mouseleave', function () {
      activeCell = null;
      stopCycle();
      preview.style.opacity = '0';
      setTimeout(function () { if (!activeCell) preview.style.display = 'none'; }, 120);
    });
  });

  /* Follow cursor */
  document.addEventListener('mousemove', function (e) {
    if (!activeCell) return;
    var pad = 16, w = 280, h = preview.offsetHeight || 320;
    var x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth)  x = e.clientX - w - pad;
    if (y + h > window.innerHeight) y = e.clientY - h - pad;
    preview.style.left = x + 'px';
    preview.style.top  = y + 'px';
  });
}

function addTag(container, text) {
  var t = document.createElement('span');
  t.className = 'gl-tag';
  t.style.fontSize = '0.5rem';
  t.textContent = text;
  container.appendChild(t);
}
