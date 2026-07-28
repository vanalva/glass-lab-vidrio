/* ============================================================
   gl-map.js — Leaflet single-location map (Glass Lab / Pernia)
   Ported from the Alttura map tool. Themed to the Glass Lab
   electric-blue accent, CartoDB tiles (dark or light per section).

   Usage — drop a container on the page:
     <div class="gl-map gl-contacto_info_map"
          data-gl-map
          data-lat="8.9838" data-lng="-79.5205"
          data-zoom="16" data-map-theme="dark">
       <a class="gl-map_gmaps" target="_blank" rel="noopener"
          href="https://www.google.com/maps/search/?api=1&query=...">
          Abrir en Google Maps &gt;&gt;&gt;</a>
     </div>

   Requires Leaflet 1.9.x CSS + JS loaded before this file.
   ============================================================ */
(function () {
  'use strict';

  var ACCENT = '#1400FF'; // --swatch--brand-500

  /* Inject the brand duotone filters once. These recolor the neutral
     CartoDB basemap into the Glass Lab palette:
       dark  → blue-black shadows  +  periwinkle-brand features
       light → cream background    +  electric-blue features
     A luminance matrix flattens the tile to grayscale, then a component
     transfer maps luminance 0→shadow colour, 1→highlight colour. */
  function injectFilters() {
    if (document.getElementById('gl-map-filters')) return;
    var LUMA =
      '0.2126 0.7152 0.0722 0 0 ' +
      '0.2126 0.7152 0.0722 0 0 ' +
      '0.2126 0.7152 0.0722 0 0 ' +
      '0 0 0 1 0';
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('id', 'gl-map-filters');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    svg.innerHTML =
      '<defs>' +
        '<filter id="gl-map-duotone-dark" color-interpolation-filters="sRGB">' +
          '<feColorMatrix type="matrix" values="' + LUMA + '"/>' +
          '<feComponentTransfer>' +
            '<feFuncR type="table" tableValues="0.039 0.404"/>' +
            '<feFuncG type="table" tableValues="0.043 0.443"/>' +
            '<feFuncB type="table" tableValues="0.078 0.902"/>' +
          '</feComponentTransfer>' +
        '</filter>' +
        '<filter id="gl-map-duotone-light" color-interpolation-filters="sRGB">' +
          '<feColorMatrix type="matrix" values="' + LUMA + '"/>' +
          '<feComponentTransfer>' +
            '<feFuncR type="table" tableValues="0.078 0.929"/>' +
            '<feFuncG type="table" tableValues="0 0.906"/>' +
            '<feFuncB type="table" tableValues="1 0.867"/>' +
          '</feComponentTransfer>' +
        '</filter>' +
      '</defs>';
    document.body.appendChild(svg);
  }

  // Shared: add the themed CartoDB basemap + brand duotone recolor to a map.
  function addBasemap(map, theme) {
    var tileId = theme === 'light' ? 'light_all' : 'dark_all';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + tileId + '/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    var tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = theme === 'light'
        ? 'url(#gl-map-duotone-light)'
        : 'url(#gl-map-duotone-dark)';
    }
  }

  // Ctrl + wheel to zoom (keeps page scroll natural otherwise)
  function ctrlWheelZoom(el, map) {
    el.addEventListener('wheel', function (e) {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) { map.zoomIn(); } else { map.zoomOut(); }
      }
    }, { passive: false });
  }

  function initMap(el) {
    if (el._glMapInit) return;
    if (typeof L === 'undefined') return; // Leaflet not loaded yet
    // Multi-location map (Presencia regional): markers come from a JSON file.
    if (el.getAttribute('data-gl-map-src')) { initMulti(el); return; }
    el._glMapInit = true;
    injectFilters();

    var lat = parseFloat(el.getAttribute('data-lat'));
    var lng = parseFloat(el.getAttribute('data-lng'));
    var zoom = parseInt(el.getAttribute('data-zoom'), 10);
    var theme = (el.getAttribute('data-map-theme') || 'dark').toLowerCase();

    if (isNaN(lat) || isNaN(lng)) return;
    if (isNaN(zoom)) zoom = 15;

    var map = L.map(el, {
      center: [lat, lng],
      zoom: zoom,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false
    });

    // Ctrl + wheel to zoom (keeps page scroll natural otherwise)
    el.addEventListener('wheel', function (e) {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) { map.zoomIn(); } else { map.zoomOut(); }
      }
    }, { passive: false });

    // CartoDB basemap — dark_all for dark sections, light_all for light
    var tileId = theme === 'light' ? 'light_all' : 'dark_all';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + tileId + '/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Recolor the basemap into the brand duotone
    var tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = theme === 'light'
        ? 'url(#gl-map-duotone-light)'
        : 'url(#gl-map-duotone-dark)';
    }

    // Electric-blue pulsing marker
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'gl-map_marker',
        html: '<span class="gl-map_marker_dot"></span><span class="gl-map_marker_ring"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(map);

    // Leaflet mis-measures inside flex/aspect-ratio containers until visible
    setTimeout(function () { map.invalidateSize(); }, 60);
    window.addEventListener('load', function () { map.invalidateSize(); });
  }

  /* Multi-location map — reads a JSON file of { name, city, lat, lng, href }
     and drops one brand dot per project. Used by the "Presencia regional"
     section. Backwards-compatible: any [data-gl-map] without data-gl-map-src
     still uses the single-marker path above. */
  function initMulti(el) {
    if (el._glMapInit) return;
    el._glMapInit = true;
    injectFilters();

    var src = el.getAttribute('data-gl-map-src');
    var theme = (el.getAttribute('data-map-theme') || 'light').toLowerCase();
    var lat = parseFloat(el.getAttribute('data-lat'));
    var lng = parseFloat(el.getAttribute('data-lng'));
    var zoom = parseInt(el.getAttribute('data-zoom'), 10);
    if (isNaN(lat) || isNaN(lng)) { lat = 8.99; lng = -79.51; } // Panama City fallback
    if (isNaN(zoom)) zoom = 12;

    var map = L.map(el, {
      center: [lat, lng],
      zoom: zoom,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false
    });
    ctrlWheelZoom(el, map);
    addBasemap(map, theme);

    // no-cache: GitHub Pages serves JSON with a 10-min max-age; revalidating
    // keeps the pin set in sync with the live deploy (same rule as data-loader.js).
    fetch(src, { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = (data && data.locations) || [];
        var metro = []; // Panama City cluster — used to frame the default view
        for (var i = 0; i < list.length; i++) {
          var loc = list[i];
          if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') continue;
          var main = loc.area || loc.name || loc.city || '';
          var marker = L.marker([loc.lat, loc.lng], {
            icon: L.divIcon({
              className: 'gl-map_marker gl-map_pin',
              html: '<span class="gl-map_marker_dot"></span>',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            }),
            title: main
          }).addTo(map);

          var label = main;
          if (loc.city && loc.city !== main) { label += '<span class="gl-map_tip_city">' + loc.city + '</span>'; }
          marker.bindTooltip(label, {
            direction: 'top', offset: [0, -7], className: 'gl-map_tip', sticky: false
          });
          if (loc.href) {
            (function (href) {
              marker.on('click', function () { window.open(href, '_blank', 'noopener'); });
            })(loc.href);
          }
          if (loc.lat > 8.9 && loc.lat < 9.15 && loc.lng > -79.7 && loc.lng < -79.35) {
            metro.push([loc.lat, loc.lng]);
          }
        }
        // Frame the dense metro cluster; the far outliers (Boquete, Punta Cana)
        // stay on the map and are reachable by zooming out.
        if (metro.length >= 2) {
          map.fitBounds(L.latLngBounds(metro), { padding: [36, 36], maxZoom: 14 });
        }
        map.invalidateSize();
      })
      .catch(function () { /* leave the base map showing on fetch failure */ });

    setTimeout(function () { map.invalidateSize(); }, 60);
    window.addEventListener('load', function () { map.invalidateSize(); });
  }

  function initAll() {
    var nodes = document.querySelectorAll('[data-gl-map]');
    for (var i = 0; i < nodes.length; i++) { initMap(nodes[i]); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  // Re-try once Leaflet's async CDN script has certainly landed
  window.addEventListener('load', initAll);

  // Expose accent for any external theming hooks
  window.GL_MAP_ACCENT = ACCENT;
})();
