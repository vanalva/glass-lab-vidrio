/**
 * Puerta: ONE parametric figure for every Pernia sliding system, on the Hairline site runtime
 * (see ../hairline-site.js for the contract). Registers HairlineSite.figures["pglass-1a"] ... ["pglass-4c"].
 * Drawing language and mechanics are site/rail.js (pglass-4a) and site/softclose.js (pglass-1a), generalised:
 * slim frames, `nf` see-through glass, dashed hidden ceiling + steel header, thin floor line with a guide per lane,
 * U-pulls on the stiles; hover/scroll peek (nudge + dashed ghost + arrow), drag with telescopic coupling, coast,
 * soft-close in the last 10%, tap = one step.
 *
 * MODEL. A door is a set of leaves (fixed or sliding, each on a lane: lane 0 is nearest the viewer) and CHAINS of sliding
 * leaves. A chain stacks toward one side (side "L" or "R") and is worked in a frame where "stack side" is always -x:
 * frame p = world left edge for side L, -(right edge) for side R. ids go rear (next to the stack) to lead (the stile that
 * meets the other chain, or the free end). The lead's frame position is one spring; the rear leaves telescope behind it
 * (trail the one ahead by at most one leaf, at least ST). Stack systems have one chain; parting systems (2c, 4c) have two,
 * each dragged on its own by grabbing the leaf under the pointer; 2d has two one-leaf chains on separate lanes that
 * cross each other freely.
 * Pocket: the leaf goes (POCKET of its width) into a drawn wall. Mount "wall" (1b): leaf in front of the wall face, rail
 * drawn on the wall face above the opening.
 *
 * COLOUR (solid bands): the frame is a ring in the finish (class `fin-fill`, thin theme edge), the pulls and the wall rail are filled too.
 * PW (frame width) is 2.5 units = 75 mm, against 42 mm before and about 40 mm real: a little wider than the profile so it reads at 390px.
 * Earlier note: variants "perfil" (site/variants.js). Class `fin` on the aluminium (leaf frames, U-pulls, the wall rail and its hangers);
 * glass, glints, floor, guides, pocket walls and the hidden steel header stay neutral.
 *
 * Per config the comment "seen:" says what the section drawing (src/assets/media/pernia/sections/<code>.webp) and the
 * data entry (src/data/pernia-systems.json) showed. Section drawings are vertical cuts: leaves side by side = lanes.
 */
(function () {
  const { Cam, clamp, fit, facing, poly, proj, prism, rings, rrect, seg, spring, stepS, disposer, mk, register, solid, put } = HL;

  const K = 99.2 / 3000, LG = 1.6, PW = 2.5, ST = 3.2, ZB = 0.6, NUDGE = 11, POCKET = 1, FRONT_Y = 2.8;

  const HINT_STACK = "Arrastra la puerta para abrirla o cerrarla. Un toque la mueve un paso.";

  // ---- the CONFIG table ---------------------------------------------------------------------------------------------
  // lw, h: leaf width / height in mm (from dimensions). hdr: header steel (read-out only). hd: header depth mm.
  // leaves[i] = { lane, x0 (closed left edge, in leaf widths), fixed?, pull: "L" | "R" | null }
  // chains[i] = { side, ids (rear -> lead), pocket?, over? (stack over a fixed leaf by ST), o? (frame open pos, in leaf widths), tag }
  const CONFIGS = {
    "pglass-1a": {
      // seen: section = one carriage, one leaf, gypsum pocket beside the opening; data: sliding x1, pocket, ceiling, 2"x2". Renders 1a: the open leaf stays visible in an alcove one leaf wide, flush (POCKET = 1).
      // QUESTION: "En 1a, con la hoja abierta, ¿queda a la vista en un nicho o escondida dentro de la pared?" (drawn as the open alcove the renders show)
      // QUESTION: "¿Dónde va el amortiguador del cierre suave (riel o carro) y actúa en los dos extremos o solo al cerrar?" (settle() keeps snapping at both ends)
      title: "pglass-1a — 1 hoja corrediza colgada de cielo",
      hint: "Arrastra la hoja hacia el bolsillo; el cierre suave la recoge. Un toque la lanza.",
      lw: 1000, h: 3000, hdr: '2" x 2" hierro', hd: 75, mount: "ceiling", jamb: "R", rest: 0.7,
      leaves: [{ lane: 0, x0: 0, pull: "R" }],
      chains: [{ side: "L", ids: [0], pocket: true }],
    },
    "pglass-1b": {
      // seen: NO section drawing; photos show the leaf standing in front of a panelled wall, opening beside it, NO visible rail or hardware (rail and hangers removed).
      // QUESTION: "¿Qué ancho de vano corresponde a la hoja de 1200 mm?" (ow: 1000 is not in the data; kept as is)
      // QUESTION: "En 1b, ¿el riel queda visible sobre el muro o va oculto? ¿Qué herrajes lleva?" (nothing drawn until answered)
      title: "pglass-1b — 1 hoja corrediza de pared",
      hint: "Arrastra la hoja a lo largo de la pared.",
      lw: 1200, h: 2400, ow: 1000, hdr: "riel en la pared", hd: 0, mount: "wall", rest: 0.62,
      leaves: [{ lane: 0, x0: -0.0833, pull: "R" }],
      chains: [{ side: "L", ids: [0], o: -1.04 }],
    },
    "pglass-2a": {
      // seen: section = a fixed leaf (wood trim above it, no carriage) beside one hung leaf under the 2"x2" header: 2 lanes, fixed + sliding. Render frame 5 stacks flush (over: 0).
      // QUESTION: "En 2a, ¿la hoja corrediza pasa por delante o por detrás de la fija?" (kept behind; hint no longer says which)
      // QUESTION: "¿El tirador de la corrediza va en el canto exterior (renders) o en el canto de encuentro (foto Pradera)?" (kept pull L)
      title: "pglass-2a — 2 hojas — 1 fija + 1 corrediza",
      hint: "Arrastra la hoja corrediza: se desliza sobre la fija. Un toque la mueve.",
      lw: 1000, h: 3000, hdr: '2" x 2" hierro', hd: 75, mount: "ceiling", rest: 0.62,
      leaves: [{ lane: 0, x0: 0, fixed: true }, { lane: 1, x0: 1, pull: "L" }],
      chains: [{ side: "L", ids: [1], over: 0 }],
    },
    "pglass-2b": {
      // seen: section = 2 lanes, two carriages in one housing, pocket wall beside it; data: same side, pocket, 2"x4". Renders 2b frames 1-6: both leaves move from the start at 2:1 and end flush (telescopic coupling).
      // QUESTION: "En 2b, ¿las dos hojas van enlazadas y se mueven a la vez (una al doble de velocidad) o cada una se mueve por separado?" (drawn coupled, as the render sequence shows)
      // QUESTION: "¿Qué es el pequeño elemento a la izquierda dentro del tabique de la sección 2b: un tope amortiguador?" (not drawn)
      title: "pglass-2b — 2 hojas corredizas — ambas hacia el mismo lado, tipo pocket",
      hint: "Arrastra la puerta hacia el bolsillo: las dos hojas van a la vez. Un toque da un paso.",
      lw: 1000, h: 3000, hdr: '2" x 4" hierro', hd: 95, mount: "ceiling", jamb: "R", rest: 0.62,
      leaves: [{ lane: 0, x0: 0, pull: "R" }, { lane: 1, x0: 1, pull: "R" }],
      chains: [{ side: "L", ids: [0, 1], pocket: true }],
    },
    "pglass-2c": {
      // seen: section = ONE lane, one track under the 2"x2" header (both leaves share it); photo = two leaves meeting at the centre, a pocket wall on each side; data travel parting. Renders: leaves visible at the sides.
      // QUESTION: "En 2c, ¿las dos hojas están enlazadas (abren simétricas) o se mueven independientes?" (kept independent)
      title: "pglass-2c — 2 hojas corredizas — una corre a la izquierda y otra a la derecha",
      hint: "Agarra una hoja y arrástrala a su bolsillo. Un toque abre o cierra esa hoja.",
      lw: 1000, h: 3000, hdr: '2" x 2" hierro', hd: 95, mount: "ceiling", rest: 0.7,
      leaves: [{ lane: 0, x0: 0, pull: "R" }, { lane: 0, x0: 1, pull: "L" }],
      chains: [{ side: "L", ids: [0], pocket: true, tag: "izq" }, { side: "R", ids: [1], pocket: true, tag: "der" }],
    },
    "pglass-2d": {
      // seen: section = 2 lanes, two separate carriages each in its own track (no pocket); photo = pulls on the OUTER edges. The leaves cross each other; renders stack both on the same side.
      // QUESTION: "En 2d, ¿cuál hoja va por el carril delantero?" (kept hoja 1 in front)
      title: "pglass-2d — 2 hojas corredizas — ambos sentidos sobre el mismo riel",
      hint: "Cada hoja corre por su carril. Arrástralas.",
      lw: 1000, h: 3000, hdr: '2" x 4" hierro', hd: 75, mount: "ceiling", rest: 0.62, span: true,
      leaves: [{ lane: 0, x0: 0, pull: "L" }, { lane: 1, x0: 1, pull: "R" }],
      chains: [{ side: "R", ids: [0], o: -2, tag: "hoja 1" }, { side: "L", ids: [1], o: 0, tag: "hoja 2" }],
    },
    "pglass-3a": {
      // seen: section = a fixed leaf (wood trim above) + 2 hung leaves in 2 lanes under the 2"x4" header; closed render 3a/1: ONE pull, on the right stile of the rightmost leaf.
      // QUESTION: "En 3a, las dos hojas corredizas, ¿pasan por delante o por detrás de la hoja fija al abrir?" (kept behind)
      // QUESTION: "¿La manija está solo en el canto libre de la hoja que se jala, o cada hoja corrediza lleva su propia manija?" (drawn on the lead only)
      // QUESTION: "¿Las dos hojas corredizas se arrastran entre sí (acople telescópico) o cada una se mueve sola?" (drawn coupled)
      title: "pglass-3a — 3 hojas — 1 fija + 2 corredizas",
      hint: HINT_STACK,
      lw: 1000, h: 3000, hdr: '2" x 4" hierro', hd: 95, mount: "ceiling", rest: 0.62,
      leaves: [{ lane: 0, x0: 0, fixed: true }, { lane: 1, x0: 1, pull: null }, { lane: 2, x0: 2, pull: "R" }],
      chains: [{ side: "L", ids: [1, 2], over: 0 }],
    },
    "pglass-3b": {
      // seen: section = 3 lanes, 3 carriages, 2"x6" header; data: 3 sliding, pocket, 4000x3000 (4000/3 = 1333 per leaf). Renders 3b/1,5,6 + Seacat photo: an open recess with the leaves visible.
      // QUESTION: "En 3b, ¿el pocket es una cavidad cerrada dentro del muro (las hojas desaparecen) o un nicho abierto donde las hojas quedan a la vista?" (drawn as the open recess the renders show)
      // QUESTION: "Los 4000 mm de ancho, ¿son el ancho del vano o el ancho total de las 3 hojas con traslape? ¿Y los 4600?" (4000/3 used)
      // QUESTION: "¿La manija está solo en la hoja delantera o cada hoja tiene la suya?" (kept on all three; closed render 3b/1 shows only the rightmost)
      // QUESTION: depth order, 3b/5 and the Seacat photo show the pull-bearing lead leaf in front (rear leaves behind); kept lead farthest until Pernia confirms.
      title: "pglass-3b — 3 hojas corredizas",
      hint: "Arrastra la puerta hacia el bolsillo. Un toque la mueve un paso.",
      lw: 1333, h: 3000, hdr: '2" x 6" hierro', hd: 95, mount: "ceiling", jamb: "R", rest: 0.62,
      leaves: [{ lane: 0, x0: 0, pull: "R" }, { lane: 1, x0: 1, pull: "R" }, { lane: 2, x0: 2, pull: "R" }],
      chains: [{ side: "L", ids: [0, 1, 2], pocket: true }],
    },
    "pglass-3c": {
      // seen: section = 3 lanes, 3 carriages, 2"x6" header only 55 deep, no wall element; data: no pocket. Closed render 3c/1: a pull on the left stile of the first leaf and on the right stile of the third.
      // QUESTION: "En 3c, ¿el sistema abre hacia ambos lados (los renders muestran la pila a la izquierda y a la derecha) o el lado se define en obra?" (stacks left)
      // QUESTION: "¿Qué hojas llevan manija? (el render cerrado muestra el canto izquierdo de la primera y el derecho de la tercera)" (drawn as the render)
      // QUESTION: depth order, 3c/5 suggests the lead leaf is in front; kept lead farthest until Pernia confirms.
      title: "pglass-3c — 3 hojas corredizas",
      hint: HINT_STACK,
      lw: 1000, h: 3000, hdr: '2" x 6" hierro', hd: 55, mount: "ceiling", rest: 0.62,
      leaves: [{ lane: 0, x0: 0, pull: "L" }, { lane: 1, x0: 1, pull: null }, { lane: 2, x0: 2, pull: "R" }],
      chains: [{ side: "L", ids: [0, 1, 2], over: 0 }],
    },
    "pglass-4a": {
      // seen: section = a fixed leaf (wood trim) + 3 hung leaves in 3 lanes under the 2"x6" header; closed render 4a/1: ONE pull, right stile of the rightmost leaf. Renders 4a: sliding left edges equally spaced mid-travel, flush at open.
      // QUESTION: "En 4a, las tres hojas corredizas, ¿pasan por delante o por detrás de la hoja fija?" (kept behind)
      // QUESTION: "¿Cuál hoja lleva manija y en qué canto?" (lead only, right stile)
      // QUESTION: "¿Las 3 hojas corredizas se acoplan entre sí o cada una se mueve sola?" (drawn coupled)
      title: "pglass-4a — 4 hojas — 1 fija + 3 corredizas",
      hint: HINT_STACK,
      lw: 1000, h: 3000, hdr: '2" x 6" hierro', hd: 95, mount: "ceiling", rest: 0.55,
      leaves: [{ lane: 0, x0: 0, fixed: true }, { lane: 1, x0: 1, pull: null }, { lane: 2, x0: 2, pull: null }, { lane: 3, x0: 3, pull: "R" }],
      chains: [{ side: "L", ids: [1, 2, 3], over: 0 }],
    },
    "pglass-4b": {
      // seen: section = 4 lanes, 4 carriages under TWO 2"x4" headers, leaf 1250 wide (5000/4). Render 4b/1: an empty recess about 0.9 leaf wide to the left; 4b/5: the stack straddles it, about 0.8 leaf beyond the opening edge. One pull, right stile of the rightmost leaf.
      // QUESTION: "En 4b, ¿las hojas se estacionan en un nicho o retorno de muro del ancho de una hoja a un lado del vano (como se ve en el render), o sobre el propio vano?" (drawn as the render: dashed recess, stack o = -0.8)
      // QUESTION: "¿Por qué son dos cabezales 2"x4" en paralelo, y la hoja de 1250 es con traslape o sin él?"
      // QUESTION: "¿La manija va solo en la hoja delantera?" (lead only)
      // QUESTION: depth order, 4b/5 shows the pull-bearing leaf in front; kept lead farthest until Pernia confirms.
      title: "pglass-4b — 4 hojas corredizas",
      hint: HINT_STACK,
      lw: 1250, h: 3000, hdr: '2" x 4" + 2" x 4" hierro', hd: 105, mount: "ceiling", rest: 0.62,
      leaves: [{ lane: 0, x0: 0, pull: null }, { lane: 1, x0: 1, pull: null }, { lane: 2, x0: 2, pull: null }, { lane: 3, x0: 3, pull: "R" }],
      chains: [{ side: "L", ids: [0, 1, 2, 3], pocket: 0.9, dashed: true, o: -0.8 }],
    },
    "pglass-4c": {
      // seen: section file shows a fixed lane (wood trim) + ONE track lane under a 2"x2" header (labelled GLSS02); photo + renders 4c/1,4,5,6 = fixed leaf at each end, the two SLIDING leaves in FRONT of the fixed ones, pulls on the inner stiles.
      // QUESTION: "Al abrir del todo, ¿la corrediza cubre la fija completamente o queda desfasada unos centímetros?" (kept the ST offset, over: ST)
      // QUESTION: "El corte "GLSS02", ¿es el mismo para 2a y 4c? ¿Lo mostramos con otro nombre?"
      // QUESTION: "¿Cada corrediza se mueve de forma independiente, sin arrastrar a la otra?" (kept independent)
      title: "pglass-4c — 4 hojas — 2 fijas + 2 corredizas",
      hint: "Agarra una hoja central y arrástrala sobre la fija. Un toque abre o cierra esa hoja.",
      lw: 1000, h: 3000, hdr: '2" x 2" hierro', hd: 95, mount: "ceiling", rest: 0.7,
      leaves: [{ lane: 1, x0: 0, fixed: true }, { lane: 0, x0: 1, pull: "R" }, { lane: 0, x0: 2, pull: "L" }, { lane: 1, x0: 3, fixed: true }],
      chains: [{ side: "L", ids: [1], over: ST, tag: "izq" }, { side: "R", ids: [2], over: ST, tag: "der" }],
    },
  };

  function makeFigure(code, cfg) {
    const fig = {
      name: code,
      title: cfg.title,
      hint: cfg.hint,
      variants: "perfil", // the 9 anodized finishes: frame, pulls, wall rail and hangers take the finish (class "fin"); glass stays clear
      label: cfg.title + ". " + (cfg.hdr ? "Cabezal " + cfg.hdr + ". " : "") + "Arrastra para abrir o cerrar.",
      mount(ctx) { return mountPuerta(ctx, cfg); },
    };
    return fig;
  }

  function mountPuerta(ctx, cfg) {
    const { svg } = ctx;
    const bag = disposer();
    const wall = cfg.mount === "wall";

    const W = cfg.lw * K, H = cfg.h * K;
    const CZ = H, ZT = wall ? ZB + H : CZ, MID = ZB + 0.5 * (ZT - ZB);
    const HZ = Math.max(3, cfg.hd * 0.05);
    const nl = Math.max(...cfg.leaves.map((l) => l.lane)) + 1;
    const laneY = (k) => (wall ? FRONT_Y : -k * LG);
    const xe = (Math.max(...cfg.leaves.map((l) => l.x0)) + 1) * W; // closed row end (ceiling systems)
    const OW = (cfg.ow || cfg.lw) * K; // wall opening width (1b)

    // ---- leaves
    const lv = cfg.leaves.map((l, i) => ({ i, lane: l.lane, y: laneY(l.lane), x0: l.x0 * W, fixed: !!l.fixed, pull: l.pull || null, wx: l.x0 * W, drawn: NaN }));

    // ---- chains
    const chains = cfg.chains.map((ch) => {
      const mirror = ch.side === "R", m = ch.ids.length;
      const toP = (x) => (mirror ? -(x + W) : x); // involution: world left edge <-> frame
      const Pc = ch.ids.map((id) => toP(lv[id].x0));
      const pw = ch.pocket === true ? POCKET : ch.pocket || 0; // recess width, in leaf widths
      let o;
      if (ch.o != null) o = ch.o * W;
      else if (pw) o = mirror ? -(xe + pw * W) : -pw * W;
      else o = mirror ? (ch.over || 0) - xe : ch.over || 0;
      // telescopic coupling: every leaf moves at once, in proportion to its distance from the stack position, so the set ends flush at o
      const Po = ch.ids.map(() => o);
      const c = {
        ch, mirror, m, toP, Pc, Po, pw, o, tag: ch.tag || "",
        lv: ch.ids.map((id) => lv[id]), LMIN: Po[m - 1], LMAX: Pc[m - 1],
        mode: "idle", vel: 0, L0: 0, brightLead: null, ghostKey: "", arrowKey: "", lastPct: -1,
      };
      const s0 = cfg.rest != null ? cfg.rest : 0.62, lead0 = c.LMIN + s0 * (c.LMAX - c.LMIN);
      c.Ls = spring(lead0, { k: 220, c: 26 });
      c.pk = spring(0, { k: 120, c: 18 });
      c.sOf = (x) => (x - c.LMIN) / (c.LMAX - c.LMIN || 1);
      return c;
    });

    // ---- extents and the camera
    const pockL = chains.filter((c) => c.pw && !c.mirror).reduce((a, c) => Math.max(a, c.pw * W + 3), 0);
    const pockR = chains.filter((c) => c.pw && c.mirror).reduce((a, c) => Math.max(a, c.pw * W + 3), 0);
    const yN = laneY(nl - 1);
    let X0, X1, pts;
    if (wall) {
      X0 = -(W + 9); X1 = OW + 12;
      pts = [[X0, -9, 0], [X1, -9, 0], [X0, 8, 0], [X1, 8, 0], [X0, -9, ZT + 18], [X1, -9, ZT + 18], [X0, 8, ZT + 18], [X1, 8, ZT + 18]];
    } else {
      X0 = -9 - pockL; X1 = xe + 9 + pockR;
      const yc = yN - 22, zt = CZ + HZ;
      pts = [[X0, yc, 0], [X1, yc, 0], [X0, 6, 0], [X1, 6, 0], [X0, yc, zt], [X1, yc, zt], [X0, 6, zt], [X1, 6, zt]];
    }
    const C0 = Cam(45, 0.5, 1);
    fit(C0, pts, 0, 0);
    const P0 = proj(C0);
    let a = 1e9, b = -1e9, c0 = 1e9, d0 = -1e9;
    for (const p of pts) { const q = P0(p[0], p[1], p[2]); a = Math.min(a, q[0]); b = Math.max(b, q[0]); c0 = Math.min(c0, q[1]); d0 = Math.max(d0, q[1]); }
    const S = clamp(Math.min(344 / (b - a), 262 / (d0 - c0)), 0.8, 2.6);
    const C = Cam(45, 0.5, S);
    fit(C, pts, 200, 166);
    const P = proj(C), front = facing(C);

    const OUT = rrect(0, ZB, W, ZT, 1.4, 3);
    const HOLE = rrect(PW, ZB + PW, W - PW, ZT - PW, 0.5, 3).reverse();
    const PULL = { L: rrect(PW + 0.9, MID - 8, PW + 2.5, MID + 8, 0.7, 2), R: rrect(W - PW - 2.5, MID - 8, W - PW - 0.9, MID + 8, 0.7, 2) };
    function leafPaths(y, x, pull) {
      const on = (ring) => poly(ring.map((q) => P(x + q.u, y, q.v))), g2 = (u, v) => P(x + u, y, v);
      return {
        frame: on(OUT) + on(HOLE),
        glint: seg(g2(PW + 7, MID + 0.36 * (ZT - ZB)), g2(PW + 13, MID + 0.28 * (ZT - ZB))) + seg(g2(PW + 7, MID + 0.25 * (ZT - ZB)), g2(PW + 10, MID + 0.2 * (ZT - ZB))),
        pull: pull ? on(PULL[pull]) : "",
        ghost: on(OUT),
      };
    }

    // ---- static drawing
    const g = mk("g", {}, svg);
    const rect = (x0, y0, x1, y1, z) => poly([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)]);
    const block = (x0, x1, y0, y1, z0, z1, bb) => {
      const [r, i] = rings(x0, y0, x1, y1, 1.2, bb || 0.9);
      const s = solid(g); put(s, prism(P, front, r, i, z0, z1));
    };

    if (wall) {
      // floor, then the wall face with the opening (jambs + lintel); the leaf stands in front of it
      const HW = ZT + 16, HO = ZT - 4, WT = 8;
      mk("path", { class: "nf", d: seg(P(X0, 8, 0), P(X1, 8, 0)) }, g);
      block(X0, 0, -WT, 0, 0, HW, 1);
      block(OW, X1, -WT, 0, 0, HW, 1);
      block(0, OW, -WT, 0, HO, HW, 1);
      mk("path", { class: "nf lo", d: seg(P(X0, 4.4, 0), P(X1, 4.4, 0)) }, g);
    } else {
      mk("path", { class: "nf dash", d: rect(X0, yN - 22, X1, 6, CZ) }, g);
      mk("path", { class: "nf", d: seg(P(X0, 5, 0), P(X1, 5, 0)) }, g);
      let d = "";
      for (let k = 0; k < nl; k++) d += seg(P(-3 - (pockL ? pockL * 0.6 : 0), laneY(k), 0), P(xe + 3 + (pockR ? pockR * 0.6 : 0), laneY(k), 0));
      mk("path", { class: "nf lo", d }, g);
      // pocket = an OPEN recess (renders 1a, 2b, 2c, 3b, 4b): back wall, roof and the far reveal, drawn BEHIND the leaves so the parked leaves stay visible
      const wy0 = yN - 2, wy1 = 2;
      const vrect = (xa, xb, y) => poly([P(xa, y, 0), P(xb, y, 0), P(xb, y, CZ), P(xa, y, CZ)]);
      for (const c of chains) {
        if (!c.pw) continue;
        const xa = c.mirror ? xe : -c.pw * W, xb = c.mirror ? xe + c.pw * W : 0, xo = c.mirror ? xb : xa;
        mk("path", { class: "nf " + (c.ch.dashed ? "dash" : ""), d: vrect(xa, xb, wy0) + rect(xa, wy0, xb, wy1, CZ) + seg(P(xo, wy0, 0), P(xo, wy1, 0)) + seg(P(xo, wy1, 0), P(xo, wy1, CZ)) }, g);
      }
      if (cfg.jamb === "R") block(xe, xe + 7, wy0, wy1, 0, CZ, 0.9);
    }

    // leaves, far lane first so the near lane paints over
    const order = lv.slice().sort((p, q) => q.lane - p.lane);
    for (const lf of order) {
      const grp = mk("g", {}, g);
      lf.frame = mk("path", { class: "sil fin-fill" }, grp);
      lf.glintEl = mk("path", { class: "nf lo" }, grp);
      lf.pullEl = mk("path", { class: "fin-fill" }, grp);
    }
    const ghosts = chains.map(() => mk("path", { class: "nf hi", "stroke-dasharray": "6 4" }, g));
    const arrows = chains.map(() => mk("path", { class: "nf hi" }, g));

    if (!wall) {
      // the hidden steel header on top (dashed, so it never hides anything)
      const slide = lv.filter((l) => !l.fixed), mn = Math.min(...slide.map((l) => l.lane)), mx = Math.max(...slide.map((l) => l.lane));
      const hy1 = laneY(mn) + 1.3, hy0 = laneY(mx) - 1.5, hz = CZ + HZ;
      mk("path", { class: "nf dash", d: rect(X0, hy0, X1, hy1, hz) + seg(P(X0, hy1, CZ), P(X0, hy1, hz)) + seg(P(X1, hy1, CZ), P(X1, hy1, hz)) }, g);
      mk("path", { class: "nf lo", d: seg(P(X0, hy1 - 0.4, CZ), P(X1, hy1 - 0.4, CZ)) + seg(P(X0, hy0 + 0.6, CZ), P(X1, hy0 + 0.6, CZ)) }, g);
    }

    function draw(lf, x) {
      if (x === lf.drawn) return;
      lf.drawn = x; lf.wx = x;
      const q = leafPaths(lf.y, x, lf.pull);
      lf.frame.setAttribute("d", q.frame); lf.glintEl.setAttribute("d", q.glint); lf.pullEl.setAttribute("d", q.pull);
    }
    for (const lf of lv) if (lf.fixed) draw(lf, lf.x0);

    // ---- state
    let hovChain = null, hovFixed = null, peekT = 0, touched = false, shown = "", act = null, cuedFixed = null, B;

    const retarget = (c) => { c.pk.t = c.mode === "drag" || c.mode === "coast" ? 0 : Math.max(hovChain === c ? 1 : 0, peekT); };
    const retargetAll = () => chains.forEach(retarget);

    function settle(c) {
      const s = c.sOf(c.Ls.t);
      c.Ls.k = 60; c.Ls.c = 14;
      if (s > 0.9) c.Ls.t = c.LMAX; else if (s < 0.1) c.Ls.t = c.LMIN;
      B.wake();
    }

    const tick = (dt) => {
      let moving = false;
      let anyActive = false;
      for (const c of chains) {
        if (stepS(c.Ls, dt)) moving = true;
        if (stepS(c.pk, dt)) moving = true;
        if (c.mode === "coast") {
          c.Ls.t = clamp(c.Ls.t + c.vel * dt, c.LMIN, c.LMAX);
          c.vel *= Math.exp(-5 * dt);
          if (Math.abs(c.vel) < 3) { c.mode = "idle"; settle(c); retarget(c); }
        }
        if (c.mode !== "idle") moving = true;

        const dir = c.sOf(c.Ls.x) < 0.6 ? 1 : -1; // toward closed, until it is nearly shut
        const m = c.m;
        const lead = clamp(c.Ls.x + dir * NUDGE * c.pk.x, c.LMIN, c.LMAX);
        // telescopic: all leaves at once, each at its fixed ratio of the lead's travel; flush at both ends
        const rr = (lead - c.o) / (c.LMAX - c.o || 1);
        for (let j = 0; j < m; j++) draw(c.lv[j], c.toP(j === m - 1 ? lead : c.o + (c.Pc[j] - c.o) * rr));

        const ci = chains.indexOf(c), wsgn = dir * (c.mirror ? -1 : 1);
        const gx = dir > 0 ? c.LMAX : c.LMIN, on = c.pk.x > 0.02, ll = c.lv[m - 1];
        const gk = on ? gx : "";
        if (gk !== c.ghostKey) { c.ghostKey = gk; ghosts[ci].setAttribute("d", on ? leafPaths(ll.y, c.toP(gx), null).ghost : ""); }
        ghosts[ci].setAttribute("opacity", String(clamp(c.pk.x * 1.1, 0, 0.9)));
        const ak = on ? wsgn + ":" + lead.toFixed(2) : "";
        if (ak !== c.arrowKey) {
          c.arrowKey = ak;
          if (!on) arrows[ci].setAttribute("d", "");
          else {
            const y = ll.y, xa = ll.wx + W * 0.5 - wsgn * 5, xt = xa + wsgn * 15;
            arrows[ci].setAttribute("d",
              seg(P(xa, y, MID), P(xt, y, MID)) +
              seg(P(xt - wsgn * 4.5, y, MID + 4.5), P(xt, y, MID)) +
              seg(P(xt - wsgn * 4.5, y, MID - 4.5), P(xt, y, MID)));
          }
        }
        arrows[ci].setAttribute("opacity", String(clamp(c.pk.x * 1.3, 0, 1)));

        const active = c.pk.x > 0.05 || c.mode !== "idle";
        if (active) anyActive = true;
        if (active !== c.brightLead) {
          c.brightLead = active;
          if (m === 1) c.lv[0].pullEl.classList.add("hi");
          else { c.lv[m - 1].pullEl.classList.toggle("hi", active); c.lv[0].pullEl.classList.toggle("hi", !active); }
        }
      }
      // fixed-leaf cue (hover only)
      if (hovFixed !== cuedFixed) {
        if (cuedFixed) cuedFixed.glintEl.classList.remove("hi");
        if (hovFixed) hovFixed.glintEl.classList.add("hi");
        cuedFixed = hovFixed;
      }
      let pcts = chains.map((c) => Math.round(clamp(1 - c.sOf(c.Ls.x), 0, 1) * 100));
      if (cfg.span) { // two crossing leaves: openness = uncovered share of the 2W doorway
        const iv = lv.map((l) => [clamp(l.wx, 0, 2 * W), clamp(l.wx + W, 0, 2 * W)]).sort((p, q) => p[0] - q[0]);
        let cov = 0, e = 0;
        for (const [u, v] of iv) { cov += Math.max(0, v - Math.max(u, e)); e = Math.max(e, v); }
        pcts = [Math.round((1 - cov / (2 * W)) * 100)];
      }
      const txt = !touched && !anyActive && !hovFixed
        ? "rest"
        : "abierta " + (chains.length === 1 || cfg.span ? pcts[0] + "%" : chains.map((c, i) => c.tag + " " + pcts[i] + "%").join(" · "));
      if (txt !== shown) { shown = txt; ctx.read(txt); }
      return moving;
    };
    B = register(ctx.stage, tick);
    bag.add(B.unregister);
    for (const c of chains) { c.lv[0].pullEl.classList.add("hi"); c.brightLead = false; }
    ctx.read("rest"); shown = "rest";

    // ---- pointer maths: the plane the leaves stand on, solved for world x and height z
    const ym = laneY((nl - 1) / 2), o = P(0, ym, 0), ex = P(1, ym, 0), ez = P(0, ym, 1);
    const ax = ex[0] - o[0], ay = ex[1] - o[1], bx = ez[0] - o[0], by = ez[1] - o[1], det = ax * by - bx * ay;
    const solve = (p) => [(by * (p[0] - o[0]) - bx * (p[1] - o[1])) / det, (-ay * (p[0] - o[0]) + ax * (p[1] - o[1])) / det];
    const along = (dx, dy) => (dx * ax + dy * ay) / (ax * ax + ay * ay);
    const hx0 = wall ? X0 + 6 : -pockL - 8, hx1 = wall ? X1 - 4 : xe + pockR + (cfg.jamb ? 7 : 0) + 8;
    const hz1 = wall ? ZT + 18 : CZ + HZ + 4;
    function hit(p) { const [u, z] = solve(p); return u > hx0 && u < hx1 && z > -8 && z < hz1; }

    function nearest(u) {
      let best = chains[0], bd = 1e9;
      for (const c of chains) { const l = c.lv[c.m - 1], dd = Math.abs(u - (l.wx + W / 2)); if (dd < bd) { bd = dd; best = c; } }
      return best;
    }
    function pick(p) {
      const [u] = solve(p);
      let best = null;
      for (const c of chains) for (const lf of c.lv) if (u >= lf.wx && u <= lf.wx + W && (!best || lf.lane < best.lane)) best = { c, lane: lf.lane };
      if (best) return { chain: best.c };
      for (const lf of lv) if (lf.fixed && u >= lf.x0 && u <= lf.x0 + W) return { fixed: lf, chain: nearest(u) };
      return { chain: nearest(u) };
    }

    return {
      hit,
      hover(p) {
        let hc = null, hf = null;
        if (p && hit(p)) { const r = pick(p); if (r.fixed) hf = r.fixed; else hc = r.chain; }
        if (hc !== hovChain || hf !== hovFixed) { hovChain = hc; hovFixed = hf; retargetAll(); B.wake(); }
      },
      peek(t) { peekT = t; retargetAll(); B.wake(); },
      press(p) {
        const r = pick(p); touched = true; hovChain = null; hovFixed = null;
        if (r.fixed) { act = null; retargetAll(); B.wake(); return; } // a fixed leaf is not pulled
        act = r.chain;
        act.L0 = act.Ls.t; act.vel = 0; act.mode = "idle";
        retargetAll(); B.wake();
      },
      drag(p, dd) {
        const c = act; if (!c) return;
        if (c.mode !== "drag") { c.mode = "drag"; c.Ls.k = 220; c.Ls.c = 26; retarget(c); }
        c.Ls.t = clamp(c.L0 + (c.mirror ? -1 : 1) * along(dd.dx, dd.dy), c.LMIN, c.LMAX);
        B.wake();
      },
      release(v) {
        const c = act; if (!c) return;
        c.vel = (c.mirror ? -1 : 1) * along(v.x, v.y);
        if (Math.abs(c.vel) > 3) c.mode = "coast"; else { c.mode = "idle"; settle(c); }
        retarget(c); B.wake();
      },
      tap(p) {
        // One panel step toward closed, or fully open when already closed.
        const c = pick(p).chain; touched = true;
        c.mode = "idle"; c.Ls.k = 100; c.Ls.c = 18;
        if (c.sOf(c.Ls.t) >= 0.97) c.Ls.t = c.LMIN; else { c.Ls.t = Math.min(c.LMAX, c.Ls.t + W); settle(c); }
        retarget(c); B.wake();
      },
      destroy: bag.dispose,
    };
  }

  for (const code of Object.keys(CONFIGS)) HairlineSite.figures[code] = makeFigure(code, CONFIGS[code]);
})();
