/* Glass Lab Visor: the approved material study, connected to the existing UI.
 * Optical strength is independent of geometric thickness. Only true laminate
 * stacks separate; surface relief and mirror coatings remain bonded.
 */
import * as THREE from 'three';
import { createSample, presets, CATALOGUE } from './gl-visor-materials.js?v=3';
import { makeQuboStudio } from './gl-visor-weave.js?v=1';
import { createBackgroundControls } from './gl-visor-background.js?v=4';

const clamp = THREE.MathUtils.clamp;
const DEFAULTS = { transparency: 60, distortion: 30, light: 75, 'background-blur': 30 };
let activeViewer;

// A module may stay cached during the site's page transitions. Observe mount
// replacement so a return to Visor starts a new renderer and disposes the old.
function syncMount() {
  const mount = document.getElementById('glass3d');
  if (activeViewer?.mount === mount) return;
  activeViewer?.dispose();
  activeViewer = null;
  if (!mount) return;
  try {
    activeViewer = boot(mount);
  } catch (error) {
    console.error('Glass Lab Visor could not initialize.', error);
    const label = mount.parentElement.querySelector('.gl-visor_scene_label span');
    if (label) label.textContent = 'No se pudo iniciar el visor 3D. Recarga la página con la aceleración gráfica activada.';
    // Do not retry on every unrelated DOM change after a WebGL failure.
    activeViewer = { mount, dispose() {} };
  }
}
new MutationObserver(syncMount).observe(document.body, { childList: true, subtree: true });
syncMount();

function boot(mount) {
  const ui = mount.closest('.gl-visor_viewer');
  const coarse = matchMedia('(pointer: coarse), (max-width: 767px)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const listen = (target, type, callback, options = {}) =>
    target.addEventListener(type, callback, { ...options, signal: events.signal });
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;touch-action:none';
  canvas.setAttribute('aria-label', 'Muestra de vidrio en tres dimensiones');
  canvas.setAttribute('role', 'img');
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.z = 7.2;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = makeQuboStudio();
  const environment = pmrem.fromScene(studio, .035);
  scene.environment = environment.texture;
  disposeObject(studio);
  pmrem.dispose();

  const ambient = new THREE.AmbientLight('#eff0e5', .6);
  const key = new THREE.DirectionalLight('#ffefd2', 2);
  const fill = new THREE.DirectionalLight('#d6e7e3', 1);
  key.position.set(-3, 4, 5);
  fill.position.set(4, 0, 2);
  scene.add(ambient, key, fill);
  const holder = new THREE.Group();
  holder.position.y = 0;
  scene.add(holder);

  const layerTools = document.createElement('div');
  layerTools.className = 'gl-visor_layers is-hidden';
  layerTools.innerHTML = '<span class="gl-mono gl-mono_muted gl-visor_layers_caption"></span>' +
    '<button type="button" class="gl-btn_skew_wrap gl-visor_layers_button" aria-pressed="false">' +
    '<svg class="gl-btn_skew_shape" viewBox="0 0 240 56" preserveAspectRatio="none" fill="none" aria-hidden="true">' +
    '<path d="M16,1 L239,1 L239,42 L224,55 L1,55 L1,14 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter" vector-effect="non-scaling-stroke"/></svg>' +
    '<span class="gl-btn_skew_element gl-btn_skew_element_sm"><span class="gl-btn_skew_text gl-btn_skew_text_sm">Separar capas</span></span></button>';
  mount.parentElement.appendChild(layerTools);
  const layerButton = layerTools.querySelector('button');
  const layerText = layerButton.querySelector('.gl-btn_skew_text');
  const layerCaption = layerTools.querySelector('.gl-visor_layers_caption');
  const sliders = new Map();
  const values = { ...DEFAULTS };
  const cells = [...ui.querySelectorAll('.gl-visor_panel_grid .gl-cell')];
  const cache = new Map();
  let sample, code, zoom = 1, spread = 0, targetSpread = 0, pointer;
  const target = { x: -.12, y: -.34 };
  holder.rotation.set(target.x, target.y, 0);
  let frame = 0, lastTime = 0, inView = true, disposed = false;

  function wake() {
    if (!frame && !disposed && inView && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function setSpread(value) {
    targetSpread = sample?.laminated ? value : 0;
    layerButton.setAttribute('aria-pressed', String(!!targetSpread));
    layerText.textContent = targetSpread ? 'Unir capas' : 'Separar capas';
    if (targetSpread) { target.x = -.17; target.y = -.58; }
    wake();
  }
  listen(layerButton, 'click', () => setSpread(targetSpread ? 0 : 1));
  const backgrounds = createBackgroundControls({ renderer, scene, camera, mount, ui,
    studioEnvironment: environment.texture, wake, listen, coarse });


  function setSlider(control, percent) {
    const value = Math.round(clamp(percent, 0, 100));
    values[control] = value;
    const row = sliders.get(control);
    if (row) {
      row.slider.setAttribute('aria-valuenow', String(value));
      row.slider.setAttribute('aria-valuetext', value + '%');
      row.fill.style.width = value + '%';
      row.thumb.style.left = value + '%';
      row.value.textContent = value + '%';
    }
    if (control === 'transparency') sample?.setClarity?.(value);
    if (control === 'distortion') sample?.setDistortion?.(value);
    if (control === 'background-blur') backgrounds.setBlur(value);
    if (control === 'light') {
      sample?.setLight?.(value);
      key.intensity = .6 + value * .018;
      renderer.toneMappingExposure = .68 + value * .0043;
    }
    wake();
  }

  ui.querySelectorAll('[data-control]').forEach(row => {
    const control = row.dataset.control;
    const slider = row.querySelector('.gl-visor_slider');
    const labels = row.querySelectorAll('.gl-visor_control_header .gl-mono_label');
    if (!slider || !Object.hasOwn(DEFAULTS, control)) return;
    slider.setAttribute('role', 'slider');
    slider.setAttribute('aria-label', labels[0].textContent.trim());
    slider.setAttribute('aria-valuemin', '0');
    slider.setAttribute('aria-valuemax', '100');
    slider.setAttribute('aria-orientation', 'horizontal');
    slider.tabIndex = 0;
    slider.style.cursor = 'pointer';
    sliders.set(control, { row, slider, fill: row.querySelector('.gl-visor_slider_fill'),
      thumb: row.querySelector('.gl-visor_slider_thumb'), value: labels[1] });
    let dragId = null;
    const enabled = () => slider.getAttribute('aria-disabled') !== 'true' && !row.hidden;
    const update = event => {
      const bounds = slider.getBoundingClientRect();
      if (bounds.width) setSlider(control, (event.clientX - bounds.left) / bounds.width * 100);
    };
    listen(slider, 'pointerdown', event => {
      if (!enabled() || event.button !== 0) return;
      dragId = event.pointerId;
      slider.setPointerCapture(dragId);
      slider.focus({ preventScroll: true });
      update(event);
    });
    listen(slider, 'pointermove', event => { if (event.pointerId === dragId) update(event); });
    const end = event => {
      if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
      dragId = null;
    };
    listen(slider, 'pointerup', end);
    listen(slider, 'pointercancel', end);
    listen(slider, 'keydown', event => {
      if (!enabled()) return;
      const steps = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = 100;
      else if (Object.hasOwn(steps, event.key)) next = values[control] + steps[event.key];
      else return;
      event.preventDefault();
      setSlider(control, next);
    });
  });

  function select(symbol, updateUrl = true) {
    if (!presets[symbol]) return;
    if (sample) holder.remove(sample.group);
    code = symbol;
    sample = cache.get(code) || createSample(code, coarse);
    cache.delete(code);
    cache.set(code, sample);
    holder.add(sample.group);
    // Bound retained GPU memory while keeping recently compared samples warm.
    if (cache.size > 4) {
      const oldest = cache.keys().next().value;
      disposeObject(cache.get(oldest).group);
      cache.delete(oldest);
    }
    spread = targetSpread = 0;
    sample.setSeparation?.(0);
    layerTools.classList.toggle('is-hidden', !sample.laminated);
    layerCaption.textContent = sample.construction;
    layerButton.setAttribute('aria-pressed', 'false');
    layerText.textContent = 'Separar capas';
    const distortionRow = sliders.get('distortion');
    if (distortionRow) distortionRow.row.hidden = !sample.distorts;
    const transparency = sliders.get('transparency');
    if (transparency) {
      transparency.slider.setAttribute('aria-disabled', String(!!sample.mirror));
      transparency.slider.tabIndex = sample.mirror ? -1 : 0;
    }
    for (const control of Object.keys(values)) setSlider(control, values[control]);
    cells.forEach(cell => {
      const selected = cell.querySelector('.gl-cell_symbol')?.textContent.trim() === code;
      cell.classList.toggle('gl-visor_cell_active', selected);
      cell.classList.toggle('gl-cell_filled', !selected);
      cell.setAttribute('aria-pressed', String(selected));
    });
    updateInfo(ui, code);
    const detailLink = ui.querySelector('.gl-visor_control_buttons a[href*="gl-vidrio.html"]');
    if (detailLink) detailLink.setAttribute('href', `gl-vidrio.html?code=${encodeURIComponent(code)}`);
    canvas.setAttribute('aria-label', `Muestra 3D: ${CATALOGUE[code].name}`);
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('glass', code);
      history.replaceState(null, '', url);
    }
    wake();
  }
  cells.forEach(cell => {
    cell.setAttribute('role', 'button');
    cell.tabIndex = 0;
    const symbol = cell.querySelector('.gl-cell_symbol')?.textContent.trim();
    cell.setAttribute('aria-label', `${symbol} · ${CATALOGUE[symbol]?.name || symbol}`);
    listen(cell, 'click', event => { event.preventDefault(); select(symbol); });
    listen(cell, 'keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(symbol); }
    });
  });

  ui.querySelectorAll('[data-action]').forEach(button => listen(button, 'click', event => {
    event.preventDefault();
    const step = Math.PI / 12;
    switch (button.dataset.action) {
      case 'rotate-left': target.y -= step; break;
      case 'rotate-right': target.y += step; break;
      case 'rotate-up': target.x = clamp(target.x - step, -1.5, 1.5); break;
      case 'rotate-down': target.x = clamp(target.x + step, -1.5, 1.5); break;
      case 'zoom': zoom = zoom > 1.6 ? 1 : zoom + .35; resize(); break;
      case 'zoom-in': zoom = clamp(zoom + .25, .7, 2); resize(); break;
      case 'zoom-out': zoom = clamp(zoom - .25, .7, 2); resize(); break;
      case 'reset':
        target.x = -.12; target.y = -.34; zoom = 1;
        setSpread(0);
        Object.entries(DEFAULTS).forEach(([control, value]) => setSlider(control, value));
        resize(); break;
    }
    wake();
  }));

  const touches = new Map();
  let pinch = 0;
  const pinchDistance = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  listen(canvas, 'pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) { pinch = pinchDistance(); pointer = null; return; }
    if (touches.size > 2 || pointer) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.style.cursor = 'grabbing';
  });
  listen(canvas, 'pointermove', event => {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2 && pinch) {
      const next = pinchDistance();
      zoom = clamp(zoom * next / pinch, .7, 2);
      pinch = next;
      resize();
      return;
    }
    if (!pointer || pointer.id !== event.pointerId) return;
    target.y += (event.clientX - pointer.x) * .007;
    target.x = clamp(target.x + (event.clientY - pointer.y) * .007, -1.5, 1.5);
    pointer.x = event.clientX; pointer.y = event.clientY;
    wake();
  });
  const release = event => {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    touches.delete(event.pointerId);
    if (touches.size < 2) pinch = 0;
    if (pointer?.id === event.pointerId) pointer = null;
    canvas.style.cursor = 'grab';
  };
  listen(canvas, 'pointerup', release);
  listen(canvas, 'pointercancel', release);
  listen(canvas, 'wheel', event => {
    event.preventDefault();
    zoom = clamp(zoom - event.deltaY * .0006, .7, 2);
    resize();
  }, { passive: false });

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Frame the whole sample (3 x 2.15 plus tilt) with margin at any aspect.
    camera.zoom = zoom * Math.min(1.08, camera.aspect * (camera.aspect < 1 ? 1.05 : .9));
    camera.updateProjectionMatrix();
    backgrounds.resize();
    wake();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);
  const intersectionObserver = new IntersectionObserver(entries => {
    inView = entries.some(entry => entry.isIntersecting);
    if (inView) wake(); else stop();
  }, { threshold: .01 });
  intersectionObserver.observe(mount);
  listen(document, 'visibilitychange', () => { if (document.hidden) stop(); else wake(); });

  function tick(time) {
    frame = 0;
    if (disposed || !mount.isConnected || !inView || document.hidden) return;
    const dt = Math.min(.05, (time - lastTime) / 1000 || .016);
    lastTime = time;
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 10);
    holder.rotation.x += (target.x - holder.rotation.x) * ease;
    holder.rotation.y += (target.y - holder.rotation.y) * ease;
    if (spread !== targetSpread) {
      spread += (targetSpread - spread) * ease;
      if (Math.abs(spread - targetSpread) < .001) spread = targetSpread;
      sample.setSeparation?.(spread);
    }
    renderer.render(scene, camera);
    if (Math.abs(target.x - holder.rotation.x) > .0001 ||
        Math.abs(target.y - holder.rotation.y) > .0001 || spread !== targetSpread) wake();
    else lastTime = 0;
  }

  const settings = ui.querySelector('.gl-visor_settings');
  if (settings) {
    const phone = matchMedia('(max-width: 767px)');
    const syncSettings = () => { settings.open = !phone.matches; };
    syncSettings();
    listen(phone, 'change', syncSettings);
  }

  const requested = new URLSearchParams(location.search).get('glass');
  select(presets[requested] ? requested : 'Va', false);
  resize();
  return {
    mount,
    dispose() {
      disposed = true;
      stop();
      events.abort();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      cache.forEach(value => disposeObject(value.group));
      cache.clear();
      backgrounds.dispose();
      environment.dispose();
      renderer.dispose();
      canvas.remove();
      layerTools.remove();
    },
  };
}

function updateInfo(ui, code) {
  const product = CATALOGUE[code];
  const categories = { colores: 'Colores', inserciones: 'Inserciones', reflectivos: 'Reflectivos' };
  const transparency = { transparente: 'Transparente', translucido: 'Translúcido', semitransparente: 'Semitransparente', espejo: 'Espejo' };
  const finishes = { Vc: 'Vidrio float', Va: 'Acanalado', Ve: 'Satinado', Vd: 'Patrón diamante', Vab: 'Tinte bronce',
    Gr: 'Transición de color', Ds: 'Película dicroica', In: '300 colores', Aq: 'Malla metálica', At: 'Malla metálica', Ec: 'Reflectante', Ed: 'Patrón diamante' };
  ui.querySelector('.gl-visor_panel_info_symbol').textContent = code;
  ui.querySelector('.gl-visor_panel_info_top .gl-mono:not(.gl-mono_muted)').textContent = product.name;
  ui.querySelector('.gl-visor_panel_info_top .gl-mono_muted').textContent =
    `${categories[product.category]} · ${finishes[code]} · ${String(product.slot).padStart(3, '0')}`;
  const tags = ui.querySelector('.gl-visor_panel_info_tags');
  tags.replaceChildren(...[transparency[product.attributes.transparencia], finishes[code],
    product.attributes.espesorMm.join(' / ') + ' mm'].map(text => {
    const span = document.createElement('span'); span.className = 'gl-tag'; span.textContent = text; return span;
  }));
}

function disposeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const retainMaterial = material => {
    materials.add(material);
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  };
  (root.userData.resourceMaterials || []).forEach(retainMaterial);
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
      retainMaterial(material);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}
