/**
 * Folded w/ Dekton on the Hairline site runtime (see ../hairline-site.js). Drawing from ../folded.js.
 * Coffee table: a lower frosted sheet on a Dekton block, a second sheet 6 cm higher (the "suspended plane", offset at the left end)
 * carrying a black Dekton tray. At the right end the sheets fold down in two nested drops: the UPPER plane's drop is the outer one
 * (reaches the floor, 30.5 cm), the lower sheet's drop is nested inside it (24.5 cm).
 * Three modes:
 *   anim     (illustrative, disclaimed) one number, `open`, 0..1: the lower sheet rises by G and the upper plane (with its tray) by 2G.
 *            Hover / scroll peek: the layers part a little and the plane goes bright. Drag up opens, drag down closes, release stays.
 *            Tap opens fully, or closes.
 *   orbit    "Girar": only the camera turns.
 *   explode  "Despiece": everything lifts off the Dekton block along z, in the order it sits: lower sheet (with its drop), upper plane
 *            (with its drop), tray.
 * Colour (static, no picker): folded-render-a/b.webp show azul AND rojo on one table, as laminated colour glass lining the
 * clear frosted sheets: azul along the lower sheet, rojo down the folded end (the outer drop). The Dekton block and tray are stone
 * (black with bronze veining): they stay neutral ink, never a glass tint. The upper plane and the inner drop are clear.
 */
(function () {
  const { Cam, clamp, fit, prism, put, rings, solid, proj, facing, hull, spring, stepS, disposer, mk, register } = HL;

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

  const L = 160, W = 80, G = 12;
  // QUESTION: ¿Cuánto mide la bandeja de Dekton (largo x ancho x alto) y dónde va colocada?
  // QUESTION: ¿Cuánto mide el bloque de Dekton y cómo se sujeta el plano superior ("suspendido")?
  // QUESTION: ¿El plano superior también se dobla hacia abajo en el extremo derecho, formando dos pliegues uno dentro del otro? ¿Qué altura tiene cada pliegue?
  // QUESTION: ¿Los planos son piezas separables o van pegados entre sí?
  const BL = [38, 58, 53, 76], BZ = 22;           // Dekton block about 15 x 18 in plan (audit: about 15 x 15)
  const BZ0 = 22, BZ1 = 24.5, PX = 157.5;         // lower sheet z 22..24.5; its drop sits inside the outer one
  const CZ0 = 28, CZ1 = 30.5;                     // upper plane z 28..30.5
  const TR = [21, 14, 35, 72], TH = 4.5;          // tray: x 21..35, y 14..72, its long axis ACROSS the table
  const PEEK = 0.4, PX_PER_FULL = 90;

  // layer 0 block, layer 1 lower sheet + inner drop, layer 2 upper plane + outer drop + tray
  const DEFS = [
    { layer: 0, box: [BL[0], BL[1], BL[2], BL[3], 0, BZ], ex: [0, 0, 0], r: 1.2, b: 0.9 },
    { layer: 1, box: [0, 0, PX - 2.5, W, BZ0, BZ1], ex: [0, 0, 14], r: 3, b: 1.2 },
    { layer: 1, box: [PX - 2.5, 0, PX, W, 0, BZ1], ex: [0, 0, 14], r: 1.2, b: 0.5 },
    { layer: 2, box: [-4, 4, PX, W - 4, CZ0, CZ1], ex: [0, 0, 30], r: 3, b: 1.2 },
    { layer: 2, box: [PX, 4, L, W - 4, 0, CZ1], ex: [0, 0, 30], r: 1.2, b: 0.5 },
    { layer: 2, box: [TR[0], TR[1], TR[2], TR[3], CZ1, CZ1 + TH], ex: [0, 0, 50], r: 1.5, b: 2.2, tray: true },
  ];
  const ANIM_PTS = [[0, 0, 0], [L, 0, 60], [L, W, 0], [0, W, 60], [L, W, 60], [0, 0, 60]];
  const S0 = 1.6, CX = 200, CY = 166;
  const FRAME = frameFor(DEFS, ANIM_PTS, S0, CX, CY);

  HairlineSite.figures.folded = {
    name: "folded",
    title: "Folded w/ Dekton",
    hint: "Arrastra la mesa para verla de otra manera: animación, giro o despiece.",
    label: "Mesa de centro Folded w/ Dekton: vidrio laminado plegado, un plano suspendido y un bloque de Dekton. Arrastra para animarla, girarla o despiezarla.",
    bounds: FRAME.bounds,
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const root = mk("g", {}, svg);
      const parts = DEFS.map((d) => ({ ...d, g: mk("g", {}, root), off: [0, 0, 0] }));
      const sc = Scene(root, parts, { S0, SO: FRAME.SO, animPts: ANIM_PTS, cx: CX, cy: CY, read: ctx.read });
      parts.forEach((p) => {
        p.el = solid(p.g);
        const [x0, y0, x1, y1, z0, z1] = p.box, [r, inn] = rings(x0, y0, x1, y1, p.r, p.b);
        p.draw = (P, front, o) => put(p.el, prism(P, front, r, inn, z0 + o[2], z1 + o[2]));
      });
      parts[1].el.sil.classList.add("tint");     // lower sheet: azul
      parts[4].el.sil.classList.add("tint-2");   // outer drop of the upper plane: rojo
      HairlineSite.paint(svg, "tint", "#1c4281");
      HairlineSite.paint(svg, "tint-2", "#b65657");

      const op = spring(0, { k: 100, c: 18 }), pk = spring(0, { k: 120, c: 18 });
      let hover = false, peekT = 0, dragging = false, O0 = 0, lastRead = "", lit = null;
      const retarget = () => { pk.t = dragging ? 0 : Math.max(hover ? 1 : 0, peekT); };

      const B = register(ctx.stage, (dt) => {
        let m = stepS(op, dt);
        if (stepS(pk, dt)) m = true;
        const e = Math.max(clamp(op.x, 0, 1), PEEK * pk.x);
        const d1 = e * G, d2 = e * 2 * G;
        let changed = false;
        for (const p of parts) {
          const dz = p.layer === 1 ? d1 : p.layer === 2 ? d2 : 0;
          if (p.off[2] !== dz) { p.off = [0, 0, dz]; changed = true; }
        }
        if (changed) sc.redraw();
        const on = e > 0.03;
        if (on !== lit) {
          lit = on;
          for (const p of parts) {
            p.el.sil.classList.toggle("hi", on ? p.layer === 2 && !p.tray : !!p.tray);
            p.el.cr.classList.toggle("hi", !on && !!p.tray);
          }
        }
        const pct = Math.round(clamp(op.x, 0, 1) * 100);
        const r = pct < 2 ? "rest" : "abierto " + pct + "%";
        if (r !== lastRead) { lastRead = r; if (sc.mode === "anim") ctx.read(r); }
        return m;
      });
      bag.add(B.unregister);
      sc.redraw();

      return {
        hit: (p) => sc.hit(p, 10),
        setMode(m) {
          sc.setMode(m);
          op.x = op.t = 0; op.v = 0; pk.x = pk.t = 0; pk.v = 0;
          hover = false; peekT = 0; dragging = false; lit = null; lastRead = "";
          parts.forEach((p) => { p.off = [0, 0, 0]; });
          sc.redraw();
          if (m === "anim") ctx.read("rest");
          B.wake();
        },
        orbit: (a) => sc.orbit(a),
        explode: (t) => sc.explode(t),
        hover(p) { const h = !!p && sc.hit(p, 10); if (h !== hover) { hover = h; retarget(); B.wake(); } },
        peek(t) { peekT = t; retarget(); B.wake(); },
        press() { dragging = true; hover = false; O0 = op.t; retarget(); B.wake(); },
        drag(p, d) { op.t = clamp(O0 - d.dy / PX_PER_FULL, 0, 1); B.wake(); },
        release() { dragging = false; retarget(); B.wake(); },
        tap() { dragging = false; op.t = op.t > 0.5 ? 0 : 1; retarget(); B.wake(); },
        destroy: bag.dispose,
      };
    },
  };
})();
