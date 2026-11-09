/**
 * Regia on the Hairline site runtime (see ../hairline-site.js). Drawing from ../regia.js.
 * MODES: "anim" (the illustrative panel slide below), "orbit" (Girar: only the camera turns) and "explode" (Despiece: both side planes
 * slide out along x, the top shelf and the small panel lift along z; the lower shelf stays).
 * Anim: one number, x, the place of the small panel between the shelves. Hover / scroll peek: the panel runs toward the pointer and a
 * dashed ghost marks where it would stand. Drag along the length: the panel follows. Tap: the panel goes to that spot.
 * Departure from rule 06: the top shelf is drawn without fill so the panel below shows through the glass.
 * COLOUR (static, no picker): from catalogo/regia-render-b.webp and -a.webp. The two shelves are coloured laminated glass graded
 * amber (x = 0 end) to blue (x = L end) along the length; the two side planes are clear glass and the small divider panel is dark smoke glass.
 * TRUTH (audit furniture-2): panel at X0 = 60 (diagram: ~61 cm along, 6 cm set back from the front), shelf heights from the diagram.
 * QUESTION: "Guillermo, ¿el panel divisor de la Regia va fijo (pegado)? Los renders lo muestran en tres posiciones distintas."
 * QUESTION: "¿La posicion del panel es estandar (centro) o a medida?"
 * QUESTION: "¿El panel es siempre de vidrio ahumado oscuro, o tambien claro?"
 * QUESTION: "¿Las repisas van pegadas a los costados o apoyadas en ellos?" (drawn glued: shelves touch the sides; the despiece slides the sides out)
 */
(function () {
  const { Cam, clamp, facing, fillet, fit, hull, proj, rings, prism, put, solid, poly, spring, stepS, disposer, mk, register, unproj } = HL;
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

  /** Gradient through colour roles (the stage's --tint-* custom properties, so it follows the theme), along the world x axis (user space; the ends are set per frame). */
  let gid = 0;
  function gradient(svg, roles) {
    const id = "hlg-regia-" + (++gid), defs = mk("defs", {}, svg), out = {}, els = [];
    const f = { fill: (r) => "light-dark(color-mix(in srgb,var(--" + r + "-hex,transparent) 26%,transparent),color-mix(in srgb,var(--" + r + "-hex,transparent) 40%,transparent))",
      opq: (r) => "light-dark(color-mix(in srgb,var(--" + r + "-hex,transparent) 30%,var(--hl-plate)),color-mix(in srgb,var(--" + r + "-hex,transparent) 46%,var(--hl-plate)))",
      stroke: (r) => "light-dark(var(--" + r + "-l,CanvasText),var(--" + r + "-d,CanvasText))" };
    for (const key of ["fill", "opq", "stroke"]) {
      const lg = mk("linearGradient", { id: id + key, gradientUnits: "userSpaceOnUse" }, defs);
      roles.forEach((r, i) => { const st = mk("stop", { offset: String(i / (roles.length - 1)) }, lg); st.style.stopColor = f[key](r); });
      out[key] = "url(#" + id + key + ")"; els.push(lg);
    }
    out.aim = (a, b) => els.forEach((lg) => { lg.setAttribute("x1", a[0]); lg.setAttribute("y1", a[1]); lg.setAttribute("x2", b[0]); lg.setAttribute("y2", b[1]); });
    return out;
  }

  const L = 120, D = 35, HT = 75, TK = 1.8;
  // shelf heights from regia-diagram.svg: top shelf top ~4.5 cm under the side tops, lower shelf top ~19 cm under
  const TOPZ = [68.6, 70.4], LOWZ = [54.2, 56], DY = [5, 30], X0 = 60, XMIN = 12, XMAX = 100, REACH = 32;
  const SIDE = fillet([[0, 0], [D, 0], [D, HT], [0, HT]], [4, 4, 4, 4], 5);
  const PT = 0.75; // half thickness of the small panel
  // part order: 0 far side, 1 lower shelf, 2 panel, 3 top shelf, 4 near side
  const boxesAt = (x, off) => [
    [0, 0, 0, TK, D, HT], [TK, 0, LOWZ[0], L - TK, D, LOWZ[1]], [x - PT, DY[0], LOWZ[1], x + PT, DY[1], TOPZ[0]],
    [TK, 0, TOPZ[0], L - TK, D, TOPZ[1]], [L - TK, 0, 0, L, D, HT],
  ].map((b, i) => shiftBox(b, off[i]));
  const Z3 = [0, 0, 0];
  const EXP = [[-16, 0, 0], Z3, [0, 0, 14], [0, 0, 28], [16, 0, 0]];
  const REST = boxesAt(X0, [Z3, Z3, Z3, Z3, Z3]);
  const VIEWS = Views(2.4, REST, boxesAt(X0, EXP));
  const ANIM_PTS = [[0, 0, 0], [L, 0, HT], [L, D, 0], [0, D, HT]];
  const animCam = () => { const C = Cam(45, 0.5, 2.4); fit(C, ANIM_PTS, 200, 166); return C; };
  const BOUNDS = (() => {
    const e = extentOf(animCam(), REST.flatMap(corners));
    const u = VIEWS.bounds(), x0 = Math.min(e[0], u[0]) - 4, y0 = Math.min(e[1], u[1]) - 4, x1 = Math.max(e[2], u[2]) + 4, y1 = Math.max(e[3], u[3]) + 4;
    return [x0, y0, x1 - x0, y1 - y0];
  })();

  HairlineSite.figures.regia = {
    name: "regia",
    bounds: BOUNDS,
    title: "Regia",
    hint: "Arrastra a lo largo de la consola: el panel entre las repisas te sigue.",
    label: "Regia, consola larga de vidrio laminado: dos costados claros, una tapa y una repisa con un panel entre ellas. Arrastra para mover el panel.",
    modes: ["anim", "orbit", "explode"],
    disclaimer: "Animación ilustrativa: las piezas no tienen partes móviles.",

    mount(ctx) {
      const { svg } = ctx;
      const bag = disposer();
      const g = mk("g", {}, svg);
      let mode = "anim", az = 45, tx = 0, C = animCam(), P = proj(C), front = facing(C);
      const wrap = [0, 1, 2, 3, 4].map(() => mk("g", {}, g));
      const sideEl = (w) => ({ sil: mk("path", { class: "sil" }, w), nf: mk("path", { class: "nf lo" }, w) });
      const farS = sideEl(wrap[0]), nearS = sideEl(wrap[4]);
      const low = solid(wrap[1]), div = solid(wrap[2]), top = solid(wrap[3]);
      const ghost = mk("path", { class: "nf hi", "stroke-dasharray": "5 4" }, g);
      top.sil.classList.add("nf", "tint");
      low.sil.classList.add("tint");
      // the divider is dark smoke glass (the darkest element in regia-render-a / -b)
      HairlineSite.paint(svg, "tint-3", "#12141a");
      div.sil.classList.add("tint-3");
      div.sil.style.fill = "light-dark(color-mix(in srgb,#12141a 72%,transparent),color-mix(in srgb,#12141a 82%,transparent))";
      HairlineSite.paint(svg, "tint", "#af6f28"); HairlineSite.paint(svg, "tint-2", "#0d4b84"); // ambar, azul
      const gr = gradient(svg, ["tint", "tint-2"]);
      top.sil.style.fill = gr.fill; low.sil.style.fill = gr.opq;
      const strokeOf = (el, hi) => { el.style.stroke = hi ? "" : gr.stroke; };

      const xs = spring(X0, { eps: 0.02 }), pk = spring(0, { k: 120, c: 18 });
      let hov = false, peekT = 0, tgt = X0 + REACH, act = "rest", x0 = X0, gmode = "idle", gk = "";
      const offs = () => mode === "explode" ? EXP.map((o) => o.map((v) => v * tx)) : [Z3, Z3, Z3, Z3, Z3];
      const panelX = () => mode === "anim" ? clamp(xs.x + (tgt - xs.x) * pk.x, XMIN, XMAX) : X0;
      let cur = REST;
      const sideDraw = (el, xv, xh, o) => {
        const a = SIDE.map(([y, z]) => P(xv + o[0], y + o[1], z + o[2])), b = SIDE.map(([y, z]) => P(xh + o[0], y + o[1], z + o[2]));
        el.sil.setAttribute("d", poly(hull(a.concat(b)))); el.nf.setAttribute("d", poly(a));
      };
      function render() {
        C = mode === "anim" ? animCam() : mode === "orbit" ? VIEWS.orbit(az) : VIEWS.explode();
        P = proj(C); front = facing(C);
        const o = offs(); cur = boxesAt(panelX(), o);
        sideDraw(farS, TK, 0, o[0]); sideDraw(nearS, L - TK, L, o[4]);
        const sh = (el, b) => { const [r, i] = rings(b[0], b[1], b[3], b[4], 2, 0.9); put(el, prism(P, front, r, i, b[2], b[5])); };
        sh(low, cur[1]); sh(top, cur[3]);
        { const b = cur[2], [r, i] = rings(b[0], b[1], b[3], b[4], 0.5, 0.3); put(div, prism(P, front, r, i, b[2], b[5])); }
        // gradient along the length, in the current projection
        const zt = cur[3][5], zl = cur[1][5];
        gr.aim(P(0, D / 2, (zt + zl) / 2), P(L, D / 2, (zt + zl) / 2));
        const on = mode === "anim" && pk.x > 0.03, key = on ? tgt.toFixed(1) : "";
        if (key !== gk) {
          gk = key;
          if (on) { const [r, i] = rings(tgt - PT, DY[0], tgt + PT, DY[1], 0.5, 0.3); ghost.setAttribute("d", prism(P, front, r, i, LOWZ[1], TOPZ[0]).sil); } else ghost.setAttribute("d", "");
        }
        ghost.setAttribute("opacity", String(on ? clamp(pk.x * 1.1, 0, 0.9) : 0));
        paintOrder(cur, C).forEach((i) => g.appendChild(wrap[i]));
        g.appendChild(ghost);
      }
      render();

      function paint() {
        div.sil.classList.toggle("hi", act === "rest" || act === "panel");
        top.sil.classList.toggle("hi", act === "tapa"); strokeOf(top.sil, act === "tapa");
        low.sil.classList.toggle("hi", act === "repisa"); strokeOf(low.sil, act === "repisa");
        nearS.sil.classList.toggle("hi", act === "costado");
        farS.sil.classList.toggle("hi", act === "costado-l");
        ctx.read(act === "costado-l" ? "costado" : act);
      }
      paint();

      const B = register(ctx.stage, (dt) => { const a = stepS(xs, dt), b = stepS(pk, dt); render(); return a || b; });
      bag.add(B.unregister);
      const retarget = () => { pk.t = gmode === "drag" ? 0 : Math.max(hov ? 1 : 0, peekT); };

      const quad = (x) => [P(x, 0, 0), P(x, D, 0), P(x, D, HT), P(x, 0, HT)];
      const inQ = (q, [px, py]) => {
        let s = 0;
        for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])) > 0 ? 1 : -1; }
        return Math.abs(s) === 4;
      };
      const onPlane = (p, z) => { const [x, y] = unproj(C, p[0], p[1], z); return x >= 0 && x <= L && y >= 0 && y <= D ? x : null; };
      function what(p) {
        if (inQ(quad(L), p)) return { name: "costado" };
        let x = onPlane(p, TOPZ[1]);
        if (x !== null) return { name: "tapa", x };
        x = onPlane(p, LOWZ[1]);
        if (x !== null) return { name: "repisa", x };
        if (inQ(quad(TK), p)) return { name: "costado-l" };
        return null;
      }
      // generous hit: the CURRENT silhouette (every mode), with slop
      const hit = (p) => hitBoxes(P, cur, p);
      const o0 = P(0, 0, 0), ex = P(1, 0, 0)[0] - o0[0], ey = P(1, 0, 0)[1] - o0[1];
      const along = (dx, dy) => (dx * ex + dy * ey) / (ex * ex + ey * ey);

      return {
        hit,
        setMode(m) {
          mode = m; az = 45; tx = 0; hov = false; peekT = 0; gmode = "idle"; act = "rest"; xs.t = X0; pk.t = 0; gk = "x";
          paint(); render(); B.wake();
        },
        orbit(a) { az = a; render(); },
        explode(t) { tx = t; render(); },
        hover(p) {
          const h = !!p && hit(p), w = h ? what(p) : null;
          act = w ? w.name : "rest";
          tgt = clamp(w && w.x !== undefined ? xs.x + clamp(w.x - xs.x, -REACH, REACH) : xs.x < 60 ? xs.x + REACH : xs.x - REACH, XMIN, XMAX);
          hov = h; paint(); retarget(); B.wake();
        },
        peek(t) { peekT = t; tgt = clamp(xs.x < 60 ? xs.x + REACH : xs.x - REACH, XMIN, XMAX); retarget(); B.wake(); },
        press() { gmode = "idle"; hov = false; x0 = xs.x; retarget(); B.wake(); },
        drag(p, d) {
          if (gmode !== "drag") { gmode = "drag"; act = "panel"; paint(); retarget(); }
          xs.t = clamp(x0 + along(d.dx, d.dy), XMIN, XMAX);
          B.wake();
        },
        release() { gmode = "idle"; retarget(); B.wake(); },
        tap(p) { const w = what(p); gmode = "idle"; xs.t = w && w.x !== undefined ? clamp(w.x, XMIN, XMAX) : X0; retarget(); B.wake(); },
        destroy: bag.dispose,
      };
    },
  };
})();
