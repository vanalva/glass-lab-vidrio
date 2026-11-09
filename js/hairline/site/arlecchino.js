/**
 * Arlecchino on the Hairline site runtime (see ../hairline-site.js). Drawing from ../arlecchino.js.
 * Dining table: two end blocks (a coloured cap and two glass legs each), a clear plate flush with the cap tops, a clear apron under it.
 * Three modes:
 *   anim     (illustrative, disclaimed) three parts each with one number 0..1: end 1 and end 2 slide away along the table, the plate
 *            lifts. Hover / scroll peek: the part under the pointer starts to move and a dashed ghost shows where it can go.
 *            Press + drag pulls the part under the finger; release leaves it there. A tap sends the part fully out, or back.
 *   orbit    "Girar": only the camera turns.
 *   explode  "Despiece": the plate lifts straight up out of the caps, the two end blocks slide outward along the length; the apron stays.
 * Colour (static, no picker): arlecchino-render-a/b.webp and furniture-app/arlecchino-app.webp show morado AND naranja on one
 * table: both ends are laminated purple glass (caps and legs) except one back leg, which is orange. The plate and the apron are
 * clear frosted glass and stay clear.
 */
(function () {
  const { Cam, clamp, facing, fit, hull, open, poly, proj, ringAt, rings, run, prism, put, solid, unproj, spring, stepS, disposer, mk, register } = HL;

  // ---- orbit / explode scene (the same block sits in every furniture figure) -------------------------------------------------
  // A part is { box: [x0,y0,x1,y1,z0,z1] world AABB at rest, ex: [dx,dy,dz] where it goes at explode t=1, off: [dx,dy,dz] the
  // figure's own animation offset, g: its <g>, draw(P, front, o, v) }. o = off + t*ex. Paint order is recomputed from the boxes for
  // every camera: a part is painted after every part that is separated from it by a plane with the viewer on its side.
  function near([x, y], pl, slop) {
    let c = false, d = Infinity;
    for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) {
      const [xi, yi] = pl[i], [xj, yj] = pl[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
      const ex = xj - xi, ey = yj - yi, l2 = ex * ex + ey * ey || 1, t = Math.max(0, Math.min(1, ((x - xi) * ex + (y - yi) * ey) / l2));
      d = Math.min(d, Math.hypot(x - xi - ex * t, y - yi - ey * t));
    }
    return c || d < slop;
  }
  function hullsOverlap(a, b) {
    for (const pg of [a, b]) for (let i = 0; i < pg.length; i++) {
      const p = pg[i], q = pg[(i + 1) % pg.length], nx = p[1] - q[1], ny = q[0] - p[0];
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const r of a) { const d = r[0] * nx + r[1] * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const r of b) { const d = r[0] * nx + r[1] * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      const eps = 0.3 * Math.hypot(nx, ny);
      if (a1 <= b0 + eps || b1 <= a0 + eps) return false;
    }
    return true;
  }
  function paintOrder(boxes, C) {
    const zf = Math.sqrt(1 - C.k * C.k), e = [zf * Math.sin(C.az), zf * Math.cos(C.az), C.k];
    const n = boxes.length, dep = boxes.map((b) => e[0] * (b[0] + b[2]) / 2 + e[1] * (b[1] + b[3]) / 2 + e[2] * (b[4] + b[5]) / 2);
    const after = boxes.map(() => []), left = new Array(n).fill(0), LO = [0, 1, 4], HI = [2, 3, 5];
    const Pj = proj(C), H = boxes.map((b) => hull(boxCorners(b, [0, 0, 0]).map((c) => Pj(c[0], c[1], c[2]))));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!hullsOverlap(H[i], H[j])) continue; // parts that do not overlap on screen never need an order
      const A = boxes[i], B = boxes[j];
      let ord = 0, best = 1e-6;
      for (let a = 0; a < 3; a++) {
        let o = 0;
        if (A[LO[a]] >= B[HI[a]] - 1e-6) o = e[a] > 0 ? 1 : -1;
        else if (B[LO[a]] >= A[HI[a]] - 1e-6) o = e[a] > 0 ? -1 : 1;
        if (o && Math.abs(e[a]) > best) { best = Math.abs(e[a]); ord = o; }
      }
      if (ord === 1) { after[j].push(i); left[i]++; } else if (ord === -1) { after[i].push(j); left[j]++; }
    }
    const out = [], done = new Array(n).fill(false);
    for (let m = 0; m < n; m++) {
      let pick = -1;
      for (let i = 0; i < n; i++) if (!done[i] && left[i] === 0 && (pick < 0 || dep[i] < dep[pick])) pick = i;
      if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || dep[i] < dep[pick])) pick = i;
      done[pick] = true; out.push(pick);
      for (const x of after[pick]) left[x]--;
    }
    return out;
  }
  const boxCorners = (b, o) => { const out = []; for (const x of [b[0], b[2]]) for (const y of [b[1], b[3]]) for (const z of [b[4], b[5]]) out.push([x + o[0], y + o[1], z + o[2]]); return out; };
  const cloud = (parts, t) => parts.flatMap((p) => boxCorners(p.box, [p.ex[0] * t, p.ex[1] * t, p.ex[2] * t]));
  function halfExtent(S, az, pts) {
    const P = proj(Cam(az, 0.5, S));
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const p of pts) { const q = P(p[0], p[1], p[2]); a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); }
    return [(b - a) / 2, (d - c) / 2];
  }
  /** The scale for orbit / explode (S0, shrunk only if a full turn or the exploded view would leave the frame) and the full-bleed bounds. */
  function frameFor(defs, animPts, S0, cx, cy) {
    let hw = 0, hh = 0;
    const take = (w, h) => { hw = Math.max(hw, w); hh = Math.max(hh, h); };
    const c0 = cloud(defs, 0);
    for (let az = 0; az < 360; az += 5) take(...halfExtent(S0, az, c0));
    take(...halfExtent(S0, 45, c0.concat(cloud(defs, 1))));
    const SO = S0 * Math.min(1, 184 / hw, Math.min(cy - 16, 304 - cy) / hh), k = SO / S0;
    let bw = hw * k, bh = hh * k;
    const [aw, ah] = halfExtent(S0, 45, animPts);
    bw = Math.max(bw, aw); bh = Math.max(bh, ah);
    return { SO, bounds: [cx - bw, cy - bh, 2 * bw, 2 * bh] };
  }
  function Scene(root, parts, cfg) {
    const top = mk("g", {}, root);
    let mode = "anim", az = 45, t = 0, key = "", v = null;
    const cur = (p) => [p.off[0] + t * p.ex[0], p.off[1] + t * p.ex[1], p.off[2] + t * p.ex[2]];
    function view() {
      let C;
      if (mode === "anim") { C = Cam(45, 0.5, cfg.S0); fit(C, cfg.animPts, cfg.cx, cfg.cy); }
      else { C = Cam(az, 0.5, cfg.SO); fit(C, mode === "explode" ? cloud(parts, 0).concat(cloud(parts, 1)) : cloud(parts, 0), cfg.cx, cfg.cy); }
      return { C, P: proj(C), front: facing(C) };
    }
    const sc = {
      top,
      get v() { return v; },
      get mode() { return mode; },
      redraw() {
        v = view();
        const boxes = parts.map((p) => { const o = cur(p), b = p.box; return [b[0] + o[0], b[1] + o[1], b[2] + o[0], b[3] + o[1], b[4] + o[2], b[5] + o[2]]; });
        parts.forEach((p) => p.draw(v.P, v.front, cur(p), v));
        const ord = paintOrder(boxes, v.C), k = ord.join();
        if (k !== key) { key = k; for (const i of ord) root.appendChild(parts[i].g); root.appendChild(top); }
      },
      setMode(m) { mode = m; az = 45; t = 0; key = ""; if (m === "orbit") cfg.read("giro 45°"); else if (m === "explode") cfg.read("despiece 0%"); },
      orbit(a) { az = a; sc.redraw(); cfg.read("giro " + Math.round(a) + "°"); },
      explode(x) { t = x; sc.redraw(); cfg.read("despiece " + Math.round(x * 100) + "%"); },
      hit(p, slop) {
        const pts = [];
        for (const q of parts) for (const c of boxCorners(q.box, cur(q))) pts.push(v.P(c[0], c[1], c[2]));
        return near(p, hull(pts), slop == null ? 10 : slop);
      },
    };
    return sc;
  }

  const L = 180, WD = 90, HT = 75, CAP = 30, CZ = 67, PZ = 70, LY = [[0, 12], [78, 90]];
  const G = 14, PEEK = 0.3, PULL = 70;
  const NAMES = ["extremo 1", "tablero", "extremo 2"];
  // QUESTION: ¿Las cuatro patas son de tonos distintos, o hay tres moradas y una naranja? ¿Las dos patas traseras son naranja?
  // QUESTION: ¿La mesa se entrega armada de una pieza, o los extremos y el tablero se separan?
  // QUESTION: ¿El tablero claro va pegado a los extremos, o apoya sobre ellos?
  const ORANGE_IDX = 3; // current behaviour: one orange back leg (end B, back leg)

  // part order: [0..1] legs of end A, [2] cap A, [3..4] legs of end B, [5] cap B, [6] apron, [7] plate
  const XA = 0, XB = L - CAP, OUT = 26;
  const DEFS = [
    ...LY.map(([y0, y1]) => ({ box: [XA, y0, XA + CAP, y1, 0, CZ], ex: [-OUT, 0, 0], end: 0 })),
    { box: [XA, 0, XA + CAP, WD, CZ, HT], ex: [-OUT, 0, 0], end: 0 },
    ...LY.map(([y0, y1]) => ({ box: [XB, y0, XB + CAP, y1, 0, CZ], ex: [OUT, 0, 0], end: 2 })),
    { box: [XB, 0, XB + CAP, WD, CZ, HT], ex: [OUT, 0, 0], end: 2 },
    { box: [CAP, 0, L - CAP, WD, 62, 64.5], ex: [0, 0, 0], end: -1 },
    { box: [CAP, 0, L - CAP, WD, PZ, HT], ex: [0, 0, 24], end: 1 },
  ];
  const ANIM_PTS = [[-26, 0, 0], [L + 26, 0, 0], [L + 26, WD, 0], [-26, WD, 0], [-26, 0, HT], [L + 26, WD, HT], [30, 0, HT + 26], [150, WD, HT + 26]];
  const S0 = 1.28, CX = 200, CY = 166;
  const FRAME = frameFor(DEFS, ANIM_PTS, S0, CX, CY);

  HairlineSite.figures.arlecchino = {
    name: "arlecchino",
    title: "Arlecchino",
    hint: "Arrastra la mesa para verla de otra manera: animación, giro o despiece.",
    label: "Mesa de comedor Arlecchino: un tablero claro entre dos extremos de cuatro patas. Arrastra para animarla, girarla o despiezarla.",
    bounds: FRAME.bounds,
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const root = mk("g", {}, svg);
      const ghost = mk("path", { class: "nf hi", "stroke-dasharray": "6 4", opacity: "0" }, root);
      const parts = DEFS.map((d) => ({ ...d, g: mk("g", {}, root), off: [0, 0, 0] }));
      const sc = Scene(root, parts, { S0, SO: FRAME.SO, animPts: ANIM_PTS, cx: CX, cy: CY, read: ctx.read });
      root.appendChild(ghost);
      const PURPLE = "#560e9e", ORANGE = "#d97225"; // pernia-mobiliario.json arlecchino colourways
      HairlineSite.paint(svg, "tint", PURPLE);
      HairlineSite.paint(svg, "tint-2", ORANGE);

      const sols = parts.map((p) => solid(p.g));
      const feet = parts.map((p, i) => (i < 6 && i % 3 < 2 ? mk("path", { class: "nf lo" }, p.g) : null));
      parts.forEach((p, i) => {
        const [x0, y0, x1, y1, z0, z1] = p.box, isLeg = i < 6 && i % 3 < 2, isCap = i < 6 && i % 3 === 2;
        const [r, inn] = isLeg ? rings(x0, y0, x1, y1, 1.2, 0.9) : rings(x0, y0, x1, y1, 1.6, 1.1);
        if (isLeg || isCap) sols[i].sil.classList.add(i === ORANGE_IDX ? "tint-2" : "tint");
        p.draw = (P, front, o) => {
          put(sols[i], prism(P, front, r, inn, z0 + o[2], z1 + o[2]));
          if (feet[i]) feet[i].setAttribute("d", open(ringAt(P, run(inn, front), 3 + o[2])));
        };
      });
      const plate = parts[7];

      // anim state
      const tgt = [0, 0, 0], sp = [spring(0), spring(0), spring(0)];
      let hov = -1, peekT = 0, grab = -1, f0 = 0, last = -1, lastRead = "", lastHi = -2, ghostKey = "", drawn = "";
      function apply() {
        const key = sp.map((s) => s.x).join();
        if (key === drawn) return;
        drawn = key;
        for (const i of [0, 1, 2]) parts[i].off = [-G * sp[0].x, 0, 0];
        for (const i of [3, 4, 5]) parts[i].off = [G * sp[2].x, 0, 0];
        plate.off = [0, 0, G * sp[1].x];
        sc.redraw();
      }
      const ghostPath = (k) => {
        const P = sc.v.P;
        if (k === 1) { const [r] = rings(CAP, 0, L - CAP, WD, 1.6, 1.1); return poly(hull(ringAt(P, r, HT + G).concat(ringAt(P, r, PZ + G)))); }
        const x0 = k === 0 ? -G : L - CAP + G, [r] = rings(x0, 0, x0 + CAP, WD, 1.6, 1.1);
        return poly(hull(ringAt(P, r, HT).concat(ringAt(P, r, CZ))));
      };

      let B;
      const tick = (dt) => {
        let moving = false;
        for (let k = 0; k < 3; k++) {
          const pk = k === hov && grab < 0 ? PEEK : 0, ps = k === 1 ? peekT * PEEK : 0;
          sp[k].t = Math.max(tgt[k], pk, ps);
          if (stepS(sp[k], dt)) moving = true;
        }
        apply();
        const gk = grab >= 0 ? -1 : hov >= 0 ? hov : peekT > 0.02 ? 1 : -1;
        const gf = gk < 0 ? 0 : Math.max(0, 1 - sp[gk].x / (PEEK * 1.2)) * (gk === hov ? 1 : peekT);
        const key = gk + ":" + gf.toFixed(2);
        if (key !== ghostKey) {
          ghostKey = key;
          ghost.setAttribute("d", gk < 0 ? "" : ghostPath(gk));
          ghost.setAttribute("opacity", String(clamp(gf, 0, 0.9)));
        }
        let focus = grab >= 0 ? grab : hov >= 0 ? hov : last >= 0 && tgt[last] > 0.02 ? last : -1;
        if (focus < 0) for (let k = 0; k < 3; k++) if (tgt[k] > 0.02) focus = k;
        const rd = focus < 0 ? "rest" : NAMES[focus] + (tgt[focus] > 0.02 ? " " + Math.round(sp[focus].x * 100) + "%" : "");
        if (rd !== lastRead) { lastRead = rd; if (sc.mode === "anim") ctx.read(rd); }
        if (focus !== lastHi) {
          lastHi = focus;
          sols[7].sil.classList.toggle("hi", focus < 0 || focus === 1);
          for (const i of [0, 1, 2]) sols[i].sil.classList.toggle("hi", focus === 0);
          for (const i of [3, 4, 5]) sols[i].sil.classList.toggle("hi", focus === 2);
        }
        return moving;
      };
      B = register(ctx.stage, tick);
      bag.add(B.unregister);
      sc.redraw();
      sols[7].sil.classList.add("hi");
      lastHi = 1;
      // picking (the anim camera never changes)
      const legBoxes = [[0, 1], [3, 4]].map((ids, e) => ids.map((i) => ({ i: e * 2, b: parts[i].box })));
      function pick(p) {
        const C = sc.v.C, [x, y] = unproj(C, p[0], p[1], HT);
        if (x > -8 && x < L + 8 && y > -8 && y < WD + 8) return x < CAP ? 0 : x > L - CAP ? 2 : 1;
        const P = sc.v.P;
        for (const grp of legBoxes) for (const { i, b } of grp) {
          const h = hull(boxCorners(b, [0, 0, 0]).map((c) => P(c[0], c[1], c[2])));
          if (near(p, h, 8)) return i;
        }
        return -1;
      }

      return {
        hit: (p) => (sc.mode === "anim" ? pick(p) >= 0 : sc.hit(p, 10)),
        setMode(m) {
          sc.setMode(m);
          tgt.fill(0); sp.forEach((s) => { s.x = 0; s.t = 0; s.v = 0; });
          hov = -1; peekT = 0; grab = -1; last = -1; drawn = "";
          ghost.setAttribute("d", ""); ghost.setAttribute("opacity", "0"); ghostKey = "";
          parts.forEach((p) => { p.off = [0, 0, 0]; });
          sc.redraw();
          if (m === "anim") ctx.read("rest");
        },
        orbit: (a) => sc.orbit(a),
        explode: (t) => sc.explode(t),
        hover(p) { const h = p ? pick(p) : -1; if (h !== hov) { hov = h; B.wake(); } },
        peek(t) { peekT = t; B.wake(); },
        press(p) { grab = pick(p); hov = -1; if (grab >= 0) { f0 = tgt[grab]; last = grab; } B.wake(); },
        drag(p, d) { if (grab >= 0) { tgt[grab] = clamp(f0 + Math.hypot(d.dx, d.dy) / PULL * (f0 > 0.5 ? -1 : 1), 0, 1); B.wake(); } },
        release() { grab = -1; B.wake(); },
        tap(p) { const k = pick(p); if (k >= 0) { tgt[k] = tgt[k] > 0.5 ? 0 : 1; last = k; B.wake(); } grab = -1; },
        destroy: bag.dispose,
      };
    },
  };
})();
