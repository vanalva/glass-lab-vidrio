/* ════════════════════════════════════════════════════════════════════
   page-vidrio.js — populates gl-vidrio.html from glass-types.json

   Reads ?code= from URL (defaults to Vc), then fills every element
   tagged with data-bind="..." or data-bind-src="..." or data-bind-attr.
   Generates the related-products row from product.relations.
   ════════════════════════════════════════════════════════════════════ */

// IIFE-wrapped so gl-page-transition.js can safely re-execute this script after
// an SPA DOM swap. Without the wrapper the top-level `const RELATION_LABELS`
// lands in the shared global scope and the 2nd run throws
// "Identifier 'RELATION_LABELS' has already been declared", which halts the
// script and leaves the visor stuck on "Cargando…".
(function () {

/* ── TEMPORARY: single-image mode ─────────────────────────────────────
   Extra sample imagery is switched off for now. Each glass type shows
   only its main image (media.hero, which is also heroSlides[0] for all
   53 products): the hero carousel collapses to that one slide and the
   "Galería" section at the bottom is hidden.

   This is a switch, not a removal — the markup, the slider code and the
   gallery derivation are all still here and still correct. Set this back
   to `true` to restore both, and nothing else needs changing. */
const SHOW_EXTRA_MEDIA = false;

const RELATION_LABELS = {
  'es-version-espejo-de':     'Versión vidrio',
  'tiene-version-espejo':     'Versión espejo',
  'es-tier-alternativo-de':   'Versión premium',
  'tiene-tier-alternativo':   'Alternativa más económica',
  'variante-de-color':        'Otra variante de color',
  'es-version-acidada-de':    'Versión normal',
  'es-version-con-film-de':   'Versión sin film',
  'comparte-familia-con':     'Misma familia'
};

/* Cross-brand link resolver — cross-brand.js owns the rule; this local copy
   keeps the page working whether or not that file has a <script> tag yet.
   gl-vidrio.html ships in the `vidrio` build, which DROPS pg-*.html, so the
   "Sistemas Pernia compatibles" cards below would 404 without it. With
   window.GL_CROSS_BRAND_BASE unset the return value is the plain relative path
   — exactly the previous behaviour, which is what the `full` build wants. */
function crossBrandHref(path) {
  if (window.glCrossBrandHref) return window.glCrossBrandHref(path);
  const base = window.GL_CROSS_BRAND_BASE || '';
  return base ? base.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '') : path;
}

window.GL_DATA.then(({ glass, helpers }) => {
  const code = helpers.getCodeFromUrl('Vc');
  const product = helpers.getProduct(code);

  if (!product) {
    renderNotFound(code);
    return;
  }

  renderProduct(product, glass, helpers);
}).catch(err => {
  console.error('[page-vidrio] failed to load glass data:', err);
  console.error('Are you opening this page via file://? Use the local server (http://localhost:8765) instead.');

  const isFileProtocol = window.location.protocol === 'file:';
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <section class="gl-hero-cap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:4rem 2rem;text-align:center;gap:1rem;">
        <span class="gl-mono gl-mono_muted">DATA LOADER — ERROR</span>
        <h1 class="gl-vidrio_hero_name" style="margin:0;">No se pudieron cargar los datos del catálogo</h1>
        <p class="u-text-style-main" style="max-width:50ch;color:color-mix(in srgb, var(--_theme---text) 70%, transparent);">
          ${isFileProtocol
            ? 'La página se está abriendo con el protocolo <code>file://</code> — los navegadores bloquean los <code>fetch()</code> locales por seguridad. Sirve la carpeta <code>src/</code> con un servidor local (<code>python -m http.server 8765</code> o <code>npx serve src</code>) y abre <code>http://localhost:8765/pages/gl-vidrio.html?code=Vc</code>.'
            : 'Hubo un error al cargar <code>data/glass-types.json</code>. Revisa la consola del navegador para el detalle.'}
        </p>
        <p class="gl-mono gl-mono_muted" style="font-size:0.8rem;">Error: ${(err && err.message) || err}</p>
        <a href="gl-catalogo.html" class="gl-mono">&larr; Volver al catálogo</a>
      </section>`;
  }
});

/* ── Renderers ───────────────────────────────────────────── */

function renderProduct(product, glass, helpers) {
  const cat    = helpers.getCategory(product.category);
  const subcat = helpers.getSubcategory(product.category, product.subcategory);
  const a      = product.attributes || {};

  // Page chrome
  document.title = `${product.code} — ${product.name?.es || product.code} | Glass Lab`;

  // Slot / category / subcategory line
  setText('[data-bind="slotCategory"]',
    `${String(product.slot).padStart(3, '0')}   ${cat?.name?.es || ''}${subcat ? '   ' + subcat.name.es : ''}`);

  // Symbol + name
  setText('[data-bind="symbol"]',   product.code);
  setText('[data-bind="name"]',     product.name?.es || product.code);
  setText('[data-bind="shortName"]',product.shortName?.es || product.name?.es || product.code);

  // Hero slider — supports product.media.heroSlides[] (multiple) or falls back to [product.media.hero]
  buildHeroSlider(product);

  // Tags row (acabado + aplicaciones top values)
  const tagsContainer = document.querySelector('[data-bind="tags"]');
  if (tagsContainer) {
    tagsContainer.innerHTML = '';
    const tags = [];
    if (cat) tags.push(cat.name.es);
    if (subcat) tags.push(subcat.name.es);
    if (a.tier) tags.push(a.tier === 'premium' ? 'Tier premium' : 'Tier alternativa');
    if (a.personalizacionColor === '300-colores') tags.push('300 colores');
    if (a.disponibilidad === 'custom') tags.push('Custom');
    if (a.disponibilidad === 'proximamente') tags.push('Próximamente');
    if (a.disponibilidad === 'made-to-order') tags.push('Made to order');
    tags.forEach(t => {
      const span = document.createElement('span');
      span.className = 'gl-tag';
      span.textContent = t;
      tagsContainer.appendChild(span);
    });
  }

  // Hero spec rows (5)
  setSpec('categoria',    cat?.name?.es + (subcat ? ' · ' + subcat.name.es : '') || '—');
  setSpec('subcategoria', subcat?.name?.es || cap(a.acabado?.[0]) || '—');
  setSpec('espesor',      formatEspesor(a) || '—');
  setSpec('dimensiones',  formatDimension(a) || '—');
  setSpec('transparencia', cap(a.transparencia) || '—');

  // Properties grid (6 cards)
  setPropCard('color',          a.colorBase ? cap(a.colorBase) : 'Variable',
              describeColor(a.colorBase));
  setPropCard('textura',        (a.acabado || []).map(cap).join(' · ') || 'Lisa',
              describeAcabado(a.acabado));
  setPropCard('espesor',        formatEspesor(a) || 'Consultar',
              describeEspesor(a));
  setPropCard('transparencia',  cap(a.transparencia) || 'Translúcido',
              describeTransparencia(a.transparencia));
  setPropCard('dimensiones',    formatDimension(a) || 'Consultar',
              describeDimension(a));
  setPropCard('aplicaciones',   'Divisorias · Mobiliario · Decorativo',
              'Compatible con todos los sistemas de puerta Pernia.');

  // Gallery — use explicit media.gallery, else derive 4 views from heroSlides
  // (every shipped catalog type has 11 editorial slides — pick detail/app/env/surface)
  const galleryContainer = document.querySelector('[data-bind="gallery"]');
  if (galleryContainer && !SHOW_EXTRA_MEDIA) {
    // Single-image mode: drop the whole "03 // Galería" section, then pull the
    // sections after it back up one number so the editorial run stays 02, 03, 04.
    const gallerySection = galleryContainer.closest('.gl-vidrio_gallery');
    if (gallerySection) {
      gallerySection.hidden = true;
      let el = gallerySection;
      while ((el = el.nextElementSibling)) {
        el.querySelectorAll('.gl-section-number').forEach(label => {
          label.textContent = label.textContent.replace(
            /^\s*(\d{2})(\s*\/\/)/,
            (_, n, sep) => String(Number(n) - 1).padStart(2, '0') + sep
          );
        });
      }
    }
  } else if (galleryContainer) {
    let gallerySrcs = Array.isArray(product.media?.gallery) && product.media.gallery.length > 0
      ? product.media.gallery.slice(0, 4)
      : null;
    if (!gallerySrcs && Array.isArray(product.media?.heroSlides) && product.media.heroSlides.length >= 4) {
      const s = product.media.heroSlides;
      const pick = [2, 7, 4, 3].map(i => s[i]).filter(Boolean); // detail-edge, app, env, surface
      gallerySrcs = (pick.length >= 4 ? pick : s).slice(0, 4);
    }
    if (gallerySrcs && gallerySrcs.length > 0) {
      galleryContainer.innerHTML = '';
      gallerySrcs.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.className = 'gl-vidrio_gallery_img';
        img.loading = 'lazy';
        img.alt = product.name?.es || product.code;
        galleryContainer.appendChild(img);
      });
    } else {
      const placeholders = galleryContainer.querySelectorAll('.gl-img-placeholder .gl-mono');
      const productName = (product.name?.es || product.code).toUpperCase();
      const customLabels = [
        `DETALLE MACRO — ${productName}`,
        `INSTALACIÓN EN CONTEXTO — ${productName}`,
        `MUESTRA ANGULAR — LUZ LATERAL`,
        `APLICACIÓN ARQUITECTÓNICA`
      ];
      placeholders.forEach((el, i) => { if (customLabels[i]) el.textContent = customLabels[i]; });
    }
  }

  // Related products row
  const related = helpers.getRelated(product.code);
  const relatedContainer = document.querySelector('[data-bind="related"]');
  if (relatedContainer) {
    relatedContainer.innerHTML = '';
    if (related.length === 0) {
      const note = document.createElement('p');
      note.className = 'gl-mono gl-mono_muted';
      note.textContent = 'Este vidrio no tiene relaciones directas con otros del catálogo.';
      relatedContainer.appendChild(note);
    } else {
      related.slice(0, 5).forEach(({ kind, product: rel }) => {
        relatedContainer.appendChild(renderRelatedCell(rel, kind));
      });
    }
  }

  // Pernia Glass compatible systems row (3 most representative)
  const perniaContainer = document.querySelector('[data-bind="perniaSystemsRow"]');
  if (perniaContainer) {
    const systems = helpers.getCompatiblePerniaSystems(product.code).slice(0, 3);
    perniaContainer.innerHTML = '';
    systems.forEach(s => perniaContainer.appendChild(renderPerniaCard(s)));
  }

  // CTA copy
  setText('[data-bind="ctaHeading"]', `¿Quieres ver ${product.name?.es || product.code} en persona?`);

  // Placeholder note (for próximamente products)
  if (product.placeholder) {
    const notice = document.createElement('div');
    notice.style.cssText = 'padding:1rem;margin:1rem 0;border:1px dashed var(--swatch--brand-500);';
    notice.innerHTML = `<span class="gl-mono gl-mono_muted">⚠ ${product.placeholder}. Información sujeta a cambio.</span>`;
    const hero = document.querySelector('.gl-vidrio_hero_info');
    if (hero) hero.prepend(notice);
  }
}

function renderRelatedCell(prod, kind) {
  const a = document.createElement('a');
  a.href = `gl-vidrio.html?code=${prod.code}`;
  a.className = `gl-link-reset gl-cell gl-cell_filled gl-cell_cat-${prod.category}`;

  const topMeta = document.createElement('div');
  topMeta.className = 'gl-home_catalog_cell-meta';
  const slot = document.createElement('span');
  slot.className = 'gl-cell_code';
  slot.textContent = String(prod.slot).padStart(3, '0');
  topMeta.appendChild(slot);

  const sym = document.createElement('span');
  sym.className = 'gl-cell_symbol';
  sym.textContent = prod.code;

  const bottomMeta = document.createElement('div');
  bottomMeta.className = 'gl-home_catalog_cell-meta';
  const name = document.createElement('span');
  name.className = 'gl-cell_name';
  name.textContent = prod.shortName?.es || prod.name?.es || prod.code;
  const rel = document.createElement('span');
  rel.className = 'gl-cell_code';
  rel.style.opacity = '0.6';
  rel.textContent = RELATION_LABELS[kind] || kind;
  bottomMeta.appendChild(name);
  bottomMeta.appendChild(rel);

  a.appendChild(topMeta);
  a.appendChild(sym);
  a.appendChild(bottomMeta);
  return a;
}

function renderPerniaCard(system) {
  const a = document.createElement('a');
  a.href = crossBrandHref(`pg-sistema.html?code=${system.code}`);
  a.className = 'pg-sistemas_card gl-vidrio_pernia_card gl-link-reset';

  const img = document.createElement('img');
  img.className = 'pg-sistemas_card-img';
  img.loading = 'lazy';
  img.src = system.media?.render || system.media?.application || system.media?.detailRender || '';
  img.alt = `${system.code} — ${system.name?.es || system.code}`;

  const body = document.createElement('div');
  body.className = 'pg-sistemas_card-body';

  const tag = document.createElement('span');
  tag.className = 'gl-tag';
  tag.textContent = system.code;

  const title = document.createElement('h3');
  title.className = 'pg-sistemas_card-title';
  title.textContent = system.configuration?.es || system.name?.es?.replace(/^pglass-\S+\s*[—-]\s*/, '') || '';

  const desc = document.createElement('p');
  desc.className = 'gl-mono gl-mono_muted';
  desc.textContent = system.tagline?.es || system.configuration?.es || '';

  const specs = document.createElement('div');
  specs.className = 'pg-sistemas_card-specs';
  const dims = (system.dimensions || []).map(d => `${d.width}×${d.height}`).join(' / ');
  [
    system.configuration?.es || '',
    dims ? dims + ' mm' : '',
    '8mm laminado'
  ].filter(Boolean).forEach(txt => {
    const span = document.createElement('span');
    span.className = 'gl-mono gl-mono_label';
    span.textContent = txt;
    specs.appendChild(span);
  });

  body.appendChild(tag);
  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(specs);
  a.appendChild(img);
  a.appendChild(body);
  return a;
}

function renderNotFound(code) {
  document.title = 'Vidrio no encontrado | Glass Lab';
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <section class="gl-hero-cap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:4rem 2rem;text-align:center;">
        <span class="gl-mono gl-mono_muted">404 — VIDRIO NO ENCONTRADO</span>
        <h1 class="gl-vidrio_hero_name" style="margin:1rem 0;">El código «${code}» no existe en el catálogo</h1>
        <p class="gl-mono gl-mono_muted" style="max-width:40ch;margin-bottom:2rem;">Tal vez el vidrio fue renombrado, o todavía no existe en la tabla periódica. Verifica el catálogo completo.</p>
        <a href="gl-catalogo.html" class="gl-mono">&larr; Volver al catálogo</a>
      </section>`;
  }
}

/* ── Hero slider ─────────────────────────────────────────── */

function buildHeroSlider(product) {
  const track   = document.querySelector('[data-bind="heroSlider"]');
  const controls = document.querySelector('[data-hero-controls]');
  const dotsWrap = document.querySelector('[data-bind="heroDots"]');
  const counter = document.querySelector('[data-bind="heroCounter"]');
  const prev    = document.querySelector('[data-hero-arrow="prev"]');
  const next    = document.querySelector('[data-hero-arrow="next"]');
  if (!track) return;

  // Source: explicit heroSlides[] takes priority; else fall back to [hero] (legacy single-image data)
  const allSlides = (Array.isArray(product.media?.heroSlides) && product.media.heroSlides.length > 0)
    ? product.media.heroSlides
    : [product.media?.hero].filter(Boolean);

  // Single-image mode keeps only the main view. Everything below already
  // handles a 1-slide product (it hides the controls row and returns early),
  // so no other branch needs to know about the switch.
  const slides = SHOW_EXTRA_MEDIA ? allSlides : allSlides.slice(0, 1);

  const productName = product.name?.es || product.code;

  // Build slides
  track.innerHTML = slides.map((src, i) => `
    <figure class="gl-vidrio_hero_slide" role="group" aria-roledescription="slide" aria-label="${i + 1} de ${slides.length}">
      <img src="${src}" alt="${productName} — vista ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" class="gl-vidrio_hero_img">
    </figure>
  `).join('');

  // Hide the whole controls row when only 1 slide
  const hasMultiple = slides.length > 1;
  if (controls) controls.hidden = !hasMultiple;
  if (!hasMultiple) return;

  // Build dots
  if (dotsWrap) {
    dotsWrap.innerHTML = slides.map((_, i) => `
      <button class="gl-vidrio_hero_dot${i === 0 ? ' is-active' : ''}" type="button" role="tab" aria-label="Vista ${i + 1}" aria-selected="${i === 0}" data-hero-dot="${i}"></button>
    `).join('');
  }

  // Counter
  const updateCounter = (i) => {
    if (!counter) return;
    counter.textContent = `${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  };
  updateCounter(0);

  // Interactivity
  const getSlideWidth = () => track.querySelector('.gl-vidrio_hero_slide')?.getBoundingClientRect().width || track.clientWidth;
  const goTo = (index) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, index));
    track.scrollTo({ left: clamped * getSlideWidth(), behavior: 'smooth' });
  };
  const currentIndex = () => Math.round(track.scrollLeft / getSlideWidth());

  prev?.addEventListener('click', () => goTo(currentIndex() - 1));
  next?.addEventListener('click', () => goTo(currentIndex() + 1));

  // Sync dots + arrow disabled state + counter with scroll position
  let scrollTimer;
  track.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const i = currentIndex();
      dotsWrap?.querySelectorAll('[data-hero-dot]').forEach((dot, idx) => {
        const active = idx === i;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', String(active));
      });
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === slides.length - 1;
      updateCounter(i);
    }, 80);
  });

  // Dot clicks
  dotsWrap?.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-hero-dot]');
    if (!dot) return;
    goTo(Number(dot.dataset.heroDot));
  });

  // Keyboard arrows when the slider has focus
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(currentIndex() - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex() + 1); }
  });

  // Initial state
  if (prev) prev.disabled = true;
}

/* ── Helpers ─────────────────────────────────────────────── */

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

/* ── Espesor / dimensiones ───────────────────────────────────
   These are per-glass and come from Guillermo's "PRESENTACION TIPOS DE
   VIDRIO_V2" deck, stored on each product as attributes.espesorMm[] and
   attributes.dimensionMaxMm[w,h].

   They used to be four hardcoded strings here — every one of the 53 glass
   pages claimed "8 mm" and "2100 × 3300 mm" (the hero row even said
   "3300 × 2100", contradicting the card below it). Only 33 of 52 glasses
   actually offer 8 mm and only 3 are 2100 × 3300, so most pages were
   publishing specs the glass does not have.

   Al has no spec slide in the deck. Rather than inventing a value these
   return null and the field shows "Consultar" / "—". */
function formatEspesor(a) {
  const e = a && a.espesorMm;
  if (!Array.isArray(e) || !e.length) return null;
  return e.length === 1 ? `${e[0]} mm` : `${e.join(' · ')} mm`;
}

function describeEspesor(a) {
  const e = a && a.espesorMm;
  if (!Array.isArray(e) || !e.length) return 'Espesor bajo consulta según formato y acabado.';
  if (e.length === 1) return 'Espesor único disponible para este vidrio.';
  return `Disponible en ${e.length} espesores, de ${Math.min(...e)} a ${Math.max(...e)} mm.`;
}

function formatDimension(a) {
  const d = a && a.dimensionMaxMm;
  if (!Array.isArray(d) || d.length !== 2) return null;
  return `${d[0]} × ${d[1]} mm`;
}

function describeDimension(a) {
  const d = a && a.dimensionMaxMm;
  if (!Array.isArray(d) || d.length !== 2) return 'Dimensión máxima bajo consulta.';
  return 'Dimensión máxima de lámina para este vidrio.';
}

function setSpec(key, value) {
  const row = document.querySelector(`[data-spec="${key}"]`);
  if (row) {
    const valEl = row.querySelector('.gl-mono:not(.gl-mono_muted)');
    if (valEl) valEl.textContent = value;
  }
}

function setPropCard(key, value, sub) {
  const card = document.querySelector(`[data-prop="${key}"]`);
  if (!card) return;
  const valEl = card.querySelector('.gl-vidrio_prop-card_value');
  const subEl = card.querySelector('.gl-mono_muted');
  if (valEl) valEl.textContent = value;
  if (subEl) subEl.textContent = sub;
}

function cap(s) {
  if (!s) return '';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/-/g, ' ');
}

function describeColor(base) {
  const map = {
    claro: 'Sin tinte — máxima transparencia para diseños neutros.',
    ultraclaro: 'Bajo en hierro — sin tono verdoso típico del cristal flotado.',
    pacifica: 'Azul-turquesa profundo, ideal para acentos arquitectónicos.',
    indigo: 'Azul-gris frío, sofisticado, lectura editorial.',
    bronce: 'Calidez cobriza — control solar y estética cálida.',
    gris: 'Neutro frío que tonifica espacios sin saturar.',
    negro: 'Opacidad total con presencia de material.',
    blanco: 'Opaco luminoso, ideal para superficies retroiluminadas.',
    iridiscente: 'Color variable según el ángulo de observación.'
  };
  return map[base] || 'Color personalizable según especificación.';
}

function describeAcabado(acabados) {
  if (!acabados || acabados.length === 0) return 'Acabado estándar de vidrio.';
  if (acabados.includes('acanalado')) return 'Patrón vertical de canales tallados en la superficie.';
  if (acabados.includes('esmerilado')) return 'Superficie satinada por chorro de arena, semi-translúcida.';
  if (acabados.includes('texturizado')) return 'Patrón decorativo embebido en la superficie del vidrio.';
  if (acabados.includes('impreso')) return 'Patrón impreso por serigrafía aplicada al vidrio.';
  if (acabados.includes('metalizado')) return 'Malla metálica laminada entre dos capas de vidrio.';
  if (acabados.includes('interlayer')) return 'Capa de color o film insertada entre las láminas.';
  if (acabados.includes('dicroico')) return 'Película dicroica que refracta la luz en colores cambiantes.';
  if (acabados.includes('gradient')) return 'Transición tonal a lo largo de la lámina.';
  if (acabados.includes('espejado')) return 'Superficie espejo de alta reflectividad.';
  return acabados.map(cap).join(', ');
}

/* Wording follows Guillermo's definitions: transparente pasa luz y vista,
   translucido pasa luz pero no vista. Semitransparente is the middle ground —
   the mallas and interlayers, which used to be labelled translucido and so
   claimed to block a view they do not block. */
function describeTransparencia(t) {
  const map = {
    transparente: 'Pasa luz y vista — visión clara a través del vidrio.',
    translucido: 'Pasa luz pero no vista — ilumina sin dejar ver.',
    semitransparente: 'Pasa luz y deja ver parcialmente, filtrando la vista.',
    opaco: 'No deja pasar luz — bloqueo total visual.',
    espejo: 'Refleja en lugar de transmitir luz.'
  };
  return map[t] || 'Variable.';
}

})(); // end IIFE — safe to re-run on SPA swaps
