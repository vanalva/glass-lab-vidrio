/**
 * Hashtag on the Hairline site runtime (see ../hairline-site.js). Drawing from ../hashtag.js.
 * Two shelves and two uprights that cross. Each shelf is drawn as three pieces that butt against the uprights (the upright plane runs through
 * the shelf plane, so there is nothing to draw where they cross).
 * MODES: "anim" (illustrative, below), "orbit" (Girar: only the camera turns) and "explode" (Despiece: both shelves slide +y and both uprights
 * slide -y, along the crossing lines, until nothing touches; every piece of a plane moves together).
 * Anim: hover / scroll peek: the plane under the pointer slides out a little (the others follow a little less). Drag: pull the plane out along its
 * crossing line; release: it eases back. Tap: latches it fully out, tap again lets it go.
 * COLOUR (static, no picker: the renders show one fixed combination): from catalogo/hashtag-render-a.webp (and -b, the small twin). The left upright
 * is pink, the right upright yellow, and each shelf GRADES smoothly pink to yellow along its length (two stops, tint to tint-2). All glass is `opq`.
 * QUESTION: "Guillermo, ¿los planos del Hashtag estan ranurados para cruzarse, o son placas pegadas?" (drawn as crossing planes; the despiece slides them apart along y)
 * QUESTION: "¿Existe una combinacion verde-naranja, como la del render pequeno?"
 * QUESTION: "¿El color es un degradado continuo rosa-amarillo en cada repisa?" (drawn as a continuous grade)
 * QUESTION: "¿Cuanto sobresalen los planos verticales por arriba y por abajo?"
 */
(function () {
  const { Cam, clamp, facing, fit, hull, poly, proj, rings, prism, put, solid, spring, stepS, disposer, mk, register } = HL;
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

  /** A two-colour gradient along world x (user space, aimed per frame): { opq, stroke, aim }. */
  let gid = 0;
  function gradient(svg, roles) {
    const id = "hlg-hashtag-" + (++gid), defs = mk("defs", {}, svg), out = {}, els = [];
    const f = { opq: (r) => "light-dark(color-mix(in srgb,var(--" + r + "-hex,transparent) 30%,var(--hl-plate)),color-mix(in srgb,var(--" + r + "-hex,transparent) 46%,var(--hl-plate)))",
      stroke: (r) => "light-dark(var(--" + r + "-l,CanvasText),var(--" + r + "-d,CanvasText))" };
    for (const key of ["opq", "stroke"]) {
      const lg = mk("linearGradient", { id: id + key, gradientUnits: "userSpaceOnUse" }, defs);
      roles.forEach((r, i) => { const st = mk("stop", { offset: String(i / (roles.length - 1)) }, lg); st.style.stopColor = f[key](r); });
      out[key] = "url(#" + id + key + ")"; els.push(lg);
    }
    out.aim = (a, b) => els.forEach((lg) => { lg.setAttribute("x1", a[0]); lg.setAttribute("y1", a[1]); lg.setAttribute("x2", b[0]); lg.setAttribute("y2", b[1]); });
    return out;
  }

  const L = 40, D = 30, TH = 1.2, V0 = 6, V1 = 32.8, VH = 50;
  const SHELF = [[45.6, 46.8], [2.6, 3.8]];
  const NAMES = ["tapa", "base", "plano izq", "plano der"];
  const DIRS = [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]];
  const PINK = "#dd66a8", YEL = "#e0ca5b";
  const FULL = 12, MAXP = 20, PEEK = 7, FOLLOW = 0.2, SLOP = 10, XOUT = 20;

  // parts: p = plane (0 top shelf, 1 base shelf, 2 left upright, 3 right upright); box; exploded offset along y
  const PARTS = (() => {
    const sh = (p, x0, x1) => ({ p, box: [x0, 0, SHELF[p][0], x1, D, SHELF[p][1]], ex: [0, XOUT, 0] });
    const up = (p, x0) => ({ p, box: [x0, 0, 0, x0 + TH, D, VH], ex: [0, -XOUT, 0] });
    return [
      sh(0, 0, V0), sh(1, 0, V0), up(2, V0), sh(0, V0 + TH, V1), sh(1, V0 + TH, V1), up(3, V1), sh(0, V1 + TH, L), sh(1, V1 + TH, L),
    ];
  })();
  const REST = PARTS.map((q) => q.box);
  const VIEWS = Views(3.8, REST, PARTS.map((q) => shiftBox(q.box, q.ex)));
  // rest bounds, widened to every plane's furthest pull, so a full-bleed crop never cuts a drag
  const ANIM_PTS = REST.concat(REST.map((b) => shiftBox(b, [0, MAXP, 0]))).flatMap(corners);
  const SA = animScale(3.8, ANIM_PTS);
  const animCam = () => { const C = Cam(45, 0.5, SA); fit(C, ANIM_PTS, 200, 166); return C; };
  const BOUNDS = (() => {
    const e = extentOf(animCam(), ANIM_PTS), u = VIEWS.bounds();
    const x0 = Math.min(e[0], u[0]) - 4, y0 = Math.min(e[1], u[1]) - 4, x1 = Math.max(e[2], u[2]) + 4, y1 = Math.max(e[3], u[3]) + 4;
    return [x0, y0, x1 - x0, y1 - y0];
  })();

  HairlineSite.figures.hashtag = {
    name: "hashtag",
    bounds: BOUNDS,
    title: "Hashtag",
    hint: "Arrastra un plano para sacarlo. Un toque lo deja fuera.",
    label: "Mesa auxiliar Hashtag, de vidrio laminado: cuatro planos que se atraviesan. Arrastra un plano para sacarlo.",
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const g = mk("g", {}, svg);
      let mode = "anim", az = 45, tx = 0, C = animCam(), P = proj(C), front = facing(C), cur = REST;
      HairlineSite.paint(svg, "tint", PINK); HairlineSite.paint(svg, "tint-2", YEL);
      const gr = gradient(svg, ["tint", "tint-2"]);

      const wrap = PARTS.map(() => mk("g", {}, g));
      const sol = wrap.map((w) => solid(w));
      PARTS.forEach((q, i) => {
        const role = q.p === 2 ? "tint" : q.p === 3 ? "tint-2" : "tint";
        sol[i].sil.classList.add("opq", role);
        if (q.p < 2) sol[i].sil.style.fill = gr.opq;
      });
      const planes = [0, 1, 2, 3].map(() => ({ sp: spring(0, { eps: 0.02 }) }));
      const strokeOf = () => PARTS.forEach((q, i) => { if (q.p < 2) sol[i].sil.style.stroke = sol[i].sil.classList.contains("hi") ? "" : gr.stroke; });

      function render() {
        C = mode === "anim" ? animCam() : mode === "orbit" ? VIEWS.orbit(az) : VIEWS.explode();
        P = proj(C); front = facing(C);
        cur = PARTS.map((q) => {
          const d = mode === "anim" ? planes[q.p].sp.x : 0, v = DIRS[q.p];
          const off = mode === "explode" ? q.ex.map((x) => x * tx) : [v[0] * d, v[1] * d, v[2] * d];
          return shiftBox(q.box, off);
        });
        cur.forEach((b, i) => {
          const [r, inn] = rings(b[0], b[1], b[3], b[4], 0.4, Math.min(0.55, (b[3] - b[0]) / 2 - 0.05, 0.55));
          put(sol[i], prism(P, front, r, inn, b[2], b[5]));
        });
        const yo = mode === "explode" ? XOUT * tx : mode === "anim" ? planes[0].sp.x : 0, zm = (SHELF[0][1] + SHELF[1][0]) / 2;
        gr.aim(P(0, D / 2 + yo, zm), P(L, D / 2 + yo, zm));
        paintOrder(cur, C).forEach((i) => g.appendChild(wrap[i]));
      }
      render();

      // state
      let hov = -1, drag = -1, latch = -1, dragAmt = 0, peekT = 0, shown = -2, B;
      const focus = () => (drag >= 0 ? drag : latch >= 0 ? latch : hov >= 0 ? hov : peekT > 0.01 ? 0 : -1);
      const amount = () => (drag >= 0 ? dragAmt : latch >= 0 ? FULL : hov >= 0 ? PEEK : PEEK * peekT);
      function retarget() {
        const a = mode === "anim" ? focus() : -1, amt = amount();
        planes.forEach((pl, i) => { pl.sp.t = a < 0 ? 0 : i === a ? amt : amt * FOLLOW; });
        const lit = mode === "anim" ? a : -2;
        if (lit !== shown) {
          shown = lit;
          PARTS.forEach((q, i) => sol[i].sil.classList.toggle("hi", lit === -2 ? false : q.p === (a < 0 ? 0 : a)));
          strokeOf();
          ctx.read(mode !== "anim" ? "" : a < 0 ? "rest" : NAMES[a]);
        }
        B.wake();
      }

      B = register(ctx.stage, (dt) => {
        let moving = false;
        planes.forEach((pl) => { if (stepS(pl.sp, dt)) moving = true; });
        render();
        return moving;
      });
      bag.add(B.unregister);
      ctx.read("rest");
      PARTS.forEach((q, i) => sol[i].sil.classList.toggle("hi", q.p === 0));
      strokeOf();

      // hit in anim: rest silhouettes (anim camera), nearest part first; slop for fingers
      const AP = proj(animCam());
      const area = [0, 1, 2, 3].map((p) => hull(PARTS.filter((q) => q.p === p).flatMap((q) => corners(q.box).map((c) => AP(c[0], c[1], c[2])))));
      const pick = (p) => {
        const hit = [3, 0, 1, 2].find((i) => pip(area[i], p));
        if (hit !== undefined) return hit;
        let best = -1, bd = SLOP;
        area.forEach((pg, i) => { const d = edgeD(pg, p); if (d < bd) { bd = d; best = i; } });
        return best;
      };

      // the drag axis on screen: one cm of pull
      const o = AP(0, 0, 0), ey = AP(0, 1, 0), ax = ey[0] - o[0], ay = ey[1] - o[1], n2 = ax * ax + ay * ay;
      const along = (dx, dy) => (dx * ax + dy * ay) / n2;
      let down = -1;

      return {
        hit: (p) => (mode === "anim" ? pick(p) >= 0 : hitBoxes(P, cur, p)),
        setMode(m) {
          mode = m; az = 45; tx = 0; hov = -1; drag = -1; latch = -1; down = -1; peekT = 0; shown = -3;
          planes.forEach((pl) => { pl.sp.t = 0; });
          retarget(); render();
        },
        orbit(a) { az = a; render(); },
        explode(t) { tx = t; render(); },
        hover(p) {
          const h = p ? pick(p) : -1;
          if (h !== hov) { hov = h; retarget(); }
        },
        peek(t) { peekT = t; retarget(); },
        press(p) { down = pick(p); hov = -1; },
        drag(p, d) {
          if (down < 0) return;
          drag = down; latch = -1;
          dragAmt = clamp(along(d.dx, d.dy), 0, MAXP);
          retarget();
        },
        release() { drag = -1; down = -1; retarget(); },
        tap(p) {
          const a = pick(p);
          latch = a < 0 || a === latch ? -1 : a;
          down = -1; drag = -1;
          retarget();
        },
        destroy: bag.dispose,
      };
    },
  };
})();
