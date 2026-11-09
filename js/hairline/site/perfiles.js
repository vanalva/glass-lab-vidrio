/**
 * Perfiles on the Hairline site runtime (see ../hairline-site.js for the contract).
 * Nine lengths of Pernia's slim extrusion in a stepped rack, one per finish. Drawing from ../perfiles.js.
 * Hover / scroll peek: the length under the pointer lifts a little and its neighbours begin to part.
 * Tap: it lifts out fully, the read-out names the finish. Drag across: scrubs through the lengths one by one.
 * COLOUR: each length is stroked in its own finish colour (class `fin` + HairlineSite.paint, data in site/variants.js), all nine at once.
 * Motion is the bench's staggered 700ms tween (tset); a partial peek is the same tween aimed at a smaller target.
 */
(function () {
  const {
    Cam, clamp, facing, fit, hull, poly, proj, ringAt, rings, rrect, prism,
    tdone, tset, tval, tween, disposer, mk, place, register, solid, put,
  } = HL;

  const NAMES = ["black", "blanco · ral 9016", "brass", "burgundy · ral 3007", "cobalt blue · ral 5013", "gold rose", "marrón", "olive · ral 6003", "orange · ral 8002"];
  // One cut length for all nine (perfiles/todos.webp), about 3x the section width.
  const HT = [90, 90, 90, 90, 90, 90, 90, 90, 90];
  const JX = [0, -1.5, 1, 1.2, 0, -1.2, -1, 1.5, 0.5];
  const TIER = [17, 9, 3];
  const PX = 38, PY = 30, CX0 = 19, CY0 = 16, LIFT = 12, PART = 7, STAG = 45, HOVL = 0.55, MARGIN = 7;
  const TZ = (i) => TIER[Math.floor(i / 3)];
  const centre = (i) => [CX0 + (i % 3) * PX + JX[i], CY0 + Math.floor(i / 3) * PY];
  // Asymmetric section: web with the slot above it, a thick leg (left, ~40%) and a thinner one (right, ~33%).
  // QUESTION: "¿Cuáles son las medidas reales de la sección del perfil (ancho, alto, ancho de la ranura) y su largo comercial?"
  // QUESTION: "¿Los acabados naranja y burgundy son anodizado o pintura RAL (en el JSON aparecen con RAL)?"
  const PARTS = [[-3, -8, 5, -1, 0.6], [-15, -8, -3, 8, 1.8], [5, -8, 15, 4, 1.8]];

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

  HairlineSite.figures.perfiles = {
    name: "perfiles",
    variants: [{ id: "acabados", label: "Acabados" }], // Original + all nine finishes at once (painted by the figure)
    variantsLabel: "Acabados",
    title: "Perfiles",
    hint: "Toca un perfil para sacarlo del soporte. Arrastra para recorrerlos.",
    label: "Nueve perfiles de aluminio de Pernia en un soporte, uno por acabado. Toca uno para sacarlo.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const C = Cam(45, 0.5, 1.75);
      fit(C, [[-12, -4, 0], [118, -4, 0], [-12, 96, 0], [118, 96, 0], [5, 8, 17 + 90 + LIFT], [109, 8, 17 + 90], [5, 84, 3 + 90 + LIFT], [118, 96, 0]], 200, 166);
      const P = proj(C), front = facing(C);

      const g = mk("g", {}, svg);
      const items = [];
      for (let r = 0; r < 3; r++) {
        const plate = solid(g), y0 = r === 0 ? -5 : CY0 + r * PY - PY / 2, y1 = r === 2 ? 97 : CY0 + r * PY + PY / 2;
        const [po, pi] = rings(-4, y0, 112, y1, 2, 1.4);
        put(plate, prism(P, front, po, pi, 0, TIER[r]));
        for (let c = 0; c < 3; c++) {
          const i = r * 3 + c, grp = mk("g", {}, g), sols = PARTS.map(() => solid(grp));
          const dots = [0, 1].map(() => mk("circle", { r: 1.1, class: "dot off" }, grp));
          // COLOUR: each length is drawn in ITS OWN finish (HairlineSite.variants.perfil[i], same order as NAMES), all at once, no picker.
          const fin = ((HairlineSite.variants || {}).perfil || [])[i];
          if (fin) {
            HairlineSite.paint(grp, "fin", fin.hex);
            // the cut end stays neutral: it is bare aluminium in every render, only the faces are finished
            for (const so of sols) so.sil.classList.add("fin");
          }
          items.push({ i, sols, dots, h: HT[i], x: tween(0), y: tween(0), z: tween(0) });
        }
      }

      function draw(it, dx, dy, dz) {
        const [cx, cy] = centre(it.i), z0 = TZ(it.i) + dz, z1 = TZ(it.i) + it.h + dz;
        PARTS.forEach(([a, b, c, d, bw], k) => {
          const [r, inn] = rings(cx + dx + a, cy + dy + b, cx + dx + c, cy + dy + d, 1.8, bw);
          put(it.sols[k], prism(P, front, r, inn, z0, z1));
        });
        place(it.dots[0], P(cx + dx - 9, cy + dy, z1));
        place(it.dots[1], P(cx + dx + 9, cy + dy - 2, z1));
      }

      // hit areas: each length's resting silhouette on screen, never the pose drawn now
      const boxes = items.map((it) => {
        const [x, y] = centre(it.i), ring = rrect(x - 15, y - 8, x + 15, y + 8, 2, 3);
        return { i: it.i, h: hull(ringAt(P, ring, TZ(it.i)).concat(ringAt(P, ring, TZ(it.i) + HT[it.i]))) };
      });
      /** The length whose rest silhouette holds p, else the nearest within finger slop; -1 outside. */
      function idxAt(p) {
        let best = -1, bd = MARGIN;
        for (const { i, h } of boxes) {
          const d = dpoly(h, p);
          if (d === 0) best = i, bd = -1;
          else if (d < bd) { bd = d; best = i; }
        }
        return best;
      }

      for (const it of items) draw(it, 0, 0, 0);
      // Reach bounds: rest, joined with each length lifted out.
      {
        const m0 = bb(svg);
        let u = m0 ? m0.slice() : null;
        if (u) {
          let x1 = u[0] + u[2], y1 = u[1] + u[3];
          for (const it of items) {
            draw(it, 0, 0, LIFT);
            const m = bb(svg);
            draw(it, 0, 0, 0);
            if (m) { u[0] = Math.min(u[0], m[0]); u[1] = Math.min(u[1], m[1]); x1 = Math.max(x1, m[0] + m[2]); y1 = Math.max(y1, m[1] + m[3]); }
          }
          u[2] = x1 - u[0]; u[3] = y1 - u[1];
          HairlineSite.figures.perfiles.bounds = u;
        }
      }
      for (const it of items) draw(it, 0, 0, 0);

      const B = register(ctx.stage, (_dt, now) => {
        let moving = false;
        for (const it of items) {
          draw(it, tval(it.x, now), tval(it.y, now), tval(it.z, now));
          if (!tdone(it.x, now) || !tdone(it.y, now) || !tdone(it.z, now)) moving = true;
        }
        return moving;
      });
      bag.add(B.unregister);

      // State. sel: the length lifted out by tap/drag. hov: under the mouse. peekT: scroll peek.
      let sel = -1, hov = -1, peekT = 0, last = { a: -2, lv: -1 };
      function show(a, lv) {
        lv = Math.round(lv * 8) / 8;
        if (a === last.a && lv === last.lv) return;
        const now = performance.now(), from = a >= 0 ? a : last.a >= 0 ? last.a : 4, [fx, fy] = centre(from);
        last = { a, lv };
        for (const it of items) {
          const [cx, cy] = centre(it.i);
          const delay = Math.hypot((cx - fx) / PX, (cy - fy) / PY) * STAG;
          let dx = 0, dy = 0, dz = 0;
          if (a >= 0 && it.i !== a) {
            const [ax, ay] = centre(a), vx = (cx - ax) / PX, vy = (cy - ay) / PY, n = Math.hypot(vx, vy) || 1;
            const amt = clamp(PART / (1 + 0.55 * (n - 1)), 2, PART) * lv;
            dx = (vx / n) * amt; dy = (vy / n) * amt * 0.8;
          } else if (a === it.i) dz = LIFT * lv;
          tset(it.x, dx, now, delay); tset(it.y, dy, now, delay); tset(it.z, dz, now, delay);
          for (const s of it.sols) s.sil.classList.toggle("hi", it.i === (a < 0 ? 4 : a));
        }
        B.wake();
      }
      const refresh = () => {
        let a = -1, lv = 0;
        if (hov >= 0) { a = hov; lv = hov === sel ? 1 : HOVL; }
        else if (sel >= 0) { a = sel; lv = 1; }
        else if (peekT > 0.01) { a = 4; lv = peekT * HOVL; }
        show(a, lv);
        ctx.read(a < 0 ? "rest" : NAMES[a]);
      };
      // initial class: the middle length carries the bright edge at rest, as in the bench
      for (const it of items) for (const s of it.sols) s.sil.classList.toggle("hi", it.i === 4);
      last = { a: -1, lv: 0 };

      ctx.read("rest");
      return {
        hit: (p) => idxAt(p) >= 0,
        hover(p) { const a = p ? idxAt(p) : -1; if (a !== hov) { hov = a; refresh(); } },
        peek(t) { peekT = t; if (sel < 0 && hov < 0) refresh(); },
        press(p) { hov = -1; sel = idxAt(p); refresh(); },
        drag(p) { const a = idxAt(p); if (a >= 0 && a !== sel) { sel = a; refresh(); } },
        release() {},
        tap(p) { const a = idxAt(p); if (a >= 0) sel = a; refresh(); },
        destroy: bag.dispose,
      };
    },
  };
})();
