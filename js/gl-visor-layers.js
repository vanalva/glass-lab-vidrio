/* ============================================================
   VISOR · Layered glass construction
   ------------------------------------------------------------
   Every product in the Visor is built as its real stack of plies
   instead of one body with a flat pattern painted inside it, and
   the stack can be pulled apart with the "Separar capas" button.

   Construction study drawn from the Glass Lab sample photographs
   and the catalogue's thickness range. Ply and wire dimensions are
   illustrative scene units — not supplier specifications or
   measured millimetres.

   Three families, one builder:
     · monolithic  (Vc Va Ve Vd Vab) → textured face + body + rear face
     · laminated   (In Gr Ds Aq At)  → glass / interlayer / core / glass
     · silvered    (Ec Ed)           → glass / silver / copper / backing

   `optics.depth` is the refraction depth the whole stack shares out
   among its glass plies. Monolithic and silvered samples inherit the
   single-body renderer's 1.3; the mesh laminates run deliberately thin
   so the woven core reads through instead of being drowned in milk.

   Layers stay visible while assembled unless they are marked
   `hideAssembled` — matched glass/polymer interfaces are invisible
   face-on, so an interlayer only earns its own solid once the stack
   opens. A perimeter bond band stands in for it while closed.
   ============================================================ */
import * as THREE from 'three';

/* Total travel of the outermost plies when fully separated. */
const SPREAD = 1.34;

/* ── Construction specs, keyed by the Visor's glass symbols ─────── */
export const LAYER_SPECS = {
  /* ---- Monolithic: one piece of glass, two different faces ------ */
  Vc: {
    family: 'monolithic', env: 'room', backdrop: 'bars',
    layers: [
      { label: 'Cara aire',    kind: 'face',  t: 0.040, tint: '#cfe6f2', att: 6.0, roughness: 0.03 },
      { label: 'Cuerpo float', kind: 'glass', t: 0.260, tint: '#cfe6f2', att: 6.0, roughness: 0.03 },
      { label: 'Cara estaño',  kind: 'face',  t: 0.040, tint: '#d3e4ee', att: 6.0, roughness: 0.05 },
    ],
  },
  Va: {
    family: 'monolithic', env: 'room', backdrop: 'bars',
    layers: [
      { label: 'Cara acanalada', kind: 'face',  t: 0.120, relief: 'reed', flutes: 18, depth: 0.085, tint: '#c4dcec', att: 2.6, roughness: 0.06 },
      { label: 'Cuerpo',         kind: 'glass', t: 0.160, tint: '#c4dcec', att: 2.6, roughness: 0.06 },
      { label: 'Cara lisa',      kind: 'face',  t: 0.060, tint: '#c4dcec', att: 2.6, roughness: 0.05 },
    ],
  },
  Vab: {
    family: 'monolithic', env: 'room', backdrop: 'bars',
    layers: [
      { label: 'Cara acanalada', kind: 'face',  t: 0.120, relief: 'reed', flutes: 18, depth: 0.085, tint: '#b5822e', att: 2.0, roughness: 0.07 },
      { label: 'Cuerpo bronce',  kind: 'glass', t: 0.160, tint: '#a8761f', att: 1.7, roughness: 0.07 },
      { label: 'Cara lisa',      kind: 'face',  t: 0.060, tint: '#b5822e', att: 2.0, roughness: 0.06 },
    ],
  },
  Ve: {
    family: 'monolithic', env: 'room', backdrop: 'bars',
    layers: [
      { label: 'Capa esmerilada', kind: 'face',  t: 0.030, tint: '#e7f0f5', att: 5.0, roughness: 0.80, clearcoat: 0 },
      { label: 'Cuerpo',          kind: 'glass', t: 0.250, tint: '#dbe8f0', att: 4.0, roughness: 0.10 },
      { label: 'Cara lisa',       kind: 'face',  t: 0.060, tint: '#dbe8f0', att: 4.0, roughness: 0.05 },
    ],
  },
  Vd: {
    family: 'monolithic', env: 'room', backdrop: 'bars',
    layers: [
      { label: 'Cara diamante', kind: 'face',  t: 0.110, relief: 'diamond', cells: 26, depth: 0.052, tint: '#c8dfef', att: 3.0, roughness: 0.08 },
      { label: 'Cuerpo',        kind: 'glass', t: 0.170, tint: '#c8dfef', att: 3.0, roughness: 0.08 },
      { label: 'Cara lisa',     kind: 'face',  t: 0.060, tint: '#c8dfef', att: 3.0, roughness: 0.05 },
    ],
  },

  /* ---- Laminated: two plies bonded around a core ---------------- */
  In: {
    family: 'laminate', env: 'room', backdrop: 'bars',
    layers: [
      { label: 'Vidrio',              kind: 'glass', t: 0.130, tint: '#dbe9f2', att: 4.5, roughness: 0.05 },
      { label: 'Interlámina de color', kind: 'film', t: 0.080, film: 'solid', color: '#2f6fb0' },
      { label: 'Vidrio',              kind: 'glass', t: 0.130, tint: '#dbe9f2', att: 4.5, roughness: 0.05 },
    ],
  },
  Gr: {
    family: 'laminate', env: 'room', backdrop: 'bars',
    layers: [
      { label: 'Vidrio',                kind: 'glass', t: 0.130, tint: '#dbe9f2', att: 5.0, roughness: 0.05 },
      { label: 'Interlámina gradiente', kind: 'film',  t: 0.080, film: 'gradient' },
      { label: 'Vidrio',                kind: 'glass', t: 0.130, tint: '#dbe9f2', att: 5.0, roughness: 0.05 },
    ],
  },
  Ds: {
    family: 'laminate', env: 'studio', backdrop: 'wall',
    optics: { depth: 0.55, specular: 0.9, env: 1.0, clearcoat: 0.06 },
    layers: [
      { label: 'Vidrio',        kind: 'glass', t: 0.125, tint: '#dfeaf0', att: 5.5, roughness: 0.04 },
      { label: 'Interlámina',   kind: 'film',  t: 0.026, film: 'clear', color: '#f0e9d2', opacity: 0.55, hideAssembled: true },
      { label: 'Film dicroico', kind: 'film',  t: 0.014, film: 'dichroic', iridescence: 1 },
      { label: 'Interlámina',   kind: 'film',  t: 0.026, film: 'clear', color: '#f0e9d2', opacity: 0.55, hideAssembled: true },
      { label: 'Vidrio',        kind: 'glass', t: 0.125, tint: '#dfeaf0', att: 5.5, roughness: 0.04 },
    ],
  },
  Aq: {
    family: 'laminate', env: 'studio', backdrop: 'wall',
    optics: { depth: 0.13, specular: 1.0, env: 1.0, transmission: 1, clearcoat: 0 },
    layers: [
      { label: 'Vidrio',      kind: 'glass', t: 0.065, tint: '#dcebe3', att: 2.8, roughness: 0.025 },
      { label: 'Interlámina', kind: 'film',  t: 0.017, film: 'clear', color: '#f0e9d2', opacity: 0.6, hideAssembled: true },
      { label: 'Malla Qubo',  kind: 'weave', weave: 'qubo', color: '#a68e57', metalness: 0.88, roughness: 0.32 },
      { label: 'Interlámina', kind: 'film',  t: 0.017, film: 'clear', color: '#f0e9d2', opacity: 0.6, hideAssembled: true },
      { label: 'Vidrio',      kind: 'glass', t: 0.065, tint: '#dcebe3', att: 2.8, roughness: 0.025 },
    ],
  },
  At: {
    family: 'laminate', env: 'studio', backdrop: 'wall',
    optics: { depth: 0.13, specular: 1.0, env: 1.0, transmission: 1, clearcoat: 0 },
    layers: [
      { label: 'Vidrio',       kind: 'glass', t: 0.065, tint: '#dfeee6', att: 3.2, roughness: 0.025 },
      { label: 'Interlámina',  kind: 'film',  t: 0.017, film: 'clear', color: '#f2ecd8', opacity: 0.6, hideAssembled: true },
      { label: 'Malla tejida', kind: 'weave', weave: 'tejida', color: '#c3b48c', metalness: 0.12, roughness: 0.72 },
      { label: 'Interlámina',  kind: 'film',  t: 0.017, film: 'clear', color: '#f2ecd8', opacity: 0.6, hideAssembled: true },
      { label: 'Vidrio',       kind: 'glass', t: 0.065, tint: '#dfeee6', att: 3.2, roughness: 0.025 },
    ],
  },

  /* ---- Silvered: coating stack on the rear face ----------------- */
  Ec: {
    family: 'silvered', env: 'studio', backdrop: 'bars',
    layers: [
      { label: 'Vidrio',   kind: 'glass',   t: 0.290, tint: '#dae8f5', att: 8.0, roughness: 0.04 },
      { label: 'Plata',    kind: 'coating', t: 0.014, color: '#f4f6f8', metalness: 1.0, roughness: 0.045 },
      { label: 'Cobre',    kind: 'coating', t: 0.010, color: '#b0714a', metalness: 0.9, roughness: 0.30 },
      { label: 'Pintura',  kind: 'coating', t: 0.022, color: '#3c4148', metalness: 0.0, roughness: 0.85 },
    ],
  },
  Ed: {
    family: 'silvered', env: 'studio', backdrop: 'bars',
    layers: [
      { label: 'Cara diamante', kind: 'face',    t: 0.110, relief: 'diamond', cells: 26, depth: 0.050, tint: '#c8dfef', att: 8.0, roughness: 0.10 },
      { label: 'Vidrio',        kind: 'glass',   t: 0.185, tint: '#c8dfef', att: 8.0, roughness: 0.06 },
      { label: 'Plata',         kind: 'coating', t: 0.014, color: '#f4f6f8', metalness: 1.0, roughness: 0.06 },
      { label: 'Cobre',         kind: 'coating', t: 0.010, color: '#b0714a', metalness: 0.9, roughness: 0.30 },
      { label: 'Pintura',       kind: 'coating', t: 0.022, color: '#3c4148', metalness: 0.0, roughness: 0.85 },
    ],
  },
};

/* Camera framing per family — the deeper the stack, the further back
   the separated state needs the camera. */
const FRAMING = {
  //                       dolly-out once the stack is fully open ↓  ↓ phones start zoomed out, so they pull back less
  monolithic: { tilt: -0.16, zoom: 1.06, zoomCoarse: 0.92, spreadZoom: 0.58, spreadZoomCoarse: 0.74, lift: 0.10, liftCoarse: 0.02 },
  laminate:   { tilt: -0.24, zoom: 1.18, zoomCoarse: 0.95, spreadZoom: 0.62, spreadZoomCoarse: 0.78, lift: 0.22, liftCoarse: 0.04 },
  silvered:   { tilt: -0.20, zoom: 1.10, zoomCoarse: 0.92, spreadZoom: 0.60, spreadZoomCoarse: 0.76, lift: 0.16, liftCoarse: 0.03 },
};

export function framingFor(sym) {
  const spec = LAYER_SPECS[sym];
  return spec ? FRAMING[spec.family] : null;
}

/* Caption above the button — the stack read front to back, with
   repeated ply names collapsed so it stays a phrase, not a list. */
export function captionFor(sym) {
  const spec = LAYER_SPECS[sym];
  if (!spec) return '';
  const seen = [];
  spec.layers.forEach((l) => { if (seen[seen.length - 1] !== l.label) seen.push(l.label); });
  return seen.join(' / ').toUpperCase();
}

/* ============================================================
   Sample builder
   ============================================================ */
export function createLayeredSample(sym, w, h, coarse = false) {
  const spec = LAYER_SPECS[sym];
  if (!spec) return null;

  const group = new THREE.Group();
  group.name = `${sym} · ${spec.family}`;
  const outline = swatchOutline(w, h);
  const built = [];
  const glassMats = [], metalMats = [], filmMats = [];

  /* Refraction reads off MeshPhysicalMaterial.thickness, not the ply's
     geometric depth — a 0.12-unit ply set to its own depth refracts
     nothing. Split the single-body renderer's optical depth across the
     glass plies by their share of the stack, so a closed sample bends
     light exactly as much as the one-piece version did. */
  const glassDepth = spec.layers
    .filter((l) => l.kind === 'glass' || l.kind === 'face')
    .reduce((sum, l) => sum + l.t, 0) || 1;
  const optics = { depth: 1.3, specular: 0.6, env: 0.9, transmission: 0.98, clearcoat: 0.22, ...(spec.optics || {}) };

  /* Assembled z: stack the layers front to back, centred on 0.
     Weave layers are embedded in the core and take no stack height. */
  const total = spec.layers.reduce((sum, l) => sum + (l.kind === 'weave' ? 0 : l.t), 0);
  let cursor = total / 2;

  spec.layers.forEach((layer, i) => {
    const thickness = layer.kind === 'weave' ? 0 : layer.t;
    const baseZ = cursor - thickness / 2;
    cursor -= thickness;

    const { mesh, material } = buildLayer(layer, w, h, outline, coarse, layer.t / glassDepth, optics);
    mesh.name = layer.label;
    mesh.position.z = baseZ;
    group.add(mesh);
    built.push({ layer, mesh, baseZ });

    if (layer.kind === 'glass' || layer.kind === 'face') glassMats.push(material);
    else if (layer.kind === 'weave' || layer.kind === 'coating') metalMats.push(material);
    else filmMats.push(material);
  });

  /* Edge ribbons make each ply readable from the side without drawing
     opaque outlines across the faces. They brighten as the stack opens:
     clear plies floating apart on a lit wall have nothing else to read by. */
  const EDGE_CLOSED = 0.4, EDGE_OPEN = 0.85;
  const edgeMat = new THREE.MeshPhysicalMaterial({
    color: '#c6d9ce', metalness: 0.08, roughness: 0.2,
    transparent: true, opacity: EDGE_CLOSED, depthWrite: false,
    envMapIntensity: 0.65, side: THREE.DoubleSide,
  });
  built.forEach(({ layer, mesh }) => {
    if (layer.kind !== 'glass' && layer.kind !== 'face') return;
    mesh.add(new THREE.Mesh(perimeterBand(outline, Math.max(layer.t - 0.008, 0.004)), edgeMat));
  });

  /* One bond band stands in for the hidden interlayers while closed. */
  const hidden = spec.layers.filter((l) => l.hideAssembled);
  let bond = null;
  if (hidden.length) {
    const bondT = hidden.reduce((s, l) => s + l.t, 0) + (spec.layers.some((l) => l.kind === 'weave') ? 0.03 : 0);
    bond = new THREE.Mesh(
      perimeterBand(swatchOutline(w - 0.009, h - 0.009), bondT),
      new THREE.MeshStandardMaterial({
        color: '#b8b19b', roughness: 0.3, metalness: 0.15,
        transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide,
      }));
    bond.name = 'Bond line at laminate edge';
    group.add(bond);
  }

  /* ── Separation ────────────────────────────────────────────────
     Layers fan out evenly about the centre of the stack, so a 3-ply
     monolith and a 5-ply laminate travel the same total distance. */
  const n = built.length;
  const step = n > 1 ? SPREAD / (n - 1) : 0;
  const centre = (n - 1) / 2;
  let separation = 0;

  function setSeparation(value) {
    separation = value;
    built.forEach((entry, i) => {
      entry.mesh.position.z = entry.baseZ + (centre - i) * step * value;
      if (entry.layer.hideAssembled) entry.mesh.visible = value > 0.001;
    });
    if (bond) bond.visible = value < 0.001;
    edgeMat.opacity = EDGE_CLOSED + (EDGE_OPEN - EDGE_CLOSED) * value;
  }
  setSeparation(0);

  return {
    group,
    setSeparation,
    get separation() { return separation; },
    setClarity(pct) {
      // Change optical depth and absorption, never the ply's real geometry:
      // clearer = a longer light path through thinner colour, exactly as the
      // single-body renderer treats the slider.
      const p = pct / 100;
      const scale = 0.46 + (1 - p) * 1.23;
      glassMats.forEach((m) => {
        m.thickness = (m.userData.opticalDepth ?? 1.3) * scale * (m.userData.depthShare ?? 1);
        m.attenuationDistance = (m.userData.attenuationBase || 4) * (0.5 + p * 1.2);
      });
      filmMats.forEach((m) => {
        if (!m.userData.bonding) return;   // a colour interlayer keeps its density
        const base = m.userData.opacityBase ?? 0.9;
        m.opacity = clamp(base * (1.25 - p * 0.5), 0.06, 1);
      });
    },
    setLight(pct) {
      const p = pct / 100;
      glassMats.forEach((m) => { m.envMapIntensity = (m.userData.envBase ?? 0.9) * (0.45 + p * 0.55); });
      metalMats.forEach((m) => { m.envMapIntensity = 0.5 + p * 0.9; });
      filmMats.forEach((m) => { m.envMapIntensity = 0.35 + p * 0.6; });
    },
    dispose() {
      group.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry.dispose();
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
    },
  };
}

/* ── One layer → mesh + material ───────────────────────────────── */
function buildLayer(layer, w, h, outline, coarse, depthShare = 1, optics = {}) {
  if (layer.kind === 'weave') {
    const material = new THREE.MeshStandardMaterial({
      color: layer.color, metalness: layer.metalness, roughness: layer.roughness,
      envMapIntensity: 1.05,
    });
    return { mesh: new THREE.Mesh(wovenWireGeometry(w, h, coarse, layer.weave), material), material };
  }

  if (layer.kind === 'coating') {
    const material = new THREE.MeshStandardMaterial({
      color: layer.color, metalness: layer.metalness, roughness: layer.roughness,
      envMapIntensity: 1.0, side: THREE.DoubleSide,
    });
    return { mesh: new THREE.Mesh(beveledSlab(swatchOutline(w - 0.004, h - 0.004), layer.t, 0.002), material), material };
  }

  if (layer.kind === 'film') {
    /* Two very different jobs share this kind.

       A bonding interlayer is optically matched to the glass, so it is
       invisible face-on and only earns a solid once the stack opens: keep it
       transmissive and let `hideAssembled` pull it while closed.

       A colour, gradient or dichroic interlayer IS the product, and it has to
       survive being looked at through the pane in front of it. Three.js fills
       the transmission buffer from the opaque list only, so a transparent film
       is simply painted over by the transmissive ply covering it. These films
       are therefore rendered OPAQUE — which is also how the flat-insert
       renderer drew them — and the glass refracts them properly. */
    const bonding = layer.film === 'clear';
    const material = new THREE.MeshPhysicalMaterial({
      color: bonding ? layer.color : '#ffffff',
      metalness: 0, roughness: bonding ? 0.18 : 0.34,
      transparent: bonding, opacity: bonding ? (layer.opacity ?? 0.9) : 1,
      transmission: bonding ? 0.98 : 0,
      thickness: layer.t, ior: 1.48,
      iridescence: layer.iridescence || 0, iridescenceIOR: 1.9, iridescenceThicknessRange: [120, 520],
      clearcoat: bonding ? 0 : 0.4, clearcoatRoughness: 0.2,
      envMapIntensity: bonding ? 0.45 : 0.7,
      side: THREE.DoubleSide, depthWrite: !bonding,
    });
    if (layer.film === 'gradient' || layer.film === 'dichroic') material.map = filmTexture(layer.film);
    else if (layer.film === 'solid') material.color.set(layer.color);
    material.userData.opacityBase = bonding ? (layer.opacity ?? 0.9) : 1;
    material.userData.bonding = bonding;
    const geo = beveledSlab(swatchOutline(w - 0.006, h - 0.006), layer.t, 0.001);
    planarUV(geo, w, h);
    return { mesh: new THREE.Mesh(geo, material), material };
  }

  /* glass + face — same physical material, different silhouette */
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0,
    roughness: layer.roughness ?? 0.04,
    transmission: optics.transmission, thickness: optics.depth * depthShare, ior: 1.5,
    attenuationColor: new THREE.Color(layer.tint),
    attenuationDistance: layer.att,
    clearcoat: layer.clearcoat ?? optics.clearcoat, clearcoatRoughness: 0.16,
    envMapIntensity: optics.env, specularIntensity: optics.specular,
    // Extruded plies are closed solids, so their back faces are wasted fill
    // and only muddy the stack; the grid-built relief shells need both sides.
    side: layer.relief ? THREE.DoubleSide : THREE.FrontSide,
  });
  material.userData.attenuationBase = layer.att;
  material.userData.depthShare = depthShare;
  material.userData.opticalDepth = optics.depth;
  material.userData.envBase = optics.env;

  const geo = layer.relief
    ? texturedSlab(w, h, layer.t, layer.relief, layer)
    : beveledSlab(outline, layer.t, 0.004);
  if (layer.bodyMap) { /* reserved: body-level maps ride on the film layer */ }
  return { mesh: new THREE.Mesh(geo, material), material };
}

/* ============================================================
   Scene dressing
   ============================================================ */
export function makeLayerStudio(kind) {
  const studio = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.18, 0.17), side: THREE.BackSide }));
  studio.add(room);
  function softbox(w, h, x, y, z, strength) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(strength, strength, strength * 0.97), side: THREE.DoubleSide }));
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }
  softbox(0.9, 6.0, -4.4, 1.6, 4.0, 2.4);
  softbox(3.0, 4.0, 4.5, 2.2, 3.5, 1.2);
  softbox(5.5, 1.4, 0, 5.8, 1.0, 2.0);
  softbox(1.0, 5.5, 3.5, 0.0, -4.8, 1.7);
  if (kind === 'silvered') {
    // Mirrors show the room rather than the sample, so give them a
    // second bright edge to catch across the silvered face.
    softbox(0.7, 5.0, -2.2, -1.4, 5.2, 2.0);
  }
  return studio;
}

export function makeLayerBackdrop() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 768;
  const ctx = canvas.getContext('2d');
  const wash = ctx.createRadialGradient(330, 280, 20, 480, 360, 750);
  wash.addColorStop(0, '#575b56');
  wash.addColorStop(0.5, '#303634');
  wash.addColorStop(1, '#111716');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 1024, 768);
  // A quiet studio wall gives clear openings a readable background, without
  // the old white stripe masking the metal detail across the whole sample.
  const light = ctx.createLinearGradient(220, 0, 560, 0);
  light.addColorStop(0, 'rgba(210,214,204,0)');
  light.addColorStop(0.48, 'rgba(210,214,204,0.08)');
  light.addColorStop(0.52, 'rgba(210,214,204,0.08)');
  light.addColorStop(1, 'rgba(210,214,204,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 1024, 768);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* Interlayer films that carry their own colour. Read off the sample
   photographs: Gr runs teal → plum → peach → rose down the pane; Ds is
   a soft amber/teal/rose shift, not a saturated rainbow. */
function filmTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  if (kind === 'gradient') {
    const lg = g.createLinearGradient(0, 0, 0, 512);
    lg.addColorStop(0.00, '#2f7f74');
    lg.addColorStop(0.30, '#6a5a86');
    lg.addColorStop(0.62, '#d99a6c');
    lg.addColorStop(1.00, '#e2809a');
    g.fillStyle = lg;
  } else {
    const lg = g.createLinearGradient(0, 0, 512, 512);
    lg.addColorStop(0.00, '#8fc7bd');
    lg.addColorStop(0.34, '#e0a86a');
    lg.addColorStop(0.62, '#d98f96');
    lg.addColorStop(0.84, '#9ab7cd');
    lg.addColorStop(1.00, '#8fc7bd');
    g.fillStyle = lg;
  }
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ============================================================
   Geometry
   ============================================================ */
export function swatchOutline(w, h) {
  const x = w / 2, y = h / 2, cut = Math.min(w, h) * 0.26;
  return [new THREE.Vector2(-x, -y), new THREE.Vector2(x - cut, -y),
    new THREE.Vector2(x, -y + cut), new THREE.Vector2(x, y),
    new THREE.Vector2(-x + cut, y), new THREE.Vector2(-x, y - cut)];
}

function beveledSlab(outline, thickness, bevel) {
  // ExtrudeGeometry expands the bevel outwards. Offset the source polygon
  // inward so the widest ring retains the exact original silhouette.
  const inset = insetPolygon(outline, bevel);
  const shape = new THREE.Shape(inset);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel, steps: 1,
    bevelEnabled: true, bevelSegments: 3, bevelSize: bevel,
    bevelThickness: bevel, curveSegments: 1,
  });
  geo.translate(0, 0, -thickness / 2 + bevel);
  return geo;
}

/* ExtrudeGeometry writes world-space UVs; film maps need 0..1. */
function planarUV(geo, w, h) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + w / 2) / w;
    uv[i * 2 + 1] = (pos.getY(i) + h / 2) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function insetPolygon(points, distance) {
  return points.map((p, i) => {
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const a = p.clone().sub(prev).normalize();
    const b = next.clone().sub(p).normalize();
    const na = new THREE.Vector2(-a.y, a.x), nb = new THREE.Vector2(-b.y, b.x);
    return p.clone().add(na.clone().add(nb).multiplyScalar(distance / (1 + na.dot(nb))));
  });
}

function perimeterBand(points, thickness) {
  const pos = [], indices = [];
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    const start = pos.length / 3;
    pos.push(p.x, p.y, -thickness / 2, next.x, next.y, -thickness / 2,
      next.x, next.y, thickness / 2, p.x, p.y, thickness / 2);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* ── Textured face shells ───────────────────────────────────────
   A thin solid whose FRONT face carries real displaced relief —
   lenticular flutes for acanalado, pyramid facets for diamante —
   and whose back face is flat, so it sits on the body while the
   stack is closed and reads as its own sheet once it opens.
   Triangles wholly inside a chamfered corner are dropped, and
   boundary vertices snap to the chamfer line, so the cut edge
   stays clean with no ghost geometry behind the notch. */
function texturedSlab(w, h, t, mode, opts = {}) {
  const W = w / 2, H = h / 2, c = Math.min(w, h) * 0.26;
  const flutes = opts.flutes || 18, cells = opts.cells || 26;
  const depth = opts.depth || (mode === 'reed' ? 0.085 : 0.052);
  const nx = mode === 'reed' ? 180 : 150;
  const ny = mode === 'diamond' ? 150 : 90;
  const pos = [], uv = [], rem = [], rowLen = nx + 1;

  const grid = (useFront) => {
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const ox = -W + (i / nx) * w, oy = -H + (j / ny) * h;
        const [x, y] = chamferXY(ox, oy, W, H, c);
        let z = -t / 2;
        if (useFront) {
          if (mode === 'diamond') {
            const a = 1 - Math.abs(((x + W) / w * cells) % 1 - 0.5) * 2;
            const b = 1 - Math.abs(((y + H) / h * cells) % 1 - 0.5) * 2;
            z = t / 2 + depth * Math.min(a, b);
          } else {
            z = t / 2 + depth * Math.sin(Math.PI * (((x + W) / w * flutes) % 1));
          }
          rem.push(inChamfer(ox, oy, W, H, c));
        }
        pos.push(x, y, z);
        uv.push((ox + W) / w, (oy + H) / h);
      }
  };
  grid(true);
  const back = (ny + 1) * rowLen;
  grid(false);

  const rq = (i, j) => rem[j * rowLen + i];
  const tri = (arr, p, q, r) => {
    if (!(rq(...p) && rq(...q) && rq(...r)))
      arr.push(p[1] * rowLen + p[0], q[1] * rowLen + q[0], r[1] * rowLen + r[0]);
  };
  const idx = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      tri(idx, [i, j], [i, j + 1], [i + 1, j]);
      tri(idx, [i + 1, j], [i, j + 1], [i + 1, j + 1]);
      const bt = [];
      tri(bt, [i, j], [i + 1, j], [i, j + 1]);
      tri(bt, [i + 1, j], [i + 1, j + 1], [i, j + 1]);
      for (const v of bt) idx.push(v + back);
    }
  const F = (i, j) => j * rowLen + i, B = (i, j) => back + j * rowLen + i;
  const wall = (i0, j0, i1, j1) => {
    if (rq(i0, j0) && rq(i1, j1)) return;
    idx.push(F(i0, j0), F(i1, j1), B(i0, j0), B(i0, j0), F(i1, j1), B(i1, j1));
  };
  for (let i = 0; i < nx; i++) { wall(i, ny, i + 1, ny); wall(i + 1, 0, i, 0); }
  for (let j = 0; j < ny; j++) { wall(0, j + 1, 0, j); wall(nx, j, nx, j + 1); }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* Is (ox,oy) inside a cut-off corner (top-left or bottom-right)? */
function inChamfer(ox, oy, W, H, c) {
  const dl = ox + W, dt = H - oy;
  if (dl >= 0 && dt >= 0 && dl + dt < c) return true;
  const dr = W - ox, db = oy + H;
  if (dr >= 0 && db >= 0 && dr + db < c) return true;
  return false;
}
/* Project a vertex that's inside a cut corner onto the chamfer line. */
function chamferXY(x, y, W, H, c) {
  let dl = x + W, dt = H - y;
  if (dl >= 0 && dt >= 0 && dl + dt < c) {
    const f = c / Math.max(dl + dt, 1e-4); x = dl * f - W; y = H - dt * f;
  }
  let dr = W - x, db = y + H;
  if (dr >= 0 && db >= 0 && dr + db < c) {
    const f = c / Math.max(dr + db, 1e-4); x = W - dr * f; y = db * f - H;
  }
  return [x, y];
}

/* ── Woven cores ────────────────────────────────────────────────
   One continuous strand per warp and per weft, riding over and under
   at alternating crossings, trimmed to the sample outline including
   its diagonal cuts. Qubo is a tight brass wire cloth; Tejida is a
   coarser, softer flax-toned weave, so it gets a wider pitch, fatter
   strands and a shallower crimp. */
const WEAVES = {
  qubo:   { divisions: 64, radius: 0.155, crimp: 1.03, inset: 0.055 },
  tejida: { divisions: 40, radius: 0.235, crimp: 0.80, inset: 0.055 },
};

export function wovenWireGeometry(w, h, coarse, weave = 'qubo') {
  const cfg = WEAVES[weave] || WEAVES.qubo;
  const pitch = w / cfg.divisions;
  const radius = pitch * cfg.radius, amplitude = radius * cfg.crimp;
  const poly = insetPolygon(swatchOutline(w, h), cfg.inset + radius);
  const sides = coarse ? 5 : 6, samples = coarse ? 3 : 4;
  const positions = [], normals = [], indices = [];

  // Intersect each continuous wire with the inset polygon, including its
  // diagonal cuts. This trims the real weave to the sample outline.
  function limits(fixed, vertical) {
    const hits = [];
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      const a = vertical ? p.x : p.y, b = vertical ? q.x : q.y;
      if (Math.abs(b - a) < 1e-8) return;
      const t = (fixed - a) / (b - a);
      if (t >= 0 && t <= 1) hits.push(vertical ? p.y + t * (q.y - p.y) : p.x + t * (q.x - p.x));
    });
    return hits.length >= 2 ? [Math.min(...hits), Math.max(...hits)] : null;
  }

  function strand(fixed, index, vertical) {
    const range = limits(fixed, vertical);
    if (!range) return;
    const [start, end] = range;
    const count = Math.ceil((end - start) / pitch * samples);
    const base = positions.length / 3;
    // At every crossing warp is above weft, then below at the next crossing.
    // Opposite phases ensure strands do not intersect at their centers.
    const sign = (index % 2 === 0 ? 1 : -1) * (vertical ? 1 : -1);
    for (let j = 0; j <= count; j++) {
      const t = start + (end - start) * j / count;
      const phase = Math.PI * t / pitch;
      const z = sign * amplitude * Math.cos(phase);
      const slope = -sign * amplitude * Math.PI / pitch * Math.sin(phase);
      const length = Math.sqrt(1 + slope * slope);
      for (let k = 0; k <= sides; k++) {
        const theta = k / sides * Math.PI * 2;
        const c = Math.cos(theta), s = Math.sin(theta);
        const nx = vertical ? c : -s * slope / length;
        const ny = vertical ? -s * slope / length : c;
        const nz = s / length;
        positions.push((vertical ? fixed : t) + nx * radius,
          (vertical ? t : fixed) + ny * radius, z + nz * radius);
        normals.push(nx, ny, nz);
      }
    }
    for (let j = 0; j < count; j++) {
      for (let k = 0; k < sides; k++) {
        const a = base + j * (sides + 1) + k, b = a + sides + 1;
        if (vertical) indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    // Close cut wire ends, which can be seen along the clear glass margin.
    for (const endRing of [0, count]) {
      const center = positions.length / 3;
      const t = endRing ? end : start;
      positions.push(vertical ? fixed : t, vertical ? t : fixed,
        sign * amplitude * Math.cos(Math.PI * t / pitch));
      normals.push(vertical ? 0 : (endRing ? 1 : -1), vertical ? (endRing ? 1 : -1) : 0, 0);
      for (let k = 0; k < sides; k++) {
        const a = base + endRing * (sides + 1) + k;
        if ((vertical && !endRing) || (!vertical && endRing)) indices.push(center, a, a + 1);
        else indices.push(center, a + 1, a);
      }
    }
  }
  for (let i = Math.ceil(-w / 2 / pitch); i <= Math.floor(w / 2 / pitch); i++) strand(i * pitch, i, true);
  for (let j = Math.ceil(-h / 2 / pitch); j <= Math.floor(h / 2 / pitch); j++) strand(j * pitch, j, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
