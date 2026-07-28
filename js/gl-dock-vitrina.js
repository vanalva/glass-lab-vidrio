/* ════════════════════════════════════════════════════════════════════
   gl-dock-vitrina.js — Vitrina hover panels for the dock
   Panels: Catálogo · Visor · Contacto · Lente (logo trigger)
   Requires: gsap.min.js
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof gsap === 'undefined') return;

  /* The vitrina hover panels — including the "Lente" glass generator
     (preset chips + spawn-empty + auto-open editor) — are entirely
     pointer/hover driven. On any touch device (incl. an iPad Pro that
     reports desktop width) or ≤991px they can't be reached and only add
     clutter + perf cost, so skip building them. The dock's own nav links
     keep working as ordinary links. */
  if (window.matchMedia('(max-width: 991px)').matches
      || window.matchMedia('(hover: none)').matches
      || window.matchMedia('(pointer: coarse)').matches) return;

  var dock     = document.querySelector('.gl-dock');
  var dockInner = dock && dock.querySelector('.gl-dock_inner');
  if (!dock || !dockInner) return;

  /* ─── Panel HTML ─────────────────────────────────────────────────── */
  function cellHTML(symbol, code, name) {
    return '<a href="gl-vidrio.html?code=' + symbol + '" class="gl-vitrina_cell">' +
      '<span class="gl-vitrina_cell_code">' + code + '</span>' +
      '<span class="gl-vitrina_cell_symbol">' + symbol + '</span>' +
      '<span class="gl-vitrina_cell_name">' + name + '</span>' +
      '</a>';
  }

  var panelHTML = {
    catalogo:
      '<div class="gl-vitrina_header">' +
        '<span class="gl-vitrina_title">Catálogo</span>' +
        '<a href="gl-catalogo.html" class="gl-vitrina_header_link">Ver completo →</a>' +
      '</div>' +
      '<div class="gl-vitrina_cells">' +
        cellHTML('Vc',  '001', 'Claro') +
        cellHTML('In',  '002', 'Interlayer') +
        cellHTML('Ds',  '003', 'Sunset') +
        cellHTML('Dc',  '005', 'Dicroico') +
        cellHTML('Af',  '016', 'Afrodita') +
        cellHTML('Gra', '019', 'Gradient') +
        cellHTML('Ac',  '040', 'Sa-Cuadros') +
        cellHTML('Lm',  '012', 'Laminado') +
      '</div>',

    visor:
      '<div class="gl-vitrina_header">' +
        '<span class="gl-vitrina_title">Visor</span>' +
      '</div>' +
      '<p class="gl-vitrina_desc u-text-style-small">Compositor interactivo de vidrio. Combina sistemas, capas y acabados en tiempo real.</p>' +
      '<a href="gl-visor.html" class="gl-vitrina_cta">Abrir Visor →</a>',

    contacto:
      '<div class="gl-vitrina_header">' +
        '<span class="gl-vitrina_title">Contacto</span>' +
      '</div>' +
      '<form class="gl-vitrina_form" onsubmit="return false">' +
        '<input type="text"  class="gl-vitrina_input" placeholder="Nombre">' +
        '<input type="email" class="gl-vitrina_input" placeholder="Email">' +
        '<textarea class="gl-vitrina_textarea" placeholder="Mensaje" rows="3"></textarea>' +
        '<button type="submit" class="gl-vitrina_submit">Enviar</button>' +
      '</form>',

    lente: '<!-- built dynamically after GL_LENTE_CATALOG is available -->'
  };

  /* ─── Build DOM ──────────────────────────────────────────────────── */
  var anchor = document.createElement('div');
  anchor.className = 'gl-vitrina';

  ['catalogo', 'visor', 'contacto', 'lente'].forEach(function (key) {
    var panel = document.createElement('div');
    panel.className = 'gl-vitrina_panel';
    panel.dataset.vitrina = key;
    panel.innerHTML = panelHTML[key];
    anchor.appendChild(panel);
  });

  dock.insertBefore(anchor, dockInner);
  gsap.set('.gl-vitrina_panel', { autoAlpha: 0, y: 10 });

  /* ─── Show / hide ────────────────────────────────────────────────── */
  var activeKey = null;
  var hideTimer = null;

  function showPanel(key) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (activeKey === key) return;
    if (activeKey) {
      var old = anchor.querySelector('[data-vitrina="' + activeKey + '"]');
      if (old) gsap.to(old, { autoAlpha: 0, y: 10, duration: 0.12, ease: 'power2.in', overwrite: 'auto' });
    }
    activeKey = key;
    var panel = anchor.querySelector('[data-vitrina="' + key + '"]');
    if (panel) gsap.to(panel, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
  }

  function scheduleHide() {
    hideTimer = setTimeout(function () {
      if (!activeKey) return;
      var panel = anchor.querySelector('[data-vitrina="' + activeKey + '"]');
      if (panel) gsap.to(panel, { autoAlpha: 0, y: 10, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
      activeKey = null;
    }, 100);
  }

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  /* ─── Wire dock links ────────────────────────────────────────────── */
  var linkMap = { 'gl-catalogo': 'catalogo', 'gl-visor': 'visor', 'gl-contacto': 'contacto' };

  dockInner.querySelectorAll('.gl-dock_link').forEach(function (link) {
    var href = link.getAttribute('href') || '';
    var key = null;
    Object.keys(linkMap).forEach(function (pattern) {
      if (href.indexOf(pattern) !== -1) key = linkMap[pattern];
    });
    if (!key) return;
    link.addEventListener('mouseenter', function () { showPanel(key); });
  });

  /* Logo: hover → show Lente panel, click → spawn a new glass lens */
  var logo = dockInner.querySelector('.gl-dock_logo');
  if (logo) {
    /* Mark the logo as a JS-only trigger so gl-page-transition.js
       doesn't intercept the click in capture phase (which would block
       our bubble-phase handler below from running). */
    logo.dataset.noTransition = 'true';
    logo.addEventListener('mouseenter', function () { showPanel('lente'); });
    logo.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.glLente) window.glLente.spawn();
    });
  }

  /* Public: show lente panel from outside (kept for compatibility) */
  window.glVitrina = { showLente: function () { showPanel('lente'); } };

  anchor.addEventListener('mouseenter', cancelHide);
  anchor.addEventListener('mouseleave', scheduleHide);
  dockInner.addEventListener('mouseleave', scheduleHide);
  dockInner.addEventListener('mouseenter', cancelHide);

  /* Stop panel link clicks from triggering page-transition */
  anchor.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    e.stopPropagation();
  });

  /* ─── Lente panel — compact branded preset launcher ──────────────
     The full settings editor lives inside gl-lente.js (opens after spawn).
     This panel just lets the user pick a starting point and launch:
       1. Preset chips (uses GL_LENTE_PRESETS — same data as the editor row)
       2. "Lente vacía" button to spawn a blank lens
     Both actions spawn a lens AND auto-open the full editor next to it.

     CSS shares the editor's classes (.gl-le-preset, .gl-lente-editor_*) so
     visual changes to the editor propagate here automatically. */
  var lensPanel = anchor.querySelector('[data-vitrina="lente"]');

  /* Category filters — derived from the presets' own `category` field, in
     the catalog's canonical order, plus an "all" default. */
  var LP_CATS = [
    { id: 'all',         label: 'Todos' },
    { id: 'colores',     label: 'Colores' },
    { id: 'inserciones', label: 'Inserciones' },
    { id: 'reflectivos', label: 'Reflectivos' }
  ];

  function buildLentePanel() {
    var presets = window.GL_LENTE_PRESETS || [];
    var chips = presets.map(function (p) {
      var ds = p.dot && (p.dot.indexOf('gradient') !== -1 || p.dot.indexOf('conic') !== -1)
        ? 'background-image:' + p.dot
        : 'background-color:' + (p.dot || '#444');
      var hay = ((p.code || '') + ' ' + (p.name || '') + ' ' + (p.sub || '')).toLowerCase();
      return '<button class="gl-le-preset gl-lp-preset" data-preset-id="' + p.id + '"' +
        ' data-cat="' + (p.category || '') + '" data-search="' + hay.replace(/"/g, '') + '"' +
        ' title="' + p.name + ' — ' + p.sub + '">' +
        '<span class="gl-le-preset-dot" style="' + ds + '"></span>' +
        '<span class="gl-le-preset-name">' + p.name + '</span>' +
        '</button>';
    }).join('');
    var catBtns = LP_CATS.map(function (c, i) {
      return '<button type="button" class="gl-lp-cat' + (i === 0 ? ' is-active' : '') + '" data-cat="' + c.id + '">' + c.label + '</button>';
    }).join('');

    lensPanel.innerHTML =
      '<div class="gl-vitrina_header">' +
        '<span class="gl-vitrina_title">Lente</span>' +
        /* Clear-all — top-right of the Lente panel. Removes every
           non-bounded lens (preserves the section-anchored interlude
           samples). */
        '<button class="gl-lp-clear-all" id="gl-lp-clear-all" type="button" aria-label="Limpiar todas las lentes" title="Limpiar todas las lentes">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
            '<path d="M10 11v6M14 11v6"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<p class="gl-lp-intro">Compositor de vidrio en tiempo real. Busca un vidrio del catálogo o lanza una lente vacía.</p>' +
      '<div class="gl-lp-filterbar">' +
        '<input type="text" class="gl-lp-search" id="gl-lp-search" placeholder="Buscar vidrio… (código o nombre)" autocomplete="off" spellcheck="false">' +
        '<div class="gl-lp-cats">' + catBtns + '</div>' +
      '</div>' +
      '<div class="gl-lp-presets" id="gl-lp-presets">' + chips + '</div>' +
      '<div class="gl-lp-empty" id="gl-lp-empty" hidden>Sin resultados</div>' +
      /* Brand skew CTA — same signature button used across the homepage */
      '<div class="gl-btn_skew_wrap gl-btn_skew_wrap_brand gl-lp-spawn-wrap">' +
        '<svg class="gl-btn_skew_shape" viewBox="0 0 240 56" preserveAspectRatio="none" fill="none">' +
          '<path d="M16,1 L239,1 L239,42 L224,55 L1,55 L1,14 Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter" vector-effect="non-scaling-stroke"/>' +
        '</svg>' +
        '<button type="button" class="gl-btn_skew_element gl-btn_skew_element_sm" id="gl-lp-spawn">' +
          '<span class="gl-btn_skew_text gl-btn_skew_text_sm">Lente vacía</span>' +
        '</button>' +
      '</div>';

    wireLentePanel();
  }

  function spawnAndHide(presetId) {
    if (!window.glLente) return;
    if (presetId) window.glLente.loadPreset(presetId);
    else          window.glLente.spawn({});
    /* Auto-open the editor — the user just configured a lens; show settings */
    if (window.glLente.openEditor) window.glLente.openEditor();
    scheduleHide();
  }

  function wireLentePanel() {
    /* Preset chip → spawn lens + load preset + open editor */
    var chipEls = lensPanel.querySelectorAll('.gl-lp-preset');
    chipEls.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        spawnAndHide(btn.dataset.presetId);
      });
    });

    /* ── Search + category filter ──────────────────────────────────── */
    var searchEl = lensPanel.querySelector('#gl-lp-search');
    var catEls   = lensPanel.querySelectorAll('.gl-lp-cat');
    var emptyEl  = lensPanel.querySelector('#gl-lp-empty');
    var listEl   = lensPanel.querySelector('#gl-lp-presets');
    var curCat   = 'all';
    function applyFilter() {
      var q = (searchEl && searchEl.value || '').trim().toLowerCase();
      var shown = 0;
      chipEls.forEach(function (btn) {
        var okCat = curCat === 'all' || btn.dataset.cat === curCat;
        var okQ   = !q || (btn.dataset.search || '').indexOf(q) !== -1;
        var show  = okCat && okQ;
        btn.hidden = !show;
        if (show) shown++;
      });
      if (emptyEl) emptyEl.hidden = shown > 0;
      if (listEl)  listEl.scrollTop = 0;
    }
    if (searchEl) {
      searchEl.addEventListener('input', applyFilter);
      /* Keep clicks inside the field from bubbling to the panel/spawn. */
      searchEl.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    catEls.forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        curCat = b.dataset.cat;
        catEls.forEach(function (x) { x.classList.toggle('is-active', x === b); });
        applyFilter();
      });
    });
    /* Empty-lens button */
    var spawn = lensPanel.querySelector('#gl-lp-spawn');
    if (spawn) spawn.addEventListener('click', function (e) {
      e.stopPropagation();
      spawnAndHide(null);
    });
    /* Clear-all — close every user-spawned lens (skips bounded
       interlude samples, which are part of the page composition). */
    var clearBtn = lensPanel.querySelector('#gl-lp-clear-all');
    if (clearBtn) clearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.glLente && window.glLente.closeAllUnbounded) {
        window.glLente.closeAllUnbounded();
      } else if (window.glLente && window.glLente.closeAll) {
        window.glLente.closeAll();
      }
    });
  }

  /* Build after catalog is ready (gl-lente.js loads before gl-dock-vitrina.js) */
  if (window.GL_LENTE_CATALOG) {
    buildLentePanel();
  } else {
    document.addEventListener('DOMContentLoaded', buildLentePanel);
  }

})();
