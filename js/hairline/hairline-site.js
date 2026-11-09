/**
 * hairline-site: the shared interaction layer for Hairline figures on a real page.
 * Needs the Hairline kernel loaded first (global HL). Exposes window.HairlineSite.
 *
 *   HairlineSite.mount(el, figure, opts) -> { destroy }
 *   HairlineSite.figures                 registry: a figure file does `HairlineSite.figures.rail = {...}`
 *
 * WHAT THE RUNTIME OWNS (a figure never touches any of this)
 *   - DOM: inside `el` it builds a stage (data-hairline, an svg viewBox 400x320) and, below it,
 *     a meta row with the hint caption and the read-out text (both outside the drawing).
 *   - Sizing: desktop up to 900px wide; at <=767px full-bleed (edge to edge, no card) and the
 *     viewBox is cropped to the drawing's rest bounds + a margin, so the object fills the width.
 *     Coordinates stay the SAME 400x320 world; only the visible window shrinks.
 *   - Theme: light/dark through the kernel (ancestor [data-theme="dark"], .dark, or the page's
 *     color-scheme). opts.theme = "light" | "dark" forces one.
 *   - Input, all in viewBox units: mouse hover, press/drag/release/tap with velocity, and the
 *     TOUCH CLAIM: a touch that starts where figure.hit(p) is true gets preventDefault() on its
 *     non-passive touchstart/touchmove, so the page cannot scroll in any direction for that whole
 *     gesture. A touch that starts anywhere else scrolls the page normally.
 *   - Scroll peek (devices with no hover, not under reduced motion): t goes 0 -> 1 as the
 *     stage's centre rises from 75% to 50% of the viewport height, then 1 -> 0 by 25%.
 *     It turns itself off for the instance after the first real press.
 *   - destroy(): every listener/observer removed, svg emptied, DOM restored.
 *
 * THE FIGURE CONTRACT
 *   figure = {
 *     name:  "rail",                 // data-hairline value
 *     title: "Puerta corrediza",     // for the page that lists figures (the runtime does not draw it)
 *     hint:  "Arrastra ...",         // one short Spanish line, drawn under the stage (opts.hint overrides, false hides)
 *     label: "...",                  // aria-label of the stage
 *     bounds: [x, y, w, h],          // optional: rest extents in viewBox units (else measured with getBBox after mount)
 *     mount(ctx, api) -> fig
 *   }
 *   ctx = { svg, stage, read(text), reduced() }
 *       svg     draw into it with HL.mk (viewBox is managed by the runtime; never set it)
 *       stage   pass to HL.register(ctx.stage, tick) for the frame loop; springs and tweens stay HL's
 *       read    sets the read-out text ("cerrada 40%")
 *       reduced true under prefers-reduced-motion
 *   api = { refit() }  call after the drawing's extents change for good (rare)
 *   fig = { hit(p), hover(p|null), peek(t), press(p), drag(p, d), release(v), tap(p), destroy() }
 *       p        [x, y] in viewBox units (the 400x320 world, even when cropped)
 *       hit(p)   true if a press at p starts a gesture. Be generous (about 10 units of slop for a finger).
 *                This also decides the touch claim and the grab cursor.
 *       hover(p) mouse only, any position over the stage (check hit(p) yourself); null when it leaves or a press starts. A small PEEK, never the action.
 *       peek(t)  0..1 scroll-scrubbed peek (touch). Called with 0 once when the first press turns it off.
 *       press(p) a gesture started on the object (before any movement: record your start state here).
 *       drag(p, d) every move after the slop. d = { dx, dy, x0, y0 } = displacement and start point, viewBox units.
 *       release(v) a drag ended. v = { x, y } velocity in viewBox units/second (0,0 if it stopped before lifting, or was cancelled).
 *       tap(p)   a press that never moved ended: the click/tap action.
 *       destroy  tear down everything the figure made (call your disposer; unregister from HL.register).
 *
 * MODES (optional; for furniture, which does not move in real life): the same piece in up to three ways
 *   figure.modes = ["anim", "orbit", "explode"]   any subset, in display order; the first is the default. Fewer than two: no control.
 *   figure.disclaimer = "Los muebles no se mueven; la animación solo muestra ..."   one muted line under the stage (above the hint),
 *       shown ONLY while the mode is "anim".
 *   The runtime draws a segmented control under the stage ("Animación" / "Girar" / "Despiece", buttons with aria-pressed, keyboard
 *   reachable, wraps at 390px, a tap on it never claims the touch lock) and remembers the choice per figure
 *   (localStorage "hairline-mode-v1:<name>", try/catch). mount(el, figure, { mode: "orbit" }) forces the initial mode; the handle
 *   has setMode(m), .mode and .azimuth. A figure without `modes` is unchanged.
 *   Extra methods on fig (all optional; the runtime only calls the ones for the modes you declared):
 *     fig.setMode(mode)     "anim" | "orbit" | "explode", after every change (also once at mount if a saved mode is not the first).
 *                           Return to the rest state of the new mode: "orbit" starts at azimuth 45, "explode" at 0, "anim" is the
 *                           figure's normal rest pose. Stop your own idle animation / ghosts in the other modes if they would fight.
 *     fig.orbit(azDeg)      "orbit" mode. azDeg in [0, 360), starts at 45 (the kernel's default camera, Cam(45, 0.5, S)).
 *                           REBUILD THE PROJECTION FROM THE NEW AZIMUTH: C = HL.Cam(azDeg, 0.5, S); keep the same S and re-run
 *                           HL.fit(C, pts, cx, cy) on the same 3D points (or keep a fixed ox/oy) so the piece stays centred; P =
 *                           HL.proj(C); front = HL.facing(C). Then redraw every path and RE-SORT THE PAINT ORDER (far parts first,
 *                           and the faces facing away dropped: the draw order that was right at 45 is wrong at 135). Cheap
 *                           redraw only: this is called every frame of a drag. It must not rely on anything that only held at 45.
 *     fig.explode(t)        "explode" mode. t in [0, 1]: 0 assembled, 1 fully exploded (parts slide apart along their own axes, with
 *                           guide ticks if you like). Called every frame of a drag and of the settle spring; idempotent.
 *     fig.hit(p)            keep it true over the piece in EVERY mode (it also decides the touch claim): it must follow the current
 *                           projection, since the piece moves when it is rotated or exploded.
 *   What the runtime does per mode (the figure never reads pointer events for orbit / explode):
 *     anim     everything as before: hover / press / drag / release / tap / peek go to the figure.
 *     orbit    horizontal drag turns it: azimuth = start + dx * 0.5 deg per viewBox unit, wrapped to a full turn; on release a
 *              little inertia (decay about 0.33s). The scroll peek / hover is a gentle sway of +-8 deg (sin of peek t) around the
 *              current azimuth. The figure's hover / press / drag / release / tap / peek are NOT called.
 *     explode  a drag (right or up opens, about 110 units for the full range) follows the finger with fig.explode(t); on release it
 *              settles open or closed on a spring (t > 0.5 opens). A tap toggles open / closed. Mouse hover over the piece and the
 *              scroll peek hold t at 0.15. The figure's hover / press / drag / release / tap / peek are NOT called.
 *   Worked example (a box in two parts, the lid lifts away):
 *     HairlineSite.figures.box = {
 *       name: "box", title: "Caja", hint: "...", label: "...",
 *       modes: ["anim", "orbit", "explode"],
 *       disclaimer: "Los muebles no se mueven: la animación solo ilustra el uso.",
 *       mount(ctx) {
 *         const bag = HL.disposer(), S = 3, pts = [[-20,-20,0],[20,20,0],[-20,-20,40],[20,20,40]];
 *         let az = 45, t = 0, mode = "anim", faces = [];                       // faces: [{ path, pts3d, n }] for base + lid
 *         const draw = () => {
 *           const C = HL.Cam(az, 0.5, S); HL.fit(C, pts, 200, 160);
 *           const P = HL.proj(C), c = Math.cos(C.az), s = Math.sin(C.az), zf = Math.sqrt(1 - C.k * C.k);
 *           // per face: rotated normal (nx*c-ny*s, nx*s+ny*c, nz); visible if Ny*C.k + Nz*zf > 0; depth = rotated Y of its centre
 *           // draw only visible faces, far to near (re-append the paths in that order), lid z += t * 18
 *         };
 *         const tickAnim = ...;                                                // your existing animation, only while mode === "anim"
 *         draw();
 *         return {
 *           hit: (p) => insideProjectedBox(p),
 *           setMode: (m) => { mode = m; az = 45; t = 0; draw(); },
 *           orbit: (a) => { az = a; draw(); },
 *           explode: (v) => { t = v; draw(); },
 *           hover: ..., peek: ..., press: ..., drag: ..., release: ..., tap: ...,   // anim mode only
 *           destroy: bag.dispose,
 *         };
 *       },
 *     };
 *   A runnable one: site/_modes-test.js (scratch page site/_modes-test.html).
 *
 * ORIGINAL FIRST (every figure with colour): the picker's first swatch is "Original" (an empty outline circle) and it is the
 *   default; the figure is then the plain Hairline line drawing: the stage carries [data-original], which switches the role
 *   classes off (inline gradient fills are put back to the class look, pure colour overlays are hidden). Any other swatch
 *   removes it. A figure with `variants` gets Original prepended; a figure that paints colour on its own (roles or
 *   HairlineSite.paint, no `variants`) is detected after mount and gets Original + "Catálogo" (its own colours); a variant
 *   with no `hex`/`colors` means "the figure's own colour" (perfiles: { id: "acabados", label: "Acabados" }). The saved
 *   choice lives under "hairline-variant-v2:<name>", so older saved choices are ignored.
 *
 * COLOUR VARIANTS (material colour only; the highlight stays the one bright stroke; Hairline rule 04 is lifted for MATERIAL colour)
 *   Contract, for a figure that offers colours:
 *     figure.variants = "perfil" | "<piece slug>" | [{ id, label, hex | colors:{ role: hex } }]
 *         strings are keys of HairlineSite.variants (site/variants.js, which site.html loads after this file).
 *         "perfil" = the 9 anodized finishes; "<slug>" = that furniture piece's colourways.
 *     figure.variantRole = "fin" (default) | "tint"     which role a plain `hex` fills. Metal finishes are "fin", coloured glass "tint".
 *     figure.variantsLabel = "Acabado" | "Color"        aria-label of the picker (default from the role).
 *   A figure TAGS ELEMENTS WITH CLASSES (the runtime does the colour, the figure sets no colour of its own):
 *     fin        metal: stroke = the finish colour, 1.6x the base width (colour needs a little mass; tint too) and chroma x1.9 (the sampled finishes are grey-lit renders, so a hairline needs the hue lifted; swatches get the same lift); keeps the element's own fill (plate, so it still hides what is behind it).
 *                Dark finishes are lifted on the dark theme (lightness floor L 0.62 in oklab, chroma scaled with it, so
 *                black / marron / burgundy still read and still differ) and white is capped on the light theme (L 0.72).
 *     fin-fill   metal as a SOLID BAND: the element's fill is the finish colour exactly as sampled (only lightness is nudged
 *                where it would vanish: capped at L 0.86 on light, floored at L 0.32 on dark), with a thin theme-colour edge
 *                stroke (--hl-edge; `hi` = the ink, 2.3x thicker). Use it on closed shapes: a frame ring (outer outline + the
 *                glass outline reversed, so the glass stays clear), pulls, rails. Swatches show the sample as it is.
 *     tint       coloured glass: translucent fill of the colour (26% on light, 40% on dark) and a stroke that is a deeper
 *                shade of the same hue on light (L x0.75, max 0.55) and a lifted one on dark (L 0.66..0.85).
 *     tint opq   same colour but OPAQUE (the tint blended over the plate), for a coloured part that must hide what is behind it.
 *     tint-2, tint-3   the same for further colours of one piece (colors: { tint, "tint-2", "tint-3" }).
 *     hi on a fin/tint element = that part's own stroke, strengthened (62-70% towards the ink) and 2.3x thicker; never a new hue.
 *     Clear glass stays plain `nf` (no class). Colour changes cross-fade in 220ms (CSS, so figures stay timer-free).
 *   Rules to remember: draw glass as ONE element per colour; a `tint` is translucent, so paint a plate under it (or use
 *   `tint opq`) where lines behind must not show through. Put `fin` on the SAME element as `sil`/`nf` (class="sil fin").
 *   Optional hook: fig.setVariant(v) after each change (v = the variant object), for what CSS cannot do. ctx.variant is the
 *   current variant (null if none). The runtime also exposes ctx.paint(el, role, hex) / HairlineSite.paint(el, role, hex):
 *   it sets the colour of ONE element subtree (the roles above) so a figure can show several colours at once with no picker
 *   (site/perfiles.js paints each length in its own finish; HairlineSite.variants.perfil[i].hex).
 *   The runtime draws the picker below the stage: round swatches (buttons, aria-pressed, keyboard reachable) and the name;
 *   a tap on a swatch never touches the stage, so it can never claim the touch lock. The choice is remembered per figure
 *   (localStorage "hairline-variant-v2:<figure.name>", every access in try/catch) and the name shows in the read-out for 1.6s (until the figure reads something new).
 *   mount(el, figure, { variant: "<id>" }) forces the initial variant; the returned handle has setVariant(id).
 *
 *   Worked example (a glass door whose frame takes the finish and whose pane is tinted):
 *     figure = { name: "x", variants: "perfil", ... mount(ctx) {
 *         HL.mk("path", { class: "sil fin", d: frameD }, ctx.svg);       // aluminium frame: stroke = the finish
 *         HL.mk("path", { class: "nf", d: glassD }, ctx.svg);            // clear glass: unchanged
 *         HL.mk("path", { class: "nf fin hi", d: pullD }, ctx.svg);      // the highlighted pull: finish colour, brighter and thicker
 *     } }
 *   and for a coloured-glass piece: variants: "folded", variantRole: "tint", and HL.mk("path", { class: "tint", d: paneD }).
 *
 * WORKED EXAMPLE (a dot you can drag; hover grows it a little)
 *   HairlineSite.figures.dot = {
 *     name: "dot", title: "Punto", hint: "Arrastra el punto.", label: "Un punto arrastrable.",
 *     mount(ctx) {
 *       const bag = HL.disposer();
 *       const c = HL.mk("ellipse", { class: "sil", rx: 14, ry: 14, cx: 200, cy: 160 }, ctx.svg);
 *       const pos = { x: HL.spring(200), y: HL.spring(160) }, pk = HL.spring(0);
 *       let hov = false, peekT = 0, o = [200, 160], B;
 *       const tick = (dt) => {
 *         pk.t = Math.max(hov ? 1 : 0, peekT);
 *         const m = [HL.stepS(pos.x, dt), HL.stepS(pos.y, dt), HL.stepS(pk, dt)].some(Boolean);
 *         c.setAttribute("cx", pos.x.x); c.setAttribute("cy", pos.y.x); c.setAttribute("rx", 14 + 4 * pk.x); c.setAttribute("ry", 14 + 4 * pk.x);
 *         return m;
 *       };
 *       B = HL.register(ctx.stage, tick); bag.add(B.unregister);
 *       const hit = (p) => Math.hypot(p[0] - pos.x.x, p[1] - pos.y.x) < 26;
 *       return {
 *         hit,
 *         hover: (p) => { hov = !!p && hit(p); B.wake(); },
 *         peek: (t) => { peekT = t; B.wake(); },
 *         press: () => { o = [pos.x.x, pos.y.x]; },
 *         drag: (p, d) => { pos.x.t = o[0] + d.dx; pos.y.t = o[1] + d.dy; B.wake(); },
 *         release: (v) => { pos.x.t += v.x * 0.15; pos.y.t += v.y * 0.15; B.wake(); },
 *         tap: () => { pos.x.t = 200; pos.y.t = 160; B.wake(); },
 *         destroy: bag.dispose,
 *       };
 *     },
 *   };
 *   HairlineSite.mount(document.querySelector("#slot"), HairlineSite.figures.dot);
 */
(function () {
  const HS = (window.HairlineSite = window.HairlineSite || {});
  HS.figures = HS.figures || {};

  const STYLE = [
    ".hls{display:block;box-sizing:border-box;width:min(100%,900px,calc(82svh * var(--hls-ar-n,1.25)));margin-inline:auto}",
    ".hls-stage[data-hairline]{aspect-ratio:5/4;touch-action:auto;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;" +
      "box-sizing:border-box;width:100%;border:1px solid var(--hl-lo);border-radius:14px;overflow:hidden;background:var(--hl-plate)}",
    ".hls-meta{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin:10px 4px 0;min-height:1.4em}",
    ".hls-hint{margin:0;font:13px/1.4 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--hls-muted,color-mix(in srgb,var(--hl-hi) 62%,transparent))}",
    ".hls-read{flex:none;font:11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;color:var(--hl-hi)}",
    ".hls-pick{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;margin:10px 4px 0}" +
      ".hls-sw{all:unset;box-sizing:border-box;position:relative;flex:none;width:30px;height:30px;border-radius:50%;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
      ".hls-sw::before{content:'';position:absolute;inset:5px;border-radius:50%;background:var(--sw);" +
        "box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hls-ink,CanvasText) 28%,transparent);transition:transform 160ms ease}" +
      ".hls-sw:hover::before{transform:scale(1.12)}" +
      ".hls-sw-o::before{background:transparent;box-shadow:inset 0 0 0 1.5px var(--hls-ink,CanvasText)}" +
      ".hls-sw[aria-pressed=true]::after{content:'';position:absolute;inset:1px;border-radius:50%;box-shadow:0 0 0 1.5px var(--hls-ink,CanvasText)}" +
      ".hls-sw:focus-visible{outline:1.5px solid var(--hls-ink,CanvasText);outline-offset:1px}" +
      ".hls-vname{margin-left:8px;font:12px/1.3 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--hls-muted,GrayText)}" +
    ".hls-modes{display:flex;flex-wrap:wrap;gap:4px;margin:10px 4px 0}" +
      ".hls-mode{all:unset;box-sizing:border-box;min-height:32px;padding:0 14px;display:inline-flex;align-items:center;border:1px solid var(--hl-lo);border-radius:999px;cursor:pointer;" +
        "font:12px/1 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--hls-muted,GrayText);-webkit-tap-highlight-color:transparent;transition:color 160ms ease,border-color 160ms ease}" +
      ".hls-mode:hover{color:var(--hls-ink,CanvasText)}" +
      ".hls-mode[aria-pressed=true]{color:var(--hls-ink,CanvasText);border-color:var(--hls-ink,CanvasText)}" +
      ".hls-mode:focus-visible{outline:1.5px solid var(--hls-ink,CanvasText);outline-offset:1px}" +
      ".hls-disc{margin:8px 4px 0;font:12px/1.4 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--hls-muted,GrayText)}.hls-disc[hidden]{display:none}" +
    "@media (max-width:767px){" +
      ".hls-pick,.hls-modes{margin:8px 10px 0}.hls-disc{margin:8px 16px 0}" +
      ".hls{width:100vw;max-width:none;margin-left:calc(50% - 50vw)}" +
      ".hls-stage[data-hairline]{border:0;border-radius:0}" +
      ".hls-meta{margin:10px 16px 0}}",
  ].join("");

  // ---- colour: roles -> classes -> custom properties ------------------------------------------------------------------
  const ROLES = ["fin", "tint", "tint-2", "tint-3"];
  const FIN_CHROMA = 1.9; // sampled finishes come from grey-lit renders (low chroma); a hairline needs the hue to read
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  function toLab(hex) {
    const h = hex.replace("#", ""), n = h.length === 3 ? h.replace(/./g, "$&$&") : h;
    const r = lin(parseInt(n.slice(0, 2), 16) / 255), g = lin(parseInt(n.slice(2, 4), 16) / 255), b = lin(parseInt(n.slice(4, 6), 16) / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
  }
  function fromLch(L, C, h) {
    for (let k = 0; k < 24; k++) {
      const a = C * Math.cos(h), b = C * Math.sin(h);
      const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
      const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
      if (rgb.every((v) => v >= -0.0005 && v <= 1.0005) || C < 0.001) {
        return "#" + rgb.map((v) => Math.round(gam(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, "0")).join("");
      }
      C *= 0.93;
    }
    return "#888888";
  }
  /** Stroke colour for a role on one theme side ("l" light / "d" dark), as described in the header. */
  function strokeFor(role, hex, side) {
    const c = toLab(hex), cl = (v, a, b) => Math.min(b, Math.max(a, v));
    let L = c.L;
    if (role === "fin") L = side === "l" ? Math.min(L, 0.72) : Math.max(L, 0.62);
    else L = side === "l" ? Math.min(L * 0.75, 0.55) : cl(L, 0.66, 0.85);
    let C = L > c.L && c.L > 0.02 ? c.C * (L / c.L) : c.C; // lifting keeps the chroma-to-lightness ratio
    if (role === "fin") C *= FIN_CHROMA;
    return fromLch(L, C, c.h);
  }
  /** Colour ONE subtree: sets --<role>-hex, --<role>-l, --<role>-d on el (the CSS below reads them). */
  function paint(el, role, hex) {
    if (!hex) { for (const k of ["hex", "l", "d", "fl", "fd"]) el.style.removeProperty("--" + role + "-" + k); return; }
    el.style.setProperty("--" + role + "-hex", hex);
    el.style.setProperty("--" + role + "-l", strokeFor(role, hex, "l"));
    el.style.setProperty("--" + role + "-d", strokeFor(role, hex, "d"));
    if (role === "fin") { el.style.setProperty("--fin-fl", fillFor(hex, "l")); el.style.setProperty("--fin-fd", fillFor(hex, "d")); }
  }
  /** Swatches show the sampled colour as it is. */
  function swatchOf(role, hex) { return hex; }
  /** Band fill for `fin-fill`: the sample as it is; only lightness is nudged where it would vanish (light cap 0.86, dark floor 0.32). */
  function fillFor(hex, side) {
    const c = toLab(hex);
    const L = side === "l" ? Math.min(c.L, 0.86) : Math.max(c.L, 0.32);
    return L === c.L ? hex : fromLch(L, c.C, c.h);
  }
  HS.paint = paint;

  // CSS for the role classes. mode "a" follows color-scheme (light-dark()), "l"/"d" are forced by an ancestor / figure theme.
  function roleCss() {
    const THEMES = [
      { pre: ".hls-stage:not([data-original])", mode: "a" },
      { pre: ':where(.dark,[data-theme="dark"]) .hls-stage:not([data-original])', mode: "d" },
      { pre: '.hls-stage[data-hairline-theme="dark"]:not([data-original])', mode: "d" },
      { pre: '.hls-stage[data-hairline-theme="light"]:not([data-original])', mode: "l" },
    ];
    const val = (mode, f) => (mode === "a" ? "light-dark(" + f("l") + "," + f("d") + ")" : f(mode));
    let out = ".hls-stage .fin-fill{transition:fill 220ms ease}.hls-stage .fin,.hls-stage .tint,.hls-stage .tint-2,.hls-stage .tint-3{transition:stroke 220ms ease,fill 220ms ease}";
    const bump = "stroke-width:calc(var(--hl-sw,0.9) * 2.3);", body = "stroke-width:calc(var(--hl-sw,0.9) * 1.6);";
    for (const t of THEMES) {
      const hiMix = (v, side) => "color-mix(in srgb," + v + (side === "l" ? " 62%" : " 70%") + ",var(--hl-hi))";
      out += t.pre + " .fin{stroke:" + val(t.mode, (s) => "var(--fin-" + s + ",var(--hl-edge))") + ";" + body + "}";
      // fin-fill: a SOLID BAND in the finish (sample as is); a thin theme stroke keeps the drawing language; hi = the theme ink, thicker
      out += t.pre + " .fin-fill{fill:" + val(t.mode, (s) => "var(--fin-f" + s + ",var(--hl-plate))") + ";stroke:var(--hl-edge)}";
      out += t.pre + " .fin-fill.hi{stroke:var(--hl-hi);" + bump + "}";
      out += t.pre + " .fin.hi{stroke:" + val(t.mode, (s) => hiMix("var(--fin-" + s + ",var(--hl-edge))", s)) + ";" + bump + "}";
      for (const r of ROLES.slice(1)) {
        const st = (s) => "var(--" + r + "-" + s + ",var(--hl-edge))", hx = "var(--" + r + "-hex,transparent)";
        out += t.pre + " ." + r + "{fill:" + val(t.mode, (s) => "color-mix(in srgb," + hx + " " + (s === "l" ? 26 : 40) + "%,transparent)") + ";stroke:" + val(t.mode, st) + ";" + body + "}";
        out += t.pre + " ." + r + ".opq{fill:" + val(t.mode, (s) => "color-mix(in srgb," + hx + " " + (s === "l" ? 30 : 46) + "%,var(--hl-plate))") + "}";
        out += t.pre + " ." + r + ".hi{stroke:" + val(t.mode, (s) => hiMix(st(s), s)) + ";" + bump + "}";
      }
    }
    // ORIGINAL: the plain Hairline line drawing. The class rules above are off; what remains is what figures set inline
    // (gradient fills/strokes on tinted slabs, overlay gradients): put those back to the class look, hide pure colour overlays.
    const O = ".hls-stage[data-original] :is(.tint,.tint-2,.tint-3)[style]";
    out += O + "{fill:var(--hl-plate)!important;stroke:var(--hl-mid)!important}" + O + ".nf{fill:none!important}" + O + ".lo{stroke:var(--hl-lo)!important}" +
      O + ".sil{stroke:var(--hl-edge)!important}" + O + ".hi{stroke:var(--hl-hi)!important}" +
      '.hls-stage[data-original] [style*="url(#"]:not(.tint):not(.tint-2):not(.tint-3){display:none!important}';
    return out;
  }

  let styled = false;
  function injectStyle() {
    if (styled) return;
    styled = true;
    const s = document.createElement("style");
    s.setAttribute("data-hairline-site-style", "");
    s.textContent = STYLE + roleCss();
    document.head.appendChild(s);
  }

  const DEFAULT_VB = [0, 0, 400, 320];

  HS.mount = function mount(el, figure, opts) {
    opts = opts || {};
    injectStyle();
    HL.inject(document);
    const bag = HL.disposer();

    // ---- DOM
    el.classList.add("hls");
    const stage = document.createElement("div");
    stage.className = "hls-stage";
    stage.setAttribute("data-hairline", figure.name || "figure");
    stage.setAttribute("role", "img");
    if (figure.label) stage.setAttribute("aria-label", figure.label);
    if (opts.theme === "light" || opts.theme === "dark") stage.setAttribute("data-hairline-theme", opts.theme);
    const svg = HL.mk("svg", { viewBox: DEFAULT_VB.join(" "), preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true" }, stage);
    const meta = document.createElement("div");
    meta.className = "hls-meta";
    const hintText = opts.hint === false ? "" : opts.hint != null ? opts.hint : figure.hint || "";
    const hintEl = document.createElement("p");
    hintEl.className = "hls-hint";
    hintEl.textContent = hintText;
    const readEl = document.createElement("span");
    readEl.className = "hls-read";
    readEl.setAttribute("aria-hidden", "true");
    meta.append(hintEl, readEl);
    // ---- colour variants (picker lives outside the stage, so it can never claim a touch)
    let variants = figure.variants;
    if (typeof variants === "string") variants = (HS.variants || {})[variants];
    variants = Array.isArray(variants) && variants.length ? variants : null;
    const ORIGINAL = { id: "original", label: "Original", original: true };
    if (variants) variants = [ORIGINAL].concat(variants.filter((v) => !v.original));
    const role = figure.variantRole || "fin";
    const keyOf = () => "hairline-variant-v2:" + (figure.name || "figure"); // v2: earlier saved choices are ignored, everyone starts on Original
    let cur = null, holdUntil = 0, holdTimer = 0, lastText = "";
    let pick = null, pickName = null, swBtns = [];
    // Colour is INERT until a variant is chosen: stage[data-original] switches every role class off (see roleCss).
    stage.setAttribute("data-original", "");
    const hexesIn = () => {
      const out = [], re = /--[a-z0-9-]+-hex:\s*(#[0-9a-fA-F]{6})/g, nodes = [svg].concat([...svg.querySelectorAll("[style*='-hex']")]);
      for (const n of nodes) { let m; const t = n.getAttribute("style") || ""; re.lastIndex = 0; while ((m = re.exec(t))) if (!out.includes(m[1].toLowerCase())) out.push(m[1].toLowerCase()); }
      return out;
    };
    function buildPicker() {
      pick = document.createElement("div");
      pick.className = "hls-pick";
      pick.setAttribute("role", "group");
      pick.setAttribute("aria-label", figure.variantsLabel || (role === "fin" ? "Acabado" : "Color"));
      pickName = document.createElement("span");
      pickName.className = "hls-vname";
      const own = hexesIn();
      swBtns = variants.map((v, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "hls-sw" + (v.original ? " hls-sw-o" : "");
        b.setAttribute("aria-pressed", "false");
        b.setAttribute("aria-label", v.label + (v.ral ? " " + v.ral : ""));
        b.title = v.label;
        if (!v.original) {
          const sw = v.hex || (v.colors && (v.colors[role] || v.colors[Object.keys(v.colors)[0]]));
          if (sw) b.style.setProperty("--sw", swatchOf(v.colors ? Object.keys(v.colors)[0] : role, sw));
          else if (own.length) {
            const n = own.length;
            b.style.setProperty("--sw", n === 1 ? own[0] : "conic-gradient(" + own.map((h, k) => h + " " + (k * 360 / n) + "deg " + ((k + 1) * 360 / n) + "deg").join(",") + ")");
          } else b.style.setProperty("--sw", "#888");
        }
        b.addEventListener("click", () => setVariant(i, true));
        return b;
      });
      pick.append(...swBtns, pickName);
    }
    if (variants) buildPicker();
    // ---- modes (anim | orbit | explode) and the disclaimer; both live outside the stage, so a tap on them never claims a touch
    const MODE_LABEL = { anim: "Animación", orbit: "Girar", explode: "Despiece" };
    const modes = Array.isArray(figure.modes) ? figure.modes.filter((m, i, a) => MODE_LABEL[m] && a.indexOf(m) === i) : [];
    const modeKey = "hairline-mode-v1:" + (figure.name || "figure");
    let mode = modes[0] || "anim", modesEl = null, modeBtns = [];
    if (modes.length > 1) {
      modesEl = document.createElement("div");
      modesEl.className = "hls-modes";
      modesEl.setAttribute("role", "group");
      modesEl.setAttribute("aria-label", "Modo de vista");
      modeBtns = modes.map((m) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "hls-mode"; b.textContent = MODE_LABEL[m];
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => setMode(m, true));
        modesEl.append(b);
        return b;
      });
    }
    let discEl = null;
    if (figure.disclaimer) {
      discEl = document.createElement("p");
      discEl.className = "hls-disc";
      discEl.textContent = figure.disclaimer;
    }
    el.append(stage);
    if (modesEl) el.append(modesEl);
    if (pick) el.append(pick);
    if (discEl) el.append(discEl);
    el.append(meta);
    bag.add(() => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.remove(); stage.remove(); meta.remove(); if (pick) pick.remove(); if (modesEl) modesEl.remove(); if (discEl) discEl.remove();
      clearTimeout(holdTimer);
      el.classList.remove("hls");
      el.style.removeProperty("--hls-ar-n");
    });

    const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); bag.add(() => t.removeEventListener(type, fn, o)); };

    // ---- viewBox: default on desktop, cropped to the drawing on phones
    const mq = matchMedia("(max-width: 767px)");
    let bounds = null, vb = DEFAULT_VB.slice();
    function measure() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of svg.children) {
        let b;
        try { b = n.getBBox(); } catch (_) { continue; }
        if (!b || (b.width === 0 && b.height === 0)) continue;
        x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
      }
      return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
    }
    function fit() {
      if (mq.matches) {
        if (!bounds) bounds = figure.bounds || measure();
        if (bounds) {
          const m = Math.max(6, bounds[2] * 0.03);
          vb = [bounds[0] - m, bounds[1] - m, bounds[2] + 2 * m, bounds[3] + 2 * m];
        } else vb = DEFAULT_VB.slice();
      } else vb = DEFAULT_VB.slice();
      svg.setAttribute("viewBox", vb.map((n) => Math.round(n * 100) / 100).join(" "));
      stage.style.aspectRatio = vb[2] + " / " + vb[3];
      el.style.setProperty("--hls-ar-n", String(vb[2] / vb[3]));
    }

    // ---- figure
    let lastRead = null;
    let H = null; // the gesture router (see the modes block near the end)
    const ctx = {
      svg, stage,
      read: (s) => { if (s !== lastText && holdUntil) { holdUntil = 0; clearTimeout(holdTimer); } lastText = s; if (s !== lastRead && performance.now() >= holdUntil) { lastRead = s; readEl.textContent = s; } },
      paint,
      get variant() { return cur === null ? null : variants[cur]; },
      reduced: () => HL.reducedMotion(),
    };
    const api = { refit() { bounds = null; fit(); } };
    function applyVariant(v) {
      const colors = v.original ? {} : v.colors || { [role]: v.hex };
      for (const r of ROLES) paint(stage, r, colors[r]);
      if (v.original) stage.setAttribute("data-original", ""); else stage.removeAttribute("data-original");
      stage.setAttribute("data-variant", v.id);
    }
    function setVariant(i, user) {
      if (!variants || i < 0 || i >= variants.length) return;
      cur = i;
      const v = variants[i];
      applyVariant(v);
      swBtns.forEach((b, k) => b.setAttribute("aria-pressed", k === i ? "true" : "false"));
      pickName.textContent = v.label + (v.ral ? " · " + v.ral : "");
      if (user) {
        try { localStorage.setItem(keyOf(), v.id); } catch (_) {}
        holdUntil = performance.now() + 1600;
        lastRead = pickName.textContent; readEl.textContent = lastRead;
        clearTimeout(holdTimer);
        holdTimer = setTimeout(() => { holdUntil = 0; lastRead = lastText; readEl.textContent = lastText; }, 1620);
      }
      try { if (typeof fig !== "undefined" && fig && fig.setVariant) fig.setVariant(v); } catch (_) {}
    }
    if (variants) {
      let id = opts.variant;
      if (id == null) { try { id = localStorage.getItem(keyOf()); } catch (_) {} }
      const i0 = variants.findIndex((v) => v.id === id);
      cur = i0 >= 0 ? i0 : 0;
      applyVariant(variants[cur]);
    }
    const fig = figure.mount(ctx, api);
    if (!variants) {
      // a figure that paints colour itself (static roles) gets Original + Catalogo: its own colours are the one option
      if (svg.querySelector(".fin,.fin-fill,.tint,.tint-2,.tint-3") || hexesIn().length) {
        variants = [ORIGINAL, { id: "catalogo", label: "Catálogo" }];
        buildPicker();
        el.insertBefore(pick, discEl || meta);
        let id = opts.variant;
        if (id == null) { try { id = localStorage.getItem(keyOf()); } catch (_) {} }
        const i0 = variants.findIndex((v) => v.id === id);
        cur = i0 >= 0 ? i0 : 0;
      } else stage.removeAttribute("data-original");
    }
    else if (variants.some((v) => !v.original && !v.hex && !v.colors)) { const old = pick; buildPicker(); old.replaceWith(pick); } // swatch of 'the figure's own colours' needs the mounted drawing
    if (variants) setVariant(cur, false);
    fit();
    if (mq.addEventListener) { mq.addEventListener("change", fit); bag.add(() => mq.removeEventListener("change", fit)); }
    bag.add(() => { try { fig.destroy && fig.destroy(); } catch (_) {} });

    // ---- points
    const pt = (cx, cy) => {
      const r = svg.getBoundingClientRect();
      return [vb[0] + ((cx - r.left) / r.width) * vb[2], vb[1] + ((cy - r.top) / r.height) * vb[3]];
    };
    const unit = () => vb[2] / svg.getBoundingClientRect().width; // viewBox units per CSS px
    const cursor = (c) => { stage.style.cursor = c; };
    bag.add(() => { stage.style.cursor = ""; });

    // ---- scroll peek
    let interacted = false, peekOn = false, lastT = 0, queued = 0, near = false;
    const reducedQ = matchMedia("(prefers-reduced-motion: reduce)");
    const wantScroll = opts.scrollPeek === true || (opts.scrollPeek !== false && matchMedia("(hover: none)").matches);
    function readScroll() {
      queued = 0;
      if (!peekOn) return;
      const r = stage.getBoundingClientRect(), vh = innerHeight, c = r.top + r.height / 2, a = 0.75 * vh, b = 0.5 * vh;
      const t = c >= a ? 0 : c > b ? (a - c) / (a - b) : 1 - HL.clamp((b - c) / (0.25 * vh), 0, 1);
      if (Math.abs(t - lastT) > 0.002 || (t === 0 && lastT !== 0)) { lastT = t; H.peek(t); }
    }
    const queue = () => { if (!queued && near && peekOn) queued = requestAnimationFrame(readScroll); };
    function peekOff() {
      if (!peekOn) return;
      peekOn = false;
      if (queued) { cancelAnimationFrame(queued); queued = 0; }
      removeEventListener("scroll", queue); removeEventListener("resize", queue);
      if (lastT !== 0) { lastT = 0; H.peek(0); }
    }
    if (wantScroll && !reducedQ.matches && typeof IntersectionObserver !== "undefined") {
      peekOn = true;
      addEventListener("scroll", queue, { passive: true });
      addEventListener("resize", queue);
      const io = new IntersectionObserver((es) => {
        for (const en of es) {
          near = en.isIntersecting;
          if (near) { if (!bounds && mq.matches) fit(); queue(); }
        }
      }, { rootMargin: "100% 0px" });
      io.observe(stage);
      bag.add(() => { io.disconnect(); peekOff(); });
    }

    // ---- touch claim: a touch that starts on the object never scrolls the page
    let claimed = null;
    on(stage, "touchstart", (e) => {
      if (claimed !== null) { if (e.cancelable) e.preventDefault(); return; }
      const t = e.changedTouches[0];
      if (t && fig.hit(pt(t.clientX, t.clientY))) { claimed = t.identifier; if (e.cancelable) e.preventDefault(); }
    }, { passive: false });
    on(stage, "touchmove", (e) => { if (claimed !== null && e.cancelable) e.preventDefault(); }, { passive: false });
    const touchEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === claimed) { claimed = null; if (e.cancelable && e.type === "touchend") e.preventDefault(); }
    };
    on(stage, "touchend", touchEnd, { passive: false });
    on(stage, "touchcancel", touchEnd, { passive: false });
    on(stage, "contextmenu", (e) => { if (claimed !== null || g) e.preventDefault(); });

    // ---- pointer gesture
    let g = null; // { id, cx, cy, p0, moved, touch, lt, lx, ly, vx, vy }
    on(stage, "pointerdown", (e) => {
      if (g || (e.pointerType === "mouse" && e.button !== 0)) return;
      const p = pt(e.clientX, e.clientY);
      if (!fig.hit(p)) return;
      g = { id: e.pointerId, cx: e.clientX, cy: e.clientY, p0: p, moved: false, touch: e.pointerType !== "mouse", lt: performance.now(), lx: e.clientX, ly: e.clientY, vx: 0, vy: 0 };
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      if (!g.touch) { H.hover(null); cursor("grabbing"); e.preventDefault(); }
      interacted = true; peekOff();
      H.press(p);
    });
    on(stage, "pointermove", (e) => {
      if (!g) {
        if (e.pointerType !== "mouse") return;
        const p = pt(e.clientX, e.clientY);
        H.hover(p);
        cursor(fig.hit(p) ? "grab" : "");
        return;
      }
      if (e.pointerId !== g.id) return;
      if (!g.moved && Math.hypot(e.clientX - g.cx, e.clientY - g.cy) < (g.touch ? 8 : 4)) return;
      g.moved = true;
      const k = unit(), now = performance.now(), dtm = now - g.lt;
      if (dtm > 0) {
        const vx = ((e.clientX - g.lx) * k) / (dtm / 1000), vy = ((e.clientY - g.ly) * k) / (dtm / 1000);
        g.vx = dtm > 80 ? 0 : g.vx * 0.5 + vx * 0.5; g.vy = dtm > 80 ? 0 : g.vy * 0.5 + vy * 0.5;
      }
      g.lt = now; g.lx = e.clientX; g.ly = e.clientY;
      H.drag(pt(e.clientX, e.clientY), { dx: (e.clientX - g.cx) * k, dy: (e.clientY - g.cy) * k, x0: g.p0[0], y0: g.p0[1] });
    });
    const up = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const d0 = g; g = null;
      try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
      const ok = e.type === "pointerup";
      if (d0.moved) {
        const stale = performance.now() - d0.lt > 80;
        H.release(ok && !stale ? { x: d0.vx, y: d0.vy } : { x: 0, y: 0 });
      } else if (ok) H.tap(d0.p0);
      if (!d0.touch) {
        const p = pt(e.clientX, e.clientY);
        if (ok) H.hover(p);
        cursor(ok && fig.hit(p) ? "grab" : "");
      }
    };
    on(stage, "pointerup", up);
    on(stage, "pointercancel", up);
    on(stage, "pointerleave", (e) => {
      if (g || e.pointerType !== "mouse") return;
      H.hover(null); cursor("");
    });

    // ---- modes: the runtime owns the azimuth / explode state and routes the gesture; "anim" is the figure's own input
    const AZ0 = 45, SWAY = 8, DEG_PER_UNIT = 0.5;
    const wrap360 = (a) => ((a % 360) + 360) % 360;
    let az = AZ0, azV = 0, azStart = AZ0, orbDrag = false, sway = 0, lastAz = null;
    const ex = HL.spring(0, { eps: 0.002 });
    let exUser = 0, exHov = 0, exPeek = 0, exDrag = false, exStart = 0, lastEx = null;
    let raf = 0, lastF = 0;
    const pushOrbit = () => { const a = Math.round(wrap360(az + sway) * 100) / 100; if (a !== lastAz) { lastAz = a; fig.orbit && fig.orbit(a); } };
    const pushExplode = () => { const t = Math.round(HL.clamp(ex.x, 0, 1) * 1000) / 1000; if (t !== lastEx) { lastEx = t; fig.explode && fig.explode(t); } };
    const retarget = () => { if (!exDrag) ex.t = Math.max(exUser, exHov, exPeek); wake(); };
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - lastF) / 1000 || 0.016); lastF = now;
      let more = false;
      if (mode === "orbit" && !orbDrag) {
        if (Math.abs(azV) > 2) { az = wrap360(az + azV * dt); azV *= Math.exp(-3 * dt); more = true; } else azV = 0;
        pushOrbit();
      } else if (mode === "explode" && !exDrag) { more = HL.stepS(ex, dt); pushExplode(); }
      if (more) wake();
    }
    function wake() { if (!raf) { lastF = performance.now(); raf = requestAnimationFrame(frame); } }
    bag.add(() => { if (raf) cancelAnimationFrame(raf); raf = 0; });
    const noop = () => {};
    const ANIM = {
      hover: (p) => fig.hover && fig.hover(p), press: (p) => fig.press && fig.press(p), drag: (p, d) => fig.drag && fig.drag(p, d),
      release: (v) => fig.release && fig.release(v), tap: (p) => fig.tap && fig.tap(p), peek: (t) => fig.peek && fig.peek(t),
    };
    const ORBIT = {
      hover: noop,
      press: () => { orbDrag = true; azV = 0; azStart = az; },
      drag: (p, d) => { az = wrap360(azStart + d.dx * DEG_PER_UNIT); pushOrbit(); },
      release: (v) => { orbDrag = false; azV = HL.reducedMotion() ? 0 : HL.clamp(v.x * DEG_PER_UNIT, -720, 720); wake(); },
      tap: () => { orbDrag = false; azV = 0; },
      peek: (t) => { sway = t > 0 ? SWAY * Math.sin(t * Math.PI * 2) : 0; pushOrbit(); },
    };
    const EXPLODE = {
      hover: (p) => { exHov = p && fig.hit(p) ? 0.15 : 0; retarget(); },
      press: () => { exDrag = true; exStart = ex.x; exHov = 0; },
      drag: (p, d) => {
        const c = Math.abs(d.dx) > Math.abs(d.dy) ? d.dx : -d.dy; // right or up opens
        ex.x = ex.t = HL.clamp(exStart + c / 110, 0, 1); ex.v = 0; pushExplode();
      },
      release: () => { exDrag = false; exUser = ex.x > 0.5 ? 1 : 0; retarget(); },
      tap: () => { exDrag = false; exUser = ex.x > 0.5 ? 0 : 1; retarget(); },
      peek: (t) => { exPeek = 0.15 * t; retarget(); },
    };
    const routes = { anim: ANIM, orbit: ORBIT, explode: EXPLODE };
    H = {
      hover: (p) => routes[mode].hover(p), press: (p) => routes[mode].press(p), drag: (p, d) => routes[mode].drag(p, d),
      release: (v) => routes[mode].release(v), tap: (p) => routes[mode].tap(p), peek: (t) => routes[mode].peek(t),
    };
    function syncModeUI() {
      modeBtns.forEach((b, k) => b.setAttribute("aria-pressed", modes[k] === mode ? "true" : "false"));
      if (discEl) discEl.hidden = mode !== "anim";
    }
    function setMode(m, user) {
      if (modes.indexOf(m) < 0 || m === mode) return;
      H.hover(null); H.peek(0); // the old mode lets go of whatever the peek held
      orbDrag = false; exDrag = false;
      mode = m;
      az = AZ0; azV = 0; sway = 0; lastAz = null; exUser = exHov = exPeek = 0; ex.x = ex.t = 0; ex.v = 0; lastEx = null;
      try { fig.setMode && fig.setMode(m); } catch (_) {}
      if (peekOn && lastT) H.peek(lastT);
      syncModeUI();
      if (user) { try { localStorage.setItem(modeKey, mode); } catch (_) {} }
    }
    if (modes.length > 1) {
      let m0 = modes[0];
      try { const sv = localStorage.getItem(modeKey); if (sv && modes.indexOf(sv) >= 0) m0 = sv; } catch (_) {}
      if (opts.mode && modes.indexOf(opts.mode) >= 0) m0 = opts.mode;
      setMode(m0, false);
    }
    syncModeUI();

    return {
      destroy() { bag.dispose(); },
      get mode() { return mode; },
      get azimuth() { return az; },
      setMode(m) { setMode(m, true); },
      get interacted() { return interacted; },
      setVariant(id) { if (variants) setVariant(typeof id === "number" ? id : variants.findIndex((v) => v.id === id), true); },
    };
  };
})();
