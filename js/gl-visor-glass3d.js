/* ============================================================
   VISOR · Interactive 3D glass sample
   ------------------------------------------------------------
   Replaces the Spline scene with a real Three.js glass viewer.
   Every sample shares ONE procedural chamfered swatch shape (built in
   `makeSwatchGeometry` — a thin glass tile with a chamfered corner
   echoing gl-btn_skew) as the glass BODY; only the pattern changes,
   hybrid by glass type: surface textures (Acanalado reeded, Diamante)
   swap in a relief swatch with REAL displaced ribs/facets; inclusion
   glasses (mesh Qubo/Tejida, interlayer, gradient, dichroic) get a
   pattern texture on an inset insert swatch inside the glass. Default:
   Va · Acanalado. Grab to rotate.

   Wired to the existing right-panel UI:
     · rotate ↑↓←→ buttons  → target rotation
     · zoom / reset         → camera dolly + state reset
     · Transparencia slider → material transmission
     · Intensidad slider    → light + env intensity
     · glass selector cells → material preset swap

   Heavy WebGL is gated on coarse-pointer / small screens the
   same way the rest of Glass Lab gates its effects: on those
   devices we cap the pixel ratio and hold a slow idle spin
   without pointer drag, keeping the main thread light.
   ============================================================ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const mount = document.getElementById('glass3d');
if (mount) boot(mount);

function boot(mount) {
  const COARSE = window.matchMedia('(hover: none)').matches
    || window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(max-width: 767px)').matches;

  /* ── Material presets, keyed by the visor's glass symbols ─────────
     Every sample shares the imported tile as its glass BODY. `kind`
     picks how the pattern is produced — a hybrid, matched to how the
     real product is made:
       · surface textures (reed / diamond) → REAL displaced relief
         geometry sitting on the front face (genuine refraction, no
         normal-map glitter)
       · inclusion glasses (mesh / interlayer / gradient / dichroic) →
         a pattern texture on an INSERT plane inside the glass
       · plain / frost / mirror → material only
     `attenuation` is the body colour (volumetric tint via
     MeshPhysicalMaterial.attenuationColor). */
  const PRESETS = {
    Vc:  { label: 'Vc · Vidrio Claro',     kind: 'plain',         attenuation: 0xcfe6f2, attDist: 6.0, roughness: 0.03, transmission: 1.0,  metalness: 0, iridescence: 0 },
    Va:  { label: 'Va · Acanalado',        kind: 'reed',          attenuation: 0xc4dcec, attDist: 2.6, roughness: 0.06, transmission: 1.0,  metalness: 0, iridescence: 0 },
    Ve:  { label: 'Ve · Esmerilado',       kind: 'frost',         attenuation: 0xdbe8f0, attDist: 4.0, roughness: 0.62, transmission: 1.0,  metalness: 0, iridescence: 0 },
    Vd:  { label: 'Vd · Diamante',         kind: 'diamond',       attenuation: 0xc8dfef, attDist: 3.0, roughness: 0.08, transmission: 1.0,  metalness: 0, iridescence: 0 },
    Vab: { label: 'Vab · Acanalado Bronce',kind: 'reed',          attenuation: 0xb5822e, attDist: 2.0, roughness: 0.07, transmission: 0.95, metalness: 0, iridescence: 0 },
    Gr:  { label: 'Gr · Gradient',         kind: 'gradient',      attenuation: 0x9fc4de, attDist: 3.0, roughness: 0.10, transmission: 1.0,  metalness: 0, iridescence: 0 },
    Ds:  { label: 'Ds · Dichroic Sunset',  kind: 'dichroic',      attenuation: 0xdfe9f2, attDist: 5.0, roughness: 0.08, transmission: 0.9,  metalness: 0, iridescence: 1.0 },
    In:  { label: 'In · Interlayer',       kind: 'interlayer',    attenuation: 0x9fc4de, attDist: 4.0, roughness: 0.08, transmission: 1.0,  metalness: 0, iridescence: 0, insertColor: 0x2f6fb0 },
    Aq:  { label: 'Aq · Malla SA-Qubo',    kind: 'mesh-qubo',     attenuation: 0xbcccd8, attDist: 4.0, roughness: 0.08, transmission: 1.0,  metalness: 0, iridescence: 0 },
    At:  { label: 'At · Malla SA-Tejida',  kind: 'mesh-tejida',   attenuation: 0xbcccd8, attDist: 4.0, roughness: 0.08, transmission: 1.0,  metalness: 0, iridescence: 0 },
    Ec:  { label: 'Ec · Espejo Claro',     kind: 'mirror',        attenuation: 0xdae8f5, attDist: 8.0, roughness: 0.04, transmission: 0.0,  metalness: 1.0, iridescence: 0 },
    Ed:  { label: 'Ed · Espejo Diamante',  kind: 'mirror-diamond',attenuation: 0xc8dfef, attDist: 8.0, roughness: 0.10, transmission: 0.0,  metalness: 1.0, iridescence: 0 },
  };

  /* ── Renderer / scene / camera ─────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, COARSE ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.style.touchAction = 'pan-y';

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const CAM_Z = 8.6;
  camera.position.set(0, 0, CAM_Z);

  /* Environment — soft studio room for realistic reflections/refraction. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  /* ── Background (what the glass refracts) ──────────────────────── */
  const bgTex = makeBackdropTexture();
  bgTex.colorSpace = THREE.SRGBColorSpace;
  const bgMat = new THREE.MeshBasicMaterial({ map: bgTex });
  const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), bgMat);
  bgMesh.position.z = -3.2;
  scene.add(bgMesh);

  /* ── Lights ────────────────────────────────────────────────────── */
  const ambient = new THREE.AmbientLight(0xffffff, 0.28);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x99c4ff, 1.0);
  rim.position.set(5, -2, 3);
  scene.add(rim);

  /* ── Glass body material (shared by the imported tile + relief) ── */
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 0.98,
    thickness: 1.3,
    ior: 1.5,
    attenuationColor: new THREE.Color(0xc4dcec),
    attenuationDistance: 2.6,
    clearcoat: 0.22,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.9,
    specularIntensity: 0.6,
    side: THREE.DoubleSide,
  });

  /* Insert-layer material — the pattern (mesh weave, gradient, colour
     film) lives INSIDE the glass on a thin plane, seen through the clear
     body. Refracts naturally because the body sits in front of it. */
  const insertMat = new THREE.MeshStandardMaterial({
    transparent: true, side: THREE.DoubleSide,
    roughness: 0.55, metalness: 0.1,
  });
  const patternCache = {};   // kind → CanvasTexture

  /* ── Procedural chamfered swatch (one clean thin mesh, fully in code) ─
     A thin glass tile with a chamfered corner (echoes the gl-btn_skew
     motif). Everything sits on geometry we control: the clear BODY is a
     flat swatch; reeded/diamante swap in a relief swatch (same silhouette,
     displaced front); inclusion patterns ride on a slightly-inset insert
     swatch dead-centre in the body. */
  const SW = { w: 3.0, h: 2.15, t: 0.34 };
  const flatGeo = makeSwatchGeometry(SW.w, SW.h, SW.t, 'flat');
  const reedGeo = makeSwatchGeometry(SW.w, SW.h, SW.t, 'reed');
  const diamondGeo = makeSwatchGeometry(SW.w, SW.h, SW.t, 'diamond');

  const sample = new THREE.Group();   // rotating wrapper
  scene.add(sample);
  const tileRoot = new THREE.Mesh(flatGeo, glassMat);   // clear glass body
  sample.add(tileRoot);
  const reliefMesh = new THREE.Mesh(reedGeo, glassMat); // reed/diamond relief
  reliefMesh.visible = false;
  sample.add(reliefMesh);
  const insertLayer = new THREE.Mesh(
    makeSwatchGeometry(SW.w * 0.88, SW.h * 0.88, 0.04, 'flat'), insertMat);
  insertLayer.visible = false;
  sample.add(insertLayer);

  /* ── Interaction state ─────────────────────────────────────────── */
  const rot = { x: -0.12, y: -0.5 };        // current
  const target = { x: -0.12, y: -0.5 };     // eased-toward
  let zoom = 1;
  let dragging = false, lastX = 0, lastY = 0;
  let activePreset = PRESETS.Va;   // declared before the control wiring reads it
  let currentSym = 'Va';           // active glass symbol (tile loads async)
  const ROT_STEP = Math.PI / 12;

  /* Render-on-demand: the loop runs only while something is actually moving
     (drag, easing to a target, hover-spin or the intro spin) AND the element
     is on-screen with the tab visible. It parks itself otherwise — a still
     glass panel costs nothing, and the transmission double-render never fires
     off-screen or in a backgrounded tab. Any input calls wake(). */
  let running = false, paused = false, frameReq = 0;
  let introUntil = now() + 4200;   // one-time intro spin so the panel reads as 3D
  function wake() {
    if (paused || running) return;
    running = true;
    frameReq = requestAnimationFrame(tick);
  }
  function stopLoop() {
    running = false;
    if (frameReq) cancelAnimationFrame(frameReq);
    frameReq = 0;
  }

  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    el.style.cursor = 'grabbing';
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    wake();
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    target.y += dx * 0.008;
    target.x += dy * 0.008;
    target.x = clamp(target.x, -1.2, 1.2);
  });
  const endDrag = (e) => {
    dragging = false;
    el.style.cursor = 'grab';
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = clamp(zoom + (e.deltaY > 0 ? -0.06 : 0.06), 0.6, 2.2);
    wake();
  }, { passive: false });

  /* ── Wire the existing panel controls ──────────────────────────── */
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const a = btn.dataset.action;
      if (a === 'rotate-left')  target.y -= ROT_STEP;
      if (a === 'rotate-right') target.y += ROT_STEP;
      if (a === 'rotate-up')    target.x = clamp(target.x - ROT_STEP, -1.2, 1.2);
      if (a === 'rotate-down')  target.x = clamp(target.x + ROT_STEP, -1.2, 1.2);
      if (a === 'zoom')         zoom = zoom > 1.6 ? 1 : zoom + 0.35;
      if (a === 'reset') {
        target.x = -0.12; target.y = -0.5; zoom = 1;
        setSlider('transparency', 60);
        setSlider('light', 75);
      }
      wake();
    });
  });

  /* Transparencia → tint density. We keep transmission pinned near 1 so the
     glass never turns milky-white; instead the slider drives how much colour
     the body absorbs (attenuation distance + thickness). More transparent =
     clearer, longer light path, thinner colour. Mirrors (transmission 0) are
     unaffected. */
  function applyTransparency(pct) {
    const p = pct / 100;
    glassMat.transmission = activePreset.transmission > 0
      ? Math.min(activePreset.transmission, 0.98)
      : 0;
    glassMat.attenuationDistance = activePreset.attDist * (0.35 + 1.7 * p);
    glassMat.thickness = 1.9 - 0.9 * p;
    glassMat.needsUpdate = true;
  }
  /* Intensidad de luz → key/rim/env brightness. */
  function applyLight(pct) {
    const p = pct / 100;
    key.intensity = 0.4 + p * 2.2;
    rim.intensity = 0.25 + p * 1.4;
    ambient.intensity = 0.16 + p * 0.34;
    glassMat.envMapIntensity = 0.4 + p * 1.1;
    renderer.toneMappingExposure = 0.85 + p * 0.45;
  }

  function setSlider(control, pct) {
    const row = document.querySelector(`[data-control="${control}"]`);
    pct = clamp(pct, 0, 100);
    if (row) {
      const fill = row.querySelector('.gl-visor_slider_fill');
      const thumb = row.querySelector('.gl-visor_slider_thumb');
      const labels = row.querySelectorAll('.gl-visor_control_header .gl-mono_label');
      if (fill) fill.style.width = pct + '%';
      if (thumb) thumb.style.left = pct + '%';
      if (labels[1]) labels[1].textContent = Math.round(pct) + '%';
    }
    if (control === 'transparency') applyTransparency(pct);
    if (control === 'light') applyLight(pct);
    wake();   // material changed → render at least one frame
  }

  document.querySelectorAll('[data-control]').forEach((row) => {
    const control = row.dataset.control;
    const slider = row.querySelector('.gl-visor_slider');
    if (!slider) return;
    const init = control === 'transparency' ? 60 : 75;
    setSlider(control, init);
    let drag = false;
    const upd = (e) => {
      const r = slider.getBoundingClientRect();
      const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - r.left;
      setSlider(control, (x / r.width) * 100);
    };
    slider.style.cursor = 'pointer';
    slider.addEventListener('pointerdown', (e) => { drag = true; try { slider.setPointerCapture(e.pointerId); } catch (_) {} upd(e); });
    slider.addEventListener('pointermove', (e) => { if (drag) upd(e); });
    slider.addEventListener('pointerup', (e) => { drag = false; try { slider.releasePointerCapture(e.pointerId); } catch (_) {} });
    slider.addEventListener('pointercancel', () => { drag = false; });
  });

  /* ── Glass selector cells → swap material preset ───────────────── */
  function applyPreset(sym) {
    const p = PRESETS[sym];
    if (!p) return;
    activePreset = p;
    currentSym = sym;

    // body material
    glassMat.attenuationColor.set(p.attenuation);
    glassMat.roughness = p.roughness;
    glassMat.metalness = p.metalness;
    glassMat.iridescence = p.iridescence;
    glassMat.iridescenceIOR = p.iridescence ? 1.8 : 1.3;
    glassMat.needsUpdate = true;

    // hybrid pattern: a solid relief slab (in place of the tile) for surface
    // textures; the tile's built-in insert layer, re-materialled, for the
    // inclusion glasses. (relief / insert / tile exist only after load.)
    if (reliefMesh && insertLayer && tileRoot) {
      const isReed = p.kind === 'reed';
      const isDiamond = p.kind === 'diamond' || p.kind === 'mirror-diamond';
      const surface = isReed || isDiamond;
      reliefMesh.visible = surface;
      tileRoot.visible = !surface;                 // slab replaces the tile
      if (isReed) reliefMesh.geometry = reedGeo;
      else if (isDiamond) reliefMesh.geometry = diamondGeo;

      // inclusion pattern on the insert plane (mesh / gradient / dichroic);
      // interlayer is done as a body tint, so it needs no plane
      const mapKind = { 'mesh-qubo': 1, 'mesh-tejida': 1, 'gradient': 1, 'dichroic': 1, 'interlayer': 1 }[p.kind];
      insertLayer.visible = !!mapKind;
      if (mapKind) {
        if (!patternCache[p.kind]) patternCache[p.kind] = makePatternTexture(p.kind, p.insertColor);
        const meshy = p.kind === 'mesh-qubo' || p.kind === 'mesh-tejida';
        // OPAQUE (or alpha-tested) so it renders in the opaque pass and the
        // transmission glass actually refracts it — transparent inserts get
        // hidden by the glass and vanish on the dark backdrop.
        insertMat.map = patternCache[p.kind];
        insertMat.transparent = false;
        insertMat.alphaTest = meshy ? 0.5 : 0;      // mesh: discard gaps; films: full sheet
        insertMat.opacity = 1;
        insertMat.needsUpdate = true;
      }
    }
    // re-apply the current slider values against the new preset baselines
    const tRow = document.querySelector('[data-control="transparency"] .gl-visor_control_header .gl-mono_label:last-child');
    const lRow = document.querySelector('[data-control="light"] .gl-visor_control_header .gl-mono_label:last-child');
    applyTransparency(parseFloat(tRow?.textContent) || 60);
    applyLight(parseFloat(lRow?.textContent) || 75);
    wake();   // geometry / material swap → render
  }

  /* info-panel copy per glass symbol (matches the catalog metadata) */
  const INFO = {
    Vc:  { name: 'Vidrio Claro',     type: 'Colores · float · 001',            tags: ['Transparente', 'Sin tinte', 'Disponible'] },
    Va:  { name: 'Vidrio Acanalado', type: 'Colores · reed · 007',             tags: ['Translúcido', 'Flauta lenticular', 'Hero'] },
    Ve:  { name: 'Vidrio Esmerilado',type: 'Colores · acid-etched · 009',      tags: ['Translúcido', 'Satinado', 'Privacidad'] },
    Vd:  { name: 'Vidrio Diamante',  type: 'Colores · facetas · 011',          tags: ['Translúcido', 'Patrón diamante', 'Decorativo'] },
    Vab: { name: 'Acanalado Bronce', type: 'Colores · reed tintado · 014',     tags: ['Translúcido', 'Tinte bronce', 'Tier color'] },
    Gr:  { name: 'Gradient',         type: 'Inserciones · gradiente · 018',    tags: ['Translúcido', 'Transición color', 'Decorativo'] },
    Ds:  { name: 'Dichroic Sunset',  type: 'Inserciones · dicroico · 020',     tags: ['Iridiscente', 'Cambia con la luz', 'Spot color'] },
    In:  { name: 'Interlayer',       type: 'Inserciones · film color · 022',   tags: ['Translúcido', '300 colores', 'Made-to-order'] },
    Aq:  { name: 'Malla SA-Qubo',    type: 'Inserciones · Mallas A · 036',     tags: ['Translúcido', 'Patrón cubo', 'Tier premium'] },
    At:  { name: 'Malla SA-Tejida',  type: 'Inserciones · Mallas A · 039',     tags: ['Translúcido', 'Patrón tejido', 'Tier premium'] },
    Ec:  { name: 'Espejo Claro',     type: 'Reflectivos · silver · 091',       tags: ['Espejo', 'Reflectivo total', 'Decorativo'] },
    Ed:  { name: 'Espejo Diamante',  type: 'Reflectivos · facetas · 098',      tags: ['Espejo', 'Patrón diamante', 'Decorativo'] },
  };
  const infoSymbol = document.querySelector('.gl-visor_panel_info_symbol');
  const infoName = document.querySelector('.gl-visor_panel_info_top .gl-mono:not(.gl-mono_muted)');
  const infoType = document.querySelector('.gl-visor_panel_info_top .gl-mono_muted');
  const infoTags = document.querySelector('.gl-visor_panel_info_tags');
  function updateInfo(sym) {
    const i = INFO[sym];
    if (!i) return;
    if (infoSymbol) infoSymbol.textContent = sym;
    if (infoName) infoName.textContent = i.name;
    if (infoType) infoType.textContent = i.type;
    if (infoTags) infoTags.innerHTML = i.tags.map((t) => '<span class="gl-tag">' + t + '</span>').join('');
  }

  const cells = document.querySelectorAll('.gl-visor_panel_grid .gl-cell');
  cells.forEach((cell) => {
    cell.addEventListener('click', () => {
      const sym = cell.querySelector('.gl-cell_symbol')?.textContent.trim();
      if (!sym || !PRESETS[sym]) return;
      cells.forEach((c) => { c.classList.remove('gl-visor_cell_active'); c.classList.add('gl-cell_filled'); });
      cell.classList.remove('gl-cell_filled');
      cell.classList.add('gl-visor_cell_active');
      applyPreset(sym);
      updateInfo(sym);
    });
  });

  /* ── Resize ────────────────────────────────────────────────────── */
  function resize() {
    const w = mount.clientWidth || mount.offsetWidth;
    const h = mount.clientHeight || mount.offsetHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    wake();   // re-render once at the new size
  }
  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  window.addEventListener('resize', resize);
  resize();

  /* ── Visibility gating ─────────────────────────────────────────── */
  // Pause entirely when scrolled off-screen or the tab is backgrounded.
  const io = new IntersectionObserver((entries) => {
    const visible = entries.some((en) => en.isIntersecting);
    paused = !visible || document.hidden;
    if (paused) stopLoop(); else wake();
  }, { threshold: 0.01 });
  io.observe(mount);
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (paused) stopLoop(); else wake();
  });

  /* ── Render loop (self-parking) ────────────────────────────────── */
  const EPS = 1e-4;
  function tick() {
    const spin = now() < introUntil;
    if (spin) target.y += 0.0022;
    rot.x += (target.x - rot.x) * 0.09;
    rot.y += (target.y - rot.y) * 0.09;
    sample.rotation.x = rot.x;
    sample.rotation.y = rot.y;
    const targetZ = CAM_Z / zoom;
    camera.position.z += (targetZ - camera.position.z) * 0.12;
    renderer.render(scene, camera);

    const moving = dragging || spin
      || Math.abs(target.x - rot.x) > EPS
      || Math.abs(target.y - rot.y) > EPS
      || Math.abs(targetZ - camera.position.z) > EPS;
    if (moving && !paused) {
      frameReq = requestAnimationFrame(tick);
    } else {
      running = false; frameReq = 0;   // park — nothing left to animate
    }
  }

  // start with defaults applied — Va (Acanalado / reeded), the hero material
  applyPreset('Va');
  updateInfo('Va');
  cells.forEach((c) => {
    const s = c.querySelector('.gl-cell_symbol')?.textContent.trim();
    c.classList.toggle('gl-visor_cell_active', s === 'Va');
    c.classList.toggle('gl-cell_filled', s !== 'Va');
  });
  setSlider('transparency', 60);
  setSlider('light', 75);
  wake();   // kick off the intro spin + initial render, then it self-parks

  // debug handle
  window.__visorGlass = { scene, sample, glassMat, insertMat, camera, applyPreset,
    get relief() { return reliefMesh; }, get insert() { return insertLayer; },
    get running() { return running; }, get paused() { return paused; } };
}

/* ============================================================
   Helpers
   ============================================================ */
function now() { return (window.performance && performance.now) ? performance.now() : +new Date(); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

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
  let dl = x + W, dt = H - y;                 // top-left corner
  if (dl >= 0 && dt >= 0 && dl + dt < c) {
    const f = c / Math.max(dl + dt, 1e-4); x = dl * f - W; y = H - dt * f;
  }
  let dr = W - x, db = y + H;                 // bottom-right corner
  if (dr >= 0 && db >= 0 && dr + db < c) {
    const f = c / Math.max(dr + db, 1e-4); x = W - dr * f; y = db * f - H;
  }
  return [x, y];
}

/* Procedural chamfered glass swatch — one solid thin mesh: a grid front
   (flat, or displaced into real reed ribs / diamond facets), a flat back, and
   walled sides that follow the chamfered outline. Triangles that fall entirely
   inside a cut corner are DROPPED (not collapsed) so there's no degenerate
   ghost geometry behind the notch; boundary verts snap to the chamfer line so
   the cut edge stays clean. Genuine geometry — transmission refracts through it
   correctly. UVs are planar for the insert map. */
function makeSwatchGeometry(w, h, t, mode) {
  const W = w / 2, H = h / 2, c = Math.min(w, h) * 0.26;
  const flutes = 18, cells = 9;
  const nx = mode === 'reed' ? 180 : 130;
  const ny = mode === 'diamond' ? 130 : 90;
  const depth = mode === 'reed' ? 0.085 : 0.055;
  const pos = [], uv = [], rem = [], rowLen = nx + 1;

  const frontZ = (x) => {                     // uses final (snapped) x so no edge step
    if (mode === 'reed') return t / 2 + depth * Math.sin(Math.PI * (((x + W) / w * flutes) % 1));
    return t / 2;                             // diamond handled per-vertex below
  };
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
          } else z = frontZ(x);
          rem.push(inChamfer(ox, oy, W, H, c));
        }
        pos.push(x, y, z);
        uv.push((ox + W) / w, (oy + H) / h);
      }
  };
  grid(true);                        // front
  const back = (ny + 1) * rowLen;
  grid(false);                       // back

  const rq = (i, j) => rem[j * rowLen + i];
  const tri = (arr, p, q, r) => { if (!(rq(...p) && rq(...q) && rq(...r))) arr.push(p[1] * rowLen + p[0], q[1] * rowLen + q[0], r[1] * rowLen + r[0]); };
  const idx = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      // front (drop triangles wholly inside a cut corner)
      tri(idx, [i, j], [i, j + 1], [i + 1, j]);
      tri(idx, [i + 1, j], [i, j + 1], [i + 1, j + 1]);
      // back (mirror winding, offset to back grid)
      const bt = [];
      tri(bt, [i, j], [i + 1, j], [i, j + 1]);
      tri(bt, [i + 1, j], [i + 1, j + 1], [i, j + 1]);
      for (const v of bt) idx.push(v + back);
    }
  const F = (i, j) => j * rowLen + i, B = (i, j) => back + j * rowLen + i;
  const wall = (i0, j0, i1, j1) => {          // quad between two perimeter verts (front↔back)
    if (rq(i0, j0) && rq(i1, j1)) return;     // both in cut → skip
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

/* Insert-layer pattern textures — drawn to a canvas, mapped onto the thin
   plane INSIDE the glass. Mesh weaves (Qubo / Tejida), colour interlayer and
   gradient. Transparent where the glass should read clear. */
function makePatternTexture(kind, insertColor) {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.clearRect(0, 0, s, s);

  if (kind === 'mesh-qubo') {
    // crisp fine square grid of wires
    const step = s / 34, wire = step * 0.2;
    g.fillStyle = 'rgba(24,30,36,0.95)';
    for (let x = 0; x <= s; x += step) g.fillRect(x - wire / 2, 0, wire, s);
    for (let y = 0; y <= s; y += step) g.fillRect(0, y - wire / 2, s, wire);
  } else if (kind === 'mesh-tejida') {
    // woven look — finer over/under strands
    const step = s / 26, strand = step * 0.36;
    g.fillStyle = 'rgba(30,36,42,0.92)';
    for (let x = 0; x <= s; x += step) g.fillRect(x - strand / 2, 0, strand, s);
    for (let y = 0; y <= s; y += step) g.fillRect(0, y - strand / 2, s, strand);
    // knock out alternating intersections to fake the weave crossing
    g.globalCompositeOperation = 'destination-out';
    for (let yi = 0, y = 0; y <= s; y += step, yi++)
      for (let xi = 0, x = 0; x <= s; x += step, xi++)
        if ((xi + yi) % 2 === 0) g.fillRect(x - strand / 2 - 1, y - strand / 2 - 1, strand + 2, strand + 2);
    g.globalCompositeOperation = 'source-over';
  } else if (kind === 'gradient') {
    // opaque colour transition (the insert is rendered opaque)
    const lg = g.createLinearGradient(0, 0, s, s);
    lg.addColorStop(0, '#4f9fd8');
    lg.addColorStop(0.5, '#7a63c8');
    lg.addColorStop(1, '#2b4a72');
    g.fillStyle = lg; g.fillRect(0, 0, s, s);
  } else if (kind === 'interlayer') {
    const col = new THREE.Color(insertColor || 0x2f6fb0);
    g.fillStyle = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
    g.fillRect(0, 0, s, s);
  } else if (kind === 'dichroic') {
    // iridescent film — full-strength rainbow bands
    const lg = g.createLinearGradient(0, 0, s, s);
    ['#ff3366', '#ff8800', '#22cc88', '#0088ff', '#8800ff', '#ff3366'].forEach((col, i, a) =>
      lg.addColorStop(i / (a.length - 1), col));
    g.fillStyle = lg; g.fillRect(0, 0, s, s);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* Backdrop the glass refracts: near-black field, a faint thin grid, and one
   thick bright horizontal line. Kept deliberately dark and graphic — no
   gradients — so the flutes read as clean vertical slices of a single light
   bar rather than a colour wash. */
function makeBackdropTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const g = c.getContext('2d');

  // flat dark base
  g.fillStyle = '#0a0b0d';
  g.fillRect(0, 0, c.width, c.height);

  // faint thin grid
  g.strokeStyle = 'rgba(180,205,225,0.05)';
  g.lineWidth = 1;
  for (let x = 64; x < c.width; x += 64) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, c.height); g.stroke(); }
  for (let y = 64; y < c.height; y += 64) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(c.width, y + 0.5); g.stroke(); }

  // a couple of slightly brighter thin accent lines
  g.strokeStyle = 'rgba(200,224,245,0.14)';
  g.lineWidth = 1.5;
  [200, 470].forEach((y) => { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(c.width, y + 0.5); g.stroke(); });

  // the single thick bright line — the highlight the flutes stretch
  g.fillStyle = 'rgba(236,246,255,0.92)';
  g.fillRect(0, 324, c.width, 18);
  // soft bloom just above/below it so the refraction has a little falloff
  g.fillStyle = 'rgba(210,232,250,0.18)';
  g.fillRect(0, 312, c.width, 6);
  g.fillRect(0, 342, c.width, 6);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}
