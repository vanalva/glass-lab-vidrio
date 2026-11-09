/**
 * Fraca on the Hairline site runtime (see ../hairline-site.js). Drawing from ../fraca.js.
 * MODES: "anim" (illustrative, below), "orbit" (Girar: only the camera turns) and "explode" (Despiece: the legs and the coloured leg are the
 * datum and never move; the seat lifts straight up, the back slides back along x, the two arms slide out along y).
 * Anim: hover / scroll peek: the part under the pointer slides out a little (the others follow a little less). Drag: pull the part out along its
 * own axis (back backward, arm outward, seat up); release: it eases back. Tap: latches it fully out, tap again lets it go. The leg plates and the
 * coloured leg never move (they used to extend below the floor).
 * COLOUR (static, no picker): from catalogo/fraca-render-a.webp and -b. The two seat planes are strong coloured glass (tint) and the one hollow leg
 * is the other colour (tint-2); the back, both arms and the two leg planes are clear glass and stay plain. Blue seat, orange leg, as rendered.
 * Both are `opq` so the seat still hides what is under it, as its plate did.
 * TRUTH (audit furniture-2): the two seat planes are at different heights (diagram: a ~3.5 cm vertical double line where they meet; render-a: the front
 * plane lower): the first plane is lowered to z 36.6 to 37.8.
 * QUESTION: "Guillermo, ¿los dos planos del asiento de la Fraca estan a la misma altura o uno mas bajo?"
 * QUESTION: "¿Cuanto mide el escalon, si lo hay?" (drawn 1.4 cm; the diagram line reads ~3.5 cm)
 * QUESTION: "¿La pata de color va pegada bajo el plano del asiento o pasa por una ranura?"
 * QUESTION: "¿Las dos placas bajo el brazo izquierdo son patas independientes o una sola pieza con corte?"
 */
(function () {
  const { Cam, clamp, facing, fit, hull, proj, rings, prism, put, solid, spring, stepS, disposer, mk, register } = HL;
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

  const NAMES = ["respaldo", "asiento", "brazo izq", "brazo der", "patas", "pata"];
  // anim pull axis per part: the legs and the coloured leg stay on the floor
  const DIRS = [[-1, 0, 0], [0, 0, 1], [0, 1, 0], [0, -1, 0], [0, 0, 0], [0, 0, 0]];
  const EXD = [[-18, 0, 0], [0, 0, 18], [0, 14, 0], [0, -14, 0], [0, 0, 0], [0, 0, 0]]; // despiece offset per part
  const FULL = 8, MAXP = 14, PEEK = 5, FOLLOW = 0.2, SLOP = 10;

  const S = (x0, y0, x1, y1, z0, z1, r, b, ax = 0, ay = 0, ref = z0) => ({ x0, y0, x1, y1, z0, z1, r, b, ax, ay, ref });
  const PARTS = [
    [S(0, 3, 1.2, 42, 36, 65, 0.5, 0.5, -0.2, 0, 36)],
    [S(6, 4, 60, 21, 36.6, 37.8, 1.2, 0.6), S(4, 24, 52, 41, 38, 39.2, 1.2, 0.6)],
    [S(6, 43.8, 56, 45, 36.5, 50, 0.5, 0.5, 0, 0.22, 36)],
    [S(6, 0, 56, 1.2, 36.5, 50, 0.5, 0.5, 0, -0.22, 36)],
    [S(8, 43.8, 30, 45, 0, 36.5, 0.5, 0.5), S(33, 43.8, 53, 45, 0, 36.5, 0.5, 0.5)],
    [S(52, 0, 59, 4, 0, 38, 1, 1, -0.3, 0, 38)],
  ];
  const ORDER = [0, 3, 1, 5, 4, 2];
  const MARK = 5;

  // flat list of solids: { gi, s }, and each one's bounding box (the shear included) for fit / paint order / hit
  const SOL = PARTS.flatMap((grp, gi) => grp.map((s) => ({ gi, s })));
  const bboxOf = (s) => {
    const dx = [s.ax * (s.z0 - s.ref), s.ax * (s.z1 - s.ref)], dy = [s.ay * (s.z0 - s.ref), s.ay * (s.z1 - s.ref)];
    return [s.x0 + Math.min(...dx), s.y0 + Math.min(...dy), s.z0, s.x1 + Math.max(...dx), s.y1 + Math.max(...dy), s.z1];
  };
  // the paint order sees thick boxes without the 1.2 cm where one part sits on another (arm on leg plate, arm on the coloured leg)
  const sortBox = (b) => (b[5] - b[2] > 3 ? [b[0], b[1], b[2] > 0 ? b[2] + 1.2 : 0, b[3], b[4], b[5] - 1.2] : b);
  const REST = SOL.map((o) => bboxOf(o.s));
  const VIEWS = Views(2.45, REST, SOL.map((o, i) => shiftBox(REST[i], EXD[o.gi])));
  const ANIM_PTS = [[-14, 0, 0], [60, 0, 65], [60, 59, 0], [0, 59, 65], [0, -14, 79], [60, 45, -14]].concat(
    REST.flatMap((b, i) => corners(b).concat(corners(shiftBox(b, DIRS[SOL[i].gi].map((v) => v * MAXP))))));
  const SA = animScale(2.45, ANIM_PTS);
  const animCam = () => { const C = Cam(45, 0.5, SA); fit(C, ANIM_PTS, 200, 166); return C; };
  // rest bounds, widened to every part's furthest pull, so a full-bleed crop never cuts a drag
  const BOUNDS = (() => {
    const e = extentOf(animCam(), ANIM_PTS), u = VIEWS.bounds();
    const x0 = Math.min(e[0], u[0]) - 4, y0 = Math.min(e[1], u[1]) - 4, x1 = Math.max(e[2], u[2]) + 4, y1 = Math.max(e[3], u[3]) + 4;
    return [x0, y0, x1 - x0, y1 - y0];
  })();

  HairlineSite.figures.fraca = {
    name: "fraca",
    bounds: BOUNDS,
    title: "Fraca",
    hint: "Arrastra una pieza para sacarla. Un toque la deja fuera.",
    label: "Silla Fraca, de vidrio laminado: planos que se cruzan. Arrastra una pieza para sacarla.",
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const g = mk("g", {}, svg);
      let mode = "anim", az = 45, tx = 0, C = animCam(), P = proj(C), front = facing(C), cur = REST;
      HairlineSite.paint(svg, "tint", "#1c96c7"); HairlineSite.paint(svg, "tint-2", "#d97e22");

      const wrap = SOL.map(() => mk("g", {}, g));
      const sol = wrap.map((w) => solid(w));
      SOL.forEach((o, i) => {
        if (o.gi === 1) sol[i].sil.classList.add("tint", "opq"); // seat
        if (o.gi === MARK) sol[i].sil.classList.add("tint-2", "opq"); // the coloured leg
      });
      const parts = PARTS.map(() => ({ sp: spring(0, { eps: 0.02 }) }));

      function render() {
        C = mode === "anim" ? animCam() : mode === "orbit" ? VIEWS.orbit(az) : VIEWS.explode();
        P = proj(C); front = facing(C);
        cur = [];
        SOL.forEach((o, i) => {
          const s = o.s, v = mode === "explode" ? EXD[o.gi].map((x) => x * tx) : mode === "anim" ? DIRS[o.gi].map((x) => x * parts[o.gi].sp.x) : [0, 0, 0];
          const Pd = (x, y, z) => P(x + s.ax * (z - s.ref) + v[0], y + s.ay * (z - s.ref) + v[1], z + v[2]);
          const [r, inn] = rings(s.x0, s.y0, s.x1, s.y1, s.r, s.b);
          put(sol[i], prism(Pd, front, r, inn, s.z0, s.z1));
          cur.push(shiftBox(REST[i], v));
        });
        paintOrder(cur.map(sortBox), C).forEach((i) => g.appendChild(wrap[i]));
      }
      render();

      let hov = -1, drag = -1, latch = -1, dragAmt = 0, peekT = 0, shown = -2, down = -1, B;
      const focus = () => (drag >= 0 ? drag : latch >= 0 ? latch : hov >= 0 ? hov : peekT > 0.01 ? 1 : -1);
      const amount = () => (drag >= 0 ? dragAmt : latch >= 0 ? FULL : hov >= 0 ? PEEK : PEEK * peekT);
      function retarget() {
        const a = mode === "anim" ? focus() : -1, amt = amount();
        parts.forEach((p, i) => { p.sp.t = a < 0 ? 0 : i === a ? amt : amt * FOLLOW; });
        const lit = mode === "anim" ? a : -2;
        if (lit !== shown) {
          shown = lit;
          SOL.forEach((o, i) => sol[i].sil.classList.toggle("hi", mode === "anim" && o.gi === (a < 0 ? MARK : a)));
          ctx.read(mode !== "anim" ? "" : a < 0 ? "rest" : NAMES[a]);
        }
        B.wake();
      }

      B = register(ctx.stage, (dt) => {
        let moving = false;
        parts.forEach((p) => { if (stepS(p.sp, dt)) moving = true; });
        render();
        return moving;
      });
      bag.add(B.unregister);
      ctx.read("rest");
      SOL.forEach((o, i) => { if (o.gi === MARK) sol[i].sil.classList.add("hi"); });

      // hit in anim: rest hulls on the anim camera (a target that does not run away from the pointer)
      const AP = proj(animCam());
      const area = PARTS.map((grp, gi) => SOL.map((o, i) => (o.gi === gi ? hull(corners(REST[i]).map((q) => AP(q[0], q[1], q[2]))) : null)).filter(Boolean));
      const pick = (p) => {
        const hit = [...ORDER].reverse().find((i) => area[i].some((pg) => pip(pg, p)));
        if (hit !== undefined) return hit;
        let best = -1, bd = SLOP;
        area.forEach((pgs, i) => pgs.forEach((pg) => { const d = edgeD(pg, p); if (d < bd) { bd = d; best = i; } }));
        return best;
      };

      // the drag axis of part i on screen: one cm of pull
      const o0 = AP(0, 0, 0);
      const axis = DIRS.map((d) => { const e = AP(d[0], d[1], d[2]); return [e[0] - o0[0], e[1] - o0[1]]; });
      const along = (i, dx, dy) => { const n = axis[i][0] ** 2 + axis[i][1] ** 2; return n ? (dx * axis[i][0] + dy * axis[i][1]) / n : 0; };

      return {
        hit: (p) => (mode === "anim" ? pick(p) >= 0 : hitBoxes(P, cur, p)),
        setMode(m) {
          mode = m; az = 45; tx = 0; hov = -1; drag = -1; latch = -1; down = -1; peekT = 0; shown = -3;
          parts.forEach((p) => { p.sp.t = 0; });
          retarget(); render();
          if (m === "anim") SOL.forEach((o, i) => sol[i].sil.classList.toggle("hi", o.gi === MARK));
        },
        orbit(a) { az = a; render(); },
        explode(t) { tx = t; render(); },
        hover(p) {
          const h = p ? pick(p) : -1;
          if (h !== hov) { hov = h; retarget(); }
        },
        peek(t) { peekT = t; retarget(); },
        press(p) { down = pick(p); hov = -1; },
        drag(p, d) {
          if (down < 0) return;
          drag = down; latch = -1;
          dragAmt = clamp(along(down, d.dx, d.dy), 0, MAXP);
          retarget();
        },
        release() { drag = -1; down = -1; retarget(); },
        tap(p) {
          const a = pick(p);
          latch = a < 0 || a === latch ? -1 : a;
          down = -1; drag = -1;
          retarget();
        },
        destroy: bag.dispose,
      };
    },
  };
})();
