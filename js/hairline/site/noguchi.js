/**
 * Noguchi Tribute on the Hairline site runtime (see ../hairline-site.js). Drawing from ../noguchi.js.
 * Coffee table: a biomorphic glass top (127 x 91 x 40 cm overall) resting directly on two curved glass supports that meet at the
 * crotch under the top.
 * Three modes:
 *   anim     (illustrative, disclaimed) three parts each with one number 0..1: the top (lifts clear), support 1 and support 2 (each slides
 *            out along its own line, away from the crotch). Hover / scroll peek: the part under the pointer starts to move and a dashed
 *            ghost shows where it can go. Press + drag pulls the part under the finger; release leaves it there. A tap sends it out, or back.
 *   orbit    "Girar": only the camera turns; the support faces and the colour fade are recomputed per azimuth.
 *   explode  "Despiece": the top lifts straight up, each support slides out along its own line away from the crotch.
 * Colour (static, no picker): noguchi-tribute-render-a/b.webp show ambar AND verde agua on one table, as laminated colour
 * stripes in the top running ambar to verde agua (a little blue between); the two supports are clear glass. So the top takes a
 * ambar to verde agua fade and the supports stay clear.
 */
(function () {
  const { Cam, fillet, fit, hull, open, poly, proj, ringAt, run, facing, clamp, spring, stepS, disposer, mk, register } = HL;

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

  // The top rests ON the supports: its underside is at the supports' height (z = 38) and its top at the 40 cm spec.
  const T = 3, TZ = 38, TT = 2, STEP = 70, N = 40;
  const TOP = [[2, 64], [48, 4], [120, 40], [104, 90], [22, 80]], TOPR = [30, 44, 52, 40, 26];
  // QUESTION: ¿Cómo se traban los dos soportes entre sí (muesca, pegado, pasador)? ¿Se pueden separar?
  // QUESTION: ¿Puede enviarnos el perfil exacto de los soportes en alzado y en planta?
  // QUESTION: ¿El tablero va pegado a los soportes o apoya?
  // QUESTION: ¿El rayado de color es impreso o laminado, y cuántas franjas tiene?
  // each support is a plate standing on a line in plan; `a` is where it starts, `b` where it ends (at the crotch)
  const SUP = [
    { a: [16, 78], b: [44, 40] },   // support 1: the short leg from the front-left, tall at its foot end, sweeping down to the crotch
    { a: [112, 48], b: [41, 38] },  // support 2: the long plate, tall at its right end, its underside rising toward the crotch
  ].map((d) => {
    const dx = d.b[0] - d.a[0], dy = d.b[1] - d.a[1], len = Math.hypot(dx, dy), u = [dx / len, dy / len];
    let n = [u[1], -u[0]];
    if (n[0] + n[1] < 0) n = [-n[0], -n[1]];
    return { ...d, len, u, n, out: [-u[0], -u[1]] };
  });

  /** The plan position and the plate normal at distance s along a support. */
  const at = (sp, s) => [sp.a[0] + sp.u[0] * s, sp.a[1] + sp.u[1] * s, sp.n[0], sp.n[1]];

  /** A support's outline in (s, z), every corner rounded. Support 1 stands on the floor and sweeps down; support 2 is tall at one end and its underside rises. */
  function outline(k) {
    const L = SUP[k].len, pts = [], M = 10;
    if (k === 0) {
      pts.push([0, 0]);
      pts.push([L, 0]);
      for (let i = 0; i <= M; i++) { const t = i / M; pts.push([L * (1 - t * 0.94), 14 + 24 * Math.pow(t, 2.2)]); }
      pts.push([0, 36]);
    } else {
      // s runs from the right end (tall, on the floor) to the crotch end
      for (let i = 0; i <= M; i++) { const t = i / M; pts.push([L * t, 18 * Math.pow(t, 2.2)]); }
      pts.push([L, 38]); pts.push([0, 38]);
    }
    const rs = pts.map((_, i) => (i < 2 || i >= pts.length - 3 ? 3 : 0.01));
    return fillet(pts, rs, 3);
  }

  /** A closed plan outline as a ring with outward normals, and its inset. */
  function ringOf(pts, b) {
    const m = pts.length;
    let ar = 0;
    for (let i = 0; i < m; i++) { const p = pts[i], q = pts[(i + 1) % m]; ar += p[0] * q[1] - q[0] * p[1]; }
    const sg = ar > 0 ? 1 : -1, out = [], inn = [];
    for (let i = 0; i < m; i++) {
      const a = pts[(i + m - 1) % m], c = pts[(i + 1) % m], p = pts[i];
      const tx = c[0] - a[0], ty = c[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      const nu = sg * ty / l, nv = -sg * tx / l;
      out.push({ u: p[0], v: p[1], nu, nv });
      inn.push({ u: p[0] - b * nu, v: p[1] - b * nv, nu, nv });
    }
    return [out, inn];
  }

  const G = 18, PEEK = 0.3, PULL = 70;
  const NAMES = ["tablero", "soporte 1", "soporte 2"];
  const [RING, INNER] = ringOf(fillet(TOP, TOPR, 10), 1.2);
  const SHAPES = SUP.map((_, k) => outline(k));
  const TBOX = [Math.min(...RING.map((q) => q.u)), Math.min(...RING.map((q) => q.v)), Math.max(...RING.map((q) => q.u)), Math.max(...RING.map((q) => q.v))];
  const SBOX = SUP.map((sp) => {
    const xs = [sp.a[0], sp.b[0], sp.a[0] + sp.n[0] * T, sp.b[0] + sp.n[0] * T], ys = [sp.a[1], sp.b[1], sp.a[1] + sp.n[1] * T, sp.b[1] + sp.n[1] * T];
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 0, TZ];
  });
  const DEFS = [
    { box: [TBOX[0], TBOX[1], TBOX[2], TBOX[3], TZ, TZ + TT], ex: [0, 0, 28] },
    { box: SBOX[0], ex: [SUP[0].out[0] * 22, SUP[0].out[1] * 22, 0] },
    { box: SBOX[1], ex: [SUP[1].out[0] * 22, SUP[1].out[1] * 22, 0] },
  ];
  const ANIM_PTS = [[2, 64, 0], [48, 4, 0], [120, 40, 0], [104, 90, 0], [22, 80, 75], [48, 4, 75], [120, 40, 75], [104, 90, 75], [2, 64, 42], [120, 40, 42]];
  const S0 = 2.3, CX = 200, CY = 166;
  const FRAME = frameFor(DEFS, ANIM_PTS, S0, CX, CY);

  /** A slab gradient from colour role a to role b (roles = the stage's --tint-* custom properties, so it follows the theme).
   *  userSpaceOnUse; the caller moves x1..y2 with the camera so the fade stays on the slab. */
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

  HairlineSite.figures.noguchi = {
    name: "noguchi",
    title: "Noguchi Tribute",
    hint: "Arrastra la mesa para verla de otra manera: animación, giro o despiece.",
    label: "Mesa de centro Noguchi Tribute: un tablero de vidrio laminado sobre dos soportes curvos. Arrastra para animarla, girarla o despiezarla.",
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
      HairlineSite.paint(svg, "tint", "#c49547");   // ambar
      HairlineSite.paint(svg, "tint-2", "#52929c"); // verde agua
      const [topP, s1, s2] = parts;

      // supports: two plane faces (the one toward the camera is the bright `sil` one), re-chosen per azimuth
      const sup = [s1, s2].map((p, k) => ({ p, k, back: mk("path", { class: "nf lo" }, p.g), face: mk("path", { class: "nf sil" }, p.g), scr: [] }));
      const facePts = (P, k, off, o) => SHAPES[k].map(([s, z]) => {
        const [px, py, nx, ny] = at(SUP[k], s);
        return P(px + nx * off + o[0], py + ny * off + o[1], z + o[2]);
      });
      sup.forEach((q) => {
        q.p.draw = (P, front, o, v) => {
          const n = SUP[q.k].n, towards = n[0] * Math.sin(v.C.az) + n[1] * Math.cos(v.C.az) >= 0;
          const fo = towards ? T : 0, bo = towards ? 0 : T;
          q.scr = facePts(P, q.k, fo, o);
          q.back.setAttribute("d", poly(facePts(P, q.k, bo, o)));
          q.face.setAttribute("d", poly(q.scr));
        };
      });

      const topSil = mk("path", { class: "nf sil tint" }, topP.g), topCr = mk("path", { class: "nf lo" }, topP.g);
      const tg = gradient(svg, "tint", "tint-2");
      topSil.style.fill = tg.fill;
      let topHi = false;
      const topStroke = () => { topSil.style.stroke = topHi ? "" : tg.stroke; };
      topStroke();
      let topScr = [];
      topP.draw = (P, front, o) => {
        const z1 = TZ + TT + o[2], z0 = TZ + o[2];
        topScr = hull(ringAt(P, RING, z1).concat(ringAt(P, RING, z0)));
        topSil.setAttribute("d", poly(topScr));
        topCr.setAttribute("d", open(ringAt(P, run(INNER, front), z1)));
        // ambar to verde agua along the world diagonal (+x, -y): the stripes' direction is fixed on the top
        const a = P(TBOX[0], TBOX[3], z1), b = P(TBOX[2], TBOX[1], z1);
        for (const lg of tg.els) { lg.setAttribute("x1", a[0].toFixed(2)); lg.setAttribute("y1", a[1].toFixed(2)); lg.setAttribute("x2", b[0].toFixed(2)); lg.setAttribute("y2", b[1].toFixed(2)); }
      };

      // anim state: tgt[k] 0..1 is where each part rests (set by drag / tap); sp[k] follows it; hov is the part under the mouse
      const tgt = [0, 0, 0], sp = [spring(0), spring(0), spring(0)];
      let hov = -1, peekT = 0, grab = -1, f0 = 0, last = -1, drawn = "", lastRead = "", lastHi = -2, ghostKey = "", restPick = null;

      function apply() {
        const key = sp.map((s) => s.x).join();
        if (key === drawn) return;
        drawn = key;
        topP.off = [0, 0, G * sp[0].x];
        for (const k of [1, 2]) parts[k].off = [SUP[k - 1].out[0] * G * sp[k].x, SUP[k - 1].out[1] * G * sp[k].x, 0];
        sc.redraw();
      }
      const ghostD = (gk) => {
        const P = sc.v.P;
        if (gk === 0) return poly(hull(ringAt(P, RING, TZ + TT + G).concat(ringAt(P, RING, TZ + G))));
        const k = gk - 1;
        return poly(facePts(P, k, T, [SUP[k].out[0] * G, SUP[k].out[1] * G, 0]));
      };
      let B;
      const tick = (dt) => {
        let moving = false;
        for (let k = 0; k < 3; k++) {
          const pk = k === hov && grab < 0 ? PEEK : 0, ps = k === 0 ? peekT * PEEK : 0;
          sp[k].t = Math.max(tgt[k], pk, ps);
          if (stepS(sp[k], dt)) moving = true;
        }
        apply();
        // dashed ghost: where the part under the pointer can go
        const gk = grab >= 0 ? -1 : hov >= 0 ? hov : peekT > 0.02 ? 0 : -1;
        const gf = gk < 0 ? 0 : Math.max(0, 1 - sp[gk].x / (PEEK * 1.2)) * (gk === hov ? 1 : peekT);
        const key = gk + ":" + gf.toFixed(2);
        if (key !== ghostKey) {
          ghostKey = key;
          ghost.setAttribute("d", gk < 0 ? "" : ghostD(gk));
          ghost.setAttribute("opacity", String(clamp(gf, 0, 0.9)));
        }
        let focus = grab >= 0 ? grab : hov >= 0 ? hov : last >= 0 && tgt[last] > 0.02 ? last : -1;
        if (focus < 0) for (let k = 0; k < 3; k++) if (tgt[k] > 0.02) focus = k;
        const rd = focus < 0 ? "rest" : NAMES[focus] + (tgt[focus] > 0.02 ? " " + Math.round(sp[focus].x * 100) + "%" : "");
        if (rd !== lastRead) { lastRead = rd; if (sc.mode === "anim") ctx.read(rd); }
        if (focus !== lastHi) {
          lastHi = focus;
          topSil.classList.toggle("hi", focus < 0 || focus === 0); topHi = focus < 0 || focus === 0; topStroke();
          sup[0].face.classList.toggle("hi", focus === 1);
          sup[1].face.classList.toggle("hi", focus === 2);
        }
        return moving;
      };
      B = register(ctx.stage, tick);
      bag.add(B.unregister);
      sc.redraw();
      restPick = { s1: sup[0].scr.slice(), s2: sup[1].scr.slice(), top: ringAt(sc.v.P, RING, TZ + TT) };

      const pick = (p) => (near(p, restPick.s2, 6) ? 2 : near(p, restPick.s1, 6) ? 1 : near(p, restPick.top, 8) ? 0 : -1);

      return {
        hit: (p) => (sc.mode === "anim" ? pick(p) >= 0 : sc.hit(p, 10)),
        setMode(m) {
          sc.setMode(m);
          tgt.fill(0); sp.forEach((s) => { s.x = 0; s.t = 0; s.v = 0; });
          hov = -1; peekT = 0; grab = -1; last = -1; drawn = ""; lastHi = -2; lastRead = "";
          ghost.setAttribute("d", ""); ghost.setAttribute("opacity", "0"); ghostKey = "";
          parts.forEach((p) => { p.off = [0, 0, 0]; });
          sc.redraw();
          if (m === "anim") ctx.read("rest");
          B.wake();
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
