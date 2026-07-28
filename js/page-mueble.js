/* ════════════════════════════════════════════════════════════════════
   page-mueble.js — populates pg-mueble.html from pernia-mobiliario.json

   Reads ?slug=<slug> (or ?code=<CODE>) from the URL, then fills every
   element tagged with data-bind. Builds the spec rows, colorway swatches,
   in-context gallery and the related-pieces row.
   ════════════════════════════════════════════════════════════════════ */

/* Field labels for the spec table (any keys present on a piece render in
   this order; unknown keys fall back to a title-cased label). */
/* Guillermo asked for exactly material / medidas / color on each piece
   (WhatsApp 2026-07-20). The older keys stay listed so any legacy entry
   still renders with a proper label instead of a title-cased slug. */
var MUEBLE_SPEC_LABELS = {
  material:        'Material',
  medidas:         'Medidas',
  color:           'Color',
  cantos:          'Cantos',
  union:           'Unión',
  acabado:         'Acabado',
  formato:         'Formato',
  composicion:     'Composición',
  personalizacion: 'A medida',
  pieza:           'Pieza'
};

window.GL_DATA.then(function (data) {
  var helpers = data.helpers;
  var slug = getSlugFromUrl('perforata');
  var piece = helpers.getMueble(slug);

  if (!piece) {
    renderNotFound(slug);
    return;
  }
  renderPiece(piece, helpers.getMuebles());
}).catch(function (err) {
  console.error('[page-mueble] failed to load mobiliario data:', err);
  console.error('Are you opening this page via file://? Use the local server (http://localhost:8765) instead.');
});

function renderPiece(piece, allPieces) {
  var nameEs   = piece.name && piece.name.es || piece.code;
  var catEs    = piece.categoryLabel && piece.categoryLabel.es || piece.category || '';
  var descEs   = piece.description && piece.description.es || '';
  var taglineEs = piece.tagline && piece.tagline.es || '';

  document.title = nameEs + ' | Pernia Glass';

  /* Breadcrumb + tags + title */
  var bc = document.querySelector('[data-bind="breadcrumb"]');
  if (bc) {
    bc.innerHTML = '<a href="pg-mobiliario.html" class="pg-sistema_hero_breadcrumb-link">Mobiliario</a> &gt; ' + esc(nameEs);
  }
  setText('[data-bind="categoryTag"]', catEs);
  setText('[data-bind="name"]',        nameEs);
  setText('[data-bind="tagline"]',     taglineEs);

  /* Hero image */
  var heroImg = document.querySelector('[data-bind-src="hero"]');
  var heroSrc = piece.media && (piece.media.render || piece.media.detailRender);
  if (heroImg && heroSrc) {
    heroImg.src = heroSrc;
    heroImg.alt = nameEs + ' — mobiliario de vidrio Pernia';
  }

  /* Hero facts — the hard numbers, opposite the tagline. Catalogue reading
     order: what it's made of, then how big it is. */
  var heroFacts = document.querySelector('[data-bind="heroFacts"]');
  if (heroFacts) {
    heroFacts.innerHTML = '';
    var specs = piece.specs || {};
    [specs.medidas, specs.material].forEach(function (spec) {
      if (!spec || !spec.es) return;
      var line = document.createElement('span');
      line.className = 'gl-mono gl-mono_muted';
      line.textContent = spec.es;
      heroFacts.appendChild(line);
    });
  }

  /* Overview heading + description */
  setText('[data-bind="overviewHeading"]', nameEs);
  setText('[data-bind="overviewDesc"]',    descEs || taglineEs);

  /* Overview detail image (falls back to render) */
  var overviewImg = document.querySelector('[data-bind-src="overview"]');
  var overviewSrc = piece.media && (piece.media.detailRender || piece.media.render);
  if (overviewImg && overviewSrc) {
    overviewImg.src = overviewSrc;
    overviewImg.alt = 'Detalle — ' + nameEs;
  }

  /* Features (short bullet list) */
  var features = document.querySelector('[data-bind="features"]');
  if (features) {
    features.innerHTML = '';
    var specs = piece.specs || {};
    var bullets = [];
    if (specs.material)   bullets.push(specs.material.es);
    if (specs.medidas)    bullets.push('Medidas de catálogo — ' + specs.medidas.es);
    if (specs.acabado)    bullets.push(specs.acabado.es);
    if (piece.colorways && piece.colorways.length) {
      bullets.push(piece.colorways.length + ' acabados de referencia — color a medida');
    }
    bullets.push('Fabricación a medida — color y dimensión a elección');
    bullets.forEach(function (b) { if (b) features.appendChild(featureItem(b)); });
  }

  /* Catalogue line drawing beside the spec table (hidden if a piece has none) */
  var diagramImg = document.querySelector('[data-bind-src="diagram"]');
  var diagramWrap = document.querySelector('[data-bind-section="diagram"]');
  var diagramSrc = piece.media && piece.media.diagram;
  if (diagramImg && diagramSrc) {
    diagramImg.src = diagramSrc;
    diagramImg.alt = 'Dibujo isométrico de ' + nameEs + ' — catálogo Pernia Studio';
  } else if (diagramWrap) {
    diagramWrap.style.display = 'none';
  }

  /* Specs table */
  var specsTable = document.querySelector('[data-bind="specs"]');
  if (specsTable) {
    specsTable.innerHTML = '';
    var s = piece.specs || {};
    Object.keys(s).forEach(function (key) {
      var val = s[key] && s[key].es;
      if (!val) return;
      var label = MUEBLE_SPEC_LABELS[key] || titleCase(key);
      specsTable.appendChild(specRow(label, val));
    });
  }

  /* Colorway swatches */
  var swatchContainer = document.querySelector('[data-bind="colorways"]');
  if (swatchContainer) {
    swatchContainer.innerHTML = '';
    (piece.colorways || []).forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'pg-sistema_swatch-item';
      var block = document.createElement('div');
      block.className = 'gl-swatch pg-sistema_swatch-block';
      block.style.backgroundColor = c.hex;
      var label = document.createElement('span');
      label.className = 'gl-mono gl-mono_label';
      label.textContent = c.name && c.name.es || '';
      item.appendChild(block);
      item.appendChild(label);
      swatchContainer.appendChild(item);
    });
  }

  /* Gallery (in context) — hide the whole section when empty */
  var gallery = document.querySelector('[data-bind="gallery"]');
  var gallerySection = document.querySelector('[data-bind-section="gallery"]');
  var shots = (piece.media && piece.media.gallery) ? piece.media.gallery.slice() : [];
  if (gallery && shots.length) {
    gallery.innerHTML = '';
    var GALLERY_CLASSES = ['is-wide', 'is-tall', 'is-half', 'is-half', 'is-third', 'is-third', 'is-third'];
    shots.forEach(function (src, i) {
      var item = document.createElement('div');
      item.className = 'pg-mob_gallery_item ' + (GALLERY_CLASSES[i] || 'is-third');
      var img = document.createElement('img');
      img.className = 'pg-mob_gallery_img';
      img.loading = 'lazy';
      img.src = src;
      img.alt = nameEs + ' en contexto';
      item.appendChild(img);
      gallery.appendChild(item);
    });
  } else if (gallerySection) {
    gallerySection.style.display = 'none';
  }

  /* Related pieces (3 others, prefer same category first) */
  var relatedContainer = document.querySelector('[data-bind="relatedPieces"]');
  if (relatedContainer) {
    relatedContainer.innerHTML = '';
    var others = allPieces.filter(function (p) { return p.slug !== piece.slug; });
    others.sort(function (a, b) {
      var aSame = a.category === piece.category ? 0 : 1;
      var bSame = b.category === piece.category ? 0 : 1;
      return aSame - bSame;
    });
    others.slice(0, 3).forEach(function (p) { relatedContainer.appendChild(relatedCard(p)); });
  }

  /* CTA heading */
  setText('[data-bind="ctaHeading"]', 'Consultar « ' + nameEs + ' »');
}

/* ── Element builders ─────────────────────────────────────── */

function featureItem(text) {
  var div = document.createElement('div');
  div.className = 'pg-sistema_feature-item';
  var bullet = document.createElement('div');
  bullet.className = 'pg-sistema_feature-bullet';
  var span = document.createElement('span');
  span.className = 'gl-mono';
  span.textContent = text;
  div.appendChild(bullet);
  div.appendChild(span);
  return div;
}

function specRow(label, value) {
  var row = document.createElement('div');
  row.className = 'pg-sistema_specs_row';
  var l = document.createElement('span');
  l.className = 'gl-mono gl-mono_muted';
  l.textContent = label;
  var v = document.createElement('span');
  v.className = 'gl-mono';
  v.textContent = value;
  row.appendChild(l);
  row.appendChild(v);
  return row;
}

function relatedCard(piece) {
  var a = document.createElement('a');
  a.href = 'pg-mueble.html?slug=' + encodeURIComponent(piece.slug);
  a.className = 'pg-sistema_related_card';

  var img = document.createElement('img');
  img.className = 'pg-sistema_related_card-img';
  img.loading = 'lazy';
  img.src = piece.media && (piece.media.render || piece.media.detailRender) || '';
  img.alt = (piece.name && piece.name.es || piece.code);

  var info = document.createElement('div');
  info.className = 'pg-sistema_related_card-info';
  var tag = document.createElement('span');
  tag.className = 'gl-tag';
  tag.textContent = piece.categoryLabel && piece.categoryLabel.es || piece.category || '';
  var title = document.createElement('p');
  title.className = 'pg-sistema_related_card-title';
  title.textContent = piece.name && piece.name.es || piece.code;

  info.appendChild(tag);
  info.appendChild(title);
  a.appendChild(img);
  a.appendChild(info);
  return a;
}

function renderNotFound(slug) {
  document.title = 'Pieza no encontrada | Pernia Glass';
  var main = document.querySelector('main');
  if (main) {
    main.innerHTML =
      '<section class="gl-hero-cap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:4rem 2rem;text-align:center;">' +
      '<span class="gl-mono gl-mono_muted">404 — PIEZA NO ENCONTRADA</span>' +
      '<h1 class="pg-sistema_hero_title" style="margin:1rem 0;color:var(--swatch--dark-900);">« ' + esc(slug) + ' » no existe</h1>' +
      '<p class="gl-mono gl-mono_muted" style="max-width:40ch;margin-bottom:2rem;">Explora la colección completa de mobiliario.</p>' +
      '<a href="pg-mobiliario.html" class="gl-mono">&larr; Volver al mobiliario</a>' +
      '</section>';
  }
}

/* ── Helpers ──────────────────────────────────────────────── */

function getSlugFromUrl(fallback) {
  var params = new URLSearchParams(window.location.search);
  return params.get('slug') || params.get('code') || fallback || null;
}

function setText(selector, value) {
  var el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function titleCase(s) {
  if (!s) return '';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
