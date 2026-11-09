import * as THREE from 'three';

export const BACKGROUND_COLORS = { dark: '#0b0b0b', beige: '#cec8bb' };

// Equivalent to CSS object-fit: cover. Three's native screen background uses
// this UV transform directly; camera zoom never changes its coverage.
export function coverTransform(imageWidth, imageHeight, viewWidth, viewHeight) {
  const imageAspect = imageWidth / imageHeight;
  const viewAspect = viewWidth / viewHeight;
  const x = Math.min(1, viewAspect / imageAspect);
  const y = Math.min(1, imageAspect / viewAspect);
  return { x, y, offsetX: (1 - x) / 2, offsetY: (1 - y) / 2 };
}

export function createBackgroundControls({ renderer, scene, mount, ui, studioEnvironment, wake, listen, coarse }) {
  const stage = mount.parentElement;
  const options = [...ui.querySelectorAll('[data-background-mode]')];
  const upload = ui.querySelector('[data-background-upload]');
  const input = ui.querySelector('[data-background-file]');
  const status = ui.querySelector('[data-background-status]');
  const blurRow = ui.querySelector('[data-control="background-blur"]');
  const pmrem = new THREE.PMREMGenerator(renderer);
  // Draw beige through the native screen background, including the transmission
  // pass. A clear color skips that pass's color conversion in Three r160.
  // Linear data keeps tone mapping consistent outside and through the glass.
  const beigeColor = new THREE.Color(BACKGROUND_COLORS.beige);
  const beigeBackground = new THREE.DataTexture(new Uint8Array([
    Math.round(beigeColor.r * 255), Math.round(beigeColor.g * 255),
    Math.round(beigeColor.b * 255), 255,
  ]), 1, 1);
  beigeBackground.colorSpace = THREE.LinearSRGBColorSpace;
  beigeBackground.needsUpdate = true;
  let mode = 'beige', blur = 30, source = null, fileName = '';
  let backgroundTexture = null, imageEnvironment = null;
  let generation = 0, timer = 0, disposed = false;
  const pendingUrls = new Set();

  function syncStyle() {
    stage.dataset.background = mode;
    const light = mode === 'beige' || (mode === 'image' && source?.light);
    const color = light ? BACKGROUND_COLORS.beige : BACKGROUND_COLORS.dark;
    stage.style.backgroundColor = color;
    stage.style.setProperty('--_theme---background', color);
    stage.style.setProperty('--_theme---text', light ? '#353931' : '#e8e7dd');
    options.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.backgroundMode === mode));
      if (button.dataset.backgroundMode === 'image') button.disabled = !source;
    });
    blurRow.hidden = mode !== 'image';
  }

  function setMode(next, cancelPending = true) {
    if (next === 'image' && !source) return;
    if (!['dark', 'beige', 'image'].includes(next)) return;
    if (cancelPending) generation++;
    mode = next;
    if (mode === 'image') {
      if (!backgroundTexture) rebuildImage();
      scene.background = backgroundTexture;
      scene.environment = imageEnvironment.texture;
      status.textContent = fileName;
      status.title = fileName;
    } else {
      scene.background = mode === 'beige' ? beigeBackground : new THREE.Color(BACKGROUND_COLORS.dark);
      scene.environment = studioEnvironment;
      status.textContent = source ? 'Imagen lista para volver a usar.' : 'La imagen se queda en tu dispositivo.';
      status.removeAttribute('title');
    }
    syncStyle();
    resize();
    wake();
  }

  function rebuildImage() {
    if (!source || disposed) return;
    const blurred = blurImage(source.canvas, blur);
    const nextBackground = new THREE.CanvasTexture(blurred);
    nextBackground.colorSpace = THREE.SRGBColorSpace;
    const reflectionSource = new THREE.CanvasTexture(blurred);
    reflectionSource.colorSpace = THREE.SRGBColorSpace;
    reflectionSource.mapping = THREE.EquirectangularReflectionMapping;
    // A 360-degree panorama is the most faithful source. Ordinary photographs
    // are also accepted as an approximate surrounding light/reflection field.
    let nextEnvironment;
    try {
      nextEnvironment = pmrem.fromEquirectangular(reflectionSource);
    } catch (error) {
      nextBackground.dispose();
      throw error;
    } finally {
      reflectionSource.dispose();
    }
    const previousBackground = backgroundTexture, previousEnvironment = imageEnvironment;
    backgroundTexture = nextBackground;
    imageEnvironment = nextEnvironment;
    if (mode === 'image') {
      scene.background = backgroundTexture;
      scene.environment = imageEnvironment.texture;
    }
    previousBackground?.dispose();
    previousEnvironment?.dispose();
    resize();
    wake();
  }

  function resize() {
    if (!backgroundTexture || !mount.clientWidth || !mount.clientHeight) return;
    const t = coverTransform(source.canvas.width, source.canvas.height, mount.clientWidth, mount.clientHeight);
    backgroundTexture.repeat.set(t.x, t.y);
    backgroundTexture.offset.set(t.offsetX, t.offsetY);
    backgroundTexture.updateMatrix();
  }

  listen(upload, 'click', () => input.click());
  options.forEach(button => listen(button, 'click', () => setMode(button.dataset.backgroundMode)));
  listen(input, 'change', async () => {
    const file = input.files?.[0];
    input.value = ''; // Choosing the same file again must still fire change.
    if (!file) return;
    const request = ++generation;
    const allowed = /^image\/(jpeg|png|webp|avif)$/i.test(file.type) ||
      (!file.type && /\.(jpe?g|png|webp|avif)$/i.test(file.name));
    if (!allowed || file.size > 20 * 1024 * 1024) {
      status.textContent = allowed ? 'Elige una imagen de hasta 20 MB.' : 'Usa una imagen JPG, PNG, WebP o AVIF.';
      return;
    }
    status.textContent = 'Cargando imagen…';
    const url = URL.createObjectURL(file);
    pendingUrls.add(url);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (disposed || request !== generation) return;
      const nextSource = normalizeImage(image, coarse ? 1024 : 1536);
      const previousSource = source;
      source = nextSource;
      try { rebuildImage(); } catch (error) { source = previousSource; throw error; }
      fileName = file.name;
      setMode('image', false);
    } catch (error) {
      if (!disposed && request === generation) {
        status.textContent = 'No se pudo abrir esa imagen. Prueba con otra.';
        console.warn('Visor background image could not be decoded or prepared.', error);
      }
    } finally {
      URL.revokeObjectURL(url);
      pendingUrls.delete(url);
    }
  });

  setMode('beige', false);
  return {
    resize,
    setBlur(percent) {
      const next = THREE.MathUtils.clamp(percent, 0, 100);
      if (next === blur) return;
      blur = next;
      clearTimeout(timer);
      if (!source) return;
      // Avoid regenerating the reflection map on every pointer-move event.
      timer = setTimeout(() => {
        timer = 0;
        if (disposed) return;
        try { rebuildImage(); } catch (error) {
          status.textContent = 'No se pudo actualizar el desenfoque.';
          console.warn('Visor background blur could not be prepared.', error);
        }
      }, 100);
    },
    dispose() {
      disposed = true;
      generation++;
      clearTimeout(timer);
      pendingUrls.forEach(url => URL.revokeObjectURL(url));
      pendingUrls.clear();
      backgroundTexture?.dispose();
      imageEnvironment?.dispose();
      beigeBackground.dispose();
      pmrem.dispose();
      source = null;
      scene.background = null;
      scene.environment = null;
    },
  };
}

function normalizeImage(image, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BACKGROUND_COLORS.beige;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const sample = document.createElement('canvas');
  sample.width = sample.height = 8;
  const sampleCtx = sample.getContext('2d');
  sampleCtx.drawImage(canvas, 0, 0, 8, 8);
  const pixels = sampleCtx.getImageData(0, 0, 8, 8).data;
  let luminance = 0;
  for (let i = 0; i < pixels.length; i += 4) luminance += .2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
  return { canvas, light: luminance / 64 > 145 };
}

function blurImage(source, percent) {
  const w = source.width, h = source.height;
  const radius = Math.max(w, h) * .022 * percent / 100;
  const pad = Math.ceil(radius * 3) + 2;
  const padded = document.createElement('canvas');
  padded.width = w + pad * 2; padded.height = h + pad * 2;
  const p = padded.getContext('2d');
  // Extend edge pixels before blurring so the viewport never picks up a dark
  // or transparent border. This keeps the original image crop unchanged.
  p.drawImage(source, pad, pad);
  p.drawImage(source, 0, 0, w, 1, pad, 0, w, pad);
  p.drawImage(source, 0, h-1, w, 1, pad, pad+h, w, pad);
  p.drawImage(source, 0, 0, 1, h, 0, pad, pad, h);
  p.drawImage(source, w-1, 0, 1, h, pad+w, pad, pad, h);
  for (const [sx,sy,dx,dy] of [[0,0,0,0],[w-1,0,pad+w,0],[0,h-1,0,pad+h],[w-1,h-1,pad+w,pad+h]])
    p.drawImage(source, sx, sy, 1, 1, dx, dy, pad, pad);
  const result = document.createElement('canvas');
  result.width = w; result.height = h;
  const ctx = result.getContext('2d');
  ctx.filter = radius > 0 ? `blur(${radius}px)` : 'none';
  ctx.drawImage(padded, -pad, -pad);
  return result;
}
