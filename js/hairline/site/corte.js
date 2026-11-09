/**
 * Corte on the Hairline site runtime (see ../hairline-site.js for the contract).
 * A short length of a Pernia door head, cut across and eased apart. Drawing from ../corte.js.
 * Hover / scroll peek: the layers part a little more, and (mouse) the layer under the pointer is lit.
 * Drag (vertical or horizontal, whichever leads): scrubs the explode gap. Tap on a layer picks it:
 * bright edge and its name in the read-out.
 */
(function () {
  const { Cam, clamp, facing, fit, hull, poly, proj, rings, rrect, prism, put, solid, spring, stepS, disposer, mk, place, register } = HL;

  const L = 44, GM = 10, GAP0 = 5, PEEK = 3.6, MARGIN = 7;
  // layer 0 hierro, 1 gypsum (ceiling slab, slot between), 2 riel (and carriage), 3 perfil, 4 vidrio; sx = lateral sign
  // Heights follow the section drawings (sections/pglass-1a..4c): head box about as tall as the steel tube, hanger stem
  // under it, then the profile, then the glass. Gypsum is a pair of thin vertical returns beside the head box.
  // QUESTION: "¿El hierro de este corte es siempre 2x2 o lo mostramos con el del sistema que se esté viendo (2x4, 2x6)?"
  // QUESTION: "¿El gypsum a los lados del riel lleva siempre ese retorno vertical, o depende de la obra?"
  const PARTS = [
    { l: 4, x0: -3.2, x1: 3.2, z0: -112, z1: -44, r: 1.2, b: 0.5, dz: -1.3 },
    { l: 3, x0: -18, x1: 18, z0: -54, z1: -40, r: 2.4, b: 1.1, dz: -0.7, wall: 2.6 },
    { l: 2, x0: -3, x1: 3, y0: 15, y1: 29, z0: -40, z1: -28, r: 1.2, b: 0.6, dz: -0.2 },
    { l: 1, x0: -23, x1: -19, z0: -28, z1: 12, r: 1, b: 0.5, dz: 0.5, sx: -1.2 },
    { l: 2, x0: -17, x1: 17, z0: -28, z1: 12, r: 2, b: 1, dz: 0.3, wall: 2.2, dots: 1 },
    { l: 1, x0: 19, x1: 23, z0: -28, z1: 12, r: 1, b: 0.5, dz: 0.5, sx: 1.2 },
    { l: 0, x0: -20, x1: 20, z0: 12, z1: 52, r: 2.4, b: 1.2, dz: 1.4, wall: 4 },
  ];
  const NAMES = ["hierro 2×2", "gypsum", "riel", "perfil", "vidrio 8mm"];

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

  HairlineSite.figures.corte = {
    name: "corte",
    title: "Corte del cabezal",
    hint: "Arrastra para abrir o cerrar el corte. Toca una capa para nombrarla.",
    label: "Corte del cabezal de una puerta Pernia: hierro, gypsum, riel, perfil y vidrio, separados. Arrastra para abrirlo.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const C = Cam(45, 0.5, 1.55);
      const ext = [];
      for (const x of [-23 - 1.2 * GM, 23 + 1.2 * GM]) for (const y of [0, L]) for (const z of [-112 - 1.3 * GM, 52 + 1.4 * GM]) ext.push([x, y, z]);
      fit(C, ext, 200, 166);
      const P = proj(C), front = facing(C);

      const g = mk("g", {}, svg);
      const els = PARTS.map((p) => {
        const s = solid(g), marks = [];
        if (p.wall) marks.push(mk("path", { class: "nf lo" }, g));
        const dots = p.dots ? [mk("circle", { r: 1.3, class: "dot off" }, g), mk("circle", { r: 1.3, class: "dot off" }, g)] : [];
        return { p, s, wall: marks[0], dots };
      });

      let drawn = -1, act = -2;
      const sp = spring(GAP0);
      function draw(gap) {
        for (const { p, s, wall, dots } of els) {
          const dx = (p.sx || 0) * gap, dz = p.dz * gap, y0 = p.y0 || 0, y1 = p.y1 || L;
          const [ring, inner] = rings(p.x0 + dx, y0, p.x1 + dx, y1, p.r, p.b);
          put(s, prism(P, front, ring, inner, p.z0 + dz, p.z1 + dz));
          if (wall) {
            const w = p.wall, face = rrect(p.x0 + dx + w, p.z0 + dz + w, p.x1 + dx - w, p.z1 + dz - w, 1, 3);
            wall.setAttribute("d", poly(face.map((q) => P(q.u, y1, q.v))));
          }
          dots.forEach((d, k) => place(d, P((k ? 7 : -7) + dx, y1, p.z0 + 6 + dz)));
        }
        drawn = gap;
      }
      draw(GAP0);

      const B = register(ctx.stage, (dt) => {
        const moving = stepS(sp, dt);
        if (sp.x !== drawn) draw(sp.x);
        return moving;
      });
      bag.add(B.unregister);

      // State. gc: the committed gap. sel: the picked layer (-1 none). hovL: the layer under the mouse.
      let gc = GAP0, sel = -1, hovL = -1, peekT = 0, dragging = false, g0 = GAP0, touched = false;
      function paint() {
        const a = hovL >= 0 ? hovL : sel;
        if (a === act) return;
        act = a;
        for (const { p, s, dots } of els) {
          s.sil.classList.toggle("hi", p.l === (a < 0 ? 4 : a));
          dots.forEach((d) => d.setAttribute("class", p.l === (a < 0 ? 4 : a) ? "dot" : "dot off"));
        }
        ctx.read(a < 0 ? "rest" : NAMES[a]);
      }
      paint();
      const aim = () => {
        const k = dragging ? 0 : Math.max(hovL >= 0 ? 1 : 0, peekT);
        sp.t = clamp(gc + PEEK * k, 0, GM);
        B.wake();
      };

      // Hit: each layer's silhouette as it stands (committed gap), plus finger slop. Later parts are nearer.
      const hulls = new Map();
      const hullsAt = (gap) => {
        const key = Math.round(gap * 4);
        if (hulls.has(key)) return hulls.get(key);
        const hs = PARTS.map((p) => {
          const dx = (p.sx || 0) * gap, dz = p.dz * gap, y0 = p.y0 || 0, y1 = p.y1 || L, pts = [];
          for (const x of [p.x0 + dx, p.x1 + dx]) for (const y of [y0, y1]) for (const z of [p.z0 + dz, p.z1 + dz]) pts.push(P(x, y, z));
          return { l: p.l, h: hull(pts) };
        });
        hulls.set(key, hs);
        return hs;
      };
      const layerAt = (p) => {
        const hs = hullsAt(gc);
        let best = -1, bd = MARGIN;
        for (let i = hs.length - 1; i >= 0; i--) {
          const d = dpoly(hs[i].h, p);
          if (d === 0) return hs[i].l;
          if (d < bd) { bd = d; best = hs[i].l; }
        }
        return best;
      };
      const hit = (p) => layerAt(p) >= 0;

      // rest bounds, joined with the widest gap a drag can reach
      {
        const m1 = bb(svg), keep = sp.x;
        draw(GM);
        const m2 = bb(svg);
        draw(keep);
        if (m1 && m2) {
          const x0 = Math.min(m1[0], m2[0]), y0 = Math.min(m1[1], m2[1]);
          HairlineSite.figures.corte.bounds = [x0, y0, Math.max(m1[0] + m1[2], m2[0] + m2[2]) - x0, Math.max(m1[1] + m1[3], m2[1] + m2[3]) - y0];
        } else if (m1) HairlineSite.figures.corte.bounds = m1;
      }

      return {
        hit,
        hover(p) {
          const a = p ? layerAt(p) : -1;
          if (a !== hovL) { hovL = a; paint(); aim(); }
        },
        peek(t) { peekT = t; aim(); },
        press(p) { dragging = true; touched = true; hovL = -1; g0 = gc; sel = layerAt(p); paint(); aim(); },
        drag(p, d) {
          const lead = Math.abs(d.dx) >= Math.abs(d.dy) ? d.dx : -d.dy;
          gc = clamp(g0 + lead * 0.09, 0, GM);
          sp.t = gc; B.wake();
        },
        release() { dragging = false; aim(); },
        tap(p) { dragging = false; sel = layerAt(p); paint(); aim(); },
        destroy: bag.dispose,
      };
    },
  };
})();
