/**
 * Acetato on the Hairline site runtime (see ../hairline-site.js). Drawing from ../acetato.js.
 * A stone column and a glass disc cut away around it.
 * MODES: "anim" (illustrative, below), "orbit" (Girar: only the camera turns) and "explode" (Despiece: the glass slides straight out along
 * its own bearing, away from the column it is cut around, at its own height; the column stays).
 * Anim: one spring, the disc's bearing about the column, clamped to 72 degrees either side of rest. Hover / scroll peek: the glass leans a
 * few degrees toward the pointer (a quarter of the way) and its edge goes bright. Press and drag turns the glass to the bearing of the finger;
 * release leaves it there. A tap turns it to the tapped bearing, or back to rest when it is already there.
 * Paint order (rule 06): the part of the glass in front of the column (plan strip |u| < the cut, w > 0, u and w being across and along the
 * CURRENT view) is its own layer painted after the column, so nothing pops as the disc swings or the camera turns; the rest is painted before it.
 * COLOUR (static; Original shows the plain line drawing, Catálogo the ring): decided from catalogo/acetato-render-a.webp and -b. The column is
 * stone (white marble), so it takes NO colour, nor does the disc's own clear glass; only the coloured RING of the glass does (the band between
 * the two ring lines, 45% to 80% of the disc radius), as a `tint` fill that follows the disc round the column and is cut by it exactly like the
 * glass. The renders grade the ring navy (by the column) to red to amber (far side): a local gradient along the axis column -> glass centre.
 * QUESTION: "Guillermo, ¿como se fija el vidrio a la columna de piedra (adhesivo, inserto, ranura)?"
 * QUESTION: "¿El vidrio puede girar o va fijo?" (anim keeps its illustrative swivel; the despiece slides the glass out of its cut)
 * QUESTION: "¿La columna es de marmol blanco, Dekton u otra piedra?"
 * QUESTION: "¿El anillo es un degradado unico ambar-rojo-azul noche, o son tres colores a elegir?"
 */
(function () {
  const { Cam, clamp, facing, fit, hull, open, poly, prism, proj, rrect, put, solid, spring, stepS, unproj, disposer, mk, register } = HL;
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

  /** Three-stop gradient through colour roles (CSS custom properties of the stage, so it follows the theme), in user space; returns { lg, url }. */
  let gid = 0;
  function gradient(svg, roles) {
    const id = "hlg-acetato-" + (++gid), lg = mk("linearGradient", { id, gradientUnits: "userSpaceOnUse" }, mk("defs", {}, svg));
    roles.forEach((r, i) => {
      const st = mk("stop", { offset: String(i / (roles.length - 1)) }, lg);
      // a stronger mix than the first pass: the ring read pastel (red looked pink, navy grey-blue)
      st.style.stopColor = "light-dark(color-mix(in srgb,var(--" + r + "-hex,transparent) 50%,transparent),color-mix(in srgb,var(--" + r + "-hex,transparent) 62%,transparent))";
    });
    return { lg, url: "url(#" + id + ")" };
  }

  const R = 15, RC = R + 0.8, RG = 25, H = 50, GZ = 44, GT = 1.6, REST = -25.6, DIST = 25.5, N = 96, V = 72, PEEK = 0.25, OUT = 22;
  const rad = (d) => (d * Math.PI) / 180;
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

  function runs(pts, ok) {
    const k = pts.findIndex((p, i) => ok(p) && !ok(pts[(i + pts.length - 1) % pts.length]));
    if (k < 0) return ok(pts[0]) ? [pts] : [];
    const r = pts.slice(k).concat(pts.slice(0, k)), out = [];
    let cur = [];
    for (const p of r) { if (ok(p)) cur.push(p); else if (cur.length) { out.push(cur); cur = []; } }
    if (cur.length) out.push(cur);
    return out;
  }
  function clip(pts, f) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }

  const COL = [-R, -R, 0, R, R, H];
  const glassBox = (a, dist) => { const cx = dist * Math.cos(rad(a)), cy = dist * Math.sin(rad(a)); return [cx - RG, cy - RG, GZ - GT, cx + RG, cy + RG, GZ]; };
  const VIEWS = Views(3.2, [COL, glassBox(REST, DIST)], [COL, glassBox(REST, DIST + OUT)]);
  const ANIM_PTS = (() => {
    const ex = [[-R, -R, 0], [R, R, 0], [-R, R, 0], [R, -R, 0], [-R, -R, H], [R, R, H]];
    for (let a = REST - 72; a <= REST + 73; a += 15) {
      const cx = DIST * Math.cos(rad(a)), cy = DIST * Math.sin(rad(a));
      ex.push([cx + RG, cy + RG, GZ], [cx - RG, cy - RG, GZ], [cx + RG, cy - RG, GZ], [cx - RG, cy + RG, GZ]);
    }
    return ex;
  })();
  const SA = animScale(3.2, ANIM_PTS);
  const animCam = () => { const C = Cam(45, 0.5, SA); fit(C, ANIM_PTS, 200, 166); return C; };
  const BOUNDS = (() => {
    const e = extentOf(animCam(), ANIM_PTS), u = VIEWS.bounds();
    const x0 = Math.min(e[0], u[0]) - 4, y0 = Math.min(e[1], u[1]) - 4, x1 = Math.max(e[2], u[2]) + 4, y1 = Math.max(e[3], u[3]) + 4;
    return [x0, y0, x1 - x0, y1 - y0];
  })();

  HairlineSite.figures.acetato = {
    name: "acetato",
    bounds: BOUNDS,
    title: "Acetato",
    hint: "Arrastra el vidrio para girarlo alrededor de la columna. Un toque lo gira hasta ahí.",
    label: "Mesa auxiliar Acetato: una columna de piedra y un disco de vidrio laminado que la rodea. Arrastra para girar el vidrio.",
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      let mode = "anim", az = 45, tx = 0, C = animCam(), P = proj(C), front = facing(C);
      let cs = Math.cos(C.az), sn = Math.sin(C.az);
      const U = (p) => p[0] * cs - p[1] * sn, W = (p) => p[0] * sn + p[1] * cs; // across / along the current view
      const g = mk("g", {}, svg);

      const back = mk("g", {}, g);
      const bBand = mk("path", { class: "sil" }, back), bTop = mk("path", { class: "sil" }, back), bRings = mk("path", { class: "nf lo" }, back);
      const col = solid(g);
      const cr = rrect(-R, -R, R, R, R, 14), ci = rrect(-R + 1.2, -R + 1.2, R - 1.2, R - 1.2, R - 1.2, 14);
      const fr = mk("g", {}, g);
      const fFill = mk("path", { class: "fo" }, fr), fBand = mk("path", { class: "sil" }, fr), fLine = mk("path", { class: "nf sil" }, fr), fRings = mk("path", { class: "nf lo" }, fr);

      // the colour ring: even-odd of two plates (outer 80% and the 45% hole), each cut by the column like the glass; no outline of its own
      HairlineSite.paint(svg, "tint", "#d6a614"); HairlineSite.paint(svg, "tint-2", "#a8121b"); HairlineSite.paint(svg, "tint-3", "#1c2d51");
      const gr = gradient(svg, ["tint-3", "tint-2", "tint"]);
      const ringFill = (parent, before) => {
        const el = mk("path", { "fill-rule": "evenodd", d: "" }, parent);
        el.style.stroke = "none"; el.style.fill = gr.url;
        parent.insertBefore(el, before);
        return el;
      };
      const bFill = ringFill(back, bRings);
      const fRingFill = ringFill(fr, fBand);
      // Original = the plain line drawing: the ring is only shown for a colour variant (Catálogo)
      const showRing = (on) => { bFill.style.display = on ? "" : "none"; fRingFill.style.display = on ? "" : "none"; };
      showRing(!!(ctx.variant && !ctx.variant.original));

      const pt = (cx, cy, r, i) => [cx + r * Math.cos((i / N) * 2 * Math.PI), cy + r * Math.sin((i / N) * 2 * Math.PI)];
      const inFront = (p) => Math.abs(U(p)) < RC && W(p) > 0;
      const up = (arr, z) => arr.map((p) => P(p[0], p[1], z));
      function drawGlass(a, dist) {
        const cx = dist * Math.cos(rad(a)), cy = dist * Math.sin(rad(a));
        const inCut = (p) => Math.hypot(p[0], p[1]) < RC;
        const disc = Array.from({ length: N }, (_, i) => pt(cx, cy, RG, i)), cut = Array.from({ length: N }, (_, i) => pt(0, 0, RC, i));
        // the disc of radius r about the glass centre, with the column's cut taken out (one closed polygon)
        const platePoly = (r) => {
          const ring = Array.from({ length: N }, (_, i) => pt(cx, cy, r, i));
          const Dr = runs(ring, (p) => !inCut(p))[0];
          let Kr = runs(cut, (p) => Math.hypot(p[0] - cx, p[1] - cy) < r)[0];
          if (!Kr) return Dr;
          const e = Dr[Dr.length - 1], d0 = Math.hypot(Kr[0][0] - e[0], Kr[0][1] - e[1]), d1 = Math.hypot(Kr[Kr.length - 1][0] - e[0], Kr[Kr.length - 1][1] - e[1]);
          if (d1 < d0) Kr = Kr.slice().reverse();
          return Dr.concat(Kr);
        };
        const plate = platePoly(RG), line = plate.concat([plate[0]]);
        const ringA = platePoly(RG * 0.8), ringB = platePoly(RG * 0.45);
        const bandOf = (list) => list.map((r) => poly(up(r, GZ).concat(up(r.slice().reverse(), GZ - GT)))).join("");
        const face = (p) => !inCut(p) && front({ u: p[0], v: p[1], nu: p[0] - cx, nv: p[1] - cy });
        const ringsOf = (ok) => {
          let s = "";
          for (const f of [0.45, 0.8]) for (const r of runs(Array.from({ length: N }, (_, i) => pt(cx, cy, RG * f, i)), (p) => !inCut(p) && ok(p))) s += open(up(r, GZ));
          return s;
        };
        bTop.setAttribute("d", poly(up(plate, GZ)));
        bBand.setAttribute("d", bandOf(runs(disc, face)));
        bRings.setAttribute("d", ringsOf(() => true));
        { const dx = Math.cos(rad(a)) * RG * 0.8, dy = Math.sin(rad(a)) * RG * 0.8, p1 = P(cx - dx, cy - dy, GZ), p2 = P(cx + dx, cy + dy, GZ);
          gr.lg.setAttribute("x1", p1[0]); gr.lg.setAttribute("y1", p1[1]); gr.lg.setAttribute("x2", p2[0]); gr.lg.setAttribute("y2", p2[1]); }
        bFill.setAttribute("d", poly(up(ringA, GZ)) + poly(up(ringB, GZ)));
        // the layer in front of the column
        const strip = (pl) => { let q = clip(pl, (p) => RC - U(p)); q = q.length ? clip(q, (p) => U(p) + RC) : q; return q.length ? clip(q, W) : q; };
        const f = strip(plate);
        fFill.setAttribute("d", f.length > 2 ? poly(up(f, GZ)) : "");
        const fa = strip(ringA), fb = strip(ringB);
        fRingFill.setAttribute("d", (fa.length > 2 ? poly(up(fa, GZ)) : "") + (fb.length > 2 ? poly(up(fb, GZ)) : ""));
        fBand.setAttribute("d", bandOf(runs(disc, (p) => face(p) && inFront(p))));
        fLine.setAttribute("d", runs(line, inFront).map((r) => open(up(r, GZ))).join(""));
        fRings.setAttribute("d", ringsOf(inFront));
      }

      const sp = spring(REST, { eps: 0.02 });
      let drawn = NaN, hov = null, dragging = false, peekT = 0, lit = null, cHull = [], gHull = [];
      const bearing = (p) => { const w = unproj(C, p[0], p[1], GZ); return REST + clamp(wrap((Math.atan2(w[1], w[0]) * 180) / Math.PI - REST), -V, V); };
      let dragA = REST, heldA = REST;
      const curBearing = () => (mode === "anim" ? sp.x : REST);
      const curDist = () => (mode === "explode" ? DIST + OUT * tx : DIST);
      function render() {
        C = mode === "anim" ? animCam() : mode === "orbit" ? VIEWS.orbit(az) : VIEWS.explode();
        P = proj(C); front = facing(C); cs = Math.cos(C.az); sn = Math.sin(C.az);
        put(col, prism(P, front, cr, ci, 0, H));
        drawGlass(curBearing(), curDist());
        cHull = hull([0, H].flatMap((z) => cr.map((q) => P(q.u, q.v, z))));
        // anim: the rest position (a target that does not run away from the pointer); the other modes: where the glass is now
        const gb = mode === "anim" ? REST : curBearing(), gx = curDist() * Math.cos(rad(gb)), gy = curDist() * Math.sin(rad(gb));
        gHull = hull([GZ, GZ - GT].flatMap((z) => Array.from({ length: 48 }, (_, i) => { const p = pt(gx, gy, RG, i * 2); return P(p[0], p[1], z); })));
      }
      const B = register(ctx.stage, (dt) => {
        if (mode !== "anim") return false;
        if (dragging) sp.t = dragA;
        else if (hov) sp.t = heldA + PEEK * (bearing(hov) - heldA);
        else sp.t = heldA + (peekT ? 18 * peekT : 0);
        const m = stepS(sp, dt);
        if (sp.x !== drawn) { drawn = sp.x; render(); }
        const on = dragging || !!hov || peekT > 0 || Math.abs(heldA - REST) > 0.5;
        if (on !== lit) { lit = on; ctx.read(on ? "vidrio 50" : "rest"); }
        return m || dragging;
      });
      bag.add(B.unregister);
      render(); drawn = REST;
      bTop.classList.add("hi"); fLine.classList.add("hi");

      const hit = (p) => pip(cHull, p) || pip(gHull, p) || edgeD(cHull, p) < 10 || edgeD(gHull, p) < 10;

      return {
        hit,
        setMode(m) {
          mode = m; az = 45; tx = 0; hov = null; dragging = false; peekT = 0; heldA = REST; dragA = REST; sp.t = REST; sp.x = REST; drawn = NaN; lit = null;
          render(); B.wake();
        },
        orbit(a) { az = a; render(); },
        explode(t) { tx = t; render(); },
        setVariant(v) { showRing(!!v && !v.original); },
        hover(p) { const h = p && hit(p) ? p : null; if (h || hov) { hov = h; B.wake(); } },
        peek(t) { peekT = t; B.wake(); },
        press(p) { dragging = true; hov = null; dragA = bearing(p); B.wake(); },
        drag(p) { dragA = bearing(p); B.wake(); },
        release() { dragging = false; heldA = dragA; B.wake(); },
        tap(p) { dragging = false; const a = bearing(p); heldA = Math.abs(a - heldA) < 4 ? REST : a; B.wake(); },
        destroy: bag.dispose,
      };
    },
  };
})();
