/**
 * Abatible on the Hairline site runtime (see ../hairline-site.js for the contract).
 * pglass-swi: one leaf hinged on its own stile (hinge line at the jamb, not set in like pglass-piv),
 * lever on the free stile, swinging out toward the viewer. Drawing language from ../pivote.js:
 * slim frame, `nf` see-through glass, jambs, dashed floor swing arc.
 * Hover / scroll peek: the leaf opens a few degrees and the swing arc brightens.
 * Drag: the leaf follows the pointer's angle around the hinge line (relative to where the grab began),
 * clamped to the swing; release leaves it there, and near closed a soft spring draws it shut.
 * Tap: opens to about 60 degrees, or closes.
 */
(function () {
  const { Cam, clamp, fit, proj, rings, prism, fillet, hull, poly, open, seg, rad, spring, stepS, flatDot, mk, place, register, disposer, solid, put, unproj } = HL;

  const W = 30.9, T = 2.4, Z0 = 1.2, Z1 = 109.2, OH = 110.4, OW = W + 2, HX = 1, FR = 2.5, MAX = 90;
  // lever on the free stile (rose + bar reaching toward the hinge), about 37% up from the floor
  const RU0 = W - 5.2, RU1 = W - 2.4, RZ0 = 37.6, RZ1 = 42.4, BU0 = W - 8, BU1 = W - 3.6, BZ0 = 39.4, BZ1 = 40.8, PO = T / 2 + 2;
  // No hinge hardware is drawn: none is visible in systems/pglass-swi/1, 2 or app (concealed, or on the far side).
  // QUESTION: "¿Las bisagras son ocultas o a la vista, y cuántas lleva (tres, como dibujamos)?"
  // QUESTION: "¿La puerta abatible abre hacia adentro o hacia afuera del espacio, o se puede elegir al pedirla?" (the figure swings toward the viewer; the evidence render 2.webp may show it opening away)
  // QUESTION: "¿El cierre suave de la abatible va en las bisagras o en un cierrapuertas?"
  const PEEK = 6, OPENED = 60, SHUT = 7, MARGIN = 9;

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

  HairlineSite.figures.abatible = {
    name: "abatible",
    variants: "perfil", // the 9 anodized finishes (class "fin" = aluminium: frame, lever); glass stays clear
    title: "Puerta abatible",
    hint: "Abre la puerta sobre sus bisagras. Un toque la abre a 60° o la cierra.",
    label: "Puerta abatible de vidrio, pglass-swi. Arrastra para abrirla sobre sus bisagras.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const C = Cam(45, 0.5, 2.1);
      const world = (u, v, z, a) => {
        const s = Math.sin(rad(a)), c = Math.cos(rad(a));
        return [HX + u * c - v * s, u * s + v * c, z];
      };
      const ext = [[-6, -14, -2], [W + 8, W + 8, -2], [W + 8, -14, -2], [-6, W + 8, -2], [0, 0, OH]];
      for (const a of [0, MAX]) for (const u of [0, W]) for (const v of [-T / 2, PO]) ext.push(world(u, v, Z1, a), world(u, v, Z0, a));
      fit(C, ext, 200, 168);
      const P = proj(C);
      const rnd = (pts, r) => fillet(pts, pts.map(() => r), 4);

      const g = mk("g", {}, svg);
      const [fr, fi] = rings(-6, -14, W + 8, W + 8, 6, 1.5);
      put(solid(g), prism(P, () => true, fr, fi, -2, 0));

      // the jambs and head, in the wall plane
      const rectAt = (y) => [[0, y, 0], [0, y, OH], [OW, y, OH], [OW, y, 0]].map((p) => P(...p));
      mk("path", { class: "lo nf", d: open(rectAt(0)) }, g);

      // the reach: the free stile's foot, swept over the swing
      const arc = mk("path", { class: "dash nf" }, g);
      {
        const pts = [];
        for (let i = 0; i <= 24; i++) pts.push(P(...world(W - 0.6, 0, 0, (MAX * i) / 24)));
        arc.setAttribute("d", open(pts));
      }
      const dotLo = flatDot(g, C, 1.1, "dot off"), dotHi = flatDot(g, C, 1.1, "dot off");

      const lf = { hull: mk("path", { class: "sil nf" }, g), fa: mk("path", { class: "lo nf" }, g), fb: mk("path", { class: "lo nf" }, g) };
      const frame = mk("path", { class: "sil fin-fill", "fill-rule": "evenodd" }, g);
      const rose = mk("path", { class: "sil hi fin-fill" }, g), bar = mk("path", { class: "sil hi fin-fill" }, g), post = mk("path", { class: "lo nf fin" }, g);
      const edge = mk("path", { class: "hi nf fin" }, g);
      const sp = spring(0, { eps: 0.02 });
      let drawn = NaN, lit = false, arcHi = false;

      function leafHull(a) {
        const pts = [];
        for (const u of [0, W]) for (const v of [-T / 2, T / 2]) for (const z of [Z0, Z1]) pts.push(P(...world(u, v, z, a)));
        return hull(pts);
      }
      function draw() {
        const a = sp.x, W3 = (u, v, z) => P(...world(u, v, z, a));
        const rect = (v, f) => [[f, Z0 + f], [W - f, Z0 + f], [W - f, Z1 - f], [f, Z1 - f]].map(([u, z]) => W3(u, v, z));
        lf.hull.setAttribute("d", poly(rnd(leafHull(a), 1.6)));
        frame.setAttribute("d", poly(rnd(rect(T / 2, 0), 1.2)) + poly(rnd(rect(T / 2, FR), 0.8)));
        lf.fa.setAttribute("d", poly(rnd(rect(T / 2, FR), 1)));
        lf.fb.setAttribute("d", poly(rnd(rect(-T / 2, FR), 1)));
        const rr = [[RU0, RZ0], [RU1, RZ0], [RU1, RZ1], [RU0, RZ1]].map(([u, z]) => W3(u, PO, z));
        const bb2 = [[BU0, BZ0], [BU1, BZ0], [BU1, BZ1], [BU0, BZ1]].map(([u, z]) => W3(u, PO, z));
        rose.setAttribute("d", poly(rnd(rr, 0.7)));
        bar.setAttribute("d", poly(rnd(bb2, 0.45)));
        const mu = (RU0 + RU1) / 2;
        post.setAttribute("d", seg(W3(mu, T / 2, (RZ0 + RZ1) / 2), W3(mu, PO, (RZ0 + RZ1) / 2)));
        edge.setAttribute("d", lit ? seg(W3(W, T / 2, Z0), W3(W, T / 2, Z1)) : "");
        place(dotLo, P(HX, 0, 0)); place(dotHi, P(HX, 0, Z1));
        rose.classList.toggle("hi", !lit); bar.classList.toggle("hi", !lit);
        arc.classList.toggle("hi", arcHi);
      }

      // State. A: the committed angle (what a release leaves). The spring follows A plus the peek.
      let A = 0, hov = false, peekT = 0, dragging = false, touched = false;
      let ang0 = 0, a0 = 0, zg = 55;
      const B = register(ctx.stage, (dt) => {
        const m = stepS(sp, dt);
        if (sp.x !== drawn) { drawn = sp.x; draw(); }
        return m;
      });
      bag.add(B.unregister);
      const aim = () => {
        const k = dragging ? 0 : Math.max(hov ? 1 : 0, peekT);
        const sgn = A > MAX - PEEK - 2 ? -1 : 1;
        sp.t = clamp(A + sgn * PEEK * k, 0, MAX);
        const l = dragging || k > 0.05;
        if (l !== lit || l !== arcHi) { lit = l; arcHi = l; drawn = NaN; }
        ctx.read(touched || k > 0.05 || dragging ? "abierta " + Math.round(sp.t) + "°" : "rest");
        B.wake();
      };
      draw(); ctx.read("rest");

      // Hit: the leaf as it stands now, plus finger slop; the closed leaf's footprint always counts.
      const hit = (p) => dpoly(leafHull(sp.t), p) <= MARGIN || dpoly(leafHull(0), p) <= MARGIN;
      // The pointer's angle around the hinge line, on the plane the grab fell on (height zg).
      const angAt = (p) => { const w = unproj(C, p[0], p[1], zg); return (Math.atan2(w[1], w[0] - HX) * 180) / Math.PI; };
      const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
      const dist = (p) => { const w = unproj(C, p[0], p[1], zg); return Math.hypot(w[0] - HX, w[1]); };

      const mb = bb(svg);
      if (mb) {
        // union with the leaf held at full swing, so a drag to the stop is never cropped
        const keep = sp.x;
        sp.x = MAX; draw();
        const m2 = bb(svg);
        sp.x = keep; draw(); drawn = sp.x;
        if (m2) {
          const x0 = Math.min(mb[0], m2[0]), y0 = Math.min(mb[1], m2[1]);
          HairlineSite.figures.abatible.bounds = [x0, y0, Math.max(mb[0] + mb[2], m2[0] + m2[2]) - x0, Math.max(mb[1] + mb[3], m2[1] + m2[3]) - y0];
        } else HairlineSite.figures.abatible.bounds = mb;
      }

      return {
        hit,
        hover(p) { const h = !!p && hit(p); if (h !== hov) { hov = h; aim(); } },
        peek(t) { peekT = t; aim(); },
        press(p) {
          // find the height at which the grab falls on the leaf's own plane, then measure the angle there
          let best = Infinity;
          for (let z = 0; z <= OH; z += 2) {
            const w = unproj(C, p[0], p[1], z), a = rad(A), r = (w[0] - HX) * -Math.sin(a) + w[1] * Math.cos(a);
            const along = (w[0] - HX) * Math.cos(a) + w[1] * Math.sin(a);
            const e = Math.abs(r) + (along < 0 || along > W ? 20 : 0);
            if (e < best) { best = e; zg = z; }
          }
          dragging = true; touched = true; hov = false; a0 = A; ang0 = angAt(p); aim();
        },
        drag(p) {
          if (dist(p) < 3) return;
          A = clamp(a0 + wrap(angAt(p) - ang0), 0, MAX);
          aim();
        },
        // near closed, the soft-close spring draws the leaf the last few degrees
        release() { dragging = false; if (A < SHUT) A = 0; aim(); },
        tap() { dragging = false; A = A < OPENED - 20 ? OPENED : 0; aim(); },
        destroy: bag.dispose,
      };
    },
  };
})();
