/**
 * Perforata on the Hairline site runtime (see ../hairline-site.js for the contract).
 * Dining table: two frosted glass plates (the top has a window), two U-channel glass legs, and 48 fine colour stripes lying flat
 * under the window. The table has no moving parts. Three modes:
 *   anim     (illustrative, disclaimed) the stripes turn edge-on in a wave under the pointer, as the copy says "de canto casi desaparecen".
 *            At rest every stripe lies flat.
 *   orbit    "Girar": only the camera turns; paint order is recomputed per azimuth.
 *   explode  "Despiece": legs stay on the floor; apron, stripe layer and top plate lift straight up in that order (what sits on what).
 * Colour (static, no picker): the render (catalogo/perforata-render-b.webp, furniture-app/perforata-app.webp) shows BOTH
 * colourways on one table at once, as laminated colour stripes under clear frosted plates: the stripes run ciruela (one end)
 * to azul (the other) and each leg carries its own colour's stripes (ciruela leg, azul leg). Plates and aprons stay clear.
 */
(function () {
  const {
    Cam, clamp, facing, fillet, fit, hull, lerp, open, poly, proj, rad, ringAt, rings, rrect, run, seg, prism, put, solid,
    spring, stepS, disposer, mk, register, unproj,
  } = HL;

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

  const L = 200, Wd = 100, HT = 75;
  const TOP0 = 73.5, AP0 = 62, AP1 = 63.5;
  // 48 stripes, pitch 3.25 cm across the 156 cm window (x = 22..178); stripe about as wide as its gap (render b: 45-50 stripes)
  const N = 48, PITCH = 3.25, XS = 22 + PITCH / 2, SW = 1.6, SL = 68, SY0 = 16, ZC = 68.6;
  const LEG = [[18, 23], [177, 182]], LY0 = 22, LY1 = 78;
  const REACH = 85; // cm, the bench default
  const BLUE = "#2693d4", PLUM = "#7e2752"; // pernia-mobiliario.json perforata colourways
  // QUESTION: ¿Las franjas van impresas o laminadas dentro de un bloque de vidrio fijo, o son láminas de vidrio sueltas? ¿Cuántas franjas tiene la mesa?
  // QUESTION: ¿Alguna parte de la Perforata gira, se desliza o se desmonta, o toda la mesa es fija?
  // QUESTION: ¿Las franjas quedan entre los dos planos, a la vista por la ventana del plano superior?
  const mixHex = (a, b, t) => "#" + [1, 3, 5].map((k) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, "0")).join("");
  const XMIN = XS, XMAX = XS + (N - 1) * PITCH;
  const fall = (d, R) => 0.09 + 0.91 * Math.exp(-2.2 * (d / R) * (d / R));

  // the stack lifts in order: legs stay on the floor, then apron, stripe layer, top plate
  const DEFS = [
    { box: [LEG[0][0], LY0, LEG[0][1], LY1, 0, AP0], ex: [0, 0, 0] },
    { box: [LEG[1][0], LY0, LEG[1][1], LY1, 0, AP0], ex: [0, 0, 0] },
    { box: [0, 0, L, Wd, AP0, AP1], ex: [0, 0, 10] },
    { box: [22, SY0, 178, SY0 + SL, ZC - 0.8, ZC + 0.8], ex: [0, 0, 22] },
    { box: [0, 0, L, Wd, TOP0, HT], ex: [0, 0, 38] },
  ];
  const ANIM_PTS = [[0, 0, 0], [L, 0, HT], [L, Wd, 0], [0, Wd, 0], [L, Wd, HT], [0, 0, HT]];
  const S0 = 1.42, CX = 200, CY = 166;
  const FRAME = frameFor(DEFS, ANIM_PTS, S0, CX, CY);

  HairlineSite.figures.perforata = {
    name: "perforata",
    title: "Mesa Perforata",
    hint: "Arrastra la mesa para verla de otra manera: animación, giro o despiece.",
    label: "Mesa de comedor Perforata: dos planos de vidrio, dos patas y cuarenta y ocho franjas de color. Arrastra para animarla, girarla o despiezarla.",
    bounds: FRAME.bounds,
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const root = mk("g", {}, svg);
      const parts = DEFS.map((d) => ({ ...d, g: mk("g", {}, root), off: [0, 0, 0] }));
      const [legA, legB, apron, stripes, topP] = parts;
      const sc = Scene(root, parts, { S0, SO: FRAME.SO, animPts: ANIM_PTS, cx: CX, cy: CY, read: ctx.read });

      // legs: a glass slab with colour stripes on its broad face (the one facing the camera)
      [[legA, LEG[0]], [legB, LEG[1]]].forEach(([pt, [x0, x1]]) => {
        const sol = solid(pt.g), str = mk("path", { class: "nf lo tint" }, pt.g);
        HairlineSite.paint(str, "tint", x0 < L / 2 ? PLUM : BLUE);
        pt.draw = (P, front, o, v) => {
          const [r, inn] = rings(x0, LY0, x1, LY1, 1.2, 0.9);
          put(sol, prism(P, front, r, inn, o[2], AP0 + o[2]));
          const s = Math.sin(v.C.az), xf = s >= 0 ? x1 : x0;
          let d = "";
          if (Math.abs(s) > 0.02) for (let k = 1; k < 14; k++) d += seg(P(xf, LY0 + 1.5, k * 4.4 + o[2]), P(xf, LY1 - 1.5, k * 4.4 + o[2]));
          str.setAttribute("d", d);
        };
      });

      const aSol = solid(apron.g), [pr, pi] = rings(0, 0, L, Wd, 4, 1.4);
      apron.draw = (P, front, o) => put(aSol, prism(P, front, pr, pi, AP0 + o[2], AP1 + o[2]));

      // top plate with its window
      const outer = rrect(0, 0, L, Wd, 4, 5), hole = rrect(22, 14, 178, 86, 2, 4), crease = rrect(1.4, 1.4, L - 1.4, Wd - 1.4, 2.6, 5);
      const band = mk("path", { class: "sil" }, topP.g), face = mk("path", { class: "sil" }, topP.g), cre = mk("path", { class: "nf lo" }, topP.g);
      topP.draw = (P, front, o) => {
        const z = HT + o[2], z0 = TOP0 + o[2];
        band.setAttribute("d", poly([...ringAt(P, run(outer, front), z), ...ringAt(P, run(outer, front), z0).reverse()]));
        face.setAttribute("d", poly(ringAt(P, outer, z)) + poly(ringAt(P, hole, z).slice().reverse()));
        cre.setAttribute("d", open(ringAt(P, run(crease, front), z)));
      };

      // the stripe layer: 48 flat stripes; only the (disclaimed) animation turns them
      const shape = fillet([[0, -SW / 2], [SL, -SW / 2], [SL, SW / 2], [0, SW / 2]], [0.5, 0.5, 0.5, 0.5], 2);
      const slats = [];
      for (let i = 0; i < N; i++) {
        const el = mk("path", { class: "sil tint" }, stripes.g);
        HairlineSite.paint(el, "tint", mixHex(PLUM, BLUE, i / (N - 1)));
        slats.push({ i, xc: XS + i * PITCH, el, sp: spring(0, { eps: 0.05 }) });
      }
      stripes.draw = (P, front, o) => {
        for (const s of slats) {
          const a = s.sp.x, c = Math.cos(rad(a)), n = Math.sin(rad(a));
          s.el.setAttribute("d", poly(shape.map(([u, v]) => P(s.xc + v * c, SY0 + u, ZC + v * n + o[2]))));
        }
      };

      const xAt = (p) => clamp(unproj(sc.v.C, p[0], p[1], ZC)[0], XMIN, XMAX);
      let mode = "idle", dragX = XS, hovX = null, peekT = 0, tapLeft = 0, tapX = XS, act = -1;
      const mark = 16;
      const setHi = () => slats.forEach((s) => s.el.classList.toggle("hi", s.i === (act < 0 ? mark : act)));
      setHi();

      let B;
      function plan() {
        let px = 0, k = 0;
        if (mode === "drag") { px = dragX; k = 1; }
        else if (tapLeft > 0) { px = tapX; k = 1; }
        else if (hovX !== null) { px = hovX; k = 0.65; }
        else if (peekT > 0.001) { px = lerp(XMIN, XMAX, peekT); k = 0.5 * Math.min(1, peekT * 6); }
        const a = k > 0 ? clamp(Math.round((px - XS) / PITCH), 0, N - 1) : -1;
        for (const s of slats) s.sp.t = k ? lerp(0, 88, k * fall(Math.abs(s.xc - px), REACH)) : 0;
        if (a !== act) { act = a; setHi(); }
        if (sc.mode === "anim") ctx.read(a < 0 ? "rest" : "franja " + String(a + 1).padStart(2, "0"));
        B.wake();
      }

      B = register(ctx.stage, (dt) => {
        let m = false, dirty = false;
        if (tapLeft > 0) { tapLeft -= dt; m = true; if (tapLeft <= 0) { tapLeft = 0; plan(); } }
        for (const s of slats) if (stepS(s.sp, dt)) { m = true; dirty = true; }
        if (dirty) sc.redraw();
        return m;
      });
      bag.add(B.unregister);
      sc.redraw();
      plan();

      return {
        hit: (p) => sc.hit(p, 10),
        setMode(m) {
          sc.setMode(m);
          mode = "idle"; tapLeft = 0; hovX = null; peekT = 0; act = -1;
          for (const s of slats) { s.sp.x = 0; s.sp.t = 0; s.sp.v = 0; }
          setHi();
          sc.redraw();
          if (m === "anim") ctx.read("rest");
        },
        orbit: (a) => sc.orbit(a),
        explode: (t) => sc.explode(t),
        hover(p) { const h = p && sc.hit(p, 10) ? xAt(p) : null; if (h !== hovX) { hovX = h; if (mode === "idle") plan(); } },
        peek(t) { peekT = t; if (mode === "idle" && hovX === null) plan(); },
        press(p) { mode = "press"; tapLeft = 0; hovX = null; dragX = xAt(p); },
        drag(p) { mode = "drag"; dragX = xAt(p); plan(); },
        release() { mode = "idle"; plan(); },
        tap(p) { mode = "idle"; tapX = xAt(p); tapLeft = 0.9; plan(); },
        destroy: bag.dispose,
      };
    },
  };
})();
