/* Glass Lab Visor: search + collapsible category sections of the selector.
 * Selection itself belongs to gl-visor-glass3d.js, which reads every
 * .gl-visor_panel_grid .gl-cell; this file only filters and folds them.
 * Classic script, loaded deferred after the engine module. The SPA page
 * transition re-runs it on every visit, so each panel is set up once
 * (data-gl-browse-ready) and nothing is bound to document or window.
 */
(function () {
  'use strict';
  var fold = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  };

  function setup(browse) {
    if (browse.hasAttribute('data-gl-browse-ready')) return;
    browse.setAttribute('data-gl-browse-ready', '');
    var input = browse.querySelector('.gl-visor_search_input');
    var empty = browse.querySelector('.gl-visor_search_empty');
    var groups = Array.prototype.slice.call(browse.querySelectorAll('.gl-visor_group'));
    var saved = null;

    function syncIcon(group) {
      var icon = group.querySelector('.gl-visor_group_icon');
      if (icon) icon.classList.toggle('is-open', group.open);
    }
    groups.forEach(function (group) {
      group.addEventListener('toggle', function () { syncIcon(group); });
    });

    function filter() {
      var q = fold(input.value);
      if (q && !saved) saved = groups.map(function (g) { return g.open; });
      var total = 0;
      groups.forEach(function (group, i) {
        var hits = 0;
        group.querySelectorAll('.gl-cell').forEach(function (cell) {
          var hit = !q || (cell.getAttribute('data-gl-search') || '').indexOf(q) !== -1;
          cell.classList.toggle('gl-visor_cell_hidden', !hit);
          if (hit) hits++;
        });
        group.classList.toggle('gl-visor_group_hidden', !!q && !hits);
        if (q) group.open = hits > 0;
        else if (saved) group.open = saved[i];
        total += hits;
      });
      if (!q) saved = null;
      if (empty) empty.classList.toggle('gl-visor_hidden', !q || total > 0);
    }
    if (input) {
      input.addEventListener('input', filter);
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && input.value) { input.value = ''; filter(); }
      });
    }

    // Desktop: open the section that holds the glass on show. Phones keep
    // them folded; the featured strip and the info block come first there.
    if (!window.matchMedia('(max-width: 767px)').matches) {
      var active = browse.closest('.gl-visor_panel') &&
        browse.closest('.gl-visor_panel').querySelector('.gl-visor_cell_active .gl-cell_symbol');
      var code = (active && active.textContent.trim()) ||
        new URLSearchParams(location.search).get('glass') || 'Va';
      var symbols = browse.querySelectorAll('.gl-cell_symbol');
      for (var i = 0; i < symbols.length; i++) {
        if (symbols[i].textContent.trim() === code) {
          var group = symbols[i].closest('.gl-visor_group');
          if (group) group.open = true;
          break;
        }
      }
    }
    groups.forEach(syncIcon);

    // The engine puts the featured strip's prev/next arrows in the canvas
    // bottom bar. The strip now sits under the scene background, so the
    // arrows move next to it (the engine keeps its references to them; the
    // node is only re-parented). Visible on phones only, per project.css.
    var viewer = browse.closest('.gl-visor_viewer');
    var header = viewer && viewer.querySelector('.gl-visor_featured_header');
    var nav = viewer && viewer.querySelector('.gl-visor_scene .gl-visor_strip_nav');
    if (header && nav) header.appendChild(nav);
  }

  document.querySelectorAll('.gl-visor_browse').forEach(setup);
})();
