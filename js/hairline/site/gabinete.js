/**
 * Gabinete on the Hairline site runtime (see ../hairline-site.js for the contract).
 * pglass-CAB: a carcass with a pair of slim-aluminium framed glass doors, each hinged at its outer stile
 * and swinging toward the viewer (evidence: pglass-CAB photos 1-3, a butt-jointed pair of framed glass doors).
 * Hover / scroll peek: the door under the pointer (door 2 on scroll) opens a few degrees, its free edge lights
 * and the dashed swing arc goes bright. Drag: the grabbed door follows the pointer angle around its hinge
 * (clamped); release leaves it, and near closed it soft-closes. Tap: opens that door to ~65 degrees or closes it.
 * Glass is `nf` (see-through), as in pivote.js / rail.js.
 */
(function () {
  const { Cam, clamp, fit, proj, rings, prism, fillet, hull, poly, open, seg, rad, spring, stepS, mk, register, disposer, solid, put, unproj } = HL;

  const CW = 64, H = 96, D = 24, T0 = 1.8, TH = 2.2, FR = 2.5, GAP = 0.3;
  const DW = (CW - 2 * T0) / 2 - GAP, Z0 = T0 + 0.6, Z1 = H - T0 - 0.6;
  const HX = [T0, CW - T0];
  // QUESTION: "¿Las puertas del gabinete se articulan en los costados exteriores o en el centro, y la bisagra va oculta?" (hinge sides kept as drawn; no hinge hardware shown, none is visible in the photos)
  // QUESTION: "¿Las medidas 400x3000 y 600x1500 son por puerta o del gabinete completo?" (no size is printed)
  // QUESTION: "¿Qué herraje lleva el encuentro central (tirador, imán, pestillo)?" (the block at the meeting stile is the photo's dark block, type unknown)
  const MAX = 95, PEEK = 9, OPENED = 65, SOFT = 7, MARGIN = 9, SHELF = H * 0.5;

  function bb(svg) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of svg.children) {
      let b; try { b = n.getBBox(); } catch (_) { continue; }
      if (!b || (!b.width && !b.height)) continue;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  }
  function dpoly(pl, p) {
    const x = p[0], y = p[1];
    let inside = false, best = Infinity;
    for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) {
      const xi = pl[i][0], yi = pl[i][1], xj = pl[j][0], yj = pl[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      const dx = xj - xi, dy = yj - yi, l = dx * dx + dy * dy;
      const t = l ? clamp(((x - xi) * dx + (y - yi) * dy) / l, 0, 1) : 0;
      best = Math.min(best, Math.hypot(x - (xi + t * dx), y - (yi + t * dy)));
    }
    return inside ? 0 : best;
  }

  HairlineSite.figures.gabinete = {
    name: "gabinete",
    variants: "perfil", // the 9 anodized finishes (class "fin" = aluminium: frames, meeting-stile block); glass stays clear
    title: "Gabinete",
    hint: "Arrastra una puerta para abrirla. Un toque la abre o la cierra.",
    label: "Gabinete pglass-CAB: dos puertas de vidrio con bisagra. Arrastra una puerta para abrirla.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const C = Cam(45, 0.5, 2.2);
      // door k: 0 = left (hinge at the left stile), 1 = right. u along the door from its hinge, v out of its face.
      const world = (k, u, v, z, a) => {
        const s = Math.sin(rad(a)), c = Math.cos(rad(a));
        return k === 0 ? [HX[0] + u * c - v * s, u * s + v * c, z] : [HX[1] - u * c + v * s, u * s + v * c, z];
      };
      const ext = [[-8, -D - 6, -2], [CW + 8, DW + 12, -2], [CW + 8, -D - 6, -2], [-8, DW + 12, -2], [0, 0, H]];
      for (const k of [0, 1]) for (const a of [0, MAX]) for (const u of [0, DW]) for (const v of [-TH / 2, TH / 2]) ext.push(world(k, u, v, Z1, a), world(k, u, v, Z0, a));
      fit(C, ext, 200, 168);
      const P = proj(C);
      const rnd = (pts, r) => fillet(pts, pts.map(() => r), 4);

      const g = mk("g", {}, svg);
      const [fr, fi] = rings(-8, -D - 6, CW + 8, DW + 12, 6, 1.5);
      put(solid(g), prism(P, () => true, fr, fi, -2, 0));

      // carcass: back, sides, top, bottom and one shelf, all see-through lines
      const B = (x, y, z) => P(x, y, z);
      const car = mk("path", { class: "sil nf" }, g), carIn = mk("path", { class: "lo nf" }, g);
      {
        const o = [[0, 0, 0], [CW, 0, 0], [CW, 0, H], [0, 0, H]];
        car.setAttribute("d", poly(o.map((q) => B(...q))) + seg(B(0, 0, H), B(0, -D, H)) + seg(B(CW, 0, H), B(CW, -D, H)) + seg(B(CW, 0, 0), B(CW, -D, 0)) +
          seg(B(0, -D, H), B(CW, -D, H)) + seg(B(CW, -D, 0), B(CW, -D, H)));
        const op = [[T0, 0, T0], [CW - T0, 0, T0], [CW - T0, 0, H - T0], [T0, 0, H - T0]].map((q) => B(...q));
        const bk = [[T0, -D + T0, T0], [CW - T0, -D + T0, T0], [CW - T0, -D + T0, H - T0], [T0, -D + T0, H - T0]].map((q) => B(...q));
        carIn.setAttribute("d", poly(op) + open(bk.concat([bk[0]])) +
          seg(B(T0, 0, SHELF), B(T0, -D + T0, SHELF)) + seg(B(CW - T0, 0, SHELF), B(CW - T0, -D + T0, SHELF)) + seg(B(T0, -D + T0, SHELF), B(CW - T0, -D + T0, SHELF)) +
          seg(B(T0, 0, SHELF), B(CW - T0, 0, SHELF)));
      }

      const L = [0, 1].map((k) => ({
        k, hull: mk("path", { class: "sil nf" }, g), fa: mk("path", { class: "lo nf" }, g), fb: mk("path", { class: "lo nf" }, g),
        reeds: mk("path", { class: "lo nf" }, g), frame: mk("path", { class: "sil fin-fill", "fill-rule": "evenodd" }, g), pull: mk("path", { class: "sil fin-fill" }, g),
        arc: mk("path", { class: "dash nf" }, g), edge: mk("path", { class: "hi nf fin" }, g),
        sp: spring(0, { eps: 0.02 }), A: 0, peek: 0, lit: false, drawn: NaN,
      }));
      for (const d of L) {
        const pts = [];
        for (let i = 0; i <= 24; i++) pts.push(P(...world(d.k, DW, 0, 0, (MAX * i) / 24)));
        d.arc.setAttribute("d", open(pts));
      }

      const leafHull = (d, a) => {
        const pts = [];
        for (const u of [0, DW]) for (const v of [-TH / 2, TH / 2]) for (const z of [Z0, Z1]) pts.push(P(...world(d.k, u, v, z, a)));
        return hull(pts);
      };
      function draw(d) {
        const a = d.sp.x, k = d.k, W3 = (u, v, z) => P(...world(k, u, v, z, a));
        const rect = (v, f) => [[f, Z0 + f], [DW - f, Z0 + f], [DW - f, Z1 - f], [f, Z1 - f]].map(([u, z]) => W3(u, v, z));
        d.hull.setAttribute("d", poly(rnd(leafHull(d, a), 1.4)));
        d.frame.setAttribute("d", poly(rnd(rect(TH / 2, 0), 1)) + poly(rnd(rect(TH / 2, FR), 0.6)));
        d.fa.setAttribute("d", poly(rnd(rect(TH / 2, FR), 0.8)));
        d.fb.setAttribute("d", poly(rnd(rect(-TH / 2, FR), 0.8)));
        let r = "";
        for (let i = 1; i < 15; i++) { const u = FR + ((DW - 2 * FR) * i) / 15; r += seg(W3(u, TH / 2, Z0 + FR + 1), W3(u, TH / 2, Z1 - FR - 1)); }
        d.reeds.setAttribute("d", r);
        // the one hardware piece the photos show (2.webp): a small block at the meeting stile, top third. No hinges are drawn.
        const ph = Z0 + (Z1 - Z0) * 0.72;
        d.pull.setAttribute("d", poly(rnd([[DW - 3.6, ph], [DW - 1, ph], [DW - 1, ph + 5], [DW - 3.6, ph + 5]].map(([u, z]) => W3(u, TH / 2, z)), 0.5)));
        d.edge.setAttribute("d", d.lit ? seg(W3(DW, TH / 2, Z0), W3(DW, TH / 2, Z1)) : "");
        d.arc.classList.toggle("hi", d.lit);
      }
      L.forEach(draw);

      let hov = -1, peekT = 0, dragK = -1, touched = -1, zg = H / 2, ang0 = 0, a0 = 0;
      const tgt = (d) => {
        const k = dragK === d.k ? 0 : Math.max(hov === d.k ? 1 : 0, d.k === 1 ? peekT : 0);
        d.peek = k;
        d.sp.t = clamp(d.A + (d.A > MAX - PEEK - 2 ? -1 : 1) * PEEK * k, 0, MAX);
        const lit = dragK === d.k || k > 0.05;
        if (lit !== d.lit) { d.lit = lit; d.drawn = NaN; }
      };
      const names = () => {
        const k = dragK >= 0 ? dragK : hov >= 0 ? hov : peekT > 0.05 ? 1 : touched;
        if (k < 0) { ctx.read("rest"); return; }
        const d = L[k], pk = d.peek > 0.05 && d.A < 2;
        ctx.read("puerta " + (k + 1) + " · " + (pk ? "entreabre" : d.A > 2 || dragK === k ? "abierta" : "cerrada"));
      };
      const Bh = register(ctx.stage, (dt) => {
        let m = false;
        for (const d of L) { if (stepS(d.sp, dt)) m = true; if (d.sp.x !== d.drawn) { d.drawn = d.sp.x; draw(d); } }
        return m;
      });
      bag.add(Bh.unregister);
      const aim = () => { L.forEach(tgt); names(); Bh.wake(); };
      ctx.read("rest");

      const nearest = (p) => {
        let bk = -1, bd = Infinity;
        for (const d of L) { const e = dpoly(leafHull(d, d.sp.x), p); if (e < bd) { bd = e; bk = d.k; } }
        return [bk, bd];
      };
      const hit = (p) => nearest(p)[1] <= MARGIN;
      const angAt = (d, p) => { const w = unproj(C, p[0], p[1], zg); return (Math.atan2(w[1], d.k === 0 ? w[0] - HX[0] : HX[1] - w[0]) * 180) / Math.PI; };
      const dist = (d, p) => { const w = unproj(C, p[0], p[1], zg); return Math.hypot(w[0] - HX[d.k], w[1]); };
      const wrap = (x) => ((((x + 180) % 360) + 360) % 360) - 180;

      const fig = HairlineSite.figures.gabinete;
      const m0 = bb(svg);
      if (m0) {
        const keep = L.map((d) => d.sp.x);
        L.forEach((d) => { d.sp.x = MAX; draw(d); });
        const m1 = bb(svg);
        L.forEach((d, i) => { d.sp.x = keep[i]; draw(d); d.drawn = d.sp.x; });
        if (m1) {
          const x0 = Math.min(m0[0], m1[0]), y0 = Math.min(m0[1], m1[1]);
          fig.bounds = [x0, y0, Math.max(m0[0] + m0[2], m1[0] + m1[2]) - x0, Math.max(m0[1] + m0[3], m1[1] + m1[3]) - y0];
        } else fig.bounds = m0;
      }

      return {
        hit,
        hover(p) { const r = p ? nearest(p) : [-1, Infinity]; const h = r[1] <= MARGIN ? r[0] : -1; if (h !== hov) { hov = h; aim(); } },
        peek(t) { peekT = t; aim(); },
        press(p) {
          const k = nearest(p)[0], d = L[k], sg = k === 0 ? 1 : -1;
          let best = Infinity;
          for (let z = Z0; z <= Z1; z += 2) {
            const w = unproj(C, p[0], p[1], z), a = rad(d.A);
            const r = (w[0] - HX[k]) * -Math.sin(a) * sg + w[1] * Math.cos(a);
            const al = (w[0] - HX[k]) * Math.cos(a) * sg + w[1] * Math.sin(a);
            const e = Math.abs(r) + (al < -2 || al > DW + 2 ? 20 : 0);
            if (e < best) { best = e; zg = z; }
          }
          dragK = k; touched = k; hov = -1; a0 = d.A; ang0 = angAt(d, p); aim();
        },
        drag(p) {
          const d = L[dragK]; if (!d || dist(d, p) < 3) return;
          d.A = clamp(a0 + wrap(angAt(d, p) - ang0), 0, MAX); aim();
        },
        release() { const d = L[dragK]; if (d && d.A < SOFT) d.A = 0; dragK = -1; aim(); },
        tap(p) { const k = nearest(p)[0], d = L[k]; dragK = -1; touched = k; d.A = d.A < OPENED - 20 ? OPENED : 0; aim(); },
        destroy: bag.dispose,
      };
    },
  };
})();
