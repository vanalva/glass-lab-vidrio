/* ════════════════════════════════════════════════════════════════════
   gl-wavy-bend.js  v2
   Pixel-row horizontal displacement on text, à la StringTune.
   Rasterises the target element to a WebGL2 texture and runs a
   fragment shader that shifts each row of pixels by a sin curve.
   Driven by ScrollTrigger — wave amplitude peaks at viewport edges,
   settles to zero when centered.
   Requires GSAP + ScrollTrigger.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  /* Skip the per-heading WebGL wave on phones / tablets / any touch device
     (incl. an iPad Pro reporting desktop width): rasterising every heading
     to a GL texture is a real GPU cost on mobile, and the effect double-
     renders when a heading wraps to multiple lines (the canvas overlay sits
     on top of the still-visible DOM text). The crisp DOM heading is the
     correct fallback. */
  if (window.matchMedia('(max-width: 991px)').matches
      || window.matchMedia('(hover: none)').matches
      || window.matchMedia('(pointer: coarse)').matches) return;

  // Auto-apply to: any <h1>, any explicit .gl-wavy-bend, any display-class heading
  // by class-name pattern. Opt out per-element with .gl-no-wavy.
  const SELECTOR = [
    'h1',
    '.gl-wavy-bend',
    '[class*="hero_title"]',
    '[class*="hero_heading"]',
    '[class*="cta_heading"]',
    '[class*="page-header_title"]',
    '[class*="header_title"]',
    '[class*="interlude_heading"]',
    '.gl-values_word',
  ].join(', ');

  // Only apply when computed font-size is at or above this px threshold
  // (filters out small h1s in menus, modals, mobile, etc.)
  const MIN_FONT_SIZE_PX = 48;

  const boot = () => {
    waitFonts().then(() => {
      // Defer 800ms so other animation libs that mutate textContent
      // (SplitText, gsap-word splitters, etc.) finish their DOM rewriting first.
      // Elements they've touched will then have children and we'll skip them —
      // we won't fight existing animations for the same heading.
      setTimeout(scan, 800);
    });
  };

  // Lazy-init via IntersectionObserver. A generous rootMargin means each
  // element gets initialized while still ~1.2 viewport heights away from
  // entering view — so by the time the user actually scrolls to it, the
  // heavy work (rasterize + texture upload + shader warm-up) is done.
  // This converts a single ~300ms synchronous block at scan() into a
  // sequence of cheap per-element jobs spread across scroll time.
  const initQueue = [];
  let pumping = false;
  const pump = () => {
    if (pumping) return;
    pumping = true;
    const tick = () => {
      const el = initQueue.shift();
      if (el) {
        setupOne(el);
        // Hand back to the browser for a frame so other work can happen.
        requestAnimationFrame(tick);
      } else {
        pumping = false;
      }
    };
    requestAnimationFrame(tick);
  };

  const observer = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          initQueue.push(entry.target);
        }
        pump();
      }, { rootMargin: '1200px 0px 1200px 0px' })
    : null;

  const scan = () => {
    document.querySelectorAll(SELECTOR).forEach((el) => {
      if (el.dataset.glWavyInited === '1') return;
      if (el.classList.contains('gl-no-wavy')) return;
      // Skip elements that have child elements — they're likely pre-split
      // by another animation library and our canvas would be destroyed.
      if (el.children.length > 0) return;
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      if (!isFinite(fontSize) || fontSize < MIN_FONT_SIZE_PX) return;
      if (!el.textContent || !el.textContent.trim()) return;
      if (observer) {
        observer.observe(el);
      } else {
        setupOne(el);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function waitFonts() {
    return (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  }

  function setupOne(host) {
    if (host.dataset.glWavyInited === '1') return;
    host.dataset.glWavyInited = '1';

    // Capture the true text colour NOW, before the first rasterise hides the
    // DOM text via `color: transparent`. Every rasterise (re-run on font load
    // and on resize) draws with this captured colour — reading the live
    // computed colour after the hide would draw the text invisibly and upload
    // a blank texture (the words would vanish entirely).
    const textColor = getComputedStyle(host).color;

    // Amplitude is a fraction of element width so the effect scales with heading size
    // (a 600px-wide subheading and a 1500px-wide hero get proportional pull, not the same
    // absolute pixel shift).
    const AMPLITUDE_FRACTION = parseFloat(host.dataset.glWavyAmplitude || 0.05);
    const BAND_HEIGHT  = parseFloat(host.dataset.glWavyBand    || 0.16);  // band thickness as fraction of canvas height
    const BIAS_Y       = parseFloat(host.dataset.glWavyBiasY   || 4.4);   // Y falloff power
    const BIAS_X       = parseFloat(host.dataset.glWavyBiasX   || 0.3);   // X falloff power
    const WAVE_COUNT   = parseInt  (host.dataset.glWavyCount   || 1, 10); // stacked sweep bands
    const WAVE_OFFSET  = parseFloat(host.dataset.glWavyOffset  || 0.5);   // Y spacing between stacked bands
    const WAVE_FALLOFF = parseFloat(host.dataset.glWavyFalloff || 0.6);   // each next band intensity factor

    // Ensure host is a positioning context for the canvas
    const hostCS = getComputedStyle(host);
    if (hostCS.position === 'static') host.style.position = 'relative';

    const PAD_Y = 16; // small vertical buffer

    // Canvas overlay — extends PAD_Y above/below and PAD_X left/right of the
    // heading. The horizontal pad is essential: the shader displaces pixel
    // rows sideways, so without room the rightmost glyph gets pushed past the
    // canvas edge and clamp-smeared away (looked like the last letter was
    // missing). PAD_X is sized to the wave amplitude in rasterise().
    // (Removed transform: translateZ(0) + will-change: opacity here —
    // they promoted the canvas to its own GPU layer, which broke the
    // view-transition snapshot: WebGL canvases on separate compositor
    // layers render as white in the snapshot.)
    const canvas = document.createElement('canvas');
    canvas.className = 'gl-wavy-bend_canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `position:absolute; top:${-PAD_Y}px; bottom:${-PAD_Y}px; height:calc(100% + ${PAD_Y * 2}px); pointer-events:none; opacity:0;`;
    host.appendChild(canvas);

    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
    if (!gl) return;

    // Compile shaders
    const program = makeProgram(gl, VERT_SRC, FRAG_SRC);
    if (!program) return;

    const uTex         = gl.getUniformLocation(program, 'uTex');
    const uRes         = gl.getUniformLocation(program, 'uRes');
    const uProgress    = gl.getUniformLocation(program, 'uProgress');
    const uAmplitudePx = gl.getUniformLocation(program, 'uAmplitudePx');
    const uBandHeight  = gl.getUniformLocation(program, 'uBandHeight');
    const uBiasY       = gl.getUniformLocation(program, 'uBiasY');
    const uBiasX       = gl.getUniformLocation(program, 'uBiasX');
    const uWaveCount   = gl.getUniformLocation(program, 'uWaveCount');
    const uWaveOffset  = gl.getUniformLocation(program, 'uWaveOffset');
    const uWaveFalloff = gl.getUniformLocation(program, 'uWaveFalloff');

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let texW = 0, texH = 0;
    let cssW = 0, cssH = 0;
    let ampPx = 0;       // wave amplitude in CSS px, derived from host width
    let progress = 0;
    let textHidden = false;

    const render = () => {
      if (!texW || !texH) return;
      gl.viewport(0, 0, texW, texH);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uTex, 0);
      gl.uniform2f(uRes, texW, texH);
      gl.uniform1f(uProgress, progress);
      gl.uniform1f(uAmplitudePx, ampPx);
      gl.uniform1f(uBandHeight, BAND_HEIGHT);
      gl.uniform1f(uBiasY, BIAS_Y);
      gl.uniform1f(uBiasX, BIAS_X);
      gl.uniform1i(uWaveCount, WAVE_COUNT);
      gl.uniform1f(uWaveOffset, WAVE_OFFSET);
      gl.uniform1f(uWaveFalloff, WAVE_FALLOFF);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const rasterise = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = host.getBoundingClientRect();
      const hostW = rect.width;
      const hostH = rect.height;
      if (hostW < 1 || hostH < 1) return Promise.resolve();
      // Amplitude scales with host width; pad horizontally by amplitude + a
      // small buffer so the displaced rightmost glyph never leaves the canvas.
      ampPx = hostW * AMPLITUDE_FRACTION;
      // Measure how wide the text ACTUALLY renders in a 2D canvas context and
      // pad to fit the wider of {DOM width, canvas width}. On a cold cache the
      // canvas can fall back to a wider system font before the webfont (Roobert)
      // finishes loading, rendering the word wider than the DOM measured the
      // host — without this headroom the rightmost glyph is drawn past the
      // canvas edge and clamp-smeared away (the "cropped until reload" bug).
      const textW = measureCanvasTextWidth(host, hostW);
      const overflowX = Math.max(0, textW - hostW);
      const PAD_X = Math.ceil(ampPx + overflowX) + 8;
      cssW = hostW + PAD_X * 2;
      cssH = hostH + PAD_Y * 2;
      canvas.style.left  = `${-PAD_X}px`;
      canvas.style.right = `${-PAD_X}px`;
      canvas.style.width = `calc(100% + ${PAD_X * 2}px)`;
      texW = Math.ceil(cssW * dpr);
      texH = Math.ceil(cssH * dpr);
      canvas.width = texW;
      canvas.height = texH;

      const off = drawTextToCanvas(host, cssW, cssH, dpr, PAD_X, PAD_Y, textColor);
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Warm up GPU pipeline: do a couple of renders at different
        // progress values so the driver JIT-compiles the shader for all
        // branches before the user's first scroll-driven frame.
        progress = 0.0; render();
        progress = 0.25; render();
        progress = 0.75; render();
        progress = 0.0; render();
        gl.flush();
        if (!textHidden) {
          host.style.color = 'transparent';
          canvas.style.opacity = '1';
          textHidden = true;
        }
      } catch (e) {
        console.warn('[gl-wavy-bend] upload failed', e);
      }
      return Promise.resolve();
    };

    // Rasterise now for a prompt first paint, then AGAIN once the exact font
    // this heading uses is guaranteed loaded. The boot-time document.fonts.ready
    // races on a cold cache (it can resolve before the webfont request is even
    // issued), so the first rasterise may capture fallback-font metrics. Redoing
    // it after an explicit per-heading font load makes the wave geometry match
    // the DOM and closes the crop entirely.
    rasterise().catch(() => {});
    if (document.fonts && document.fonts.load) {
      const cs0 = getComputedStyle(host);
      const fontSpec = `${cs0.fontStyle} ${cs0.fontWeight} ${parseFloat(cs0.fontSize)}px ${cs0.fontFamily}`;
      document.fonts.load(fontSpec, host.textContent)
        .then(() => rasterise())
        .catch(() => {});
    }

    const trigger = window.ScrollTrigger.create({
      trigger: host,
      start: 'top bottom',
      end:   'bottom top',
      scrub: 0.6,
      onUpdate: (self) => {
        progress = self.progress;
        render();
      },
    });

    // Re-rasterise on resize (debounced)
    let resizeId = null;
    window.addEventListener('resize', () => {
      if (resizeId) clearTimeout(resizeId);
      resizeId = setTimeout(() => {
        rasterise().then(() => window.ScrollTrigger.refresh()).catch(() => {});
      }, 220);
    });
  }

  /* ── helpers ──────────────────────────────────────────────────────── */

  function drawTextToCanvas(host, cssW, cssH, dpr, padX, padY, color) {
    const off = document.createElement('canvas');
    off.width  = Math.ceil(cssW * dpr);
    off.height = Math.ceil(cssH * dpr);
    const ctx = off.getContext('2d');
    ctx.scale(dpr, dpr);

    const cs = getComputedStyle(host);
    const fontSize  = parseFloat(cs.fontSize);
    const lineHeight = cs.lineHeight === 'normal'
      ? fontSize * 1.2
      : parseFloat(cs.lineHeight) || fontSize * 1.2;
    const fontWeight = cs.fontWeight;
    const fontStyle  = cs.fontStyle;
    const fontFamily = cs.fontFamily;
    const innerW = cssW - padX * 2;  // host's actual visible width
    const innerH = cssH - padY * 2;  // host's actual visible height

    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color || cs.color;
    ctx.textBaseline = 'top';
    if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing;

    const align = cs.textAlign === 'center' ? 'center'
                : cs.textAlign === 'right'  ? 'right'
                : cs.textAlign === 'end'    ? 'right'
                : 'left';
    ctx.textAlign = align;

    const lines = wrapText(ctx, host.textContent, innerW);
    const totalH = lines.length * lineHeight;
    // Center text vertically within the host's visible area, offset by padY
    const startY = padY + Math.max(0, (innerH - totalH) / 2) + (lineHeight - fontSize) / 2;

    // Offset horizontally by padX so the text sits in the host's region,
    // leaving the pad zones on both sides as displacement headroom.
    let x;
    if (align === 'center')      x = padX + innerW / 2;
    else if (align === 'right')  x = padX + innerW;
    else                          x = padX;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, startY + i * lineHeight);
    }
    return off;
  }

  // Widest line the text renders at in a 2D canvas context, using the host's
  // computed font. Compared against the DOM width in rasterise() so the canvas
  // is padded to fit whichever is wider — guards against a canvas-vs-DOM font
  // metric mismatch (webfont still loading) clipping the rightmost glyph.
  function measureCanvasTextWidth(host, maxWidth) {
    const cs = getComputedStyle(host);
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return 0;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing;
    let w = 0;
    for (const line of wrapText(ctx, host.textContent, maxWidth)) {
      w = Math.max(w, ctx.measureText(line).width);
    }
    return w;
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function makeProgram(gl, vertSrc, fragSrc) {
    const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('[gl-wavy-bend] link error', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[gl-wavy-bend] shader compile error', gl.getShaderInfoLog(sh), src);
      return null;
    }
    return sh;
  }

  const VERT_SRC = `#version 300 es
    precision highp float;
    const vec2 V[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
    void main() { gl_Position = vec4(V[gl_VertexID], 0.0, 1.0); }`;

  const FRAG_SRC = `#version 300 es
    precision highp float;
    out vec4 o;
    uniform sampler2D uTex;
    uniform vec2  uRes;
    uniform float uProgress;
    uniform float uAmplitudePx;
    uniform float uBandHeight;
    uniform float uBiasY;
    uniform float uBiasX;
    uniform int   uWaveCount;
    uniform float uWaveOffset;
    uniform float uWaveFalloff;

    float bandMask(float y, float centerY) {
      float d = abs(y - centerY);
      float t = clamp(d / max(1e-6, uBandHeight), 0.0, 1.0);
      return pow(1.0 - t, uBiasY);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;

      // Total accumulated horizontal displacement across all stacked bands
      float total_dx = 0.0;

      // Band sweeps the text TWICE: once during entry (progress 0→0.5) and once during
      // exit (progress 0.5→1.0). At progress 0.5 the heading is centered in the viewport,
      // so the band is parked outside the text (transition is invisible since both ends
      // of the wrap are off-text). Result: clean text when centered, wave when entering/exiting.
      float p = (uProgress < 0.5)
        ? uProgress * 2.0
        : (uProgress - 0.5) * 2.0;
      float sweep = mix(1.3, -0.3, p);

      for (int i = 0; i < 8; i++) {
        if (i >= uWaveCount) break;
        float fi = float(i);
        float centerY = sweep - fi * uWaveOffset;
        float intensity = pow(uWaveFalloff, fi);

        float mV = bandMask(uv.y, centerY);

        float dxDir = sign(uv.x - 0.5);
        float distX = abs(uv.x - 0.5);
        float mH = pow(clamp(distX / 0.5, 0.0, 1.0), uBiasX);

        float dx = -(uAmplitudePx / uRes.x) * mV * mH * dxDir * intensity;
        total_dx += dx;
      }

      vec2 sampleUV = vec2(clamp(uv.x + total_dx, 0.0, 1.0), uv.y);
      o = texture(uTex, sampleUV);
    }`;
})();
