/**
 * Biplanar on the Hairline site runtime (see ../hairline-site.js). Drawing from ../biplanar.js.
 * The nightstand: two hollow glass legs (each an outer wall, an inner wall, a floor plate and a plate at shelf height, open front and back,
 * from biplanar-diagram.svg), a top plane and a shelf plane between the legs.
 * MODES: "anim" (illustrative, below), "orbit" (Girar: only the camera turns) and "explode" (Despiece: the top lifts; along x each leg comes
 * apart as outer wall | floor and shelf-height plates | inner wall, the shelf plane stays as the datum).
 * Anim: one spring per group, 0..1 of a 12 cm travel (top up, shelf out, legs outward). Hover / scroll peek: the part under the pointer moves
 * a little (0.3) and goes bright, the others give a little. Press on a part and drag pulls it out along its axis; release lets it spring back.
 * A tap holds the part out, or lets it go.
 * COLOUR (4 pairings, COMBINATIONS): from catalogo/biplanar-amarillo-azul, -verde-amarillo-rojo, -azul-rojo and -naranja-morado.webp.
 * Roles: tint = narrow leg, tint-3 = wide leg, tint-2 = the top and shelf start colour; the top plane and the shelf GRADE from tint-2 (narrow end)
 * to tint-3 (wide end) along the length, as in all four renders. The two "esmerilado" pairings are frosted (opaque blend); the clear ones are tints.
 * QUESTION: "Guillermo, ¿los costados de la Biplanar son cajones abiertos por delante, o cerrados?" (drawn open front and back)
 * QUESTION: "¿Los planos internos (base y repisa dentro del costado ancho) son parte del diseno?" (drawn: floor + shelf-height plate)
 * QUESTION: "¿Todo va pegado entre si (UV), o hay algun elemento removible?"
 * QUESTION: "¿El degradado entre los dos colores de tapa y repisa es siempre asi?"
 */
(function () {
  const { Cam, clamp, facing, fit, hull, prism, proj, rings, put, solid, spring, stepS, disposer, mk, register } = HL;
  // ---- MODES helpers (Girar / Despiece): boxes are [x0, y0, z0, x1, y1, z1] in cm
  const corners = (b) => { const o = []; for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) o.push([x, y, z]); return o; };
  const shiftBox = (b, d) => [b[0] + d[0], b[1] + d[1], b[2] + d[2], b[3] + d[0], b[4] + d[1], b[5] + d[2]];
  const extentOf = (C, pts) => {
    const P = proj(C); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of pts) { const s = P(q[0], q[1], q[2]); x0 = Math.min(x0, s[0]); y0 = Math.min(y0, s[1]); x1 = Math.max(x1, s[0]); y1 = Math.max(y1, s[1]); }
    return [x0, y0, x1, y1];
  };
  /** Far-to-near paint order (indices) of axis-aligned boxes for camera C: a box that lies on the camera's side of a separating plane is painted after the other. */
  function paintOrder(boxes, C) {
    const s = Math.sin(C.az), c = Math.cos(C.az), zf = Math.sqrt(1 - C.k * C.k), w = [zf * s, zf * c, C.k], n = boxes.length;
    const deps = boxes.map(() => []); // deps[i]: boxes that must be painted before i (they are behind it)
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      for (let a = 0; a < 3; a++) {
        if (Math.abs(w[a]) < 1e-3) continue;
        const A = boxes[i], B = boxes[j];
        if (A[a + 3] <= B[a] + 1e-4) { (w[a] > 0 ? deps[j] : deps[i]).push(w[a] > 0 ? i : j); break; }
        if (B[a + 3] <= A[a] + 1e-4) { (w[a] > 0 ? deps[i] : deps[j]).push(w[a] > 0 ? j : i); break; }
      }
    }
    const dep = boxes.map((b) => ((b[0] + b[3]) * s + (b[1] + b[4]) * c) * zf / 2 + (b[2] + b[5]) * C.k / 2);
    const out = [], done = new Set();
    while (out.length < n) {
      let best = -1;
      for (let i = 0; i < n; i++) if (!done.has(i) && deps[i].every((d) => done.has(d)) && (best < 0 || dep[i] < dep[best])) best = i;
      if (best < 0) for (let i = 0; i < n; i++) if (!done.has(i) && (best < 0 || dep[i] < dep[best])) best = i; // a cycle: centre depth
      done.add(best); out.push(best);
    }
    return out;
  }
  /** The cameras of the three modes. S0 = the piece's own anim scale. assembled / exploded: box lists (exploded = every part at t = 1). */
  function Views(S0, assembled, exploded) {
    const pa = assembled.flatMap(corners), pe = pa.concat(exploded.flatMap(corners));
    const scaleFor = (az, pts) => { const C = Cam(az, 0.5, 1); fit(C, pts, 0, 0); const e = extentOf(C, pts); return Math.min(S0, 352 / (e[2] - e[0]), 272 / (e[3] - e[1])); };
    let So = S0; for (let a = 0; a < 360; a += 15) So = Math.min(So, scaleFor(a, pa));
    const Se = scaleFor(45, pe);
    const orbit = (az) => { const C = Cam(az, 0.5, So); fit(C, pa, 200, 160); return C; };
    const explode = () => { const C = Cam(45, 0.5, Se); fit(C, pe, 200, 160); return C; };
    /** [x, y, w, h] covering the piece in orbit (every 15 degrees) and exploded, for the phone crop */
    const bounds = () => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const add = (e) => { x0 = Math.min(x0, e[0]); y0 = Math.min(y0, e[1]); x1 = Math.max(x1, e[2]); y1 = Math.max(y1, e[3]); };
      for (let a = 0; a < 360; a += 15) add(extentOf(orbit(a), pa));
      add(extentOf(explode(), pe));
      return [x0, y0, x1, y1];
    };
    return { orbit, explode, bounds };
  }
  /** union of a [x, y, w, h] and an [x0, y0, x1, y1] -> [x, y, w, h] */
  const unionB = (a, e) => { const x0 = Math.min(a[0], e[0]), y0 = Math.min(a[1], e[1]), x1 = Math.max(a[0] + a[2], e[2]), y1 = Math.max(a[1] + a[3], e[3]); return [x0, y0, x1 - x0, y1 - y0]; };
  const pip = (h, [x, y]) => {
    let c = false;
    for (let i = 0, j = h.length - 1; i < h.length; j = i++) {
      const [xi, yi] = h[i], [xj, yj] = h[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const edgeD = (h, [x, y]) => {
    let best = 1e9;
    for (let i = 0, j = h.length - 1; i < h.length; j = i++) {
      const [ax, ay] = h[j], [bx, by] = h[i], dx = bx - ax, dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return best;
  };
  /** hit on the CURRENT projection: boxes (with their offsets) projected through P, a little slop for a finger */
  const hitBoxes = (P, boxes, p) => boxes.some((b) => { const h = hull(corners(b).map((q) => P(q[0], q[1], q[2]))); return pip(h, p) || edgeD(h, p) < 8; });
  /** the anim scale: the piece's own S0, reduced only if its pull extents would leave the frame */
  const animScale = (S0, pts) => { const C = Cam(45, 0.5, 1); fit(C, pts, 0, 0); const e = extentOf(C, pts); return Math.min(S0, 370 / (e[2] - e[0]), 292 / (e[3] - e[1])); };

  /** A two-colour gradient along world x (user space, aimed per frame): { fill, opq, stroke, aim }. */
  let gid = 0;
  function gradient(svg, roles) {
    const id = "hlg-biplanar-" + (++gid), defs = mk("defs", {}, svg), out = {}, els = [];
    const f = { fill: (r) => "light-dark(color-mix(in srgb,var(--" + r + "-hex,transparent) 26%,transparent),color-mix(in srgb,var(--" + r + "-hex,transparent) 40%,transparent))",
      opq: (r) => "light-dark(color-mix(in srgb,var(--" + r + "-hex,transparent) 30%,var(--hl-plate)),color-mix(in srgb,var(--" + r + "-hex,transparent) 46%,var(--hl-plate)))",
      stroke: (r) => "light-dark(var(--" + r + "-l,CanvasText),var(--" + r + "-d,CanvasText))" };
    for (const key of ["fill", "opq", "stroke"]) {
      const lg = mk("linearGradient", { id: id + key, gradientUnits: "userSpaceOnUse" }, defs);
      roles.forEach((r, i) => { const st = mk("stop", { offset: String(i / (roles.length - 1)) }, lg); st.style.stopColor = f[key](r); });
      out[key] = "url(#" + id + key + ")"; els.push(lg);
    }
    out.aim = (a, b) => els.forEach((lg) => { lg.setAttribute("x1", a[0]); lg.setAttribute("y1", a[1]); lg.setAttribute("x2", b[0]); lg.setAttribute("y2", b[1]); });
    return out;
  }

  const L = 60, D = 30, H = 40, TT = 2, LW0 = 8, LW1 = 11, SZ = 28, ST = 1.6, TW = 1.6, T = 12, PEEK = 0.3, HL_ = H - TT;
  const NAMES = ["costado 1", "repisa", "plano 1", "costado 2"];
  // groups: 0 narrow leg (4 plates), 1 shelf, 2 top, 3 wide leg (4 plates). Each part: box, r, b, group, and its explode offset along x / z.
  const wall = (x0, x1) => [x0, 0, 0, x1, D, HL_], plate = (x0, x1, z) => [x0, 0, z, x1, D, z + ST];
  const PARTS = [
    { g: 2, box: [0, 0, H - TT, L, D, H], r: 0.83, b: 0.5, ex: [0, 0, 30] },
    { g: 1, box: [LW0, 0, SZ, L - LW1, D, SZ + ST], r: 0.67, b: 0.5, ex: [0, 0, 0] },
    { g: 0, box: wall(0, TW), r: 0.6, b: 0.4, ex: [-30, 0, 0] },
    { g: 0, box: wall(LW0 - TW, LW0), r: 0.6, b: 0.4, ex: [-6, 0, 0] },
    { g: 0, box: plate(TW, LW0 - TW, 0), r: 0.67, b: 0.5, ex: [-18, 0, 0] },
    { g: 0, box: plate(TW, LW0 - TW, SZ), r: 0.67, b: 0.5, ex: [-18, 0, 0] },
    { g: 3, box: wall(L - TW, L), r: 0.6, b: 0.4, ex: [30, 0, 0] },
    { g: 3, box: wall(L - LW1, L - LW1 + TW), r: 0.6, b: 0.4, ex: [6, 0, 0] },
    { g: 3, box: plate(L - LW1 + TW, L - TW, 0), r: 0.67, b: 0.5, ex: [18, 0, 0] },
    { g: 3, box: plate(L - LW1 + TW, L - TW, SZ), r: 0.67, b: 0.5, ex: [18, 0, 0] },
  ];
  const GV = [[-1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]]; // anim pull axis per group
  const REST = PARTS.map((p) => p.box);
  const VIEWS = Views(3.0, REST, PARTS.map((p) => shiftBox(p.box, p.ex)));
  const ANIM_PTS = [[-15, 0, 0], [L + 15, 0, 0], [L + 15, D, 0], [-15, D + 15, 0], [0, 0, H + 15], [L, 0, H + 15]].concat(REST.flatMap(corners));
  const SA = animScale(3.0, ANIM_PTS);
  const animCam = () => { const C = Cam(45, 0.5, SA); fit(C, ANIM_PTS, 200, 166); return C; };
  // rest extents plus the travel (top up, legs out), so the phone crop never clips a pulled part
  const BOUNDS = (() => {
    const P = proj(animCam()), q = [];
    for (const x of [-T, L + T]) for (const y of [0, D + T]) for (const z of [0, H + T]) q.push(P(x, y, z));
    const x0 = Math.min(...q.map((p) => p[0])), x1 = Math.max(...q.map((p) => p[0])), y0 = Math.min(...q.map((p) => p[1])), y1 = Math.max(...q.map((p) => p[1]));
    const u = VIEWS.bounds();
    return unionB([x0, y0, x1 - x0, y1 - y0], [u[0] - 4, u[1] - 4, u[2] + 4, u[3] + 4]);
  })();

  HairlineSite.figures.biplanar = {
    bounds: BOUNDS,
    name: "biplanar",
    variantRole: "tint", variantsLabel: "Combinación de color",
    variants: [
      { id: "amarillo-azul", label: "Amarillo · Azul", en: "Yellow · Blue", colors: { tint: "#dcbd2c", "tint-2": "#dcbd2c", "tint-3": "#3f6fd0" } },
      { id: "verde-amarillo-rojo", label: "Verde · Amarillo · Rojo", en: "Green · Yellow · Red", colors: { tint: "#b4c93a", "tint-2": "#e0a812", "tint-3": "#d03a2c" } },
      { id: "azul-rojo-esmerilado", label: "Azul · Rojo (esmerilado)", en: "Blue · Red (frosted)", frosted: true, colors: { tint: "#12aac2", "tint-2": "#12aac2", "tint-3": "#cf4640" } },
      { id: "naranja-morado-esmerilado", label: "Naranja · Morado (esmerilado)", en: "Orange · Purple (frosted)", frosted: true, colors: { tint: "#e66e2e", "tint-2": "#e66e2e", "tint-3": "#6b45c4" } },
    ],
    title: "Biplanar",
    hint: "Arrastra un plano para sacarlo del volumen. Un toque lo deja fuera.",
    label: "Mesa de noche Biplanar de vidrio laminado: dos costados huecos, un plano superior y una repisa. Arrastra un plano para separarlo.",
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const g = mk("g", {}, svg);
      let mode = "anim", az = 45, tx = 0, C = animCam(), P = proj(C), front = facing(C);
      const wrap = PARTS.map(() => mk("g", {}, g));
      const sol = wrap.map((w) => solid(w));
      const ROLE = ["tint", "tint-2", "tint-2", "tint-3"]; // by group
      PARTS.forEach((p, i) => sol[i].sil.classList.add(ROLE[p.g]));
      const gr = gradient(svg, ["tint-2", "tint-3"]);
      const graded = (i) => PARTS[i].g === 1 || PARTS[i].g === 2;
      let frosted = false;
      const paintFill = () => PARTS.forEach((p, i) => { if (graded(i)) sol[i].sil.style.fill = frosted ? gr.opq : gr.fill; });
      const frost = (v) => { frosted = !!(v && v.frosted); sol.forEach((s) => s.sil.classList.toggle("opq", frosted)); paintFill(); };
      frost(ctx.variant);

      const gs = [0, 1, 2, 3].map(() => ({ sp: spring(0, { eps: 0.002 }) }));
      const held = [false, false, false, false];
      let hoverP = -1, dragP = -1, dragF = 0, peekT = 0, lit = -2, lastRead = "", cur = REST, lastKey = "";
      const gOff = (gi) => { const d = gs[gi].sp.x * T, v = GV[gi]; return [v[0] * d, v[1] * d, v[2] * d]; };
      function render() {
        C = mode === "anim" ? animCam() : mode === "orbit" ? VIEWS.orbit(az) : VIEWS.explode();
        P = proj(C); front = facing(C);
        cur = PARTS.map((p) => shiftBox(p.box, mode === "anim" ? gOff(p.g) : mode === "explode" ? p.ex.map((v) => v * tx) : [0, 0, 0]));
        cur.forEach((b, i) => { const p = PARTS[i], [r, inn] = rings(b[0], b[1], b[3], b[4], p.r, p.b); put(sol[i], prism(P, front, r, inn, b[2], b[5])); });
        const z = H - TT / 2;
        gr.aim(P(0, D / 2, z), P(L, D / 2, z));
        paintOrder(cur, C).forEach((i) => g.appendChild(wrap[i]));
      }
      render();
      const strokeOf = () => PARTS.forEach((p, i) => { if (graded(i)) sol[i].sil.style.stroke = sol[i].sil.classList.contains("hi") ? "" : gr.stroke; });

      const B = register(ctx.stage, (dt) => {
        let a = -1, lvl = 0;
        if (dragP >= 0) { a = dragP; lvl = dragF; } else if (hoverP >= 0) { a = hoverP; lvl = PEEK; } else if (peekT > 0) { a = 2; lvl = PEEK * peekT; }
        let m = false;
        gs.forEach((q, i) => {
          let t = held[i] ? 1 : 0;
          if (a >= 0) t = Math.max(t, i === a ? lvl : (0.22 * lvl) / Math.abs(i - a));
          for (let j = 0; j < 4; j++) if (held[j] && j !== i) t = Math.max(t, 0.22 / Math.abs(i - j));
          q.sp.t = mode === "anim" ? t : 0;
          if (stepS(q.sp, dt)) m = true;
        });
        render();
        const heldI = held.lastIndexOf(true);
        const on = a >= 0 && lvl > 0.02 ? a : heldI >= 0 ? heldI : -1;
        const litI = mode !== "anim" ? -1 : on >= 0 ? on : 2;
        if (litI !== lit) { lit = litI; PARTS.forEach((p, i) => sol[i].sil.classList.toggle("hi", p.g === litI)); strokeOf(); }
        const r = mode !== "anim" ? "" : on >= 0 ? NAMES[on] : "rest";
        if (r !== lastRead) { lastRead = r; ctx.read(r); }
        return m || dragP >= 0;
      });
      bag.add(B.unregister);

      // the part under p at rest (anim camera, so a target never runs away from the pointer), front to back; -1 when p is off the object
      const AP = proj(animCam());
      const grpHull = (gi) => hull(PARTS.filter((p) => p.g === gi).flatMap((p) => corners(p.box).map((q) => AP(q[0], q[1], q[2]))));
      const hulls = [0, 1, 2, 3].map(grpHull);
      const pickAt = (p) => {
        for (const k of [2, 3, 0, 1]) if (pip(hulls[k], p)) return k;
        let bk = -1, bd = 12;
        hulls.forEach((h, k) => { const d = edgeD(h, p); if (d < bd) { bd = d; bk = k; } });
        return bk;
      };
      const sdir = GV.map((v) => { const o = AP(0, 0, 0), e = AP(v[0], v[1], v[2]); return [e[0] - o[0], e[1] - o[1]]; });

      return {
        hit: (p) => (mode === "anim" ? pickAt(p) >= 0 : hitBoxes(P, cur, p)),
        setMode(m) {
          mode = m; az = 45; tx = 0; hoverP = -1; dragP = -1; peekT = 0; held.fill(false); lit = -2; lastKey = "";
          gs.forEach((q) => { q.sp.t = 0; });
          render(); B.wake();
        },
        orbit(a) { az = a; render(); },
        explode(t) { tx = t; render(); },
        hover(p) { const k = p ? pickAt(p) : -1; if (k !== hoverP) { hoverP = k; B.wake(); } },
        peek(t) { peekT = t; B.wake(); },
        press(p) { dragP = pickAt(p); hoverP = -1; dragF = 0; B.wake(); },
        drag(p, d) {
          if (dragP < 0) return;
          const sd = sdir[dragP];
          dragF = clamp((d.dx * sd[0] + d.dy * sd[1]) / (sd[0] * sd[0] + sd[1] * sd[1]) / T, 0, 1);
          B.wake();
        },
        release() { dragP = -1; B.wake(); },
        tap(p) { const k = pickAt(p); dragP = -1; if (k >= 0) held[k] = !held[k]; B.wake(); },
        setVariant: frost,
        destroy: bag.dispose,
      };
    },
  };
})();
