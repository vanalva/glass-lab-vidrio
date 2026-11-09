/**
 * Pomarosa on the Hairline site runtime (see ../hairline-site.js). Drawing from ../pomarosa.js.
 * Console: two long laminated sheets (vino on the left, ambar on the right) overlap in the middle (29 cm, a third colour) on top of ONE
 * narrow amber glass body (an open box, 17 cm wide); two clear upright panes, one at each long edge, flank the sheets.
 * Departure from rule 06: the open glass body is drawn without fill so its floor and corners show.
 * Three modes:
 *   anim     (illustrative, disclaimed) one number: c, the middle of the crossing of the two sheets. Hover / scroll peek: the sheets
 *            slide a few cm toward the pointer's side and a dashed ghost of the crossing shows where it would go. Drag along the length:
 *            the crossing follows. Release stays. Tap: back to rest.
 *   orbit    "Girar": only the camera turns.
 *   explode  "Despiece": the two sheets lift off the body (vino first, ámbar above it), the two panes slide out sideways from the sheet edges.
 * Colour (static, no picker): pomarosa-render-a/b.webp show vino AND ambar on one console: the long sheets are laminated colour
 * glass (vino one side, ambar the other), the body is ambar; the upright panes are clear.
 */
(function () {
  const { Cam, clamp, facing, fit, hull, proj, rings, prism, put, solid, ringAt, rrect, poly, seg, spring, stepS, disposer, mk, register, unproj } = HL;

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

  const D = 30, HT = 75, SL = 70, OV = 29, C0 = 55.5, T = 20, PEEK = 10;
  // sheets sit on the body's top (z 61); the panes straddle the sheet plane (about 7 below, 10 above) and flank the sheets at the long edges
  const WZ = [61, 63], AZ = [63, 65], PZ = [58, 75];
  // QUESTION: ¿Qué medidas tiene el cuerpo de vidrio (ancho, fondo y alto) y en qué punto de la consola se coloca?
  // QUESTION: ¿Cuánto miden los dos vidrios verticales y van pegados al canto de los planos?
  // QUESTION: ¿Los dos planos están pegados al cuerpo? ¿Cuál va por encima en el cruce?
  // QUESTION: ¿Los vidrios verticales son transparentes o llevan color?
  // body: about 17 cm wide, between the two panes (y 1.5..28.5) so no part passes through another
  const BODY = [61, 1.5, 78, 28.5, 61];
  const PANE_X = [28, 81];
  const wr0 = C0 + OV / 2, al0 = C0 - OV / 2;
  const DEFS = [
    { box: [BODY[0], BODY[1], BODY[2], BODY[3], 0, BODY[4]], ex: [0, 0, 0] },
    { box: [PANE_X[0], 0, PANE_X[1], 1.5, PZ[0], PZ[1]], ex: [0, -22, 0] },
    { box: [PANE_X[0], D - 1.5, PANE_X[1], D, PZ[0], PZ[1]], ex: [0, 22, 0] },
    { box: [wr0 - SL, 1.5, wr0, D - 1.5, WZ[0], WZ[1]], ex: [0, 0, 20] },
    { box: [al0, 1.5, al0 + SL, D - 1.5, AZ[0], AZ[1]], ex: [0, 0, 40] },
  ];
  const ANIM_PTS = [[-24, 0, 0], [139, 0, HT], [139, D, 0], [-24, D, HT], [47, D, 0], [47, 0, HT]];
  const S0 = 2.5, CX = 200, CY = 166;
  const FRAME = frameFor(DEFS, ANIM_PTS.concat([[-30, 0, 0], [145, D, HT]]), S0, CX, CY);

  HairlineSite.figures.pomarosa = {
    bounds: FRAME.bounds,
    name: "pomarosa",
    title: "Pomarosa",
    hint: "Arrastra la consola para verla de otra manera: animación, giro o despiece.",
    label: "Pomarosa, consola de vidrio laminado: dos planos, vino y ámbar, se cruzan en voladizo sobre un cuerpo de vidrio abierto. Arrastra para animarla, girarla o despiezarla.",
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const root = mk("g", {}, svg);
      const ghost = mk("path", { class: "nf hi", "stroke-dasharray": "5 4" }, root);
      const parts = DEFS.map((d) => ({ ...d, g: mk("g", {}, root), off: [0, 0, 0] }));
      const sc = Scene(root, parts, { S0, SO: FRAME.SO, animPts: ANIM_PTS, cx: CX, cy: CY, read: ctx.read });
      root.appendChild(ghost);
      const [bodyP, paneB, paneF, wineP, ambP] = parts;
      HairlineSite.paint(svg, "tint", "#680243");   // vino
      HairlineSite.paint(svg, "tint-2", "#d2a832"); // ambar

      // the body: an open glass box, no fill, so its floor and its two far corners show through
      const [br, bi] = rings(BODY[0], BODY[1], BODY[2], BODY[3], 1.6, 1);
      const body = solid(bodyP.g), hid = mk("path", { class: "nf lo" }, bodyP.g);
      body.sil.classList.add("nf", "tint-2");
      const fl = rrect(BODY[0] + 1, BODY[1] + 1, BODY[2] - 1, BODY[3] - 1, 1, 3);
      const cs4 = [[BODY[0] + 1, BODY[1] + 1], [BODY[2] - 1, BODY[1] + 1], [BODY[2] - 1, BODY[3] - 1], [BODY[0] + 1, BODY[3] - 1]];
      bodyP.draw = (P, front, o, v) => {
        put(body, prism(P, front, br, bi, o[2], BODY[4] + o[2]));
        const s = Math.sin(v.C.az), c = Math.cos(v.C.az);
        const far = cs4.map((q, i) => ({ q, d: q[0] * s + q[1] * c })).sort((a, b) => a.d - b.d).slice(0, 2);
        hid.setAttribute("d", poly(ringAt(P, fl, 1.5 + o[2])) + far.map(({ q }) => seg(P(q[0], q[1], 1.5 + o[2]), P(q[0], q[1], BODY[4] - 1 + o[2]))).join(""));
      };

      // the two clear panes (never tinted)
      [paneB, paneF].forEach((p) => {
        const [x0, y0, x1, y1] = p.box, [r, i] = rings(x0, y0, x1, y1, 0.7, 0.4), s = solid(p.g);
        p.draw = (P, front, o) => put(s, prism(P, front, r, i, PZ[0] + o[2], PZ[1] + o[2]));
      });

      const wine = solid(wineP.g), amb = solid(ambP.g);
      wine.sil.classList.add("tint");
      amb.sil.classList.add("tint-2");
      const mark = mk("path", { class: "nf hi" }, ambP.g);
      const markD = (P, a, w, z) => poly(ringAt(P, rrect(a + 0.8, 2.3, w - 0.8, 27.7, 0.8, 3), z));
      wineP.draw = (P, front, o) => {
        const [r, i] = rings(wr0 - SL, 1.5, wr0, D - 1.5, 1.2, 0.8);
        put(wine, prism(P, front, r, i, WZ[0] + o[2], WZ[1] + o[2]));
      };
      ambP.draw = (P, front, o) => {
        const [r, i] = rings(al0, 1.5, al0 + SL, D - 1.5, 1.2, 0.8);
        put(amb, prism(P, front, r, i, AZ[0] + o[2], AZ[1] + o[2]));
        mark.setAttribute("d", markD(P, al0 + o[0], wr0 + o[0], AZ[1] + 0.01 + o[2]));
      };

      const cs = spring(C0, { eps: 0.02 }), pk = spring(0, { k: 120, c: 18 });
      let hov = false, peekT = 0, dir = 1, act = "rest", c0 = C0, drawn = NaN, gk = "", mode = "idle";

      function draw() {
        const c = clamp(cs.x + dir * PEEK * pk.x, C0 - T - PEEK, C0 + T + PEEK);
        if (c !== drawn) { drawn = c; wineP.off = [c - C0, 0, 0]; ambP.off = [c - C0, 0, 0]; sc.redraw(); }
        if (sc.mode !== "anim") { ghost.setAttribute("d", ""); gk = ""; return; }
        const on = pk.x > 0.03, tc = clamp(cs.x + dir * T, C0 - T, C0 + T), key = on ? tc.toFixed(1) : "";
        if (key !== gk) { gk = key; ghost.setAttribute("d", on ? markD(sc.v.P, tc - OV / 2, tc + OV / 2, AZ[1] + 0.02) : ""); }
        ghost.setAttribute("opacity", String(clamp(pk.x * 1.1, 0, 0.9)));
      }
      function paintHi() {
        wine.sil.classList.toggle("hi", act === "vino");
        amb.sil.classList.toggle("hi", act === "ámbar");
        const cr = act === "rest" || act === "cruce";
        mark.classList.toggle("hi", cr);
        mark.classList.toggle("lo", !cr);
        if (sc.mode === "anim") ctx.read(act);
      }
      sc.redraw();
      paintHi();

      const B = register(ctx.stage, (dt) => {
        const a = stepS(cs, dt), b = stepS(pk, dt);
        draw();
        return a || b;
      });
      bag.add(B.unregister);
      const retarget = () => { pk.t = mode === "drag" ? 0 : Math.max(hov ? 1 : 0, peekT); };

      const worldX = (p) => unproj(sc.v.C, p[0], p[1], AZ[1])[0];
      const nameAt = (p) => { const x = worldX(p); return x >= al0 && x <= wr0 ? "cruce" : x < al0 ? "vino" : "ámbar"; };
      const o0 = sc.v.P(0, 0, 0), ex = sc.v.P(1, 0, 0)[0] - o0[0], ey = sc.v.P(1, 0, 0)[1] - o0[1];
      const along = (dx, dy) => (dx * ex + dy * ey) / (ex * ex + ey * ey);

      return {
        hit: (p) => sc.hit(p, 8),
        setMode(m) {
          sc.setMode(m);
          cs.x = cs.t = C0; cs.v = 0; pk.x = pk.t = 0; pk.v = 0;
          hov = false; peekT = 0; dir = 1; act = "rest"; c0 = C0; drawn = NaN; gk = ""; mode = "idle";
          parts.forEach((p) => { p.off = [0, 0, 0]; });
          sc.redraw();
          paintHi();
          if (m === "anim") ctx.read("rest");
          B.wake();
        },
        orbit: (a) => sc.orbit(a),
        explode: (t) => sc.explode(t),
        hover(p) {
          const h = !!p && sc.hit(p, 8);
          if (h) { dir = worldX(p) >= cs.x ? 1 : -1; act = nameAt(p); } else act = "rest";
          hov = h; paintHi(); retarget(); B.wake();
        },
        peek(t) { peekT = t; if (t > 0) dir = 1; retarget(); B.wake(); },
        press() { mode = "idle"; hov = false; c0 = cs.x; retarget(); B.wake(); },
        drag(p, d) {
          if (mode !== "drag") { mode = "drag"; act = "cruce"; paintHi(); retarget(); }
          cs.t = clamp(c0 + along(d.dx, d.dy), C0 - T, C0 + T);
          B.wake();
        },
        release() { mode = "idle"; retarget(); B.wake(); },
        tap() { mode = "idle"; cs.t = C0; act = "rest"; paintHi(); retarget(); B.wake(); },
        destroy: bag.dispose,
      };
    },
  };
})();
