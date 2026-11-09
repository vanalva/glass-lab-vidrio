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

// The scene the glass refracts: a flat field, a faint thin grid and ONE thick
// horizontal line the flutes stretch. Dark is the approved look; the beige
// variant swaps to a dark ink line on a light field so the glass has something
// to bend there too.
export function makeBackdropTexture(theme) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  const dark = theme !== 'beige';
  g.fillStyle = dark ? '#0a0b0d' : BACKGROUND_COLORS.beige;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = dark ? 'rgba(180,205,225,0.05)' : 'rgba(40,38,30,0.11)';
  g.lineWidth = 1;
  for (let x = 64; x < c.width; x += 64) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, c.height); g.stroke(); }
  for (let y = 64; y < c.height; y += 64) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(c.width, y + .5); g.stroke(); }
  g.strokeStyle = dark ? 'rgba(200,224,245,0.14)' : 'rgba(30,28,22,0.22)';
  g.lineWidth = 1.5;
  [200, 470].forEach(y => { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(c.width, y + .5); g.stroke(); });
  g.fillStyle = dark ? 'rgba(236,246,255,0.92)' : 'rgba(26,25,21,0.94)';
  g.fillRect(0, 307, c.width, 26);
  g.fillStyle = dark ? 'rgba(210,232,250,0.18)' : 'rgba(26,25,21,0.16)';
  g.fillRect(0, 295, c.width, 8);
  g.fillRect(0, 337, c.width, 8);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createBackgroundControls({ renderer, scene, camera, mount, ui, studioEnvironment, wake, listen, coarse }) {
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
  const backdropTextures = { dark: makeBackdropTexture('dark'), beige: makeBackdropTexture('beige') };
  const backdropMaterial = new THREE.MeshBasicMaterial({ map: backdropTextures.dark });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backdropMaterial);
  backdrop.position.z = -3.2;
  scene.add(backdrop);
  // Soft contact shadow so the sample sits on the light field instead of floating.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 256;
  const sg = shadowCanvas.getContext('2d');
  const ramp = sg.createRadialGradient(128, 128, 20, 128, 128, 128);
  ramp.addColorStop(0, 'rgba(26,25,21,0.34)');
  ramp.addColorStop(.55, 'rgba(26,25,21,0.14)');
  ramp.addColorStop(1, 'rgba(26,25,21,0)');
  sg.fillStyle = ramp;
  sg.fillRect(0, 0, 256, 256);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 3.7),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  shadow.position.set(.18, -.3, -.6);
  shadow.visible = false;
  scene.add(shadow);
  let mode = 'dark', blur = 30, source = null, fileName = '';
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
      backdropMaterial.map = backdropTextures[mode];
      backdropMaterial.needsUpdate = true;
      scene.environment = studioEnvironment;
      status.textContent = source ? 'Imagen lista para volver a usar.' : 'La imagen se queda en tu dispositivo.';
      status.removeAttribute('title');
    }
    backdrop.visible = mode !== 'image';
    shadow.visible = mode === 'beige';
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

  function fitBackdrop() {
    // Cover the whole visible frustum at the backdrop's distance.
    const distance = camera.position.z - backdrop.position.z;
    const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom;
    backdrop.scale.set(height * camera.aspect * 1.04, height * 1.04, 1);
  }

  function resize() {
    fitBackdrop();
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

  setMode('dark', false);
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
      scene.remove(backdrop, shadow);
      shadow.geometry.dispose();
      shadow.material.dispose();
      shadowTexture.dispose();
      backdrop.geometry.dispose();
      backdropMaterial.dispose();
      Object.values(backdropTextures).forEach(t => t.dispose());
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
