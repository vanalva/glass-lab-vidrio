/* ════════════════════════════════════════════════════════════════════
   data-loader.js — shared data layer for Glass Lab + Pernia Glass

   Loads glass-types.json and pernia-systems.json once, exposes them
   to all page scripts via window.GL_DATA (a Promise). Pages just do:

       window.GL_DATA.then(({ glass, pernia, helpers }) => { ... })

   Helpers expose convenient lookups (getProduct, getSystem, getRelated...).
   This works for local development. When the site moves to Webflow CMS,
   replace the fetch calls with Webflow's CMS bindings — the helpers
   API stays the same.
   ════════════════════════════════════════════════════════════════════ */

window.GL_DATA = (async function loadData() {
  // cache:'no-cache' forces ETag revalidation on every load. GitHub Pages serves
  // these JSON files with Cache-Control: max-age=600, so a plain fetch hands back
  // a copy up to 10 minutes stale — meaning image paths and content from the
  // PREVIOUS deploy keep rendering after a new deploy. Revalidating is cheap
  // (304 when unchanged) and guarantees the data always matches the live deploy.
  const NO_CACHE = { cache: 'no-cache' };
  // fetch() only rejects on a network failure — a 404 resolves happily with an
  // HTML error body, and r.json() then dies on "<" with an opaque SyntaxError
  // that says nothing about the missing file. Check r.ok first (as the
  // mobiliario fetch below already does) so the page's error handler can show
  // which file failed and with what status.
  const required = (url) => fetch(url, NO_CACHE).then(r => {
    if (!r.ok) throw new Error(`${url} — HTTP ${r.status} ${r.statusText}`);
    return r.json();
  });
  const [glass, pernia, mobiliario] = await Promise.all([
    required('data/glass-types.json'),
    required('data/pernia-systems.json'),
    // mobiliario is optional — pages that don't need it still resolve
    fetch('data/pernia-mobiliario.json', NO_CACHE).then(r => r.ok ? r.json() : null).catch(() => null)
  ]);

  /* ── Lookups ─────────────────────────────────────────── */

  function getProduct(code) {
    return glass.products.find(p => p.code === code) || null;
  }

  function getCategory(id) {
    return glass.categories.find(c => c.id === id) || null;
  }

  function getSubcategory(catId, subId) {
    const cat = getCategory(catId);
    return cat ? (cat.subcategories.find(s => s.id === subId) || null) : null;
  }

  function getSystem(code) {
    return pernia.systems.find(s => s.code === code) || null;
  }

  /* ── Pernia mobiliario (furniture) lookups ────────────── */

  function getMueble(idOrSlug) {
    if (!mobiliario || !mobiliario.pieces) return null;
    return mobiliario.pieces.find(
      p => p.slug === idOrSlug || p.code === idOrSlug
    ) || null;
  }

  function getMuebles() {
    return (mobiliario && mobiliario.pieces) ? mobiliario.pieces : [];
  }

  /* ── Related products (siblings + tier + mirror + acidada + film) ─ */

  function getRelated(code) {
    const product = getProduct(code);
    if (!product) return [];
    const rel = product.relations || {};
    const out = [];

    // version espejo (the mirrored version of this glass)
    if (rel.esVersionEspejoDe) {
      const target = getProduct(rel.esVersionEspejoDe);
      if (target) out.push({ kind: 'es-version-espejo-de',         product: target });
    }
    // glass that THIS mirror is the espejo of (inverse)
    glass.products.forEach(p => {
      if (p.relations && p.relations.esVersionEspejoDe === code) {
        out.push({ kind: 'tiene-version-espejo', product: p });
      }
    });
    // tier alternativo
    if (rel.esTierAlternativoDe) {
      const target = getProduct(rel.esTierAlternativoDe);
      if (target) out.push({ kind: 'es-tier-alternativo-de',       product: target });
    }
    if (rel.tieneTierAlternativo) {
      const target = getProduct(rel.tieneTierAlternativo);
      if (target) out.push({ kind: 'tiene-tier-alternativo',       product: target });
    }
    // variantes de color
    (rel.variantesDeColor || []).forEach(siblingCode => {
      if (siblingCode === code) return;
      const target = getProduct(siblingCode);
      if (target) out.push({ kind: 'variante-de-color',            product: target });
    });
    // acidada
    if (rel.esVersionAcidadaDe) {
      const target = getProduct(rel.esVersionAcidadaDe);
      if (target) out.push({ kind: 'es-version-acidada-de',        product: target });
    }
    // con film
    if (rel.esVersionConFilmDe) {
      const target = getProduct(rel.esVersionConFilmDe);
      if (target) out.push({ kind: 'es-version-con-film-de',       product: target });
    }
    // comparte familia (mesh series members)
    (rel.comparteFamiliaCon || []).slice(0, 4).forEach(famCode => {
      const target = getProduct(famCode);
      if (target) out.push({ kind: 'comparte-familia-con',         product: target });
    });

    return out;
  }

  /* ── Pernia: systems that use this glass type ─────────── */

  function getCompatiblePerniaSystems(_glassCode) {
    // All 8 GLSS systems are universally 8mm laminated — they're
    // compatible with every Glass Lab product (the laminated mesh inserts
    // become the front layer of the system's 8mm laminated glass).
    return pernia.systems.filter(s => s.availability !== 'proximamente');
  }

  /* ── Distinct facet values present in the catalog ─────── */

  function getFacets() {
    const out = {
      acabado: new Set(), patron: new Set(), disponibilidad: new Set(),
      personalizacionColor: new Set(), tier: new Set(), subcategory: new Set()
    };
    glass.products.forEach(p => {
      const a = p.attributes || {};
      (a.acabado || []).forEach(v => out.acabado.add(v));
      if (a.patron) out.patron.add(a.patron);
      if (a.disponibilidad) out.disponibilidad.add(a.disponibilidad);
      if (a.personalizacionColor) out.personalizacionColor.add(a.personalizacionColor);
      if (a.tier) out.tier.add(a.tier);
      if (p.subcategory) out.subcategory.add(p.subcategory);
    });
    Object.keys(out).forEach(k => { out[k] = Array.from(out[k]).sort(); });
    return out;
  }

  /* ── URL helpers ─────────────────────────────────────── */

  function getCodeFromUrl(fallback = null) {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || fallback;
  }

  return {
    glass,
    pernia,
    mobiliario,
    helpers: {
      getProduct, getCategory, getSubcategory, getSystem,
      getMueble, getMuebles,
      getRelated, getCompatiblePerniaSystems,
      getFacets, getCodeFromUrl
    }
  };
})();
