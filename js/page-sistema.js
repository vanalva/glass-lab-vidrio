/* ════════════════════════════════════════════════════════════════════
   page-sistema.js — populates pg-sistema.html from pernia-systems.json
   (schema v2: pglass-* codes, family/composition, real perfil renders).

   Reads ?code=pglass-1a..CAB from URL (defaults to pglass-1a), then fills
   every element tagged with data-bind / data-spec / data-bind-src.
   Generates the profile-finish tiles and the related-systems row.
   ════════════════════════════════════════════════════════════════════ */

/* Cross-brand link resolver — cross-brand.js owns the rule; this local copy
   keeps the page working whether or not that file has a <script> tag yet.
   pg-sistema.html ships in the `pernia` build, which DROPS gl-*.html, so the
   "Vidrios compatibles" cells below would 404 without it. With
   window.GL_CROSS_BRAND_BASE unset the return value is the plain relative path
   — exactly the previous behaviour, which is what the `full` build wants. */
function crossBrandHref(path) {
  if (window.glCrossBrandHref) return window.glCrossBrandHref(path);
  const base = window.GL_CROSS_BRAND_BASE || '';
  return base ? base.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '') : path;
}

window.GL_DATA.then(({ pernia, helpers }) => {
  const code = helpers.getCodeFromUrl('pglass-1a');
  const system = helpers.getSystem(code);

  if (!system) {
    renderNotFound(code);
    return;
  }

  renderSystem(system, pernia);
}).catch(err => {
  console.error('[page-sistema] failed to load pernia data:', err);
  console.error('Are you opening this page via file://? Use the local server instead.');
});

/* Human-readable composition, e.g. "2 hojas · 1 fija + 1 corrediza" */
function compositionLabel(system) {
  if (system.family === 'pivot') return 'Puerta pivotante';
  if (system.family === 'swing') return 'Puerta abatible';
  if (system.family === 'cabinet') return 'Puerta de gabinete';
  const comp = system.panelComposition || [];
  const fixed = comp.filter(x => x === 'fixed').length;
  const slid = comp.filter(x => x === 'sliding').length;
  const parts = [];
  if (fixed) parts.push(`${fixed} ${fixed === 1 ? 'fija' : 'fijas'}`);
  if (slid) parts.push(`${slid} ${slid === 1 ? 'corrediza' : 'corredizas'}`);
  const n = system.panels;
  return `${n} ${n === 1 ? 'hoja' : 'hojas'} · ${parts.join(' + ')}`;
}

/* Opening behaviour in plain Spanish, from mount / travel / pocket. */
function aperturaLabel(system) {
  if (system.family === 'pivot') return 'Pivotante — eje central';
  if (system.family === 'swing') return 'Abatible';
  if (system.family === 'cabinet') return 'Gabinete';
  if (system.mount === 'ceiling') return 'Corrediza colgada de cielo';
  if (system.mount === 'wall') return 'Corrediza de pared';
  if (system.travel === 'same-side') return 'Corrediza — ambas hacia el mismo lado (pocket)';
  if (system.travel === 'parting') return 'Corrediza — una a cada lado';
  if (system.travel === 'shared-rail') return 'Corrediza — ambos sentidos sobre un mismo riel';
  return 'Corrediza';
}

function renderSystem(system, pernia) {
  const universal = pernia.family.universal;
  const isComingSoon = system.availability === 'proximamente';
  const config = system.configuration?.es || '';

  document.title = `${system.code} — ${config} | Pernia Glass`;

  // Breadcrumb + tags + title
  const bc = document.querySelector('[data-bind="breadcrumb"]');
  if (bc) {
    bc.innerHTML = `<a href="pg-sistemas.html" class="pg-sistema_hero_breadcrumb-link">Sistemas</a> &gt; ${system.code}`;
  }
  setText('[data-bind="configTag"]', system.familyName?.es || '');
  setText('[data-bind="code"]',      system.code);
  setText('[data-bind="title"]',     config || system.code);

  // Hero image (closed state = first gallery frame)
  const heroImg = document.querySelector('[data-bind-src="hero"]');
  const heroSrc = system.media?.render || (system.media?.gallery || [])[0];
  if (heroImg && heroSrc) {
    heroImg.src = heroSrc;
    heroImg.alt = `${system.code} — ${config}`;
  } else if (heroImg) {
    // No render yet (coming-soon systems). Hide the empty <img> so it can't
    // render a broken-image icon, and mark the hero as a deliberate
    // placeholder so the empty state reads as intentional, not broken.
    heroImg.removeAttribute('src');
    heroImg.style.display = 'none';
    heroImg.alt = '';
    const heroSection = heroImg.closest('.pg-sistema_hero');
    // The label goes inside the media band, not over the whole section — the
    // hero is an editorial stack now, so the section also holds the title.
    const mediaWrap = heroImg.closest('.pg-sistema_hero_media-wrap') || heroSection;
    if (heroSection && !heroSection.querySelector('.pg-sistema_hero_placeholder')) {
      heroSection.classList.add('is-placeholder');
      const ph = document.createElement('span');
      ph.className = 'pg-sistema_hero_placeholder gl-mono gl-mono_muted';
      ph.setAttribute('aria-hidden', 'true');
      ph.textContent = 'Render próximamente';
      mediaWrap.appendChild(ph);
    }
  }

  // Hero facts — panel composition and glass, opposite the tagline.
  const heroFacts = document.querySelector('[data-bind="heroFacts"]');
  if (heroFacts) {
    heroFacts.innerHTML = '';
    [compositionLabel(system), 'Vidrio laminado 8mm'].forEach(text => {
      if (!text) return;
      const line = document.createElement('span');
      line.className = 'gl-mono gl-mono_muted';
      line.textContent = text;
      heroFacts.appendChild(line);
    });
  }

  // Overview heading + description (spec-only — no invented prose)
  setText('[data-bind="overviewHeading"]', config || '');
  setText('[data-bind="overviewDesc"]',
    `${compositionLabel(system)}. Perfil slim anodizado, vidrio laminado de 8mm y mecanismo soft close, como toda la familia Pernia.`);

  // Overview image: a real in-context install (family applications, varied per
  // system), else the system's own real render, else the section drawing. The
  // white studio open-door frame is no longer used — no isolated white shots.
  const overviewImg = document.querySelector('[data-bind-src="overview"]');
  const gallery = system.media?.gallery || [];
  // Only the per-system install set is trustworthy here. The old family-pool
  // fallback assigned generic sliding photos by index and put the wrong project
  // on the wrong system (client flagged this repeatedly). Use bySystem, else the
  // system's own render/gallery — never a generic pool.
  const overviewApps = (pernia.family.applications && pernia.family.applications.bySystem
    && pernia.family.applications.bySystem[system.code]) || [];
  let overviewSrc = overviewApps[0]
    || system.media?.render
    || (gallery.length ? gallery[gallery.length - 1] : system.media?.sectionDrawing);
  if (overviewImg && overviewSrc) {
    overviewImg.src = overviewSrc;
    overviewImg.alt = `${system.code} — ${config} en aplicación`;
    // The install set is mixed portrait/landscape. Let the file decide its own
    // box (square vs 5/4) instead of cropping every photo to one ratio.
    const setOrientation = () => {
      if (!overviewImg.naturalWidth) return;
      overviewImg.classList.toggle('is-landscape', overviewImg.naturalWidth > overviewImg.naturalHeight);
    };
    if (overviewImg.complete) setOrientation();
    overviewImg.addEventListener('load', setOrientation);
  } else if (overviewImg) {
    overviewImg.closest('[class*="overview"], section')?.style.setProperty('display', 'none');
  }

  // Features
  const features = document.querySelector('[data-bind="features"]');
  if (features) {
    features.innerHTML = '';
    const bullets = [
      compositionLabel(system),
      aperturaLabel(system),
      `${universal.vidrio?.es || '8mm laminado'} · ${universal.mecanismo?.es || 'Soft close'}`,
      `${(pernia.family.perfilColores || []).length} acabados de perfil`
    ];
    bullets.forEach(b => features.appendChild(featureItem(b)));
  }

  // Specs table
  setSpec('configuracion',  config || '—');
  const dims = (system.dimensions || []).map(d => `${d.width}×${d.height} mm`).join(' / ');
  setSpec('dimensiones',    dims || 'Por confirmar');
  setSpec('espesorVidrio',  universal.vidrio?.es || '8mm laminado');
  setSpec('perfil',         universal.perfil?.es || 'Aluminio slim anodizado');
  setSpec('mecanismo',      universal.mecanismo?.es || 'Soft close');
  setSpec('headerCarga',    headerLabel(system));
  setSpec('cieloRaso',      `${universal.soffit?.es || 'GYPSUM'}${system.headerTrim ? ' · ' + system.headerTrim : ''}`);
  setSpec('pocket',         system.pocket ? 'Sí — las hojas se ocultan en el muro' : (system.family === 'sliding' ? 'No' : '—'));
  setSpec('apertura',       aperturaLabel(system));

  // Applications gallery — real Pernia installs matched to this system's
  // door family (no exact-config claims). Families with no photos (pivot,
  // swing) hide the whole section.
  const appsGrid = document.querySelector('[data-bind="applications"]');
  const appsSection = document.querySelector('[data-bind-section="applications"]');
  // Prefer the precise per-system set (derived from the client's project→system
  // map + panel-count verification); fall back to the family pool for systems
  // with no confirmed project photos.
  const appCfg = pernia.family.applications || {};
  // bySystem only — no family-pool fallback. A system with no confirmed project
  // photos shows no "en obra" gallery rather than borrowing another project's.
  const apps = (appCfg.bySystem && appCfg.bySystem[system.code]) || [];
  const appsArePerSystem = !!(appCfg.bySystem && appCfg.bySystem[system.code]);
  if (appsGrid && apps.length) {
    // Claim only what the evidence supports: name the system when the photos
    // are confirmed to be that system, otherwise stay at family level.
    const appsSub = document.querySelector('.pg-sistema_apps_sub');
    if (appsSub) {
      appsSub.textContent = appsArePerSystem
        ? `El sistema ${system.code}, instalado y fotografiado en obra.`
        : 'Instalaciones Pernia del mismo tipo de sistema, fotografiadas en obra.';
    }
    appsGrid.innerHTML = '';
    apps.forEach(src => {
      const fig = document.createElement('figure');
      fig.className = 'pg-sistema_apps_item';
      const img = document.createElement('img');
      img.className = 'pg-sistema_apps_img';
      img.loading = 'lazy';
      img.src = src;
      img.alt = appsArePerSystem
        ? `${system.code} — ${config} instalado en obra`
        : `Sistema Pernia ${system.familyName?.es || ''} instalado en obra`.replace(/\s+/g, ' ').trim();
      fig.appendChild(img);
      appsGrid.appendChild(fig);
    });
  } else if (appsSection) {
    appsSection.style.display = 'none';
  }

  // Profile finishes — real renders (not colour blocks)
  const swatchContainer = document.querySelector('[data-bind="profileColors"]');
  if (swatchContainer) {
    swatchContainer.innerHTML = '';
    (pernia.family.perfilColores || []).forEach(c => {
      const item = document.createElement('div');
      item.className = 'pg-sistema_swatch-item';
      const img = document.createElement('img');
      img.className = 'pg-sistema_swatch-img';
      img.loading = 'lazy';
      if (c.render) img.src = c.render;
      img.alt = `Perfil ${c.name.es}`;
      const label = document.createElement('span');
      label.className = 'gl-mono gl-mono_label';
      label.textContent = c.ral ? `${c.name.es} · ${c.ral}` : c.name.es;
      item.appendChild(img);
      item.appendChild(label);
      swatchContainer.appendChild(item);
    });
  }

  // Video (systems have none in v2; hide the slot if empty)
  const video = document.querySelector('[data-bind-src="video"]');
  if (video && system.media?.video) {
    const source = video.querySelector('source');
    if (source) { source.src = system.media.video; video.load(); }
  } else if (video) {
    video.closest('section')?.style.setProperty('display', 'none');
  }

  // Glass Lab compatible products row (curated across all 3 categories)
  const glContainer = document.querySelector('[data-bind="glasslabCells"]');
  if (glContainer) {
    glContainer.innerHTML = '';
    const FEATURED_CODES = ['Vc', 'Va', 'In', 'Aq', 'Ec', 'Ed'];
    FEATURED_CODES.forEach(code => {
      const a = document.createElement('a');
      a.href = crossBrandHref(`gl-vidrio.html?code=${code}`);
      a.className = 'gl-link-reset gl-cell gl-cell_filled pg-sistema_glasslab_cell';
      a.style.textDecoration = 'none';
      a.innerHTML = `
        <div class="gl-home_catalog_cell-meta"></div>
        <span class="gl-cell_symbol">${code}</span>
        <div class="gl-home_catalog_cell-meta">
          <span class="gl-cell_name">${code}</span>
        </div>`;
      glContainer.appendChild(a);
    });
    window.GL_DATA.then(({ helpers }) => {
      FEATURED_CODES.forEach((code, i) => {
        const p = helpers.getProduct(code);
        if (!p) return;
        const cell = glContainer.children[i];
        if (!cell) return;
        const sym = cell.querySelector('.gl-cell_symbol');
        const name = cell.querySelector('.gl-cell_name');
        const meta = cell.querySelectorAll('.gl-home_catalog_cell-meta')[0];
        if (sym) sym.textContent = p.code;
        if (name) name.textContent = p.shortName?.es || p.name?.es || p.code;
        if (meta) meta.innerHTML = `<span class="gl-cell_code">${String(p.slot).padStart(3, '0')}</span>`;
        cell.classList.add(`gl-cell_cat-${p.category}`);
      });
    });
  }

  // Related systems (3 nearest by panel count, same family first)
  const relatedContainer = document.querySelector('[data-bind="relatedSystems"]');
  if (relatedContainer) {
    relatedContainer.innerHTML = '';
    const related = pernia.systems
      .filter(s => s.code !== system.code && s.availability !== 'proximamente' && (s.media?.render))
      .sort((a, b) => {
        const famA = (a.family === system.family) ? 0 : 1;
        const famB = (b.family === system.family) ? 0 : 1;
        if (famA !== famB) return famA - famB;
        return Math.abs((a.panels || 0) - (system.panels || 0)) - Math.abs((b.panels || 0) - (system.panels || 0));
      })
      .slice(0, 3);
    related.forEach(s => relatedContainer.appendChild(relatedCard(s)));
  }

  setText('[data-bind="ctaHeading"]', `Solicitar cotización para ${system.code}`);

  if (isComingSoon) {
    const main = document.querySelector('main');
    if (main) {
      const notice = document.createElement('div');
      notice.style.cssText = 'padding:1rem 2rem;margin:0;border-bottom:1px dashed var(--swatch--brand-500);text-align:center;background-color:color-mix(in srgb, var(--swatch--brand-500) 8%, transparent);';
      notice.innerHTML = `<span class="gl-mono gl-mono_muted">⚠ PRÓXIMAMENTE — ${system.code} está en desarrollo. Los renders y la ficha se publicarán próximamente.</span>`;
      main.prepend(notice);
    }
  }
}

function headerLabel(system) {
  if (!system.headerSteel) return '—';
  const depth = system.headerDepth?.value;
  return depth ? `${system.headerSteel} · ${depth}mm` : system.headerSteel;
}

function featureItem(text) {
  const div = document.createElement('div');
  div.className = 'pg-sistema_feature-item';
  const bullet = document.createElement('div');
  bullet.className = 'pg-sistema_feature-bullet';
  const span = document.createElement('span');
  span.className = 'gl-mono';
  span.textContent = text;
  div.appendChild(bullet);
  div.appendChild(span);
  return div;
}

function relatedCard(system) {
  const a = document.createElement('a');
  a.href = `pg-sistema.html?code=${system.code}`;
  a.className = 'pg-sistema_related_card';

  const img = document.createElement('img');
  img.className = 'pg-sistema_related_card-img';
  img.loading = 'lazy';
  img.src = system.media?.render || (system.media?.gallery || [])[0] || '';
  img.alt = `${system.code} — ${system.configuration?.es || ''}`;

  const info = document.createElement('div');
  info.className = 'pg-sistema_related_card-info';
  const tag = document.createElement('span');
  tag.className = 'gl-tag';
  tag.textContent = system.code;
  const title = document.createElement('p');
  title.className = 'pg-sistema_related_card-title';
  title.textContent = system.configuration?.es || '';

  info.appendChild(tag);
  info.appendChild(title);
  a.appendChild(img);
  a.appendChild(info);
  return a;
}

function renderNotFound(code) {
  document.title = 'Sistema no encontrado | Pernia Glass';
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <section class="gl-hero-cap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:4rem 2rem;text-align:center;">
        <span class="gl-mono gl-mono_muted">404 — SISTEMA NO ENCONTRADO</span>
        <h1 class="pg-sistema_hero_title" style="margin:1rem 0;">El código «${code}» no existe</h1>
        <p class="gl-mono gl-mono_muted" style="max-width:44ch;margin-bottom:2rem;">La línea Pernia abarca de pglass-1a a pglass-4c, más pivotante, abatible y gabinete.</p>
        <a href="pg-sistemas.html" class="gl-mono">&larr; Volver al catálogo de sistemas</a>
      </section>`;
  }
}

/* ── Helpers ─────────────────────────────────────────────── */

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function setSpec(key, value) {
  const row = document.querySelector(`[data-spec="${key}"]`);
  if (row) {
    const valEl = row.querySelector('.gl-mono:not(.gl-mono_muted)');
    if (valEl) valEl.textContent = value;
  }
}
