/**
 * Float on the Hairline site runtime (see ../hairline-site.js). Drawing from ../float.js.
 * Coffee table: a clear/pale base sheet, a top sheet of the same size 28 cm above it and offset 28 cm along the length, and clear
 * vertical glass panes between them forming a cross.
 * Three modes:
 *   anim     (illustrative, disclaimed) one number, `sx`: how far the top plane has slid along the length, in cm (clamped to the travel).
 *            Hover / scroll peek: the top nudges along the length and a dashed ghost shows where it can go.
 *            Drag slides the plane with the pointer, release leaves it. Tap sends it to the other side.
 *   orbit    "Girar": only the camera turns; the amber-to-petroleo fade follows the top sheet, not the screen.
 *   explode  "Despiece": the top sheet lifts straight up off the glass cross, the cross lifts a little off the base.
 * Colour (static, no picker): float-render-a/b.webp show ambar AND azul petroleo on one table: the top is laminated
 * colour glass fading ambar to petroleo along its length, the lower base sheet is a pale petroleo, and the upright panes
 * between them are clear.
 */
(function () {
  const { Cam, clamp, fit, poly, prism, put, rings, ringAt, solid, proj, facing, hull, spring, stepS, disposer, mk, register } = HL;

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

  const BX = [0, 0, 120, 55], TX = [28, 0, 148, 55];   // top offset +28 along the length, flush across (float-render-b.webp)
  const BZ1 = 1.5, TZ0 = 28.5, TZ1 = 30;
  const AY = 30, AX0 = 30, AX1 = 78, BXC = 72, BY0 = 0, BY1 = 30, T = 0.6, CZ0 = BZ1, CZ1 = TZ0;
  const TRAVEL = 24, NUDGE = 9;
  // QUESTION: ¿Cuántos vidrios verticales forman la cruz, cómo están colocados y qué medidas tienen?
  // QUESTION: ¿Cuánto sobresale el plano superior respecto al inferior (en largo y en ancho)?
  // QUESTION: ¿El plano superior va pegado a la cruz o simplemente apoya?

  // the cross is one glued assembly: a pane along the length and a pane across it that ends on the first
  const CROSS_A = [AX0, AY - T, AX1, AY + T, CZ0, CZ1], CROSS_B = [BXC - T, BY0, BXC + T, AY - T, CZ0, CZ1];
  const DEFS = [
    { box: [BX[0], BX[1], BX[2], BX[3], 0, BZ1], ex: [0, 0, 0] },
    { box: [AX0, BY0, AX1, AY + T, CZ0, CZ1], ex: [0, 0, 16] },
    { box: [TX[0], TX[1], TX[2], TX[3], TZ0, TZ1], ex: [0, 0, 40] },
  ];
  const ANIM_PTS = [[-14, -8, 0], [185, -8, 30], [185, 55, 0], [-14, 55, 30], [185, 55, 30]];
  const S0 = 1.85, CX = 200, CY = 166;
  const FRAME = frameFor(DEFS, ANIM_PTS, S0, CX, CY);

  /** A slab gradient from colour role a to role b (roles = the stage's --tint-* custom properties, so it follows the theme).
   *  userSpaceOnUse: the caller moves x1..y2 with the camera so the fade stays on the slab. Returns { fill, stroke, els }. */
  let gid = 0;
  function gradient(svg, a, b) {
    const id = "hlg-" + (++gid), defs = mk("defs", {}, svg), out = { els: [] };
    for (const [key, f] of [["fill", (r) => "light-dark(color-mix(in srgb,var(--" + r + "-hex,transparent) 26%,transparent),color-mix(in srgb,var(--" + r + "-hex,transparent) 40%,transparent))"], ["stroke", (r) => "light-dark(var(--" + r + "-l,CanvasText),var(--" + r + "-d,CanvasText))"]]) {
      const lg = mk("linearGradient", { id: id + key, gradientUnits: "userSpaceOnUse", x1: "0", y1: "0", x2: "1", y2: "0" }, defs);
      for (const [o, r] of [["0", a], ["1", b]]) {
        const st = mk("stop", { offset: o }, lg);
        st.style.stopColor = f(r);
      }
      out[key] = "url(#" + id + key + ")";
      out.els.push(lg);
    }
    return out;
  }

  HairlineSite.figures.float = {
    name: "float",
    title: "Float",
    hint: "Arrastra la mesa para verla de otra manera: animación, giro o despiece.",
    label: "Mesa de centro Float: un plano de vidrio laminado sobre una cruz de vidrio y un plano inferior. Arrastra para animarla, girarla o despiezarla.",
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
      const [base, crossP, topP] = parts;
      HairlineSite.paint(svg, "tint", "#e9b548");   // ambar
      HairlineSite.paint(svg, "tint-2", "#49768b"); // azul petroleo

      const bSol = solid(base.g), [br, bi] = rings(BX[0], BX[1], BX[2], BX[3], 2.5, 1.1);
      bSol.sil.classList.add("tint-2");
      base.draw = (P, front, o) => put(bSol, prism(P, front, br, bi, o[2], BZ1 + o[2]));

      const cross = [solid(crossP.g), solid(crossP.g)];
      const cRings = [CROSS_A, CROSS_B].map((b) => rings(b[0], b[1], b[2], b[3], 0.5, 0.4));
      crossP.draw = (P, front, o, v) => {
        [CROSS_A, CROSS_B].forEach((b, i) => put(cross[i], prism(P, front, cRings[i][0], cRings[i][1], b[4] + o[2], b[5] + o[2])));
        // the two panes overlap on screen only along their joint: the one nearer the viewer goes last
        const ord = paintOrder([CROSS_A, CROSS_B], v.C);
        for (const i of ord) crossP.g.appendChild(cross[i].g);
      };

      const topS = solid(topP.g), tg = gradient(svg, "tint", "tint-2");
      topS.sil.classList.add("tint");
      topS.sil.style.fill = tg.fill;
      let topHi = false;
      const topStroke = () => { topS.sil.style.stroke = topHi ? "" : tg.stroke; };
      topStroke();
      topP.draw = (P, front, o) => {
        const [r, i] = rings(TX[0] + o[0], TX[1], TX[2] + o[0], TX[3], 3, 1.2);
        put(topS, prism(P, front, r, i, TZ0 + o[2], TZ1 + o[2]));
        const a = P(TX[0] + o[0], TX[3] / 2, TZ1 + o[2]), b = P(TX[2] + o[0], TX[3] / 2, TZ1 + o[2]);
        for (const lg of tg.els) { lg.setAttribute("x1", a[0].toFixed(2)); lg.setAttribute("y1", a[1].toFixed(2)); lg.setAttribute("x2", b[0].toFixed(2)); lg.setAttribute("y2", b[1].toFixed(2)); }
      };

      const sp = spring(0, { eps: 0.02 }), pk = spring(0, { k: 120, c: 18 });
      let drawn = NaN, hover = false, peekT = 0, dragging = false, S0x = 0, lit = null, lastRead = "";
      const retarget = () => { pk.t = dragging ? 0 : Math.max(hover ? 1 : 0, peekT); };
      const ghostD = () => {
        const [r] = rings(TX[0] + TRAVEL, TX[1], TX[2] + TRAVEL, TX[3], 3, 1.2);
        return poly(ringAt(sc.v.P, r, TZ1));
      };

      const B = register(ctx.stage, (dt) => {
        let m = stepS(sp, dt);
        if (stepS(pk, dt)) m = true;
        const x = sp.x + NUDGE * pk.x;
        if (x !== drawn) { drawn = x; topP.off = [x, 0, 0]; sc.redraw(); }
        if (sc.mode === "anim") { ghost.setAttribute("d", pk.x > 0.02 ? ghostD() : ""); ghost.setAttribute("opacity", String(clamp(pk.x * 0.9, 0, 0.9))); }
        const on = pk.x > 0.05 || dragging || Math.abs(sp.x) > 0.5;
        if (on !== lit) {
          lit = on;
          topS.sil.classList.toggle("hi", on); topHi = on; topStroke();
          cross.forEach((c) => c.sil.classList.toggle("hi", !on));
        }
        const r = Math.abs(sp.x) < 0.5 ? "rest" : "plano " + (sp.x > 0 ? "+" : "") + Math.round(sp.x);
        if (r !== lastRead) { lastRead = r; if (sc.mode === "anim") ctx.read(r); }
        return m;
      });
      bag.add(B.unregister);
      sc.redraw();

      // slide along the world x axis: project it once (the anim camera never changes)
      const o0 = sc.v.P(0, 0, 0), ex = sc.v.P(1, 0, 0)[0] - o0[0], ey = sc.v.P(1, 0, 0)[1] - o0[1];
      const along = (dx, dy) => (dx * ex + dy * ey) / (ex * ex + ey * ey);

      return {
        hit: (p) => sc.hit(p, 10),
        setMode(m) {
          sc.setMode(m);
          sp.x = sp.t = 0; sp.v = 0; pk.x = pk.t = 0; pk.v = 0;
          hover = false; peekT = 0; dragging = false; drawn = NaN; lit = null; lastRead = "";
          topP.off = [0, 0, 0];
          ghost.setAttribute("d", ""); ghost.setAttribute("opacity", "0");
          sc.redraw();
          if (m === "anim") ctx.read("rest");
          B.wake();
        },
        orbit: (a) => sc.orbit(a),
        explode: (t) => sc.explode(t),
        hover(p) { const h = !!p && sc.hit(p, 10); if (h !== hover) { hover = h; retarget(); B.wake(); } },
        peek(t) { peekT = t; retarget(); B.wake(); },
        press() { dragging = true; hover = false; S0x = sp.t; retarget(); B.wake(); },
        drag(p, d) { sp.t = clamp(S0x + along(d.dx, d.dy), -TRAVEL, TRAVEL); B.wake(); },
        release(v) { dragging = false; sp.t = clamp(sp.t + along(v.x, v.y) * 0.12, -TRAVEL, TRAVEL); retarget(); B.wake(); },
        tap() { dragging = false; sp.t = sp.t > 0 ? -20 : 20; retarget(); B.wake(); },
        destroy: bag.dispose,
      };
    },
  };
})();
