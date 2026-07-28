/* ════════════════════════════════════════════════════════════════════
   gl-home-catalog-preview.js — hover preview for the home "La Formula"
   periodic-table teaser. Same visual treatment as page-catalogo.js's
   catalog preview but scoped to .gl-home_catalog_grid and code is read
   from the cell's href (?code=XX) so the home markup doesn't need
   data-code attributes.

   Requires window.GL_DATA (from data-loader.js) to resolve before any
   hover can populate the preview.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.GL_DATA) return;

  window.GL_DATA.then(function (data) {
    var helpers = data && data.helpers;
    if (!helpers) return;

    /* Build floating preview element once, append to body */
    var preview = document.createElement('div');
    preview.className = 'gl-catalogo_preview gl-home_catalog_preview';
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
      '<div style="aspect-ratio:1/1;background:rgba(255,255,255,0.05);overflow:hidden;margin-bottom:.75rem;border-top-left-radius:var(--radius--subtle,4px);border-top-right-radius:var(--radius--subtle,4px);border-bottom-left-radius:var(--radius--subtle,4px);border-bottom-right-radius:var(--radius--subtle,4px);">',
        '<img class="gl-catalogo_preview_img" src="" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">',
      '</div>',
      '<div class="gl-catalogo_preview_top" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.5rem;">',
        '<span class="gl-cell_symbol gl-catalogo_preview_symbol" style="font-size:2rem;line-height:1;">—</span>',
        '<span class="gl-mono gl-mono_muted gl-catalogo_preview_slot" style="font-size:0.5625rem;">—</span>',
      '</div>',
      '<div class="gl-catalogo_preview_name gl-mono" style="margin-bottom:.5rem;font-size:0.75rem;">—</div>',
      '<div class="gl-catalogo_preview_tags" style="display:flex;gap:.25rem;flex-wrap:wrap;"></div>'
    ].join('');
    document.body.appendChild(preview);

    var imgEl  = preview.querySelector('.gl-catalogo_preview_img');
    var symEl  = preview.querySelector('.gl-catalogo_preview_symbol');
    var slotEl = preview.querySelector('.gl-catalogo_preview_slot');
    var nameEl = preview.querySelector('.gl-catalogo_preview_name');
    var tagsEl = preview.querySelector('.gl-catalogo_preview_tags');

    function addTag(container, text) {
      if (!text) return;
      var t = document.createElement('span');
      t.className = 'gl-tag';
      t.textContent = text;
      container.appendChild(t);
    }

    /* Extract code from href ?code=XX — home cells don't carry data-code */
    function codeFromCell(cell) {
      var explicit = cell.dataset && cell.dataset.code;
      if (explicit) return explicit;
      var href = cell.getAttribute('href') || '';
      var m = href.match(/[?&]code=([A-Za-z0-9_-]+)/);
      return m ? m[1] : null;
    }

    var activeCell = null;

    document.querySelectorAll('.gl-home_catalog_grid .gl-cell_filled').forEach(function (cell) {
      cell.addEventListener('mouseenter', function () {
        var code = codeFromCell(cell);
        if (!code) return;
        var p = helpers.getProduct(code);
        if (!p) return;
        activeCell = cell;

        // Show the image only if it actually loads — products without a
        // render asset gracefully collapse the image box instead of showing
        // a broken-image icon.
        var imgBox = imgEl.parentElement;
        if (p.media && p.media.hero) {
          imgBox.style.display = '';
          imgEl.onerror = function () { imgBox.style.display = 'none'; };
          imgEl.src = p.media.hero;
          imgEl.alt = (p.name && p.name.es) || code;
        } else {
          imgBox.style.display = 'none';
        }
        symEl.textContent  = p.code;
        slotEl.textContent = String(p.slot || '').padStart(3, '0');
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
  }).catch(function (err) {
    console.error('[gl-home-catalog-preview] data load failed:', err);
  });
})();
