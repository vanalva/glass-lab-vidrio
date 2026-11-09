/**
 * Pivote on the Hairline site runtime (see ../hairline-site.js for the contract).
 * pglass-piv: one tall leaf turning on a vertical axis set in from its hinge stile. Drawing from ../pivote.js.
 * Hover / scroll peek: the door turns a few degrees toward open and the dashed swing arc goes bright.
 * Drag: the door follows the pointer's angle around the pivot (relative to where the grab began),
 * clamped to the maximum swing; release leaves it there. Tap: opens to about 45 degrees, or closes.
 * Rule 06 departure as in pivote.js: the glass is `nf`.
 */
(function () {
  const { Cam, clamp, fit, proj, rings, prism, fillet, hull, poly, open, seg, rad, spring, stepS, flatDot, mk, place, register, disposer, solid, put, unproj } = HL;

  const W = 36, T = 2.4, Z0 = 1.2, Z1 = 109.2, OH = 110.4, OW = W + 2, PX = 1 + W / 6, FR = 2.5, REST = 26, MAX = 80;
  const PO = T / 2 + 2;
  // No pull is drawn: the piv renders (2-middle-pivot) and photos show no handle.
  // QUESTION: "Guillermo, ¿a cuántos mm del borde del vidrio queda el eje del pivote (y el pivote es fijo o regulable)?" (axis kept at W/6; not claimed as exact)
  // QUESTION: "¿La puerta pivotante gira en los dos sentidos o solo hacia un lado, y hasta qué ángulo?" (MAX 80 kept)
  // QUESTION: "¿La pivotante lleva tirador? Si sí, ¿de qué tipo y a qué altura?"
  const PEEK = 7, OPENED = 45, MARGIN = 9;

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

  HairlineSite.figures.pivote = {
    name: "pivote",
    variants: "perfil", // the 9 anodized finishes (class "fin" = aluminium: frame); glass stays clear
    title: "Puerta pivotante",
    hint: "Gira la puerta alrededor de su eje. Un toque la abre a 45° o la cierra.",
    label: "Puerta pivotante de vidrio, pglass-piv. Arrastra para girarla sobre su eje.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const C = Cam(45, 0.5, 2.1);
      const world = (u, v, z, a) => {
        const s = Math.sin(rad(a)), c = Math.cos(rad(a));
        return [PX + (u - W / 6) * c - v * s, (u - W / 6) * s + v * c, z];
      };
      const ext = [[-6, -14, -2], [44, 44, -2], [44, -14, -2], [-6, 44, -2], [0, 0, OH]];
      for (const a of [0, MAX]) for (const u of [0, W]) for (const v of [-T / 2, PO]) ext.push(world(u, v, Z1, a), world(u, v, Z0, a));
      fit(C, ext, 200, 168);
      const P = proj(C);
      const rnd = (pts, r) => fillet(pts, pts.map(() => r), 4);

      const g = mk("g", {}, svg);
      const [fr, fi] = rings(-6, -14, 44, 44, 6, 1.5);
      put(solid(g), prism(P, () => true, fr, fi, -2, 0));

      const rectAt = (y) => [[0, y, 0], [0, y, OH], [OW, y, OH], [OW, y, 0]].map((p) => P(...p));
      mk("path", { class: "lo nf", d: open(rectAt(0).slice(0, 4)) }, g);

      // the reach: the free stile's foot, swept to the maximum swing
      const arc = mk("path", { class: "dash nf" }, g);
      {
        const pts = [];
        for (let i = 0; i <= 24; i++) pts.push(P(...world(W - 0.6, 0, 0, (MAX * i) / 24)));
        arc.setAttribute("d", open(pts));
      }
      const dotLo = flatDot(g, C, 1.1, "dot off"), dotHi = flatDot(g, C, 1.1, "dot off");

      const lf = { hull: mk("path", { class: "sil nf" }, g), fa: mk("path", { class: "lo nf" }, g), fb: mk("path", { class: "lo nf" }, g) };
      const frame = mk("path", { class: "sil fin-fill", "fill-rule": "evenodd" }, g);
      const edge = mk("path", { class: "hi nf fin" }, g);
      const sp = spring(REST, { eps: 0.02 });
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
        edge.setAttribute("d", lit ? seg(W3(W, T / 2, Z0), W3(W, T / 2, Z1)) : "");
        place(dotLo, P(PX, 0, 0)); place(dotHi, P(PX, 0, Z1));
        arc.classList.toggle("hi", arcHi);
      }

      // State. A: the committed angle (what a release leaves). The spring follows A plus the peek.
      let A = REST, hov = false, peekT = 0, dragging = false, touched = false;
      let ang0 = 0, a0 = REST, zg = 55;
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
        const l = dragging || k > 0.05, ah = l;
        if (l !== lit || ah !== arcHi) { lit = l; arcHi = ah; drawn = NaN; }
        ctx.read(touched || k > 0.05 || dragging ? Math.round(sp.t) + "°" : "entreabierta");
        B.wake();
      };
      draw(); ctx.read("entreabierta"); // the opening pose is a peek, not a closed rest

      // Hit: the leaf's silhouette as it stands now, plus finger slop. Nothing beyond it.
      const hit = (p) => dpoly(leafHull(sp.t), p) <= MARGIN;
      // The pointer's angle around the pivot, on the plane the grab fell on (height zg).
      const angAt = (p) => { const w = unproj(C, p[0], p[1], zg); return (Math.atan2(w[1], w[0] - PX) * 180) / Math.PI; };
      const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
      const dist = (p) => { const w = unproj(C, p[0], p[1], zg); return Math.hypot(w[0] - PX, w[1]); };

      const mb = bb(svg);
      if (mb) {
        // union with the door held at the full swing, so a drag to the stop is never cropped
        const keep = sp.x;
        sp.x = MAX; draw();
        const m2 = bb(svg);
        sp.x = keep; draw(); drawn = sp.x;
        if (m2) {
          const x0 = Math.min(mb[0], m2[0]), y0 = Math.min(mb[1], m2[1]);
          HairlineSite.figures.pivote.bounds = [x0, y0, Math.max(mb[0] + mb[2], m2[0] + m2[2]) - x0, Math.max(mb[1] + mb[3], m2[1] + m2[3]) - y0];
        } else HairlineSite.figures.pivote.bounds = mb;
      }

      return {
        hit,
        hover(p) { const h = !!p && hit(p); if (h !== hov) { hov = h; aim(); } },
        peek(t) { peekT = t; aim(); },
        press(p) {
          // find the height at which the grab falls on the leaf's own plane, then measure the angle there
          let best = Infinity;
          for (let z = 0; z <= OH; z += 2) {
            const w = unproj(C, p[0], p[1], z), a = rad(A), r = (w[0] - PX) * -Math.sin(a) + w[1] * Math.cos(a);
            const along = (w[0] - PX) * Math.cos(a) + w[1] * Math.sin(a);
            const e = Math.abs(r) + (along < -W / 6 || along > (5 * W) / 6 ? 20 : 0);
            if (e < best) { best = e; zg = z; }
          }
          dragging = true; touched = true; hov = false; a0 = A; ang0 = angAt(p); aim();
        },
        drag(p) {
          if (dist(p) < 3) return;
          A = clamp(a0 + wrap(angAt(p) - ang0), 0, MAX);
          aim();
        },
        release() { dragging = false; aim(); },
        tap() { dragging = false; A = A < OPENED - 10 ? OPENED : 0; aim(); },
        destroy: bag.dispose,
      };
    },
  };
})();
