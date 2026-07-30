/* ════════════════════════════════════════════════════════════════════
   page-proyecto.js — populates pg-proyecto.html from pernia-proyectos.json

   Reads ?slug= from the URL (defaults to the first project), then fills
   the hero, gallery, "sistemas utilizados" and prev/next blocks.

   Before this existed, pg-proyecto.html was a single hardcoded Lantana
   page and all nine grid cards linked to it bare — which is why every
   project opened Lantana and "proyecto siguiente" appeared to do nothing
   (it pointed at the page you were already on).

   Sections are driven by what the data actually contains:
     · description  — hidden while `description` is empty. No client
                      narrative has been supplied, and the previous copy
                      on this page was placeholder scaffolding (it named a
                      450m2 house in Costa del Este and a 22mm profile),
                      so it is not carried over. Paste real paragraphs
                      into `description` in the JSON to switch it back on.
     · sistemas     — hidden unless the project has confirmed systems.
                      Only Seacat / Seacho / Torre600 do, from Guillermo's
                      project->system map.
     · location/year— omitted for those same three; the grid markup says
                      he has not supplied them and they must not be guessed.
   ════════════════════════════════════════════════════════════════════ */

// IIFE-wrapped for the same reason as page-vidrio.js: gl-page-transition.js
// re-executes page scripts after an SPA DOM swap, and a top-level `const`
// would throw "already been declared" on the second run and halt the page.
(function () {

const DATA_URL    = 'data/pernia-proyectos.json';
const SYSTEMS_URL = 'data/pernia-systems.json';

// cache:'no-cache' forces ETag revalidation — same reasoning as data-loader.js:
// GitHub Pages serves JSON with max-age=600, so a plain fetch can render up to
// 10 minutes of stale image paths after a deploy.
const NO_CACHE = { cache: 'no-cache' };

const required = (url) => fetch(url, NO_CACHE).then(r => {
  if (!r.ok) throw new Error(`${url} — HTTP ${r.status} ${r.statusText}`);
  return r.json();
});

Promise.all([
  required(DATA_URL),
  // systems only supply display names for the "sistemas utilizados" cards —
  // the page still renders correctly without them
  fetch(SYSTEMS_URL, NO_CACHE).then(r => r.ok ? r.json() : null).catch(() => null)
]).then(([doc, systemsDoc]) => {
  const projects = (doc && doc.projects) || [];
  if (!projects.length) throw new Error(`${DATA_URL} — no projects in file`);

  const slug = new URLSearchParams(window.location.search).get('slug');
  const index = slug
    ? projects.findIndex(p => p.slug === slug.toLowerCase())
    : 0;

  if (index < 0) {
    renderNotFound(slug, projects);
    return;
  }

  render(projects[index], index, projects, systemsDoc);
}).catch(err => {
  console.error('[page-proyecto] failed to load project data:', err);
  renderError(err);
});

/* ── Renderers ───────────────────────────────────────────── */

function render(project, index, projects, systemsDoc) {
  const title = project.title;

  // Page chrome
  document.title = `${title} | Pernia Glass`;
  setMeta('property', 'og:title', `${title} | Pernia Glass`);
  setMeta('name', 'twitter:title', `${title} | Pernia Glass`);

  // ── 01 Hero ──────────────────────────────────────────────
  const breadcrumb = document.querySelector('.pg-proyecto_hero_breadcrumb');
  if (breadcrumb) {
    const link = breadcrumb.querySelector('a');
    breadcrumb.textContent = '';
    if (link) breadcrumb.appendChild(link);
    breadcrumb.appendChild(document.createTextNode(' > ' + title));
  }

  setText('.pg-proyecto_hero_title', title);

  // Hero tags carry the confirmed system codes. No confirmed systems -> no tags
  // (the old page showed a hardcoded pglass-3a that was never verified).
  const tagWrap = document.querySelector('.pg-proyecto_hero_tags');
  if (tagWrap) {
    const systems = project.systems || [];
    tagWrap.innerHTML = systems.map(code =>
      `<span class="gl-tag">${esc(code)}</span>`).join('');
    tagWrap.hidden = systems.length === 0;
  }

  // Location / year — absent for the three projects still awaiting them
  const meta = [project.location, project.year].filter(Boolean).join(', ');
  const metaRow = document.querySelector('.pg-proyecto_hero_metarow');
  setText('.pg-proyecto_hero_location', meta);
  if (metaRow) metaRow.hidden = !meta;

  const heroImg = document.querySelector('.pg-proyecto_hero_media');
  if (heroImg && project.hero) {
    heroImg.src = project.hero.src;
    heroImg.alt = `Proyecto ${title} — sistema de vidrio Pernia Glass`;
    if (project.hero.w) heroImg.width = project.hero.w;
    if (project.hero.h) heroImg.height = project.hero.h;
  }

  // ── 02 Description — hidden until real copy exists ───────
  const paragraphs = Array.isArray(project.description)
    ? project.description.filter(Boolean)
    : (project.description ? [project.description] : []);
  const descSection = document.querySelector('.pg-proyecto_description');
  if (descSection) {
    if (paragraphs.length) {
      const content = descSection.querySelector('.pg-proyecto_description_content');
      if (content) {
        content.innerHTML = paragraphs.map((p, i) =>
          `<p class="pg-proyecto_description_text${i ? ' pg-proyecto_description_text_spaced' : ''} u-text-style-main">${esc(p)}</p>`
        ).join('');
      }
      descSection.hidden = false;
    } else {
      descSection.hidden = true;
    }
  }

  // ── 03 Gallery ───────────────────────────────────────────
  // Reproduces the authored rhythm — full-width landscape shots, portraits
  // paired two-up — but derives it from each image's real dimensions instead
  // of a hand-built slot list, so any project length lays out correctly.
  const grid = document.querySelector('.pg-proyecto_gallery_grid');
  const gallerySection = document.querySelector('.pg-proyecto_gallery');
  const shots = project.gallery || [];
  if (grid) {
    grid.innerHTML = buildGallery(shots, title);
    if (gallerySection) gallerySection.hidden = shots.length === 0;
  }

  // ── 04 Systems used ──────────────────────────────────────
  const sysSection = document.querySelector('.pg-proyecto_systems');
  const sysRow = document.querySelector('.pg-proyecto_systems_row');
  const codes = project.systems || [];
  if (sysRow) {
    const lookup = (code) =>
      (systemsDoc && systemsDoc.systems || []).find(s => s.code === code) || null;
    sysRow.innerHTML = codes.map(code => {
      const s = lookup(code);
      const name = (s && s.name && s.name.es) || '';
      // The name already starts with the code ("pglass-2b — 2 hojas…") — strip
      // it so the tag above doesn't repeat it.
      const label = name.replace(new RegExp('^\\s*' + code + '\\s*[—–-]\\s*'), '');
      const render = s && s.media && s.media.render;
      return `
        <a href="pg-sistema.html?code=${encodeURIComponent(code)}" class="pg-proyecto_system-ref">
          ${render ? `<img src="${esc(render)}" alt="${esc(code)} — render" class="pg-proyecto_system-ref_img" loading="lazy">` : ''}
          <div class="pg-proyecto_system-ref_info">
            <span class="gl-tag">${esc(code)}</span>
            ${label ? `<p class="pg-proyecto_system-ref_title">${esc(label)}</p>` : ''}
          </div>
        </a>`;
    }).join('');
  }
  if (sysSection) sysSection.hidden = codes.length === 0;

  renumberSections();

  // pg-proyecto-animations.js builds its ScrollTriggers from whatever the page
  // measured at init. Injecting the gallery and systems here changes the page
  // height by thousands of pixels, so those triggers keep their stale start/end
  // offsets and only some elements ever reveal (observed: 2 of 6 gallery images
  // and 1 of 3 system cards on Torre600). Recompute them against the real
  // layout. Harmless when GSAP has not loaded yet — the triggers created after
  // this point already measure the finished DOM.
  refreshScrollTriggers();
  window.addEventListener('load', refreshScrollTriggers, { once: true });

  // ── 05 Prev / next ───────────────────────────────────────
  // Wraps around the grid order. The old markup pointed both links at bare
  // pg-proyecto.html and named two projects that do not exist.
  const prev = projects[(index - 1 + projects.length) % projects.length];
  const next = projects[(index + 1) % projects.length];
  fillPrevNext('.pg-proyecto_prevnext_item-prev', prev, projects.length);
  fillPrevNext('.pg-proyecto_prevnext_item-next', next, projects.length);
}

/* The two gallery slots crop to fixed ratios via object-fit: cover —
   `-pano` is 21/9 and `-half` is 4/3 (see project.css). So a portrait shot
   dropped into a pano slot loses most of its frame to a thin horizontal
   sliver. Orientation therefore decides the slot, never the other way round:
     landscape -> pano (full width, 21/9)
     portrait  -> half (paired two-up, 4/3)
   Landscapes and portrait-pairs then alternate to keep the authored rhythm
   (pano, row, pano, row …), and a leftover odd portrait sits alone in a row
   rather than being stretched full width. */
function buildGallery(shots, title) {
  const isLandscape = (s) => s.w && s.h ? s.w > s.h : true;
  const panos = shots.filter(isLandscape);
  const portraits = shots.filter(s => !isLandscape(s));

  const rows = [];
  for (let i = 0; i < portraits.length; i += 2) {
    rows.push(portraits.slice(i, i + 2));
  }

  const out = [];
  let p = 0, r = 0;
  while (p < panos.length || r < rows.length) {
    if (p < panos.length) out.push(img(panos[p++], title, 'pano'));
    if (r < rows.length) {
      out.push(`<div class="pg-proyecto_gallery_row">${rows[r++].map(s => img(s, title, 'half')).join('')}</div>`);
    }
  }
  return out.join('');
}

function img(s, title, kind) {
  const cls = kind === 'pano' ? 'pg-proyecto_gallery_img-pano' : 'pg-proyecto_gallery_img-half';
  const dim = (s.w && s.h) ? ` width="${s.w}" height="${s.h}"` : '';
  return `<img src="${esc(s.src)}" alt="Proyecto ${esc(title)} — vidrio Pernia Glass" class="${cls}" loading="lazy"${dim}>`;
}

function fillPrevNext(selector, project, total) {
  const el = document.querySelector(selector);
  if (!el) return;
  // With a single project there is nowhere to go — hide rather than link to self
  if (!project || total < 2) { el.hidden = true; return; }
  el.hidden = false;
  el.setAttribute('href', `pg-proyecto.html?slug=${encodeURIComponent(project.slug)}`);
  const titleEl = el.querySelector('.pg-proyecto_prevnext_title');
  if (titleEl) titleEl.textContent = project.title;
  const metaEl = el.querySelector('.gl-mono_label');
  if (metaEl) {
    const meta = [project.location, project.year].filter(Boolean).join(', ');
    metaEl.textContent = meta;
    metaEl.hidden = !meta;
  }
}

/* Section numbers are authored 02..05. Hiding description and/or systems would
   leave gaps, so renumber whatever is still visible. */
function renumberSections() {
  const visible = [...document.querySelectorAll('.pg-proyecto_description, .pg-proyecto_gallery, .pg-proyecto_systems')]
    .filter(s => !s.hidden);
  visible.forEach((section, i) => {
    const label = section.querySelector('.gl-section-number');
    if (!label) return;
    const rest = label.textContent.replace(/^\s*\d+\s*\/\/\s*/, '');
    label.textContent = String(i + 2).padStart(2, '0') + ' // ' + rest;
  });
}

function renderNotFound(slug, projects) {
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `
    <section class="gl-hero-cap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:4rem 2rem;text-align:center;gap:1rem;">
      <span class="gl-mono gl-mono_muted">404 — PROYECTO NO ENCONTRADO</span>
      <h1 class="pg-proyecto_hero_title" style="margin:0;">El proyecto «${esc(slug || '')}» no existe</h1>
      <p class="gl-mono gl-mono_muted">Proyectos disponibles: ${projects.map(p => esc(p.slug)).join(' · ')}</p>
      <a href="pg-proyectos.html" class="gl-mono">&larr; Volver a proyectos</a>
    </section>`;
}

function renderError(err) {
  const main = document.querySelector('main');
  if (!main) return;
  const isFile = window.location.protocol === 'file:';
  main.innerHTML = `
    <section class="gl-hero-cap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:4rem 2rem;text-align:center;gap:1rem;">
      <span class="gl-mono gl-mono_muted">DATA LOADER — ERROR</span>
      <h1 class="pg-proyecto_hero_title" style="margin:0;">No se pudieron cargar los proyectos</h1>
      <p class="u-text-style-main" style="max-width:50ch;">${isFile
        ? 'La página se está abriendo con <code>file://</code> — los navegadores bloquean los <code>fetch()</code> locales. Sírvela con un servidor local.'
        : 'Hubo un error al cargar <code>data/pernia-proyectos.json</code>.'}</p>
      <p class="gl-mono gl-mono_muted" style="font-size:0.8rem;">Error: ${esc((err && err.message) || String(err))}</p>
      <a href="pg-proyectos.html" class="gl-mono">&larr; Volver a proyectos</a>
    </section>`;
}

/* ── helpers ─────────────────────────────────────────────── */

/* ScrollTrigger may load after this script runs (GSAP comes off a CDN), so
   poll briefly rather than refreshing once and hoping it was ready. */
function refreshScrollTriggers() {
  let tries = 0;
  const tick = () => {
    const st = window.ScrollTrigger;
    if (st && typeof st.refresh === 'function') { st.refresh(); return; }
    if (++tries < 20) setTimeout(tick, 150);
  };
  tick();
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value || '';
}

function setMeta(attr, key, value) {
  const el = document.querySelector(`meta[${attr}="${key}"]`);
  if (el) el.setAttribute('content', value);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

})(); // end IIFE — safe to re-run on SPA swaps
