/**
 * Stoa on the Hairline site runtime (see ../hairline-site.js).
 * A console of laminated glass planes: a top plane over two bases. Two base models (from the renders console-iso-1..8, there is no catalogue line drawing):
 *   modelo 1: each end is a glass "U" (two cross planes joined by a back plane against the wall).
 *   modelo 2: each end is two loose cross planes, tied by a rail plane under the front edge of the top.
 * MODES: "anim" (illustrative, below), "orbit" (Girar: only the camera turns) and "explode" (Despiece, for the base model that is showing:
 * the top plane, with the rail on model 2, lifts straight up first; then each end's two cross planes slide apart along x; on modelo 1 the
 * back planes stay between them as the datum).
 * Anim: one number, pull, how far the top plane is drawn away from the wall (it also lifts a little).
 * Hover top / scroll peek: the top eases a few cm out, a dashed ghost marks where a full pull ends.
 * Hover base: the base starts to turn into the other model. Drag toward the viewer: the top comes off the wall; release stays. Tap the top: back.
 * Tap the base: the other model (the back planes sink away, the rail grows in).
 * Departure from rule 06: every plane is drawn without fill (it is glass), so the ones behind show through.
 * COLOUR (variants "stoa": Bronce, Bronce oscuro, Humo, Grafito; ALTERNATIVES that also pick the base model): from renders/console-iso-1..4.webp.
 * The whole console is one tinted laminated glass, so every plane is `tint`. iso-1 Bronce and iso-2 Bronce oscuro are modelo 1 (the "U" ends);
 * iso-3 Humo and iso-4 Grafito are modelo 2 (loose planes + rail). Choosing a finish shows its model; tapping the base picks the same-position
 * finish on the other model by pressing that swatch.
 * TRUTH (audit furniture-2): the rail is a ~12 cm band set back from the front edge (iso-7/8); length 170 until Pernia answers (renders read 2.5 to 3 times the height).
 * QUESTION: "Guillermo, ¿cuales son las medidas estandar de la Stoa (largo, fondo, alto)?" (L = 170 meanwhile)
 * QUESTION: "¿Los dos planos de cada extremo del modelo 2 tienen la misma profundidad?" (drawn equal)
 * QUESTION: "¿El riel del modelo 2 va retrasado respecto al frente de la tapa? ¿Cuanto mide de alto?" (drawn 4 cm back, 12 cm high)
 * QUESTION: "¿La tapa va pegada a los planos de la base o solo apoyada?" (drawn resting on the ends; the despiece lifts it straight up)
 * QUESTION: "¿El Bronce existe tambien en el modelo 2, y el Humo en el modelo 1?"
 */
(function () {
  const { Cam, clamp, facing, fit, hull, proj, rings, prism, put, solid, spring, stepS, tween, tset, tval, tdone, disposer, mk, register, unproj } = HL;
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

  const L = 170, D = 34, HT = 76, TK = 1.8, W = 40, TS = 1.8, HR = 12, RB = 4;
  const ZL = HT - TS, PULL = 30, PEEK = 9, LIFT = 0.25;
  const ph = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  // part order: 0 top, 1..4 cross planes (left outer, left inner, right inner, right outer), 5 back L, 6 back R, 7 rail
  const boxes = (pull, m, ex) => {
    const lift = ex ? ph(ex, 0, 0.5) : 0, sl = ex ? ph(ex, 0.5, 1) : 0, zt = pull * LIFT + 28 * lift;
    const b = [
      [0, pull, ZL + zt, L, D + pull, HT + zt],
      [0, 0, 0, TK, D, ZL], [W - TK, 0, 0, W, D, ZL], [L - W, 0, 0, L - W + TK, D, ZL], [L - TK, 0, 0, L, D, ZL],
      [TK, 0, ZL * m, W - TK, TK, ZL], [L - W + TK, 0, ZL * m, L - TK, TK, ZL],
      [0, D - TK - RB, ZL - HR * m + 28 * lift, L, D - RB, ZL + 28 * lift],
    ];
    const mv = [-16, 16, -16, 16];
    for (let i = 0; i < 4; i++) b[1 + i] = shiftBox(b[1 + i], [mv[i] * sl, 0, 0]);
    return b;
  };
  const ASM = boxes(0, 0, 0).map((b, i) => (i === 5 || i === 6 ? [b[0], b[1], 0, b[3], b[4], b[5]] : b));
  ASM[7] = boxes(0, 1, 0)[7];
  const EXPL = boxes(0, 1, 1).concat(boxes(0, 0, 1).slice(5, 7).map((b) => b));
  const VIEWS = Views(2.1, ASM, EXPL);
  const ANIM_PTS = ASM.concat([boxes(PULL, 0, 0)[0]]).flatMap(corners);
  const SA = animScale(2.1, ANIM_PTS);
  const animCam = () => { const C = Cam(45, 0.5, SA); fit(C, ANIM_PTS, 200, 166); return C; };
  const BOUNDS = (() => {
    const P = proj(animCam());
    const bp = [-2, L + 2].flatMap((x) => [-2, D + PULL + 2].flatMap((y) => [0, HT + PULL * LIFT + 2].map((z) => P(x, y, z))));
    const x0 = Math.min(...bp.map((q) => q[0])), y0 = Math.min(...bp.map((q) => q[1])), x1 = Math.max(...bp.map((q) => q[0])), y1 = Math.max(...bp.map((q) => q[1]));
    return unionB([x0, y0, x1 - x0, y1 - y0], (([a, b, c, d]) => [a - 4, b - 4, c + 4, d + 4])(VIEWS.bounds()));
  })();

  HairlineSite.figures.stoa = {
    bounds: BOUNDS,
    name: "stoa",
    variants: "stoa", variantRole: "tint", variantsLabel: "Acabado del vidrio",
    title: "Stoa",
    hint: "Arrastra el plano superior hacia ti; toca la base para ver el otro modelo.",
    label: "Stoa, consola de vidrio laminado: un plano superior sobre dos bases, con dos modelos. Arrastra el plano superior para separarlo de la pared; toca la base para cambiar de modelo.",
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const g = mk("g", {}, svg);
      let mode = "anim", az = 45, tx = 0, C = animCam(), P = proj(C), front = facing(C);
      const wrap = [0, 1, 2, 3, 4, 5, 6, 7].map(() => mk("g", {}, g));
      const sol = wrap.map((w) => { const s = solid(w); s.sil.classList.add("nf", "tint"); return s; });
      const ghost = mk("path", { class: "nf hi", "stroke-dasharray": "5 4" }, g);
      const RAD = [2, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8], BEV = [0.9, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4];

      const ps = spring(0, { eps: 0.02 }), pk = spring(0, { k: 120, c: 18 }), pb = spring(0, { k: 120, c: 18 });
      // variant id -> base model (0 = modelo 1, the U ends; 1 = modelo 2, loose planes + rail), see the header
      const MODEL = { bronce: 0, "bronce-oscuro": 0, humo: 1, grafito: 1 }, IDS = ["bronce", "bronce-oscuro", "humo", "grafito"];
      const v0 = ctx.variant, m0 = v0 && MODEL[v0.id] ? 1 : 0;
      const mv = tween(m0);
      let cur = m0, hovT = false, hovB = false, peekT = 0, gmode = "idle", act = "rest", p0 = 0, gk = "", boxNow = ASM, mNow = m0;

      function render(now) {
        const animating = mode === "anim";
        C = animating ? animCam() : mode === "orbit" ? VIEWS.orbit(az) : VIEWS.explode();
        P = proj(C); front = facing(C);
        const pull = animating ? clamp(ps.x + PEEK * pk.x, 0, PULL) : 0;
        const m = animating ? clamp(tval(mv, now) + (cur ? -1 : 1) * 0.22 * pb.x, 0, 1) : cur;
        mNow = m;
        const b = boxes(pull, m, mode === "explode" ? tx : 0);
        boxNow = b;
        b.forEach((bx, i) => {
          if (bx[5] - bx[2] > 0.3) { const [r, inn] = rings(bx[0], bx[1], bx[3], bx[4], RAD[i], BEV[i]); put(sol[i], prism(P, front, r, inn, bx[2], bx[5])); }
          else put(sol[i], { sil: "", crease: "" });
        });
        const on = animating && pk.x > 0.03, key = on ? "1" : "";
        if (key !== gk) {
          gk = key;
          if (on) { const [r, i] = rings(0, PULL * 0.7, L, D + PULL * 0.7, 2, 0.9); ghost.setAttribute("d", prism(P, front, r, i, ZL + PULL * 0.7 * LIFT, HT + PULL * 0.7 * LIFT).sil); } else ghost.setAttribute("d", "");
        }
        ghost.setAttribute("opacity", String(on ? clamp(pk.x * 1.1, 0, 0.9) : 0));
        // paint order: only the parts that exist at this model take part
        const live = b.map((bx) => bx[5] - bx[2] > 0.3);
        const idx = b.map((_, i) => i).filter((i) => live[i]);
        paintOrder(idx.map((i) => b[i]), C).forEach((k) => g.appendChild(wrap[idx[k]]));
        g.appendChild(ghost);
      }
      render(performance.now());

      function paint() {
        sol[0].sil.classList.toggle("hi", act === "rest" || act === "plano superior");
        [1, 2, 3, 4].forEach((i) => sol[i].sil.classList.toggle("hi", act === "base"));
        ctx.read(act === "base" ? "modelo " + (cur + 1) : act);
      }
      paint();

      const B = register(ctx.stage, (dt, now) => {
        const a = stepS(ps, dt), b = stepS(pk, dt), c = stepS(pb, dt);
        render(now);
        return a || b || c || !tdone(mv, now);
      });
      bag.add(B.unregister);
      const retarget = () => { pk.t = gmode === "drag" ? 0 : Math.max(hovT ? 1 : 0, peekT); pb.t = gmode === "drag" ? 0 : hovB ? 1 : 0; };

      const hit = (p) => hitBoxes(P, boxNow.filter((bx) => bx[5] - bx[2] > 0.3), p);
      const onTop = (p) => { const z = boxNow[0][5]; const [x, y] = unproj(C, p[0], p[1], z); return x >= 0 && x <= L && y >= boxNow[0][1] && y <= boxNow[0][4]; };
      const o = P(0, 0, 0), ex = P(0, 1, 0)[0] - o[0], ey = P(0, 1, 0)[1] - o[1];
      const along = (dx, dy) => (dx * ex + dy * ey) / (ex * ex + ey * ey);

      return {
        hit,
        setMode(m) {
          mode = m; az = 45; tx = 0; hovT = hovB = false; peekT = 0; gmode = "idle"; act = "rest"; ps.t = 0; pk.t = 0; pb.t = 0; gk = "x";
          paint(); render(performance.now()); B.wake();
        },
        orbit(a) { az = a; render(performance.now()); },
        explode(t) { tx = t; render(performance.now()); },
        hover(p) {
          const h = !!p && hit(p);
          hovT = h && onTop(p); hovB = h && !hovT;
          act = hovT ? "plano superior" : hovB ? "base" : "rest";
          paint(); retarget(); B.wake();
        },
        peek(t) { peekT = t; retarget(); B.wake(); },
        press() { gmode = "idle"; hovT = hovB = false; p0 = ps.x; retarget(); B.wake(); },
        drag(p, d) {
          if (gmode !== "drag") { gmode = "drag"; act = "plano superior"; paint(); retarget(); }
          ps.t = clamp(p0 + along(d.dx, d.dy), 0, PULL);
          B.wake();
        },
        release() { gmode = "idle"; retarget(); B.wake(); },
        tap(p) {
          gmode = "idle";
          if (onTop(p)) { ps.t = 0; act = "plano superior"; }
          else {
            // the other model, in the same-position finish: press its swatch (the picker then calls setVariant below)
            const sw = ctx.stage.parentElement ? ctx.stage.parentElement.querySelectorAll(".hls-sw") : [], k = ctx.variant ? IDS.indexOf(ctx.variant.id) : -1;
            if (k >= 0 && sw[(k + 2) % 4 + 1]) sw[(k + 2) % 4 + 1].click(); // +1: the first swatch is Original
            else { cur = 1 - cur; tset(mv, cur, performance.now(), 0); }
            act = "base";
          }
          paint(); retarget(); B.wake();
        },
        // a finish was picked: show the base model that carries it
        setVariant(v) {
          if (v.original) return;
          const m = MODEL[v.id] ? 1 : 0;
          if (m !== cur) { cur = m; tset(mv, cur, performance.now(), 0); B.wake(); if (mode !== "anim") render(performance.now()); }
        },
        destroy: bag.dispose,
      };
    },
  };
})();
