/* ════════════════════════════════════════════════════════════════════
   gl-lente.js — Multi-lens Liquid Glass Engine (up to 10 instances)
   Logo click → spawn a new lens. Click any lens → editor binds to it.
   Each lens: independent drag, resize, glass effects, standby.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;

  /* ─── Static (non-interactive) mode for touch / small viewports ──────
     The lens engine is built around hover + mouse drag/resize + a
     hover-launched editor panel — none of which work on touch, and the
     live backdrop-filter recompositing on pointer events murders perf on
     tablet GPUs (an iPad Pro reports a desktop-width viewport in Chrome
     yet chokes on the full engine and renders the section glitchy). So we
     go STATIC whenever the primary input can't hover / is coarse (any
     touch device, ANY width) OR the viewport is ≤991px. In static mode
     the decorative interlude samples still render as pure decoration — no
     drag, resize, editor — and the dock "Lente" generator + free-floating
     lenses are suppressed. Only a real mouse desktop keeps full editing. */
  var GL_LENTE_STATIC = window.matchMedia('(max-width: 991px)').matches
    || window.matchMedia('(hover: none)').matches
    || window.matchMedia('(pointer: coarse)').matches;

  /* ─── Categories ──────────────────────────────────────────────────── */
  window.GL_LENTE_CATEGORIES = [
    { id: 'vidrio',  label: 'Vidrios',  sub: 'Láminas y tintes' },
    { id: 'patron',  label: 'Patrones', sub: 'Geometría y mallas' },
    { id: 'acabado', label: 'Acabados', sub: 'Superficie y reflejo' },
    { id: 'textura', label: 'Texturas', sub: 'Próximamente · SVG' }
  ];

  /* ─── Catalog ─────────────────────────────────────────────────────────
     Names + codes are CANONICAL — they mirror the client master sheet
     (CODIGOS TABLA PERIODICA_PAGINA WEB.xlsx). Display label = "<Code> · <Name>".
     The lowercase `id` is a load-bearing engine key (drives filterFor() switch
     + PATTERN_MASKS lookup + saved-layer state) — DO NOT rename ids. A few ids
     intentionally differ from their code: sz→Az, sh→Ah, sbl→Ab.
     Entries marked "Creativo" are playground primitives, NOT catalog products. */
  window.GL_LENTE_CATALOG = [
    /* Vidrios — pure backdrop-filter sheets */
    { id: 'vc',  category: 'vidrio',  name: 'Vc · Claro',          sub: 'Colores · float',         dot: 'rgba(210,235,248,0.5)' },
    { id: 'vu',  category: 'vidrio',  name: 'Vu · Ultraclaro',     sub: 'Colores · low-iron',      dot: 'rgba(228,245,255,0.65)' },
    { id: 'vb',  category: 'vidrio',  name: 'Vb · Bronce',         sub: 'Colores · tintado masa',  dot: '#7a5520' },
    { id: 'vg',  category: 'vidrio',  name: 'Vg · Gris',           sub: 'Colores · tintado neutro',dot: '#4a5058' },
    { id: 'vp',  category: 'vidrio',  name: 'Vp · Pacifica',       sub: 'Colores · tintado azul',  dot: '#1a3f68' },
    { id: 'vi',  category: 'vidrio',  name: 'Vi · Indigo',         sub: 'Colores · azul profundo', dot: '#121a5e' },
    { id: 'gra', category: 'vidrio',  name: 'Gra · Gradient Acidado', sub: 'Inserción · clear→frost', dot: 'linear-gradient(90deg,#c0d2e0,rgba(210,235,248,0))' },
    { id: 'in',  category: 'vidrio',  name: 'In · Interlayer',     sub: 'Inserción · film color',  dot: '#3a7abf' },
    { id: 'ec',  category: 'vidrio',  name: 'Ec · Espejo Claro',   sub: 'Reflectivo · silver',     dot: 'linear-gradient(135deg,#98afc0,#dae8f5)' },
    { id: 'eb',  category: 'vidrio',  name: 'Eb · Espejo Bronce',  sub: 'Reflectivo · bronce',     dot: 'linear-gradient(135deg,#70481a,#b88028)' },

    /* Patrones — geometric line/mesh overlays */
    { id: 'va',  category: 'patron',  name: 'Va · Acanalado',      sub: 'Colores · reed lenticular', dot: '#a8bece' },
    { id: 'vd',  category: 'patron',  name: 'Vd · Diamante',       sub: 'Colores · facetas',       dot: '#98b0c4' },
    { id: 'iml', category: 'patron',  name: 'Iml · Impresion Lineas', sub: 'Inserción · serigrafía', dot: '#5a6878' },
    { id: 'ac',  category: 'patron',  name: 'Ac · Cuadros',        sub: 'Malla Serie A',           dot: '#7a8898' },
    { id: 'at',  category: 'patron',  name: 'At · Tejida',         sub: 'Malla Serie A · woven',   dot: '#6a7888' },
    { id: 'bq',  category: 'patron',  name: 'Bq · Qubo',           sub: 'Malla Serie B',           dot: '#505f6e' },
    /* Microperforado — creative primitive (NOT a catalog product): middle layer
       with tiny perforations. Color paints the panel; perforations reveal below. */
    { id: 'vmp', category: 'patron',  name: 'Microperforado',      sub: 'Creativo · no catálogo',  dot: '#8593a8' },
    /* id 'sz' → code Az (Malla Serie A · Zigzag) */
    { id: 'sz',  category: 'patron',  name: 'Az · Zigzag',         sub: 'Malla Serie A',           dot: '#7d8c9c' },
    /* id 'sh' → code Ah (Malla Serie A · Herringbone) */
    { id: 'sh',  category: 'patron',  name: 'Ah · Herringbone',    sub: 'Malla Serie A · espiga',  dot: '#6e7d8c' },
    /* id 'sbl' → code Ab (Malla Serie A · Bilineal) */
    { id: 'sbl', category: 'patron',  name: 'Ab · Bilineal',       sub: 'Malla Serie A',           dot: '#85929e' },
    /* Continuation: Acabados + Texturas follow below */

    /* Acabados — surface finishes (frost, dichroic, iridescent) */
    { id: 've',  category: 'acabado', name: 'Ve · Esmerilado',     sub: 'Colores · acid-etched',   dot: '#c0d2e0' },
    { id: 'ds',  category: 'acabado', name: 'Ds · Dichroic Sunset', sub: 'Inserción · dicroico',   dot: 'conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)' },
    { id: 'ep',  category: 'acabado', name: 'Ep · Polychromatico', sub: 'Reflectivo · dicroico',   dot: 'conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)' },

    /* Texturas — SVG surface textures (próximamente). Where a texture maps to a
       real product its code is shown; purely creative textures are "Creativo". */
    { id: 'tx-noise',    category: 'textura', name: 'Ruido',         sub: 'Creativo · textura',   dot: '#8e8e8e' },
    { id: 'tx-linen',    category: 'textura', name: 'Tl · Tela Lino', sub: 'Inserción · textura', dot: '#bcb19a' },
    { id: 'tx-leather',  category: 'textura', name: 'Cuero',         sub: 'Creativo · textura',   dot: '#7a5a40' },
    { id: 'tx-marble',   category: 'textura', name: 'Mármol',        sub: 'Creativo · textura',   dot: '#d8d4ce' },
    { id: 'tx-concrete', category: 'textura', name: 'Hormigón',      sub: 'Creativo · textura',   dot: '#9c9690' },
    { id: 'tx-eva-w',    category: 'textura', name: 'Veb · Eva Blanca', sub: 'Colores · textura', dot: '#ebe6dc' },
    { id: 'tx-eva-k',    category: 'textura', name: 'Ven · Eva Negra',  sub: 'Colores · textura', dot: '#1c1b1a' },
    { id: 'tx-velvet',   category: 'textura', name: 'Velour',        sub: 'Creativo · textura',   dot: '#3a2230' }
  ];

  /* ─── Catalog presets — multi-layer compositions ────────────────────
     Each preset mirrors a real catalog product as a stack of lens layers
     with tuned settings. Loading a preset clears the current layer stack
     and replaces it with the preset's layers in order. */
  window.GL_LENTE_PRESETS = [
    {
      "id": "vidrio-claro",
      "code": "Vc",
      "name": "Vc · Vidrio Claro",
      "sub": "Colores · float",
      "dot": "rgba(210,235,248,0.5)",
      "category": "colores",
      "layers": [
        {
          "type": "vc",
          "blur": 0,
          "color": 35,
          "refraction": 20,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 18,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "vidrio-ultraclaro",
      "code": "Vu",
      "name": "Vu · Vidrio Ultraclaro",
      "sub": "Colores · low-iron",
      "dot": "rgba(228,245,255,0.65)",
      "category": "colores",
      "layers": [
        {
          "type": "vu",
          "blur": 0,
          "color": 45,
          "refraction": 18,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 12,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "vidrio-pacifica",
      "code": "Vp",
      "name": "Vp · Vidrio Pacífica",
      "sub": "Colores · tintado azul",
      "dot": "#1a3f68",
      "category": "colores",
      "layers": [
        {
          "type": "vp",
          "blur": 22,
          "color": 75,
          "refraction": 30,
          "edge": 34,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(20,70,120,0.72)",
          "tintIntensity": 52,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "vidrio-indigo",
      "code": "Vi",
      "name": "Vi · Vidrio Indigo",
      "sub": "Colores · azul profundo",
      "dot": "#121a5e",
      "category": "colores",
      "layers": [
        {
          "type": "vi",
          "blur": 25,
          "color": 80,
          "refraction": 30,
          "edge": 34,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(24,32,110,0.72)",
          "tintIntensity": 58,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "vidrio-bronce",
      "code": "Vb",
      "name": "Vb · Vidrio Bronce",
      "sub": "Colores · tintado masa",
      "dot": "#7a5520",
      "category": "colores",
      "layers": [
        {
          "type": "vb",
          "blur": 20,
          "color": 80,
          "refraction": 30,
          "edge": 40,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(180,110,30,0.85)",
          "tintIntensity": 55,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "vidrio-gris",
      "code": "Vg",
      "name": "Vg · Vidrio Gris",
      "sub": "Colores · tintado neutro",
      "dot": "#4a5058",
      "category": "colores",
      "layers": [
        {
          "type": "vg",
          "blur": 20,
          "color": 75,
          "refraction": 28,
          "edge": 36,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(74,80,88,0.72)",
          "tintIntensity": 48,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "vidrio-acanalado",
      "code": "Va",
      "name": "Va · Vidrio Acanalado",
      "sub": "Colores · reed",
      "dot": "#a8bece",
      "category": "colores",
      "layers": [
        {
          "type": "vc",
          "blur": 12,
          "color": 45,
          "refraction": 20,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 16,
          "layerOpacity": 100
        },
        {
          "type": "va",
          "blur": 15,
          "color": 55,
          "refraction": 18,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 28,
          "patternScale": 58,
          "patternRotation": 0,
          "patternThickness": 58,
          "patternDepth": 14,
          "patternShine": 62,
          "patternShineAngle": 30,
          "layerOpacity": 94,
          "reeded": true
        }
      ]
    },
    {
      "id": "vidrio-acanalado-lite",
      "code": "Val",
      "name": "Val · Vidrio Acanalado Lite",
      "sub": "Colores · reed fino",
      "dot": "#a8bece",
      "category": "colores",
      "layers": [
        {
          "type": "vc",
          "blur": 10,
          "color": 42,
          "refraction": 20,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "va",
          "blur": 15,
          "color": 55,
          "refraction": 18,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 24,
          "patternScale": 38,
          "patternRotation": 0,
          "patternThickness": 46,
          "patternDepth": 10,
          "patternShine": 55,
          "patternShineAngle": 30,
          "layerOpacity": 94,
          "reeded": true
        }
      ]
    },
    {
      "id": "vidrio-esmerilado",
      "code": "Ve",
      "name": "Ve · Vidrio Esmerilado",
      "sub": "Colores · acid-etched",
      "dot": "#c0d2e0",
      "category": "colores",
      "layers": [
        {
          "type": "ve",
          "blur": 60,
          "color": 58,
          "refraction": 32,
          "edge": 50,
          "edgeBlur": 6,
          "edgeBd": 0,
          "tint": "rgba(238,248,255,0.50)",
          "tintIntensity": 40,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "vidrio-texturizado",
      "code": "Vt",
      "name": "Vt · Vidrio Texturizado",
      "sub": "Colores · textura embebida",
      "dot": "#b8c4cc",
      "category": "colores",
      "layers": [
        {
          "type": "vc",
          "blur": 8,
          "color": 40,
          "refraction": 18,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 16,
          "layerOpacity": 100
        },
        {
          "type": "tx-noise",
          "blur": 24,
          "color": 55,
          "refraction": 15,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 18,
          "patternScale": 55,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 90
        }
      ]
    },
    {
      "id": "vidrio-diamante",
      "code": "Vd",
      "name": "Vd · Vidrio Diamante",
      "sub": "Colores · facetas",
      "dot": "#98b0c4",
      "category": "colores",
      "layers": [
        {
          "type": "vc",
          "blur": 10,
          "color": 45,
          "refraction": 20,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 16,
          "layerOpacity": 100
        },
        {
          "type": "vd",
          "blur": 25,
          "color": 55,
          "refraction": 28,
          "edge": 35,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(225,240,255,0.55)",
          "tintIntensity": 36,
          "patternScale": 58,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 18,
          "patternShine": 40,
          "patternShineAngle": 30,
          "layerOpacity": 90
        }
      ]
    },
    {
      "id": "eva-blanca",
      "code": "Veb",
      "name": "Veb · Vidrio Eva Blanca",
      "sub": "Colores · EVA opaco claro",
      "dot": "linear-gradient(135deg,#ebe6dc,#ffffff)",
      "category": "colores",
      "layers": [
        {
          "type": "vu",
          "blur": 0,
          "color": 30,
          "refraction": 20,
          "edge": 25,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "none",
          "tintIntensity": 0,
          "layerOpacity": 100
        },
        {
          "type": "tx-eva-w",
          "blur": 28,
          "color": 35,
          "refraction": 18,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(245,240,230,0.7)",
          "tintIntensity": 75,
          "patternScale": 50,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "eva-negra",
      "code": "Ven",
      "name": "Ven · Vidrio Eva Negra",
      "sub": "Colores · EVA opaco oscuro",
      "dot": "linear-gradient(135deg,#0b0b0b,#3a3a3a)",
      "category": "colores",
      "layers": [
        {
          "type": "vc",
          "blur": 0,
          "color": 30,
          "refraction": 18,
          "edge": 22,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "none",
          "tintIntensity": 0,
          "layerOpacity": 100
        },
        {
          "type": "tx-eva-k",
          "blur": 28,
          "color": 70,
          "refraction": 18,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(15,14,13,0.8)",
          "tintIntensity": 80,
          "patternScale": 50,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "acanalado-bronce",
      "code": "Vab",
      "name": "Vab · Vidrio Acanalado Bronce",
      "sub": "Colores · reed bronce",
      "dot": "linear-gradient(135deg,#7a5520,#c9a84c)",
      "category": "colores",
      "layers": [
        {
          "type": "vb",
          "blur": 20,
          "color": 80,
          "refraction": 30,
          "edge": 40,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(180,110,30,0.85)",
          "tintIntensity": 55,
          "layerOpacity": 100
        },
        {
          "type": "va",
          "blur": 10,
          "color": 60,
          "refraction": 22,
          "edge": 35,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(218,168,78,1)",
          "tintIntensity": 70,
          "patternScale": 60,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 14,
          "patternShine": 60,
          "patternShineAngle": 30,
          "layerOpacity": 95,
          "reeded": true
        }
      ]
    },
    {
      "id": "acanalado-gris",
      "code": "Vag",
      "name": "Vag · Vidrio Acanalado Gris",
      "sub": "Colores · reed gris",
      "dot": "linear-gradient(135deg,#4a5058,#9aa4ac)",
      "category": "colores",
      "layers": [
        {
          "type": "vg",
          "blur": 18,
          "color": 75,
          "refraction": 28,
          "edge": 36,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(74,80,88,0.72)",
          "tintIntensity": 50,
          "layerOpacity": 100
        },
        {
          "type": "va",
          "blur": 15,
          "color": 55,
          "refraction": 18,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(74,80,88,0.72)",
          "tintIntensity": 60,
          "patternScale": 58,
          "patternRotation": 0,
          "patternThickness": 58,
          "patternDepth": 14,
          "patternShine": 62,
          "patternShineAngle": 30,
          "layerOpacity": 94,
          "reeded": true
        }
      ]
    },
    {
      "id": "gradient",
      "code": "Gr",
      "name": "Gr · Gradient",
      "sub": "Inserción · clear→color",
      "dot": "linear-gradient(90deg,#c0d2e0,rgba(210,235,248,0))",
      "category": "inserciones",
      "layers": [
        {
          "type": "gra",
          "blur": 55,
          "color": 60,
          "refraction": 30,
          "edge": 45,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "linear-gradient(90deg,rgba(200,214,224,0.60),rgba(210,235,248,0))",
          "tintIntensity": 40,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "gradient-acidado",
      "code": "Gra",
      "name": "Gra · Gradient Acidado",
      "sub": "Inserción · grad + frost",
      "dot": "linear-gradient(135deg,#c0d2e0,#e8f2fa)",
      "category": "inserciones",
      "layers": [
        {
          "type": "gra",
          "blur": 55,
          "color": 60,
          "refraction": 30,
          "edge": 45,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "linear-gradient(90deg,rgba(200,214,224,0.60),rgba(210,235,248,0))",
          "tintIntensity": 40,
          "layerOpacity": 100
        },
        {
          "type": "ve",
          "blur": 60,
          "color": 58,
          "refraction": 32,
          "edge": 50,
          "edgeBlur": 6,
          "edgeBd": 0,
          "tint": "rgba(238,248,255,0.50)",
          "tintIntensity": 35,
          "layerOpacity": 92
        }
      ]
    },
    {
      "id": "dichroic-sunset",
      "code": "Ds",
      "name": "Ds · Dichroic Sunset",
      "sub": "Inserción · dicroico",
      "dot": "conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)",
      "category": "inserciones",
      "layers": [
        {
          "type": "ds",
          "blur": 10,
          "color": 88,
          "refraction": 35,
          "edge": 45,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)",
          "tintIntensity": 60,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "sunset-acidado",
      "code": "Dsa",
      "name": "Dsa · Dichroic Sunset Acidado",
      "sub": "Inserción dicroica acidada",
      "dot": "conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)",
      "category": "inserciones",
      "layers": [
        {
          "type": "ds",
          "blur": 8,
          "color": 88,
          "refraction": 38,
          "edge": 45,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "none",
          "tintIntensity": 0,
          "layerOpacity": 100
        },
        {
          "type": "ve",
          "blur": 55,
          "color": 60,
          "refraction": 35,
          "edge": 55,
          "edgeBlur": 6,
          "edgeBd": 0,
          "tint": "rgba(255, 220, 195, 0.45)",
          "tintIntensity": 35,
          "layerOpacity": 95
        }
      ]
    },
    {
      "id": "interlayer",
      "code": "In",
      "name": "In · Interlayer",
      "sub": "Inserción · film color",
      "dot": "#3a7abf",
      "category": "inserciones",
      "layers": [
        {
          "type": "in",
          "blur": 8,
          "color": 80,
          "refraction": 28,
          "edge": 40,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(38,118,208,0.65)",
          "tintIntensity": 60,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "int-acidado",
      "code": "Ina",
      "name": "Ina · Interlayer Acidado",
      "sub": "Inserción · film + frost",
      "dot": "linear-gradient(135deg,#3a7abf,#c0d2e0)",
      "category": "inserciones",
      "layers": [
        {
          "type": "in",
          "blur": 8,
          "color": 80,
          "refraction": 28,
          "edge": 40,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(38, 118, 208, 0.65)",
          "tintIntensity": 60,
          "layerOpacity": 100
        },
        {
          "type": "ve",
          "blur": 55,
          "color": 60,
          "refraction": 32,
          "edge": 50,
          "edgeBlur": 6,
          "edgeBd": 0,
          "tint": "rgba(228, 240, 252, 0.45)",
          "tintIntensity": 35,
          "layerOpacity": 92
        }
      ]
    },
    {
      "id": "impresion-cuadros",
      "code": "Imc",
      "name": "Imc · Impresión Cuadros",
      "sub": "Inserción · serigrafía",
      "dot": "#8b96a2",
      "category": "inserciones",
      "layers": [
        {
          "type": "vc",
          "blur": 6,
          "color": 40,
          "refraction": 22,
          "edge": 25,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "ac",
          "blur": 10,
          "color": 55,
          "refraction": 20,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(240,244,248,0.72)",
          "tintIntensity": 52,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 45,
          "patternDepth": 6,
          "patternShine": 18,
          "patternShineAngle": 25,
          "layerOpacity": 96,
          "skin": false
        }
      ]
    },
    {
      "id": "impresion-lineas",
      "code": "Iml",
      "name": "Iml · Impresión Líneas",
      "sub": "Inserción · serigrafía",
      "dot": "#5a6878",
      "category": "inserciones",
      "layers": [
        {
          "type": "vc",
          "blur": 6,
          "color": 40,
          "refraction": 22,
          "edge": 25,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "iml",
          "blur": 5,
          "color": 55,
          "refraction": 18,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(240,244,248,0.72)",
          "tintIntensity": 55,
          "patternScale": 45,
          "patternRotation": 0,
          "patternThickness": 40,
          "patternDepth": 6,
          "patternShine": 20,
          "patternShineAngle": 25,
          "layerOpacity": 96,
          "skin": false
        }
      ]
    },
    {
      "id": "tela-lino",
      "code": "Tl",
      "name": "Tl · Tela Lino",
      "sub": "Inserción · textil",
      "dot": "#bcb19a",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 4,
          "color": 35,
          "refraction": 20,
          "edge": 25,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 12,
          "layerOpacity": 100
        },
        {
          "type": "tx-linen",
          "blur": 25,
          "color": 60,
          "refraction": 15,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 22,
          "patternScale": 50,
          "patternRotation": 0,
          "layerOpacity": 96
        }
      ]
    },
    {
      "id": "malla-a-entramado",
      "code": "Ae",
      "name": "Ae · Malla Serie A — Entramado",
      "sub": "Malla A · gauze",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "at",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 60,
          "patternRotation": 0,
          "patternThickness": 40,
          "patternDepth": 12,
          "patternShine": 55,
          "patternShineAngle": 28,
          "layerOpacity": 96,
          "skin": true,
          "mesh": "w-gauze"
        }
      ]
    },
    {
      "id": "malla-a-pulida",
      "code": "Ap",
      "name": "Ap · Malla Serie A — Pulida",
      "sub": "Malla A · polished",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "ac",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 45,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 8,
          "patternShine": 78,
          "patternShineAngle": 25,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "malla-a-fabric",
      "code": "Af",
      "name": "Af · Malla Serie A — Fabric",
      "sub": "Malla A · fabric",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "at",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 45,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 16,
          "patternShine": 55,
          "patternShineAngle": 28,
          "layerOpacity": 96,
          "skin": true,
          "mesh": "w-twill"
        }
      ]
    },
    {
      "id": "malla-a-lisa",
      "code": "Al",
      "name": "Al · Malla Serie A — Lisa",
      "sub": "Malla A · plain",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "at",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 40,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 10,
          "patternShine": 58,
          "patternShineAngle": 28,
          "layerOpacity": 96,
          "skin": true,
          "mesh": "w-plain"
        }
      ]
    },
    {
      "id": "malla-a-zigzag",
      "code": "Az",
      "name": "Az · Malla Serie A — Zigzag",
      "sub": "Malla A · zigzag",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "sz",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 48,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 14,
          "patternShine": 60,
          "patternShineAngle": 35,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "malla-a-qubo",
      "code": "Aq",
      "name": "Aq · Malla Serie A — Qubo",
      "sub": "Malla A · cube",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "bq",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 18,
          "patternShine": 58,
          "patternShineAngle": 30,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "malla-a-herringbone",
      "code": "Ah",
      "name": "Ah · Malla Serie A — Herringbone",
      "sub": "Malla A · espiga",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "sh",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 40,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 16,
          "patternShine": 62,
          "patternShineAngle": 35,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "malla-a-bilineal",
      "code": "Ab",
      "name": "Ab · Malla Serie A — Bilineal",
      "sub": "Malla A · bilinear",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "sbl",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 45,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 12,
          "patternShine": 58,
          "patternShineAngle": 28,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "malla-a-tejida",
      "code": "At",
      "name": "At · Malla Serie A — Tejida",
      "sub": "Malla A · woven",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 32,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "at",
          "blur": 9,
          "color": 55,
          "refraction": 26,
          "edge": 32,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 42,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 16,
          "patternShine": 62,
          "patternShineAngle": 28,
          "layerOpacity": 96,
          "skin": true
        },
        {
          "type": "vu",
          "blur": 4,
          "color": 28,
          "refraction": 22,
          "edge": 38,
          "edgeBlur": 3,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 62
        }
      ]
    },
    {
      "id": "malla-a-cuadros",
      "code": "Ac",
      "name": "Ac · Malla Serie A — Cuadros",
      "sub": "Malla A · grid",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "ac",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 16,
          "patternShine": 55,
          "patternShineAngle": 28,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "malla-b-qubo",
      "code": "Bq",
      "name": "Bq · Malla Serie B — Qubo",
      "sub": "Malla B · cube (≡Aq)",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "bq",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 18,
          "patternShine": 58,
          "patternShineAngle": 30,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "malla-b-entramado",
      "code": "Be",
      "name": "Be · Malla Serie B — Entramado",
      "sub": "Malla B · gauze (≈Ae)",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "at",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 60,
          "patternRotation": 0,
          "patternThickness": 40,
          "patternDepth": 12,
          "patternShine": 55,
          "patternShineAngle": 28,
          "layerOpacity": 96,
          "skin": true,
          "mesh": "w-gauze"
        }
      ]
    },
    {
      "id": "malla-b-lisa",
      "code": "Bl",
      "name": "Bl · Malla Serie B — Lisa",
      "sub": "Malla B · plain (≈Al)",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "at",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 84,
          "patternScale": 40,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 10,
          "patternShine": 58,
          "patternShineAngle": 28,
          "layerOpacity": 96,
          "skin": true,
          "mesh": "w-plain"
        }
      ]
    },
    {
      "id": "malla-c-mosquitera",
      "code": "Cm",
      "name": "Cm · Malla Serie C — Mosquitera",
      "sub": "Malla C · screen",
      "dot": "linear-gradient(135deg,#8a97a4,#c6d0d8)",
      "category": "inserciones",
      "layers": [
        {
          "type": "vu",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(232,246,255,0.30)",
          "tintIntensity": 14,
          "layerOpacity": 100
        },
        {
          "type": "ac",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(150,165,180,1)",
          "tintIntensity": 80,
          "patternScale": 30,
          "patternRotation": 0,
          "patternThickness": 35,
          "patternDepth": 8,
          "patternShine": 50,
          "patternShineAngle": 25,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "malla-c-negra",
      "code": "Cn",
      "name": "Cn · Malla Serie C — Negra",
      "sub": "Malla C · black screen",
      "dot": "#1c1b1a",
      "category": "inserciones",
      "layers": [
        {
          "type": "vc",
          "blur": 5,
          "color": 30,
          "refraction": 22,
          "edge": 26,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 12,
          "layerOpacity": 100
        },
        {
          "type": "ac",
          "blur": 8,
          "color": 55,
          "refraction": 22,
          "edge": 28,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(28,28,28,1)",
          "tintIntensity": 90,
          "patternScale": 30,
          "patternRotation": 0,
          "patternThickness": 35,
          "patternDepth": 8,
          "patternShine": 45,
          "patternShineAngle": 25,
          "layerOpacity": 96,
          "skin": true
        }
      ]
    },
    {
      "id": "espejo-claro",
      "code": "Ec",
      "name": "Ec · Espejo Claro",
      "sub": "Reflectivo · silver",
      "dot": "linear-gradient(135deg,#98afc0,#dae8f5)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 68,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(150,175,195,0.55)",
          "tintIntensity": 45,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "espejo-bronce",
      "code": "Eb",
      "name": "Eb · Espejo Bronce",
      "sub": "Reflectivo · bronce",
      "dot": "linear-gradient(135deg,#70481a,#b88028)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "eb",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 62,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(150,110,55,0.60)",
          "tintIntensity": 50,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "espejo-gris",
      "code": "Eg",
      "name": "Eg · Espejo Gris",
      "sub": "Reflectivo · gris",
      "dot": "linear-gradient(135deg,#4a5058,#aab4bc)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 62,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(80,88,96,0.58)",
          "tintIntensity": 47,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        }
      ]
    },
    {
      "id": "espejo-interlayer",
      "code": "Ei",
      "name": "Ei · Espejo Interlayer",
      "sub": "Reflectivo · film 300 col",
      "dot": "linear-gradient(135deg,#3a7abf,#dae8f5)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 68,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(150,175,195,0.55)",
          "tintIntensity": 42,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        },
        {
          "type": "in",
          "blur": 8,
          "color": 80,
          "refraction": 28,
          "edge": 40,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(38,118,208,0.65)",
          "tintIntensity": 55,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 90
        }
      ]
    },
    {
      "id": "espejo-polychromatico",
      "code": "Ep",
      "name": "Ep · Espejo Polychromático",
      "sub": "Reflectivo · dicroico · CUSTOM",
      "dot": "conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 68,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(150,175,195,0.55)",
          "tintIntensity": 42,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        },
        {
          "type": "ds",
          "blur": 10,
          "color": 88,
          "refraction": 35,
          "edge": 45,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)",
          "tintIntensity": 55,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 90
        }
      ]
    },
    {
      "id": "es-acanalado",
      "code": "Ea",
      "name": "Ea · Espejo Acanalado",
      "sub": "Reflectivo + reed",
      "dot": "linear-gradient(135deg,#98afc0 0%,#a8bece 50%,#dae8f5 100%)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "vc",
          "blur": 40,
          "color": 45,
          "refraction": 30,
          "edge": 35,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "none",
          "tintIntensity": 0,
          "layerOpacity": 100
        },
        {
          "type": "va",
          "blur": 12,
          "color": 55,
          "refraction": 18,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 26,
          "patternScale": 55,
          "patternRotation": 0,
          "patternThickness": 60,
          "patternDepth": 12,
          "patternShine": 65,
          "patternShineAngle": 32,
          "layerOpacity": 92,
          "reeded": true
        },
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 70,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "none",
          "tintIntensity": 0,
          "layerOpacity": 88
        }
      ]
    },
    {
      "id": "es-acanalado-lite",
      "code": "Eal",
      "name": "Eal · Espejo Acanalado Lite",
      "sub": "Reflectivo · reed fino",
      "dot": "linear-gradient(135deg,#98afc0,#c8dcec)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 68,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(150,175,195,0.55)",
          "tintIntensity": 44,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        },
        {
          "type": "va",
          "blur": 12,
          "color": 55,
          "refraction": 18,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 24,
          "patternScale": 38,
          "patternRotation": 0,
          "patternThickness": 46,
          "patternDepth": 10,
          "patternShine": 55,
          "patternShineAngle": 30,
          "layerOpacity": 90,
          "reeded": true
        }
      ]
    },
    {
      "id": "es-diamante",
      "code": "Ed",
      "name": "Ed · Espejo Diamante",
      "sub": "Reflectivo · facetas",
      "dot": "linear-gradient(135deg,#98b0c4,#dae8f5)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 10,
          "color": 80,
          "refraction": 28,
          "edge": 55,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "none",
          "tintIntensity": 0,
          "layerOpacity": 100
        },
        {
          "type": "vd",
          "blur": 18,
          "color": 55,
          "refraction": 28,
          "edge": 35,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(225,240,255,0.55)",
          "tintIntensity": 35,
          "patternScale": 60,
          "patternRotation": 0,
          "patternThickness": 55,
          "patternDepth": 18,
          "layerOpacity": 88
        }
      ]
    },
    {
      "id": "es-esmerilado",
      "code": "Ee",
      "name": "Ee · Espejo Esmerilado",
      "sub": "Reflectivo · acid-etched",
      "dot": "linear-gradient(135deg,#c0d2e0,#98afc0)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 8,
          "color": 80,
          "refraction": 25,
          "edge": 45,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "none",
          "tintIntensity": 0,
          "layerOpacity": 100
        },
        {
          "type": "ve",
          "blur": 60,
          "color": 55,
          "refraction": 35,
          "edge": 50,
          "edgeBlur": 8,
          "edgeBd": 0,
          "tint": "rgba(238,248,255,0.5)",
          "tintIntensity": 40,
          "layerOpacity": 90
        }
      ]
    },
    {
      "id": "es-esmerilado-film",
      "code": "Eef",
      "name": "Eef · Espejo Esmerilado Film",
      "sub": "Reflectivo · frost + film 300col",
      "dot": "linear-gradient(135deg,#c0d2e0,#dae8f5)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 68,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(150,175,195,0.55)",
          "tintIntensity": 44,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        },
        {
          "type": "in",
          "blur": 8,
          "color": 80,
          "refraction": 28,
          "edge": 40,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(38,118,208,0.65)",
          "tintIntensity": 45,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 90
        },
        {
          "type": "ve",
          "blur": 60,
          "color": 58,
          "refraction": 32,
          "edge": 50,
          "edgeBlur": 6,
          "edgeBd": 0,
          "tint": "rgba(238,248,255,0.50)",
          "tintIntensity": 35,
          "layerOpacity": 90
        }
      ]
    },
    {
      "id": "es-esmerilado-poly",
      "code": "Eep",
      "name": "Eep · Espejo Esmerilado Poly",
      "sub": "Reflectivo · dicroico · CUSTOM",
      "dot": "conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 68,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(150,175,195,0.55)",
          "tintIntensity": 42,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        },
        {
          "type": "ds",
          "blur": 10,
          "color": 88,
          "refraction": 35,
          "edge": 45,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "conic-gradient(#f05,#f80,#0f8,#08f,#80f,#f05)",
          "tintIntensity": 50,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 90
        },
        {
          "type": "ve",
          "blur": 60,
          "color": 58,
          "refraction": 32,
          "edge": 50,
          "edgeBlur": 6,
          "edgeBd": 0,
          "tint": "rgba(238,248,255,0.50)",
          "tintIntensity": 35,
          "layerOpacity": 90
        }
      ]
    },
    {
      "id": "es-texturizado",
      "code": "Et",
      "name": "Et · Espejo Texturizado",
      "sub": "Reflectivo · textura",
      "dot": "linear-gradient(135deg,#98afc0,#b8c4cc)",
      "category": "reflectivos",
      "layers": [
        {
          "type": "ec",
          "blur": 6,
          "color": 90,
          "refraction": 28,
          "edge": 68,
          "edgeBlur": 4,
          "edgeBd": 0,
          "tint": "rgba(150,175,195,0.55)",
          "tintIntensity": 44,
          "patternScale": 50,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 100
        },
        {
          "type": "tx-noise",
          "blur": 24,
          "color": 55,
          "refraction": 15,
          "edge": 30,
          "edgeBlur": 0,
          "edgeBd": 0,
          "tint": "rgba(205,228,242,0.35)",
          "tintIntensity": 18,
          "patternScale": 55,
          "patternRotation": 0,
          "patternThickness": 50,
          "patternDepth": 0,
          "layerOpacity": 85
        }
      ]
    }
  ];

  /* ─── Color picker state ─────────────────────────────────────────── */
  var cpMode  = 'solid';
  var cpSolid = { h: 220, s: 65, v: 95, a: 0.55 };
  var cpGrad  = { type: 'linear', angle: 135, stops: [
    { h: 200, s: 80, v: 90, a: 0.4, pos: 0,   spread: 0 },
    { h: 270, s: 70, v: 75, a: 0.3, pos: 100, spread: 0 }
  ], active: 0 };
  var cpInitDone = false;

  /* ─── Color conversions ──────────────────────────────────────────── */
  function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    var i = Math.floor(h/60)%6, f = h/60-Math.floor(h/60);
    var p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
    var m = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i];
    return { r: Math.round(m[0]*255), g: Math.round(m[1]*255), b: Math.round(m[2]*255) };
  }
  function hsvToRgba(h, s, v, a) { var c=hsvToRgb(h,s,v); return 'rgba('+c.r+','+c.g+','+c.b+','+a.toFixed(2)+')'; }
  function rgbToHsv(r,g,b) {
    r/=255;g/=255;b/=255;
    var max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    var h=0,s=max===0?0:d/max,v=max;
    if(d){if(max===r)h=((g-b)/d+6)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}
    return{h:Math.round(h),s:Math.round(s*100),v:Math.round(v*100)};
  }
  function hexToRgb(hex){hex=hex.replace('#','');if(hex.length===3)hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];return{r:parseInt(hex.slice(0,2),16)||0,g:parseInt(hex.slice(2,4),16)||0,b:parseInt(hex.slice(4,6),16)||0};}
  function rgbToHex(r,g,b){return '#'+[r,g,b].map(function(x){return x.toString(16).padStart(2,'0');}).join('');}
  function cpGetActive(){return cpMode==='solid'?cpSolid:cpGrad.stops[cpGrad.active];}
  function cpToCss(){
    if(cpMode==='solid')return hsvToRgba(cpSolid.h,cpSolid.s,cpSolid.v,cpSolid.a);
    var sorted=cpGrad.stops.slice().sort(function(a,b){return a.pos-b.pos;});
    var parts=[];
    sorted.forEach(function(st){
      var c=hsvToRgba(st.h,st.s,st.v,st.a);
      if(st.spread>0){var hw=st.spread*0.22;parts.push(hsvToRgba(st.h,st.s,st.v,0)+' '+Math.max(0,st.pos-hw).toFixed(1)+'%');parts.push(c+' '+st.pos+'%');parts.push(hsvToRgba(st.h,st.s,st.v,0)+' '+Math.min(100,st.pos+hw).toFixed(1)+'%');}
      else parts.push(c+' '+st.pos+'%');
    });
    if(cpGrad.type==='radial')return'radial-gradient(circle, '+parts.join(', ')+')';
    return'linear-gradient('+cpGrad.angle+'deg, '+parts.join(', ')+')';
  }

  /* ─── SVG texture filter ─────────────────────────────────────────── */
  var svgEl = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svgEl.setAttribute('style','position:absolute;width:0;height:0;overflow:hidden;');
  svgEl.innerHTML='<defs><filter id="gl-lente-texture" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="turbulence" baseFrequency="0.022 0.018" numOctaves="3" result="turbulence" seed="4"/><feDisplacementMap id="gl-lente-texture-dm" in="SourceGraphic" in2="turbulence" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
  document.body.appendChild(svgEl);
  var textureDM = svgEl.querySelector('#gl-lente-texture-dm');

  /* ─── Reeded / fluted glass filter ───────────────────────────────────
     Real acanalado optics: each vertical flute acts like a cylindrical
     lens, so the backdrop is displaced horizontally in a periodic wave →
     whatever is behind the glass smears into vertical bands. Built as an
     SVG feDisplacementMap driven by a vertical-stripe map (RED channel =
     horizontal triangle wave for the x-shift; GREEN held at 128 so there
     is NO vertical shift). Applied to a layer's backdrop-filter when the
     layer sets `reeded:true`. */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var reededMap = 'data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1200'>" +
    "<defs><linearGradient id='rg' x1='0' y1='0' x2='1' y2='0'>" +
    "<stop offset='0' stop-color='rgb(0,128,128)'/>" +
    "<stop offset='0.5' stop-color='rgb(255,128,128)'/>" +
    "<stop offset='1' stop-color='rgb(0,128,128)'/></linearGradient>" +
    "<pattern id='rp' width='13' height='1200' patternUnits='userSpaceOnUse'>" +
    "<rect width='13' height='1200' fill='url(#rg)'/></pattern></defs>" +
    "<rect width='1200' height='1200' fill='url(#rp)'/></svg>"
  );
  (function () {
    var f = document.createElementNS(SVGNS, 'filter');
    f.setAttribute('id', 'gl-reeded');
    f.setAttribute('x', '0'); f.setAttribute('y', '0');
    f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    var img = document.createElementNS(SVGNS, 'feImage');
    img.setAttribute('x', '0'); img.setAttribute('y', '0');
    img.setAttribute('width', '1200'); img.setAttribute('height', '1200');
    img.setAttribute('preserveAspectRatio', 'none');
    img.setAttribute('result', 'rmap');
    img.setAttribute('href', reededMap);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', reededMap);
    var dm = document.createElementNS(SVGNS, 'feDisplacementMap');
    dm.setAttribute('in', 'SourceGraphic'); dm.setAttribute('in2', 'rmap');
    dm.setAttribute('scale', '26');
    dm.setAttribute('xChannelSelector', 'R'); dm.setAttribute('yChannelSelector', 'G');
    f.appendChild(img); f.appendChild(dm);
    svgEl.querySelector('defs').appendChild(f);
  })();

  function n(v){return parseFloat(v.toFixed(3));}

  /* ─── Glass effect applied to a specific lens element ─────────────
     applyGlassToEl ONLY sets backdrop-filter + the type CSS class. Color/tint
     comes from applyPickerColorToEl (which owns .gl-lente-tint exclusively).
     The Color slider (c) modulates filter strength only — there are no
     baked-in color tints anymore.

     backdrop-filter is written to the LAYER itself (each layer is its own
     overflow:hidden + border-radius clipping element — see makeLayerEl).
     Each layer gets its own independent backdrop-filter so multi-layer
     stacking works (top layer's filter blurs the painted content of layers
     below it). The CIRCLE has no overflow:hidden in this architecture — if
     it did, Chrome would refuse to visually render backdrop-filter on the
     nested layer (computes correctly, but paints no blur). */
  function applyGlassToEl(el, settings) {
    var glassEl = el.querySelector('.gl-lente-glass');
    var id = settings.type, b = settings.blur/100, c = settings.color/100, px = b*28;
    glassEl.className = 'gl-lente-glass gl-lente-glass--'+id;
    var bf;
    switch(id){
      case 'vc':  bf='blur('+n(px)+'px) brightness('+n(1+c*.16)+') saturate('+n(1+c*.1)+')'; break;
      case 'vu':  bf='blur('+n(px)+'px) brightness('+n(1+c*.24)+') saturate('+n(1+c*.14)+')'; break;
      case 'vb':  bf='blur('+n(px*.5)+'px) sepia('+n(.2+c*.75)+') brightness('+n(.65+c*.3)+') saturate('+n(1.2+c*1.2)+')'; break;
      case 'vg':  bf='blur('+n(px*.4)+'px) brightness('+n(.42+c*.45)+') saturate('+n(c*.2)+')'; break;
      case 'vp':  bf='blur('+n(px*.4)+'px) brightness('+n(.55+c*.3)+') hue-rotate(192deg) saturate('+n(c*.5)+')'; break;
      case 'vi':  bf='blur('+n(px*.4)+'px) brightness('+n(.38+c*.3)+') hue-rotate(220deg) saturate('+n(c*.28)+')'; break;
      case 've':  bf='blur('+n(px)+'px) brightness('+n(1.1+c*.16)+') saturate('+n(.85-c*.12)+')'; break;
      case 'va':  bf='blur('+n(px*.5)+'px) brightness('+n(1.02+c*.12)+')'; break;
      case 'vd':  bf='blur('+n(px*.6)+'px) brightness('+n(1.04+c*.12)+')'; break;
      case 'gra': bf='blur('+n(px)+'px) brightness('+n(1.06+c*.12)+')'; break;
      case 'ds':  bf='blur('+n(px*.5)+'px) saturate('+n(1.2+c*8)+') brightness('+n(1.06+c*.45)+') contrast('+n(1.06+c*.3)+')'; break;
      case 'in':  bf='blur('+n(px*.5)+'px) brightness('+n(.8+c*.25)+')'; break;
      case 'iml': bf='blur('+n(px*.4)+'px)'; break;
      case 'ac':  bf='blur('+n(px*.4)+'px) brightness('+n(1.02+c*.1)+')'; break;
      case 'at':  bf='blur('+n(px*.35)+'px)'; break;
      case 'bq':  bf='blur('+n(px*.35)+'px)'; break;
      case 'ec':  bf='blur('+n(px*.5)+'px) brightness('+n(1+c*3.2)+') saturate('+n(.04+c*.1)+') contrast('+n(1+c*1.5)+')'; break;
      case 'eb':  bf='blur('+n(px*.5)+'px) brightness('+n(1+c*2.5)+') sepia('+n(.25+c*.7)+') saturate('+n(1.4+c*3.5)+') contrast('+n(1+c*1.3)+')'; break;
      case 'ep':  bf='blur('+n(px*.3)+'px) brightness('+n(1+c*2.2)+') saturate('+n(1.5+c*8)+') contrast('+n(1+c*1.2)+')'; break;
      case 'vmp':       bf='blur('+n(px*.3)+'px) brightness('+n(1.02+c*.12)+')'; break;
      case 'sz':        bf='blur('+n(px*.4)+'px) brightness('+n(1.02+c*.1)+')'; break;
      case 'sh':        bf='blur('+n(px*.4)+'px) brightness('+n(1.02+c*.1)+')'; break;
      case 'sbl':       bf='blur('+n(px*.35)+'px) brightness('+n(1.02+c*.1)+')'; break;
      case 'tx-noise':  bf='blur('+n(px*.6)+'px) brightness('+n(1+c*.15)+')'; break;
      case 'tx-linen':  bf='blur('+n(px*.5)+'px) brightness('+n(1.02+c*.1)+') saturate('+n(0.9-c*.1)+')'; break;
      case 'tx-leather':bf='blur('+n(px*.5)+'px) brightness('+n(0.95+c*.1)+') saturate('+n(0.9+c*.4)+')'; break;
      case 'tx-marble': bf='blur('+n(px*.5)+'px) brightness('+n(1.04+c*.1)+') contrast('+n(0.95+c*.1)+')'; break;
      case 'tx-concrete':bf='blur('+n(px*.55)+'px) brightness('+n(0.92+c*.1)+') saturate('+n(0.85)+')'; break;
      case 'tx-eva-w':  bf='blur('+n(px*.7)+'px) brightness('+n(1.3+c*.2)+') saturate('+n(0.3)+')'; break;
      case 'tx-eva-k':  bf='blur('+n(px*.7)+'px) brightness('+n(0.3-c*.1)+') saturate('+n(0.3)+')'; break;
      case 'tx-velvet': bf='blur('+n(px*.6)+'px) brightness('+n(0.7+c*.2)+') saturate('+n(1.2+c*.5)+')'; break;
    }
    /* Reeded / fluted glass. Two modes:
       - reeded (default): GPU-cheap — a native frost blur; the flute look
         comes entirely from the .is-reeded rib overlay. Stays at ~60fps with
         several lenses on screen.
       - reededDeep (opt-in): the true lenticular smear via the #gl-reeded SVG
         feDisplacementMap. Gorgeous, but SOFTWARE-rendered (~18fps for ONE;
         two freeze the page) — reserve it for a SINGLE showcase lens.
       Both drop the flat wire class and tag .is-reeded for the rib overlay. */
    if (settings.reeded || settings.reededDeep) {
      glassEl.className = 'gl-lente-glass';
      bf = settings.reededDeep
        ? 'url(#gl-reeded) ' + (bf || 'blur(1px)')
        : 'blur(2.4px) brightness(1.05)';
    }
    el.classList.toggle('is-reeded', !!(settings.reeded || settings.reededDeep));
    /* Deep/Realista mode restores the ORIGINAL specular rib brillo (the cheap
       default keeps the toned-matte ribs) so Realista === the beautiful build. */
    el.classList.toggle('is-reeded-deep', !!settings.reededDeep);
    if(bf){ el.style.backdropFilter=bf; el.style.webkitBackdropFilter=bf; }
  }

  /* Pattern transform vars — read by .gl-lente-glass--*::after rules.
     Scale, rotation, wire-thickness multiplier, drop-shadow depth. */
  function applyPatternTransformToEl(el, s) {
    /* Escala → flat-mesh/texture scale. Eased curve (quadratic top) so the
       default stays fine and the high end still reaches larger patterns.
       0.3×–1.6× (was 0.4-4.0, which rendered patterns/textures far too big). */
    var ps = (s.patternScale == null ? 50 : s.patternScale) / 100;
    var scale = 0.2 + ps * 0.5 + ps * ps * 0.45;
    el.style.setProperty('--lente-scale', scale.toFixed(2));
    if (getCategoryForType(s.type) === 'patron') {
      el.style.setProperty('--lente-pattern-rotation', (s.patternRotation || 0) + 'deg');
      /* Thickness multiplier: 0% → 0 (invisible wires), 50% → 1 (default width),
         100% → 2 (double-width wires). The pattern CSS uses this in the wire
         gradient stops so changing Grosor literally widens / narrows the lines. */
      var thickMult = ((s.patternThickness == null ? 50 : s.patternThickness) / 50).toFixed(2);
      el.style.setProperty('--lente-pattern-thickness-mult', thickMult);
      /* Depth: 0–1 multiplier feeding drop-shadow strength */
      el.style.setProperty('--lente-pattern-depth', ((s.patternDepth || 0)/100).toFixed(3));
      /* Brillo (shine) — 0–1 intensity of the directional sheen band painted
         on the layer base via background-image. Below the wires, above the
         backdrop-filter, so wires retain their dark edges over the bright
         zone — reads as "well-lit metal". Angle is the sheen band direction. */
      var shine = (s.patternShine == null ? 0 : s.patternShine) / 100;
      el.style.setProperty('--lente-pattern-shine', shine.toFixed(3));
      el.style.setProperty('--lente-pattern-shine-angle', (s.patternShineAngle == null ? 25 : s.patternShineAngle) + 'deg');
    } else {
      el.style.removeProperty('--lente-pattern-rotation');
      el.style.removeProperty('--lente-pattern-thickness-mult');
      el.style.removeProperty('--lente-pattern-depth');
      el.style.removeProperty('--lente-pattern-shine');
      el.style.removeProperty('--lente-pattern-shine-angle');
    }
  }

  function applyRefractionToEl(el, settings) {
    var dm = textureDM, r = settings.refraction/100;
    var st = el.querySelector('.gl-lente-refract');
    if(dm) dm.setAttribute('scale',(r*35).toFixed(1));
    if(st) st.style.opacity = r>0.01?'1':'0';
  }

  function applyEdgeToEl(el, settings) {
    var edgeEl = el.querySelector('.gl-lente-edge');
    if(!edgeEl) return;
    edgeEl.style.opacity    = (settings.edge/100).toFixed(3);
    var eb = (settings.edgeBlur/100)*12;
    edgeEl.style.filter     = eb>0.2?'blur('+eb.toFixed(1)+'px)':'';
  }

  function applyEdgeBdToEl(el, settings) {
    var bdEl = el.querySelector('.gl-lente-edge-bd');
    if(!bdEl) return;
    var bd = (settings.edgeBd/100)*18;
    bdEl.style.backdropFilter=bdEl.style.webkitBackdropFilter=bd>0.2?'blur('+bd.toFixed(1)+'px)':'';
    bdEl.style.opacity = settings.edgeBd>0?'1':'0';
  }

  function isPatternCategory(type) {
    return getCategoryForType(type) === 'patron';
  }
  function isTextureCategory(type) {
    return getCategoryForType(type) === 'textura';
  }

  /* Per-pattern wire-shape masks. Each mirrors the wire pitch of the
     corresponding ::after gradient (in project.css), but with black/transparent
     so it reads as a CSS mask. Both the mask AND the pattern ::after consume
     `--lente-scale` (Escala) and `--lente-pattern-thickness-mult` (Grosor) so
     they stay in sync as the user adjusts sliders.

     For patterns whose mask needs background-size + repeat (e.g. dot-grid
     microperforado), use the object form {image, size, repeat}. Otherwise the
     string form is assumed to be a self-repeating gradient (linear/conic). */
  var PATTERN_MASKS = {
    /* Acanalado — vertical reed lines, pitch 7px, wire 2px×mult */
    va:  'repeating-linear-gradient(90deg, transparent 0, transparent calc((7px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((7px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(7px * var(--lente-scale, 1)), transparent calc(7px * var(--lente-scale, 1)))',
    /* Diamante — argyle diamond lattice: two crossing reeds (45° + -45°) that
       tile the FULL surface so all four corners are covered (the old single
       45° gradient only painted the two diagonal-end corners and left the other
       two transparent). Pitch ← Escala, line width ← Grosor. */
    vd:  'repeating-linear-gradient(45deg, black 0, black calc(2px * var(--lente-pattern-thickness-mult, 1) * var(--lente-scale, 1)), transparent calc(2px * var(--lente-pattern-thickness-mult, 1) * var(--lente-scale, 1)), transparent calc(14px * var(--lente-scale, 1))), repeating-linear-gradient(-45deg, black 0, black calc(2px * var(--lente-pattern-thickness-mult, 1) * var(--lente-scale, 1)), transparent calc(2px * var(--lente-pattern-thickness-mult, 1) * var(--lente-scale, 1)), transparent calc(14px * var(--lente-scale, 1)))',
    /* Imp-Líneas — fine horizontal printed lines, pitch 10px, wire 2px×mult */
    iml: 'repeating-linear-gradient(0deg, black 0, black calc(2px * var(--lente-pattern-thickness-mult, 1) * var(--lente-scale, 1)), transparent calc(2px * var(--lente-pattern-thickness-mult, 1) * var(--lente-scale, 1)), transparent calc(10px * var(--lente-scale, 1)))',
    /* SA-Cuadros — square mesh, pitch 15px, wire 2px×mult */
    ac:  'repeating-linear-gradient(0deg, transparent 0, transparent calc((15px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((15px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(15px * var(--lente-scale, 1)), transparent calc(15px * var(--lente-scale, 1))), repeating-linear-gradient(90deg, transparent 0, transparent calc((15px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((15px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(15px * var(--lente-scale, 1)), transparent calc(15px * var(--lente-scale, 1)))',
    /* SA-Tejida — woven, pitch 5px, wire 1.5px×mult */
    at:  'repeating-linear-gradient(90deg, transparent 0, transparent calc((5px - 1.5px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((5px - 1.5px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(5px * var(--lente-scale, 1)), transparent calc(5px * var(--lente-scale, 1))), repeating-linear-gradient(0deg, transparent 0, transparent calc((5px - 1.5px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((5px - 1.5px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(5px * var(--lente-scale, 1)), transparent calc(5px * var(--lente-scale, 1)))',
    /* SB-Qubo — isometric cube edges (thickness-fixed approximation) */
    bq:  'linear-gradient(30deg, black 0 12%, transparent 12.5% 87%, black 87.5% 100%), linear-gradient(150deg, black 0 12%, transparent 12.5% 87%, black 87.5% 100%)',
    /* Microperforado — solid panel with circular holes. Mask is opaque on
       the panel area, transparent through the holes. Picker color paints the
       panel; layer underneath shows through the perforations. */
    vmp: {
      image: 'radial-gradient(circle, transparent calc(28% * var(--lente-pattern-thickness-mult, 1)), black calc(30% * var(--lente-pattern-thickness-mult, 1)))',
      size:  'calc(6px * var(--lente-scale, 1)) calc(6px * var(--lente-scale, 1))',
      repeat: 'repeat'
    },
    /* SA-Zigzag — angled lines alternating up/down (use 60° + -60° pair) */
    sz: 'repeating-linear-gradient(60deg, transparent 0, transparent calc((8px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((8px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(8px * var(--lente-scale, 1)), transparent calc(8px * var(--lente-scale, 1))), repeating-linear-gradient(-60deg, transparent 0, transparent calc((8px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((8px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(8px * var(--lente-scale, 1)), transparent calc(8px * var(--lente-scale, 1)))',
    /* SA-Herringbone — 45°/-45° tight chevron */
    sh: 'repeating-linear-gradient(45deg, transparent 0, transparent calc((6px - 1.5px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((6px - 1.5px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(6px * var(--lente-scale, 1)), transparent calc(6px * var(--lente-scale, 1)))',
    /* SA-Bilineal — paired thin lines on a wider pitch (12px) */
    sbl: 'repeating-linear-gradient(0deg, transparent 0, transparent calc((12px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((12px - 2px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((12px - 1px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), transparent calc((12px - 1px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), transparent calc((12px - 0.5px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc((12px - 0.5px * var(--lente-pattern-thickness-mult, 1)) * var(--lente-scale, 1)), black calc(12px * var(--lente-scale, 1)), transparent calc(12px * var(--lente-scale, 1)))'
  };

  /* Picker color writes to .gl-lente-tint exclusively. There is no longer a
     separate "extra tint" layer or any baked-in tint from applyGlassToEl —
     the picker is the single source of color across all categories. For
     Patrones the tint also gets a CSS mask matching the wire shape so the
     color paints ONLY on the wires, leaving the gaps clear. */
  /* ═══════════════════════════════════════════════════════════════════
     Realista mesh skins — opt-in per layer (settings.skin === true). Renders
     the patron mesh as rounded 3D metal wires instead of the flat CSS gradient
     wires, while keeping the EXACT same geometry (angles + pitch read from
     project.css). Each mesh = wire families; each family is an SVG <pattern>
     rotated to its angle (seamless at any angle), painted full-cover so there's
     no CSS-repeat seam. Color ← picker tint (metal ramp); Grosor → wire width;
     Profundidad → cast shadow; Brillo/Ángulo → highlight; Escala → pitch;
     Rotación → CSS transform on .gl-lente-skin. The flat CSS wires + tint are
     turned off while a skin is active. */
  var MESH_SKINS = {
    ac:  { families: [ { a: 0, p: 15 }, { a: 90, p: 15 } ] },                    /* Ac · Cuadros — 0/90 grid */
    at:  { kind: 'woven', families: [ { a: 0, p: 5 }, { a: 90, p: 5 } ] },       /* At · Tejida — over/under woven mesh */
    sz:  { families: [ { a: 60, p: 8 }, { a: -60, p: 8 } ] },                    /* Az · Zigzag — ±60° diamond */
    bq:  { families: [ { a: 30, p: 13 }, { a: 150, p: 13 }, { a: 90, p: 13 } ] },/* Bq · Qubo — isometric cube */
    sh:  { families: [ { a: 45, p: 6 } ] },                                      /* Ah · Herringbone — 45° */
    sbl: { families: [ { a: 0, p: 12, paired: true } ] },                        /* Ab · Bilineal — paired 0° */
    va:  { wireBias: 1.7, families: [ { a: 90, p: 7 } ] },                       /* Va · Acanalado — vertical reed flutes (wider ribs) */
    /* Weave geometries selectable via a layer's `mesh` override (mesh:'w-*')
       so catalog weaves that share a base type id still render as visually
       distinct cloth instead of collapsing onto one square grid. */
    'w-gauze': { kind: 'woven', families: [ { a: 0, p: 3.5 }, { a: 90, p: 8 } ] }, /* entramado — open Dutch/leno weave (horizontal-dominant) */
    'w-plain': { kind: 'woven', families: [ { a: 0, p: 4 }, { a: 90, p: 4 } ] },   /* lisa — tight balanced plain weave */
    'w-twill': { families: [ { a: 63, p: 4.5 }, { a: 153, p: 9 } ] }               /* fabric — diagonal twill */
  };

  /* First rgb/rgba/hex color out of a tint string → {r,g,b}. */
  function parseTintRgb(tint) {
    if (!tint || tint === 'none') return null;
    var m = tint.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    var h = tint.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i);
    if (h) return hexToRgb(h[1]);
    return null;
  }
  function hsvHex(h, s, v) {
    var c = hsvToRgb(h, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, v)));
    return rgbToHex(c.r, c.g, c.b);
  }
  function rd(x) { return (Math.round(x * 100) / 100); }

  /* Metal ramp + wire fraction from settings (color, Brillo, Grosor). */
  function meshRamp(s) {
    var rgb = parseTintRgb(s.tint) || { r: 212, g: 182, b: 58 };
    var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    var shineAmt = (s.patternShine == null ? 0 : s.patternShine) / 100;
    var angle    = (s.patternShineAngle == null ? 25 : s.patternShineAngle);
    var mult     = (s.patternThickness == null ? 50 : s.patternThickness) / 50;
    return {
      edge:  hsvHex(hsv.h, hsv.s + 8,    hsv.v * 0.30),
      body:  hsvHex(hsv.h, hsv.s,        hsv.v * 0.62),
      mid:   hsvHex(hsv.h, hsv.s * 0.92, hsv.v * 0.92),
      shine: hsvHex(hsv.h, hsv.s * (0.32 - 0.20 * shineAmt), Math.min(100, hsv.v * (1.06 + 0.42 * shineAmt) + 10)),
      shinePos: Math.round(30 + (angle / 360) * 30),
      wireFrac: Math.max(0.12, Math.min(0.62, 0.30 * mult))
    };
  }
  function rampStops(r) {
    return '<stop offset="0%" stop-color="' + r.edge + '"/>' +
      '<stop offset="22%" stop-color="' + r.body + '"/>' +
      '<stop offset="' + r.shinePos + '%" stop-color="' + r.shine + '"/>' +
      '<stop offset="64%" stop-color="' + r.mid + '"/>' +
      '<stop offset="100%" stop-color="' + r.edge + '"/>';
  }
  function meshWireGrad(r) {
    return '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' + rampStops(r) + '</linearGradient>';
  }
  /* Over/under WOVEN tile (Tejida) — back verticals, front horizontals, then
     vertical segments re-drawn over the horizontals at alternating crossings,
     each group casting a soft shadow on the threads below → real wire-cloth
     interlace. Recolored from the picker ramp; scales with the uniform pitch. */
  function meshWovenDefs(pitchPx, wireW, r, depth) {
    var P = pitchPx, w = wireW, O = w, tile = 2 * P, cs = [P * 0.5, P * 1.5];
    var shOp = (0.16 + 0.28 * depth).toFixed(2); /* soft interlace shadow; Profundidad deepens it */
    var verts = '', horiz = '', cut = '';
    cs.forEach(function (cx) { verts += '<rect x="' + rd(cx - w/2) + '" y="' + rd(-O) + '" width="' + rd(w) + '" height="' + rd(tile + 2*O) + '" rx="' + rd(w/2) + '" fill="url(#gWv)"/>'; });
    cs.forEach(function (cy) { horiz += '<rect x="' + rd(-O) + '" y="' + rd(cy - w/2) + '" width="' + rd(tile + 2*O) + '" height="' + rd(w) + '" rx="' + rd(w/2) + '" fill="url(#gWh)"/>'; });
    /* Over/under via MASK: hide the horizontal exactly where the vertical
       passes over (odd crossings). Each wire stays one continuous strand that
       dips under — no stub pills, no T-junctions. */
    cs.forEach(function (cx, i) { cs.forEach(function (cy, j) {
      if ((i + j) % 2 === 1) cut += '<rect x="' + rd(cx - w*0.6) + '" y="' + rd(cy - w*0.6) + '" width="' + rd(w*1.2) + '" height="' + rd(w*1.2) + '" rx="' + rd(w*0.3) + '" fill="#000"/>';
    }); });
    var defs =
      '<linearGradient id="gWv" x1="0" y1="0" x2="1" y2="0">' + rampStops(r) + '</linearGradient>' +
      '<linearGradient id="gWh" x1="0" y1="0" x2="0" y2="1">' + rampStops(r) + '</linearGradient>' +
      '<filter id="sw" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="' + rd(w*0.09) + '" dy="' + rd(w*0.13) + '" stdDeviation="' + rd(w*0.12) + '" flood-color="#000" flood-opacity="' + shOp + '"/></filter>' +
      '<mask id="hm" maskUnits="userSpaceOnUse" x="' + rd(-O) + '" y="' + rd(-O) + '" width="' + rd(tile + 2*O) + '" height="' + rd(tile + 2*O) + '"><rect x="' + rd(-O) + '" y="' + rd(-O) + '" width="' + rd(tile + 2*O) + '" height="' + rd(tile + 2*O) + '" fill="#fff"/>' + cut + '</mask>' +
      '<pattern id="pw" patternUnits="userSpaceOnUse" width="' + rd(tile) + '" height="' + rd(tile) + '">' +
        '<g filter="url(#sw)">' + verts + '</g>' +
        '<g filter="url(#sw)" mask="url(#hm)">' + horiz + '</g>' +
      '</pattern>';
    return defs;
  }
  function meshFamilyPattern(id, angle, pitchPx, wireW, paired) {
    var L = Math.max(40, pitchPx * 6);
    var inner;
    if (paired) {
      var w2 = wireW * 0.62;
      inner = '<rect x="0" y="' + rd(pitchPx * 0.5 - w2 * 1.15) + '" width="' + rd(L) + '" height="' + rd(w2) + '" rx="' + rd(w2 / 2) + '" fill="url(#g)"/>' +
              '<rect x="0" y="' + rd(pitchPx * 0.5 + w2 * 0.15) + '" width="' + rd(L) + '" height="' + rd(w2) + '" rx="' + rd(w2 / 2) + '" fill="url(#g)"/>';
    } else {
      inner = '<rect x="0" y="' + rd((pitchPx - wireW) / 2) + '" width="' + rd(L) + '" height="' + rd(wireW) + '" rx="' + rd(wireW / 2) + '" fill="url(#g)"/>';
    }
    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + rd(L) + '" height="' + rd(pitchPx) + '" patternTransform="rotate(' + angle + ')">' + inner + '</pattern>';
  }
  function buildMeshSkinSVG(type, s, sizePx) {
    var meta = MESH_SKINS[type];
    if (!meta) return null;
    var r = meshRamp(s);
    /* Escala maps to an ABSOLUTE on-screen pitch (px), the SAME range for every
       mesh, so all meshes scale consistently and reach the same sizes — instead
       of each being tied to its intrinsic flat-CSS pitch (which left fine meshes
       like Tejida stuck small). Intra-mesh family ratios are preserved. */
    var ps = (s.patternScale == null ? 50 : s.patternScale) / 100; /* 0..1 */
    var pitch0 = 2 + ps * 8;             /* 2px … 10px on-screen — fine wire mesh */
    var depth = (s.patternDepth == null ? 0 : s.patternDepth) / 100;
    var defs, fills, wrapped;

    if (meta.kind === 'woven') {
      /* Tejida — over/under interlace (its own layered shadow lives in the tile).
         Cap the thread fraction so the weave keeps open gaps (never blobby). */
      var wW = Math.max(0.8, pitch0 * Math.min(r.wireFrac, 0.4));
      defs = meshWovenDefs(pitch0, wW, r, depth);
      fills = '<rect width="' + rd(sizePx) + '" height="' + rd(sizePx) + '" fill="url(#pw)"/>';
      wrapped = fills;
    } else {
      var baseP = meta.families[0].p || 1; /* primary family = reference for ratios */
      defs = meshWireGrad(r); fills = '';
      meta.families.forEach(function (f, i) {
        var pitchPx = pitch0 * (f.p / baseP);
        var wireW   = Math.max(0.6, pitchPx * Math.min(0.85, r.wireFrac * (meta.wireBias || 1)));
        defs  += meshFamilyPattern('p' + i, f.a, pitchPx, wireW, f.paired);
        fills += '<rect width="' + rd(sizePx) + '" height="' + rd(sizePx) + '" fill="url(#p' + i + ')"/>';
      });
      wrapped = fills;
      if (depth > 0.01) {
        var d = r.wireFrac * pitch0;
        defs += '<filter id="sd" x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="' + rd(d * 0.5 * depth) + '" dy="' + rd(d * 0.7 * depth) + '" stdDeviation="' + rd(d * 0.5 * depth + 0.2) + '" flood-color="#000" flood-opacity="' + rd(0.55 * depth) + '"/></filter>';
        wrapped = '<g filter="url(#sd)">' + fills + '</g>';
      }
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + rd(sizePx) + '" height="' + rd(sizePx) + '" viewBox="0 0 ' + rd(sizePx) + ' ' + rd(sizePx) + '"><defs>' + defs + '</defs>' + wrapped + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function applySkinToEl(el, s) {
    var skinEl = el.querySelector('.gl-lente-skin');
    if (!skinEl) return;
    var meshKey = (s && s.mesh) || (s && s.type);   /* `mesh` overrides geometry, keeps type for the flat fallback */
    var meta = MESH_SKINS[meshKey];
    var on = !!(s && s.skin && meta);
    if (on) {
      var layerW = parseFloat(el.style.width) || el.getBoundingClientRect().width || 300;
      var sizePx = layerW * 1.42; /* skin element is inset -21% → 1.42× the layer */
      skinEl.style.backgroundImage  = 'url("' + buildMeshSkinSVG(meshKey, s, sizePx) + '")';
      skinEl.style.backgroundSize   = '100% 100%';
      skinEl.style.backgroundRepeat = 'no-repeat';
      skinEl.style.opacity = '1';
      var g = el.querySelector('.gl-lente-glass');
      if (g) g.className = 'gl-lente-glass';   /* turn off flat CSS wires */
      var t = el.querySelector('.gl-lente-tint');
      if (t) t.style.opacity = '0';            /* color rides the SVG */
    } else {
      skinEl.style.opacity = '0';
      skinEl.style.backgroundImage = '';
    }
  }
  function reapplySkins(lens) {
    if (!lens) return;
    lens.layers.forEach(function (layer) {
      if (layer.settings && layer.settings.skin && MESH_SKINS[layer.settings.mesh || layer.settings.type]) {
        applySkinToEl(layer.layerEl, layer.settings);
      }
    });
  }

  function applyPickerColorToEl(el, s) {
    var tintEl = el.querySelector('.gl-lente-tint');
    if (!tintEl) return;
    /* SKIN: when a realistic mesh skin is active the SVG carries the color —
       never paint the flat tint (stops a ghost flat mesh on intensity etc). */
    if (s && s.skin && MESH_SKINS[s.type]) { tintEl.style.opacity = '0'; return; }
    var isPattern = isPatternCategory(s.type);
    /* For Patrones the tint is oversized to 142% (top/right/bottom/left = -21%)
       so when it rotates with the wires, the rotated rectangle still covers the
       full lens shape (parent overflow:hidden clips the overhang). For other
       categories the tint stays at inset:0. */
    var ins = isPattern ? '-21%' : '0';
    tintEl.style.cssText = 'position:absolute;top:'+ins+';right:'+ins+';bottom:'+ins+';left:'+ins+';pointer-events:none;z-index:2;';

    /* For Patrones: install the wire-shape mask + sync to Phase 4 rotation so
       the mask stays aligned with the rotated wires below. Supports both
       string masks (self-repeating gradients) and object masks (image+size+
       repeat, for dot-grid patterns like microperforado). */
    if (isPattern) {
      var mask = PATTERN_MASKS[s.type];
      if (mask) {
        var maskImg, maskSize, maskRepeat;
        if (typeof mask === 'string') {
          maskImg = mask;
        } else {
          maskImg = mask.image; maskSize = mask.size; maskRepeat = mask.repeat;
        }
        tintEl.style.maskImage = maskImg;
        tintEl.style.webkitMaskImage = maskImg;
        tintEl.style.maskComposite = 'add';
        tintEl.style.webkitMaskComposite = 'source-over';
        if (maskSize)   { tintEl.style.maskSize = maskSize;     tintEl.style.webkitMaskSize = maskSize; }
        if (maskRepeat) { tintEl.style.maskRepeat = maskRepeat; tintEl.style.webkitMaskRepeat = maskRepeat; }
        tintEl.style.transform = 'rotate(var(--lente-pattern-rotation, 0deg))';
        tintEl.style.transformOrigin = 'center center';
      }
    }

    /* Texturas — multiply blend so picker color tints the texture's grain */
    if (isTextureCategory(s.type)) {
      tintEl.style.mixBlendMode = 'multiply';
    }
    var tint = s.tint, intensity = s.tintIntensity || 0;
    if (!tint || tint === 'none' || intensity === 0) {
      tintEl.style.backgroundColor = '';
      tintEl.style.backgroundImage = '';
      tintEl.style.opacity = '0';
      return;
    }
    if (tint.indexOf('gradient') !== -1) {
      tintEl.style.backgroundColor = '';
      tintEl.style.backgroundImage = tint;
    } else {
      tintEl.style.backgroundImage = '';
      tintEl.style.backgroundColor = tint;
    }
    tintEl.style.opacity = (intensity / 100).toFixed(2);
  }

  function applyLayerOpacityToEl(el, s) {
    el.style.opacity = ((s.layerOpacity == null ? 100 : s.layerOpacity) / 100).toFixed(2);
  }

  function applyAllToEl(el, s) {
    applyGlassToEl(el, s);
    applyPatternTransformToEl(el, s);
    applyRefractionToEl(el, s);
    applyEdgeToEl(el, s);
    applyEdgeBdToEl(el, s);
    applyPickerColorToEl(el, s);
    applyLayerOpacityToEl(el, s);
    applySkinToEl(el, s); /* Realista skin — must run last (strips wire class + hides tint) */
  }

  /* ─── Canvas (shared container) ─────────────────────────────────── */
  var canvas = document.createElement('div');
  canvas.className = 'gl-lente-canvas';
  canvas.innerHTML = '<div class="gl-lente-overlay" style="display:none"></div>';
  document.body.appendChild(canvas);
  gsap.set(canvas, { autoAlpha: 1 }); /* always visible, lenses fade in */

  /* ─── Multi-lens management ──────────────────────────────────────── */
  var lenses        = [];
  var MAX_LENSES    = 10;
  var activeLens    = null;
  var dragLens      = null;
  var resizeLens    = null;
  var CORNER_ZONE   = 28;

  var DEFAULT_SETTINGS = function () {
    return { type: 've', blur: 65, color: 70, refraction: 55, edge: 60, edgeBlur: 0, edgeBd: 0, tint: 'none', tintIntensity: 0, patternScale: 50, patternRotation: 0, patternThickness: 50, patternDepth: 0, layerOpacity: 100 };
  };

  /* Recommended starting values when a type is selected from the dropdown */
  var TYPE_DEFAULTS = {
    vc:    { blur: 0,  color: 35 },  ve:  { blur: 70, color: 65 },
    vu:    { blur: 0,  color: 45 },  va:  { blur: 15, color: 55 },
    vb:    { blur: 20, color: 80 },  vd:  { blur: 25, color: 55 },
    vg:    { blur: 20, color: 75 },  gra: { blur: 55, color: 60 },
    vp:    { blur: 22, color: 75 },  ds:  { blur: 10, color: 90 },
    vi:    { blur: 25, color: 80 },  in:  { blur: 8,  color: 80 },
    iml:   { blur: 5,  color: 55 },  ac:  { blur: 10, color: 55 },
    at:    { blur: 8,  color: 55 },  bq:  { blur: 8,  color: 55 },
    ec:    { blur: 5,  color: 90 },  eb:  { blur: 5,  color: 90 },
    ep:    { blur: 5,  color: 90 },  vmp: { blur: 8,  color: 55 },
    sz:    { blur: 8,  color: 55 },  sh:  { blur: 10, color: 55 },
    sbl:   { blur: 8,  color: 55 },
    'tx-noise':    { blur: 20, color: 55 },
    'tx-linen':    { blur: 25, color: 60 },
    'tx-leather':  { blur: 20, color: 70 },
    'tx-marble':   { blur: 22, color: 55 },
    'tx-concrete': { blur: 24, color: 60 },
    'tx-eva-w':    { blur: 28, color: 30 },
    'tx-eva-k':    { blur: 28, color: 70 },
    'tx-velvet':   { blur: 22, color: 65 },
    custom: { blur: 30, color: 60 }
  };


  /* Slider definitions — id, label, range, unit. New sliders are added here. */
  var SLIDER_DEFS = {
    blur:         { label: 'Desenfoque',    id: 'gl-le-blur',         min: 0, max: 100, unit: '%' },
    color:        { label: 'Color',         id: 'gl-le-color',        min: 0, max: 100, unit: '%' },
    refraction:   { label: 'Textura',       id: 'gl-le-refraction',   min: 0, max: 100, unit: '%' },
    edge:         { label: 'Refracción',    id: 'gl-le-edge',         min: 0, max: 100, unit: '%' },
    edgeBlur:     { label: 'Suavidad',      id: 'gl-le-edgeBlur',     min: 0, max: 100, unit: '%' },
    edgeBd:       { label: 'Backdrop',      id: 'gl-le-edgeBd',       min: 0, max: 100, unit: '%' },
    patternScale:     { label: 'Escala',       id: 'gl-le-escala',          min: 0, max: 100, unit: '%' },
    patternRotation:  { label: 'Rotación',     id: 'gl-le-patternRotation', min: 0, max: 360, unit: '°' },
    patternThickness: { label: 'Grosor',       id: 'gl-le-patternThick',    min: 0, max: 100, unit: '%' },
    patternDepth:     { label: 'Profundidad',  id: 'gl-le-patternDepth',    min: 0, max: 100, unit: '%' },
    patternShine:     { label: 'Brillo',       id: 'gl-le-patternShine',    min: 0, max: 100, unit: '%' },
    patternShineAngle:{ label: 'Ángulo brillo',id: 'gl-le-patternShineAng', min: 0, max: 360, unit: '°' },
    layerOpacity:     { label: 'Opacidad capa', id: 'gl-le-layerOpacity',   min: 0, max: 100, unit: '%' }
  };

  /* Per-category visible slider schema (order is render order, top → bottom). */
  var CATEGORY_SCHEMAS = {
    vidrio:  ['blur', 'color', 'refraction', 'edge', 'edgeBlur', 'edgeBd', 'layerOpacity'],
    patron:  ['patternScale', 'patternRotation', 'patternThickness', 'patternDepth', 'patternShine', 'patternShineAngle', 'layerOpacity'],
    acabado: ['blur', 'color', 'refraction', 'edge', 'edgeBlur', 'edgeBd', 'layerOpacity'],
    textura: ['blur', 'color', 'patternScale', 'edge', 'edgeBlur', 'layerOpacity']
  };

  function getCategoryForType(typeId) {
    var catalog = window.GL_LENTE_CATALOG || [];
    var e = catalog.find(function(g){ return g.id === typeId; });
    return e ? e.category : 'vidrio';
  }

  /* settings → key map for default values when a slider is missing in settings */
  function readSetting(s, key) {
    var v = s[key];
    if (v != null) return v;
    if (key === 'layerOpacity') return 100;
    if (key === 'patternScale')  return 50;
    if (key === 'patternThickness') return 50;
    if (key === 'patternShineAngle') return 25;
    return 0;
  }

  /* Natural tint color for each glass type — loaded into picker on type select */
  var GLASS_PRESETS = {
    vb:  { h: 32,  s: 70, v: 88, a: 0.85, intensity: 45 }, /* Bronze */
    vg:  { h: 210, s: 12, v: 50, a: 0.8,  intensity: 40 }, /* Grey */
    vp:  { h: 210, s: 85, v: 72, a: 0.8,  intensity: 38 }, /* Pacífica */
    vi:  { h: 232, s: 92, v: 58, a: 0.85, intensity: 45 }, /* Índigo */
    ve:  { h: 200, s: 8,  v: 98, a: 0.7,  intensity: 22 }, /* Esmerilado — light milk */
    gra: { h: 200, s: 8,  v: 98, a: 0.6,  intensity: 18 }, /* Gradient acidado */
    ds:  { h: 30,  s: 90, v: 98, a: 0.8,  intensity: 50 }, /* Sunset */
    in:  { h: 215, s: 82, v: 80, a: 0.85, intensity: 55 }, /* Interlayer blue */
    ec:  { h: 200, s: 12, v: 96, a: 0.6,  intensity: 20 }, /* Espejo Claro */
    eb:  { h: 35,  s: 55, v: 85, a: 0.7,  intensity: 35 }, /* Espejo Bronce */
    ep:  { h: 290, s: 80, v: 90, a: 0.75, intensity: 45 }  /* Espejo Poly */
  };

  /* Circle shell — only shared visual elements (specular, ring, light) */
  function makeLensEl() {
    var el = document.createElement('div');
    el.className = 'gl-lente-circle';
    el.innerHTML =
      '<div class="gl-lente-specular"></div>' +
      '<div class="gl-lente-light"></div>' +
      '<div class="gl-lente-ring"></div>';
    return el;
  }

  /* Layer element — has its own glass effect stack. Each layer is appended
     directly to document.body (NOT to the canvas, NOT nested inside the circle)
     because Chrome only renders backdrop-filter on elements that are NOT inside
     another stacking context. The canvas has position:fixed which inherently
     creates a stacking context; any backdrop-filter on a descendant computes
     but doesn't paint. Direct body-level position:fixed elements paint blur
     correctly. Lens position is kept in viewport coords (position:fixed) and
     all members (layers + circle) follow each other via syncLensMembers(). */
  function makeLayerEl(zIdx) {
    var el = document.createElement('div');
    el.className = 'gl-lente-layer';
    el.style.cssText = 'position:fixed;pointer-events:none;z-index:'+zIdx+';border-top-left-radius:20px;border-top-right-radius:20px;border-bottom-left-radius:20px;border-bottom-right-radius:20px;overflow-x:hidden;overflow-y:hidden;';
    el.innerHTML =
      '<div class="gl-lente-glass"></div>' +
      '<div class="gl-lente-tint"></div>' +
      '<div class="gl-lente-skin"></div>' + /* Realista SVG mesh overlay */
      '<div class="gl-lente-refract"></div>' +
      '<div class="gl-lente-shine"></div>' +
      '<div class="gl-lente-edge-bd"></div>' +
      '<div class="gl-lente-edge"></div>';
    return el;
  }

  /* Copy position/size from the lens shell (circle) to every layer so the
     full lens unit moves and resizes as one. */
  function syncLensMembers(lens) {
    if (!lens || !lens.el) return;
    var s = lens.el.style;
    lens.layers.forEach(function (layer) {
      layer.layerEl.style.left   = s.left;
      layer.layerEl.style.top    = s.top;
      layer.layerEl.style.width  = s.width;
      layer.layerEl.style.height = s.height;
    });
  }

  /* For section-anchored lenses, recompute the fixed-position coords
     from the bounds rect + the lens's stored anchor offset. Takes a
     pre-computed bounds rect to avoid layout thrashing — read all
     rects first (in syncAllBoundedLenses), then write all styles. */
  function syncBoundedLensPosition(lens, br) {
    if (!lens || !lens.bounds) return;
    if (!br) br = lens.bounds.getBoundingClientRect();
    var size = parseFloat(lens.el.style.width) || 0;
    /* Clamp anchor in case section was resized smaller. */
    lens.anchorX = Math.max(0, Math.min(br.width  - size, lens.anchorX));
    lens.anchorY = Math.max(0, Math.min(br.height - size, lens.anchorY));
    /* Static/touch mode: anchor the decorative samples in DOCUMENT space
       (position:absolute + scroll offset baked in) so native scrolling moves
       them and NO per-frame JS sync is needed — this removes the single
       biggest lens scroll-time cost on mobile. Desktop keeps viewport-space
       position:fixed, re-synced on scroll for the draggable free lenses. */
    var pos = GL_LENTE_STATIC ? 'absolute' : 'fixed';
    var ox  = GL_LENTE_STATIC ? window.pageXOffset : 0;
    var oy  = GL_LENTE_STATIC ? window.pageYOffset : 0;
    var nx = br.left + ox + lens.anchorX, ny = br.top + oy + lens.anchorY;
    lens.el.style.position = pos;
    lens.el.style.left = nx + 'px';
    lens.el.style.top  = ny + 'px';
    /* Inline position sync for each layer — only left/top, since
       width/height don't change on scroll. Avoids a separate function
       call that'd do redundant reads. */
    lens.layers.forEach(function (layer) {
      layer.layerEl.style.position = pos;
      layer.layerEl.style.left = nx + 'px';
      layer.layerEl.style.top  = ny + 'px';
    });
  }

  /* One global scroll/resize listener — keeps every section-anchored
     lens following its section. Free-floating lenses are unaffected.

     rAF-throttled so scroll events at >60Hz don't pile up syncs; and
     batched read-then-write to eliminate layout thrashing. Without
     batching, each lens's getBoundingClientRect would force layout
     because the previous lens just wrote styles — 7 lenses sharing
     one section caused ~100ms of forced reflow per scroll burst. */
  function syncAllBoundedLenses() {
    /* Step 1: READ all bounds rects, cached by element. All 7
       interlude samples share the same section, so this collapses to
       one DOM read per unique bounds element. */
    var rectByBounds = new Map();
    for (var i = 0; i < lenses.length; i++) {
      var L = lenses[i];
      if (!L.bounds) continue;
      if (!rectByBounds.has(L.bounds)) {
        rectByBounds.set(L.bounds, L.bounds.getBoundingClientRect());
      }
    }
    /* Step 2: WRITE all positions. Done in a separate loop AFTER all
       reads so the browser can defer layout to the next frame. */
    for (var j = 0; j < lenses.length; j++) {
      var Lj = lenses[j];
      if (!Lj.bounds) continue;
      syncBoundedLensPosition(Lj, rectByBounds.get(Lj.bounds));
    }
  }
  var syncScheduled = false;
  function scheduleSyncBounded() {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(function () {
      syncScheduled = false;
      syncAllBoundedLenses();
    });
  }
  /* In static/touch mode bounded lenses are anchored in document space
     (position:absolute), so they ride native scroll and there is nothing to
     re-sync per scroll frame — skip the scroll listener entirely. Resize still
     re-anchors them (orientation change / dynamic toolbar reflow). */
  window.addEventListener('scroll', function () {
    if (GL_LENTE_STATIC) return;
    scheduleSyncBounded();
  }, { passive: true });
  window.addEventListener('resize', scheduleSyncBounded);

  /* All DOM elements that animate together as one lens (layers + the circle). */
  function lensMembers(lens) {
    if (!lens) return [];
    return lens.layers.map(function (l) { return l.layerEl; }).concat([lens.el]);
  }

  function addLayer(lens, overrides) {
    var s  = Object.assign(DEFAULT_SETTINGS(), overrides || {});
    /* Free-floating lenses use z-index 100-189 (above page content,
       below menu/editor). Section-anchored lenses use 10-39 so the
       navbar (z-index 50) renders above them — interlude samples
       should never overlap the always-on-top site chrome. */
    var zBase = lens.bounds ? 10 : 100;
    var zStep = lens.bounds ? 3 : 10;
    var zI = zBase + lens.layers.length * zStep;
    var le = makeLayerEl(zI);
    /* Position layer to match the lens shell (viewport coords — position:fixed) */
    le.style.left   = lens.el.style.left;
    le.style.top    = lens.el.style.top;
    le.style.width  = lens.el.style.width;
    le.style.height = lens.el.style.height;
    /* Static bounded lenses live in document space (position:absolute) so
       they scroll natively — match that here so layers added after the
       initial anchor inherit the same positioning scheme as the shell. */
    if (GL_LENTE_STATIC && lens.bounds) le.style.position = 'absolute';
    /* If the parent lens is pre-hidden (suppressSpawnAnim), inherit that
       state so this layer doesn't pop in before the lens is revealed. */
    if (lens.preHidden) { le.style.opacity = '0'; le.style.visibility = 'hidden'; }
    /* Insert BEFORE the circle in BODY — circle's specular/ring paint on top */
    document.body.insertBefore(le, lens.el);
    var layer = { settings: s, layerEl: le };
    lens.layers.push(layer);
    lens.activeLayerIdx = lens.layers.length - 1;
    applyAllToEl(le, s);
    /* Section-anchored lenses keep their glass backdrop-filter (blur) on
       DESKTOP — it's what gives the samples real frosted-glass depth.
       On touch/mobile (GL_LENTE_STATIC) we strip it: backdrop-filter
       compositing is the biggest scroll-time cost and weak mobile GPUs
       choke on 3-4 filtered layers × several lenses. There the pattern +
       tint + shine carry the identity instead (section bg is dark/uniform
       so the lost real-time transparency doesn't read as different). */
    if (lens.bounds && GL_LENTE_STATIC) {
      le.style.backdropFilter = 'none';
      le.style.webkitBackdropFilter = 'none';
    }
    return layer;
  }

  function removeLayer(lens, idx) {
    if (lens.layers.length <= 1) return; /* keep at least 1 */
    var layer = lens.layers[idx];
    if (layer.layerEl.parentNode) layer.layerEl.parentNode.removeChild(layer.layerEl);
    lens.layers.splice(idx, 1);
    lens.activeLayerIdx = Math.max(0, Math.min(lens.activeLayerIdx, lens.layers.length - 1));
    reindexLayerZ(lens);
  }

  /* Move a layer from one position in lens.layers[] to another. Updates the
     DOM order (so paint order matches) and reassigns z-index by position. */
  function moveLayer(lens, fromIdx, toIdx) {
    if (!lens) return;
    var n = lens.layers.length;
    if (fromIdx < 0 || fromIdx >= n || toIdx < 0 || toIdx >= n || fromIdx === toIdx) return;
    var moved = lens.layers.splice(fromIdx, 1)[0];
    lens.layers.splice(toIdx, 0, moved);
    /* Track which layer is now active — keep editing the SAME visual layer */
    if (lens.activeLayerIdx === fromIdx) lens.activeLayerIdx = toIdx;
    else if (fromIdx < lens.activeLayerIdx && toIdx >= lens.activeLayerIdx) lens.activeLayerIdx -= 1;
    else if (fromIdx > lens.activeLayerIdx && toIdx <= lens.activeLayerIdx) lens.activeLayerIdx += 1;
    reindexLayerZ(lens);
    /* Re-append in DOM order so source-order tiebreakers + z-index agree */
    var parent = lens.el.parentNode;
    if (parent) {
      lens.layers.forEach(function (layer) {
        if (layer.layerEl.parentNode === parent) parent.appendChild(layer.layerEl);
      });
      parent.appendChild(lens.el); /* circle on top of its own layers */
    }
  }

  /* Recompute z-index for every layer based on its index in lens.layers[]. */
  function reindexLayerZ(lens) {
    if (!lens) return;
    /* Match the bounded/unbounded z scheme used in addLayer. */
    var zBase = lens.bounds ? 10 : 100;
    var zStep = lens.bounds ? 3 : 10;
    lens.layers.forEach(function (layer, i) {
      layer.layerEl.style.zIndex = String(zBase + i * zStep);
    });
  }

  function activeLayer(lens) {
    return lens && lens.layers[lens.activeLayerIdx] || null;
  }

  /* Load a preset (multi-layer composition) into the active lens. Replaces
     the existing layer stack entirely. */
  function loadPreset(lens, presetId) {
    if (!lens) return;
    var presets = window.GL_LENTE_PRESETS || [];
    var preset = presets.find(function (p) { return p.id === presetId; });
    if (!preset) return;
    /* Remove every layer DOM node + clear the layers array */
    lens.layers.forEach(function (layer) {
      if (layer.layerEl.parentNode) layer.layerEl.parentNode.removeChild(layer.layerEl);
    });
    lens.layers = [];
    /* Add each preset layer */
    preset.layers.forEach(function (layerSettings) {
      addLayer(lens, layerSettings);
    });
    lens.activeLayerIdx = Math.max(0, lens.layers.length - 1);
  }

  function spawnLens(overrides) {
    /* MAX_LENSES caps user-spawned (free-floating) lenses only.
       Section-anchored decorative samples (interlude) don't count —
       otherwise the 7 interlude samples would eat 7 of the 10 slots
       and the dock logo could spawn at most 3 user lenses. */
    var unboundedCount = 0;
    for (var li = 0; li < lenses.length; li++) {
      if (!lenses[li].bounds) unboundedCount++;
    }
    var isBounded = !!(overrides && overrides.bounds);
    /* Static mode: only the section-anchored decorative samples are
       allowed. Block every free-floating (dock logo / preset / empty)
       spawn so no editable lens can ever appear on touch/small screens. */
    if (GL_LENTE_STATIC && !isBounded) return null;
    if (!isBounded && unboundedCount >= MAX_LENSES) return null;

    /* Bounds (optional) — when present, the lens is "section-anchored":
       drag is clamped within the bounds element, and on scroll/resize
       the lens follows the section. Used for the homepage Interlude
       samples which look like normal lenses but can't be dragged out
       of their section.
         opts.bounds        — DOM element (e.g. a <section>) to clamp to
         opts.anchorX/anchorY — initial position in px relative to
                                bounds top-left (defaults: center) */
    var bounds = overrides && overrides.bounds;
    var size = (overrides && overrides.size) || 300;
    var idx  = lenses.length;
    var off  = idx * 28;
    var left, top, anchorX, anchorY;
    if (bounds) {
      var br = bounds.getBoundingClientRect();
      anchorX = overrides.anchorX != null ? overrides.anchorX : (br.width  - size) / 2;
      anchorY = overrides.anchorY != null ? overrides.anchorY : (br.height - size) / 2;
      /* Clamp anchor inside bounds at spawn time */
      anchorX = Math.max(0, Math.min(br.width  - size, anchorX));
      anchorY = Math.max(0, Math.min(br.height - size, anchorY));
      left = br.left + anchorX;
      top  = br.top  + anchorY;
    } else {
      left = Math.max(20, Math.min(window.innerWidth  - size - 20, window.innerWidth  / 2 - size / 2 + off));
      top  = Math.max(20, Math.min(window.innerHeight - size - 20, window.innerHeight / 2 - size / 2 + off));
    }

    var el = makeLensEl();
    /* Circle goes on document.body at position:fixed (viewport-anchored) so its
       backdrop-filter — and the layers we'll insert before it — paint correctly.
       Free-floating lens: z-index 199 (above layers 100-190, below menu 200 /
       editor 220). Section-anchored lens: z-index 49 (just below navbar 50)
       so site chrome always wins over decorative samples. */
    var circleZ = bounds ? 49 : 199;
    el.style.cssText += ';position:fixed;cursor:grab;z-index:'+circleZ+';width:'+size+'px;height:'+size+'px;left:'+left+'px;top:'+top+'px;';
    document.body.appendChild(el);

    var lens = {
      el: el, layers: [], activeLayerIdx: 0,
      standbyTimer: null, nearCorner: null,
      dragging: false, didMove: false,
      startMX: 0, startMY: 0, startEX: 0, startEY: 0,
      resizing: false, resizeCX: 0, resizeCY: 0,
      /* Section anchoring (null = free-floating viewport lens) */
      bounds: bounds || null,
      anchorX: anchorX || 0,
      anchorY: anchorY || 0,
      /* When true, any layer added via addLayer() is also hidden so
         the whole lens stays invisible until reveal() is called.
         Set by spawnLens when suppressSpawnAnim is passed in. */
      preHidden: !!(overrides && overrides.suppressSpawnAnim)
    };

    lenses.push(lens);
    /* Don't pass bounds-related opts into addLayer's settings */
    var layerOpts = Object.assign({}, overrides || {});
    delete layerOpts.bounds; delete layerOpts.anchorX; delete layerOpts.anchorY; delete layerOpts.size; delete layerOpts.suppressSpawnAnim;
    addLayer(lens, layerOpts); /* creates the first layer */
    initLensEvents(lens);

    /* Static bounded lenses get one document-space anchor now; with the
       scroll listener disabled in static mode this is their only placement
       (resize re-anchors). Desktop lenses are placed viewport-relative at
       spawn above and corrected by the scroll sync. */
    if (GL_LENTE_STATIC && lens.bounds) syncBoundedLensPosition(lens);

    /* Suppress the back.out spawn animation when the caller wants to
       handle reveal themselves (e.g. interlude samples pre-spawned on
       idle and revealed later on scroll). Leaves the lens at opacity 0
       so it's invisible until glLente.reveal(lens) is called. */
    if (overrides && overrides.suppressSpawnAnim) {
      lensMembers(lens).forEach(function (m) {
        m.style.opacity = '0';
        m.style.visibility = 'hidden';
      });
    } else {
      gsap.fromTo(lensMembers(lens),
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)', clearProps: 'scale',
          onComplete: function () { lens.layers.forEach(function (l) { applyLayerOpacityToEl(l.layerEl, l.settings); }); } }
      );
    }

    /* Always set active — callers chaining addLayer() right after
       spawn rely on activeLens pointing to the new lens. Pre-spawned
       bounded lenses do become active during init but since they're
       invisible there's no user-facing effect; the next click on any
       visible lens (or a fresh spawn) takes over activation. */
    setActiveLens(lens);
    return lens;
  }

  /* Reveal a pre-spawned (invisible) lens via a soft fade. Used by
     gl-interlude-samples.js to animate samples into view on scroll
     without paying the back.out spawn cost at scroll-trigger time. */
  function revealLens(lens) {
    if (!lens) return;
    lens.preHidden = false; /* future addLayer calls render visible */
    var members = lensMembers(lens);
    members.forEach(function (m) { m.style.visibility = ''; });
    gsap.fromTo(members,
      { opacity: 0 },
      { opacity: 1, duration: 0.7, ease: 'power2.out', clearProps: 'opacity',
        onComplete: function () { lens.layers.forEach(function (l) { applyLayerOpacityToEl(l.layerEl, l.settings); }); } }
    );
  }

  function setActiveLens(lens) {
    activeLens = lens;
    if (!lens || !lens.el.parentNode) return;
    /* Re-append all members to bring the full lens to the front (layers first
       then circle, so the circle's specular/ring paints over the layers). */
    var parent = lens.el.parentNode;
    lens.layers.forEach(function (layer) {
      if (layer.layerEl.parentNode === parent) parent.appendChild(layer.layerEl);
    });
    parent.appendChild(lens.el);
  }

  function closeLens(lens) {
    var idx = lenses.indexOf(lens);
    if (idx < 0) return;
    lenses.splice(idx, 1);
    if (activeLens === lens) activeLens = lenses.length ? lenses[lenses.length-1] : null;
    if (lens.standbyTimer) clearTimeout(lens.standbyTimer);
    closeEditorPanel();
    var members = lensMembers(lens);
    gsap.to(members, { scale: 0.7, opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: function(){ members.forEach(function(m){ if(m.parentNode) m.parentNode.removeChild(m); }); }
    });
  }

  function lensGoFull(lens) {
    if (lens.standbyTimer) { clearTimeout(lens.standbyTimer); lens.standbyTimer = null; }
    /* Circle goes fully opaque; each LAYER returns to its own Opacidad-capa
       value (settings.layerOpacity) instead of a forced 1, which used to
       clobber the per-layer opacity on every edit. */
    gsap.to(lens.el, { opacity: 1, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    lens.layers.forEach(function (layer) {
      var o = (layer.settings.layerOpacity == null ? 100 : layer.settings.layerOpacity) / 100;
      gsap.to(layer.layerEl, { opacity: o, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    });
  }

  function lensStandby(lens) {
    if (lens.standbyTimer) clearTimeout(lens.standbyTimer);
    lens.standbyTimer = setTimeout(function () {
      if (activeLens !== lens || !editorOpen)
        gsap.to(lensMembers(lens), { opacity: 0.28, duration: 1.5, ease: 'power2.inOut' });
    }, 5000);
  }

  function initLensEvents(lens) {
    var el = lens.el;

    /* Static mode (touch / ≤991px): the lens is decorative only. Don't
       wire any interaction, and let pointer events pass straight through
       so a glass sample never blocks scrolling or taps on the content
       beneath it. The reveal-on-scroll fade still runs. */
    if (GL_LENTE_STATIC) {
      el.style.pointerEvents = 'none';
      el.style.cursor = 'default';
      return;
    }

    el.addEventListener('mouseenter', function () { lensGoFull(lens); });
    el.addEventListener('mouseleave', function () {
      lens.nearCorner = null;
      if (!lens.dragging && !lens.resizing) el.style.cursor = 'grab';
      if (!lens.dragging && !lens.resizing) lensStandby(lens);
    });

    el.addEventListener('mousemove', function (e) {
      if (lens.dragging || lens.resizing) return;
      var r = el.getBoundingClientRect(), x = e.clientX-r.left, y = e.clientY-r.top, w = r.width, h = r.height, CZ = CORNER_ZONE;
      if      (x<CZ&&y<CZ)       { lens.nearCorner='tl'; el.style.cursor='nwse-resize'; }
      else if (x>w-CZ&&y<CZ)     { lens.nearCorner='tr'; el.style.cursor='nesw-resize'; }
      else if (x<CZ&&y>h-CZ)     { lens.nearCorner='bl'; el.style.cursor='nesw-resize'; }
      else if (x>w-CZ&&y>h-CZ)   { lens.nearCorner='br'; el.style.cursor='nwse-resize'; }
      else                        { lens.nearCorner=null;  el.style.cursor='grab'; }
    });

    el.addEventListener('mousedown', function (e) {
      setActiveLens(lens);
      if (lens.nearCorner) {
        lens.resizing = true; resizeLens = lens;
        var css = parseFloat(el.style.width)||300;
        lens.resizeCX = (parseFloat(el.style.left)||0)+css/2;
        lens.resizeCY = (parseFloat(el.style.top) ||0)+css/2;
        e.preventDefault(); lensGoFull(lens); return;
      }
      lens.dragging=true; lens.didMove=false; dragLens=lens;
      lens.startMX=e.clientX; lens.startMY=e.clientY;
      lens.startEX=parseFloat(el.style.left)||0; lens.startEY=parseFloat(el.style.top)||0;
      el.style.cursor='grabbing'; e.preventDefault();
    });
  }

  /* ─── Document-level mouse handlers ─────────────────────────────── */
  document.addEventListener('mousemove', function (e) {
    if (resizeLens) {
      var L = resizeLens, dx = e.clientX-L.resizeCX, dy = e.clientY-L.resizeCY;
      var half = Math.max(90, Math.min(260, Math.sqrt(dx*dx+dy*dy)));
      /* For section-anchored lenses, cap half so the lens fits inside
         the section even at the smallest dimension. */
      if (L.bounds) {
        var br = L.bounds.getBoundingClientRect();
        half = Math.min(half, Math.floor(Math.min(br.width, br.height) / 2));
      }
      var sz = half*2;
      L.el.style.width=sz+'px'; L.el.style.height=sz+'px';
      var nx = L.resizeCX - half, ny = L.resizeCY - half;
      if (L.bounds) {
        var br2 = L.bounds.getBoundingClientRect();
        nx = Math.max(br2.left, Math.min(br2.left + br2.width  - sz, nx));
        ny = Math.max(br2.top,  Math.min(br2.top  + br2.height - sz, ny));
        L.anchorX = nx - br2.left;
        L.anchorY = ny - br2.top;
      }
      L.el.style.left = nx + 'px';
      L.el.style.top  = ny + 'px';
      syncLensMembers(L);
      reapplySkins(L); /* Realista skin SVG is sized to the lens → rebuild on resize */
      return;
    }
    if (dragLens) {
      var L = dragLens, dx = e.clientX-L.startMX, dy = e.clientY-L.startMY;
      if (Math.abs(dx)>4||Math.abs(dy)>4) { L.didMove=true; if(editorOpen)closeEditorPanel(); }
      var newX = L.startEX + dx, newY = L.startEY + dy;
      if (L.bounds) {
        /* Clamp drag to within the section. The lens position is
           expressed in viewport coords (position:fixed) but the
           clamping math has to be done against the section's current
           viewport rect since the section scrolls. We also update
           lens.anchorX/Y so the scroll listener has the right offset
           to re-apply later. */
        var br = L.bounds.getBoundingClientRect();
        var size = parseFloat(L.el.style.width) || 0;
        var minX = br.left, maxX = br.left + br.width  - size;
        var minY = br.top,  maxY = br.top  + br.height - size;
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        L.anchorX = newX - br.left;
        L.anchorY = newY - br.top;
      }
      L.el.style.left = newX + 'px';
      L.el.style.top  = newY + 'px';
      syncLensMembers(L);
    }
    /* CP 2D drag */
    if (dragging2d) { update2d(e); return; }
    if (draggingStop>=0) {
      var bar=document.getElementById('gl-cpgbar'); if(!bar)return;
      var r=bar.getBoundingClientRect(), x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
      cpGrad.stops[draggingStop].pos=Math.round(x*100); cpRender();
    }
  });

  document.addEventListener('mouseup', function () {
    if (resizeLens) { resizeLens.resizing=false; resizeLens.nearCorner=null; resizeLens.el.style.cursor='grab'; lensStandby(resizeLens); resizeLens=null; return; }
    if (dragLens)   {
      var dl=dragLens; dragLens=null; dl.dragging=false; dl.el.style.cursor='grab'; lensStandby(dl);
      if (!dl.didMove) setTimeout(openEditor,0);
      else checkMergeAfterDrag(dl); /* only after a real move */
      return;
    }
    dragging2d=false; draggingStop=-1;
  });

  /* ─── Merge-on-drop ────────────────────────────────────────────────
     If the user drops a lens with 2+ other lenses overlapping within
     MERGE_DISTANCE of its center, the layers of those others are
     absorbed into the dropped lens and the originals close out.
     Same bounds context only — bounded and free-floating don't mix. */
  var MERGE_DISTANCE = 80; /* px — center-to-center */

  function lensCenter(L) {
    var w = parseFloat(L.el.style.width)  || 0;
    var h = parseFloat(L.el.style.height) || 0;
    var x = parseFloat(L.el.style.left)   || 0;
    var y = parseFloat(L.el.style.top)    || 0;
    return { x: x + w/2, y: y + h/2 };
  }

  function checkMergeAfterDrag(target) {
    var tc = lensCenter(target);
    var nearby = [];
    for (var i = 0; i < lenses.length; i++) {
      var L = lenses[i];
      if (L === target) continue;
      /* Same context — don't mix bounded with free-floating. */
      if (!!L.bounds !== !!target.bounds) continue;
      if (L.bounds && L.bounds !== target.bounds) continue;
      var c = lensCenter(L);
      var dx = c.x - tc.x, dy = c.y - tc.y;
      if (Math.sqrt(dx*dx + dy*dy) <= MERGE_DISTANCE) nearby.push(L);
    }
    if (nearby.length < 1) return; /* need 2 total — target + 1 other */
    mergeLenses(target, nearby);
  }

  function mergeLenses(target, others) {
    /* Transfer each other lens's layers into the target. We re-parent
       the layer DOM nodes (insertBefore target.el) so they stay in the
       correct paint order and aren't removed when the source lens
       closes. */
    others.forEach(function (L) {
      L.layers.forEach(function (layer) {
        document.body.insertBefore(layer.layerEl, target.el);
        target.layers.push(layer);
      });
      L.layers = []; /* prevents closeLens from animating-then-removing them */
    });
    /* Reindex z so the absorbed layers stack above the target's
       existing ones. Re-applies the bounded/unbounded z scheme. */
    reindexLayerZ(target);
    /* Sync every layer's position to the target's current coords. */
    syncLensMembers(target);
    /* Close the source lenses (their circles fade out + remove). */
    others.forEach(closeLens);
    /* Visual feedback — quick pulse on the merged lens. */
    gsap.fromTo(lensMembers(target),
      { scale: 1.0 },
      { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut', clearProps: 'scale' }
    );
    /* Recompute backdrop-filter etc. for the freshly-stacked layers. */
    target.layers.forEach(function (layer) {
      applyAllToEl(layer.layerEl, layer.settings);
      if (target.bounds && GL_LENTE_STATIC) {
        layer.layerEl.style.backdropFilter = 'none';
        layer.layerEl.style.webkitBackdropFilter = 'none';
      }
    });
    /* Bring target to front + activate so the editor reflects the
       merged stack if the user clicks. */
    setActiveLens(target);
  }

  /* ─── Public API ─────────────────────────────────────────────────── */
  window.glLente = {
    spawn:     function (s) { return spawnLens(s); },
    close:     function ()  { if (activeLens) closeLens(activeLens); },
    closeAll:  function ()  { lenses.slice().forEach(closeLens); },
    /* Fade a pre-spawned (suppressSpawnAnim) lens into view. */
    reveal:    function (lens) { revealLens(lens); },
    /* Close every free-floating lens; preserve section-anchored ones
       (interlude samples). Used by the "Clear all" buttons in the dock
       Lente panel + each individual editor modal. */
    closeAllUnbounded: function () {
      lenses.slice().forEach(function (L) { if (!L.bounds) closeLens(L); });
    },
    isOpen:    function ()  { return lenses.length > 0; },
    count:     function ()  { return lenses.length; },
    getSettings: function () {
      var L = activeLayer(activeLens);
      return L ? Object.assign({}, L.settings) : null;
    },
    addLayer:  function (s) { if (activeLens) { addLayer(activeLens, s); if(editorOpen)syncEditor(); } },
    removeLayer: function (idx) { if (activeLens) { removeLayer(activeLens, idx); if(editorOpen)syncEditor(); } },
    moveLayer: function (fromIdx, toIdx) { if (activeLens) { moveLayer(activeLens, fromIdx, toIdx); if(editorOpen)syncEditor(); } },
    setLayer:  function (idx) { if (activeLens) { activeLens.activeLayerIdx = idx; if(editorOpen)syncEditor(); } },
    loadPreset: function (presetId) {
      /* Spawn fresh if there's no active lens OR the active one is a
         section-anchored decorative sample (interlude). Without the
         bounded check, clicking a dock preset would overwrite the
         layers of the last interlude sample (which is still the active
         lens after pre-spawn). For free-floating user lenses the
         existing "replace layers" behavior is preserved. */
      if (!activeLens || activeLens.bounds) {
        spawnLens({});
      }
      if (activeLens) {
        loadPreset(activeLens, presetId);
        if (editorOpen) { closeEditorPanel(); setTimeout(openEditor, 0); }
      }
    },
    /* Open / close the editor panel programmatically (used by the dock vitrina
       after a preset/empty-lens spawn). */
    openEditor: function () { if (!GL_LENTE_STATIC && activeLens) setTimeout(openEditor, 0); },
    closeEditor: function () { closeEditorPanel(); },
    update:    function (s) {
      if (!activeLens) return;
      var L = activeLayer(activeLens);
      if (!L) return;
      Object.assign(L.settings, s);
      applyAllToEl(L.layerEl, L.settings);
      lensGoFull(activeLens); lensStandby(activeLens);
      if (editorOpen) syncEditor();
    }
  };

  /* Keep backward compat for dock vitrina launch */
  window.glLente.launch = window.glLente.spawn;

  /* ─── CP drag state (shared) ─────────────────────────────────────── */
  var dragging2d = false, draggingStop = -1;
  function update2d(e) {
    var zone = document.getElementById('gl-cp2d'); if(!zone)return;
    var r=zone.getBoundingClientRect(), x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)), y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    var c=cpGetActive(); c.s=Math.round(x*100); c.v=Math.round((1-y)*100); cpRender();
  }

  /* ─── Floating editor ────────────────────────────────────────────── */
  var editor     = document.createElement('div');
  var editorOpen = false;
  editor.className = 'gl-lente-editor';

  function buildCpHtml() {
    return(
      '<div class="gl-cp"><div class="gl-cp-tabs"><button class="gl-cp-tab is-active" data-m="solid">Sólido</button><button class="gl-cp-tab" data-m="gradient">Gradiente</button></div>'+
      '<div class="gl-cp-grad-section" id="gl-cpgs" style="display:none">'+
        '<div class="gl-cp-gradbar-wrap"><div class="gl-cp-gradbar" id="gl-cpgbar"></div><div class="gl-cp-gradstops" id="gl-cpgstops"></div></div>'+
        '<div class="gl-cp-grad-controls"><div class="gl-cp-gradtypes"><button class="gl-cp-gradtype is-active" data-t="linear">Linear</button><button class="gl-cp-gradtype" data-t="radial">Radial</button></div>'+
        '<div class="gl-cp-angle-row" id="gl-cp-angle-row"><span class="gl-cp-label">Ángulo</span><input type="range" class="gl-cp-range" id="gl-cp-angle" min="0" max="360" value="135"><span class="gl-cp-rval" id="gl-cp-angle-v">135°</span></div></div>'+
        '<button class="gl-cp-addstop" id="gl-cp-addstop">+ Parada</button>'+
        '<div class="gl-cp-spread-row" id="gl-cp-spread-row"><span class="gl-cp-label">Difusión</span><input type="range" class="gl-cp-range" id="gl-cp-spread" min="0" max="100" value="0"><span class="gl-cp-rval" id="gl-cp-spread-v">0%</span></div>'+
      '</div>'+
      '<div class="gl-cp-2d-wrap" id="gl-cp2dw"><div class="gl-cp-2d" id="gl-cp2d"><div class="gl-cp-2d-bg" id="gl-cp2dbg"></div><div class="gl-cp-2d-dot" id="gl-cp2ddot"></div></div></div>'+
      '<div class="gl-cp-slider-row"><span class="gl-cp-label">H</span>'+
        '<div class="gl-cp-hue-track" style="position:relative;flex:1">'+
          '<div class="gl-cp-track-thumb" id="gl-cp-hue-th"></div>'+
          '<input type="range" class="gl-cp-hue-range" id="gl-cp-hue" min="0" max="360" value="220" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;margin:0;padding:0;">'+
        '</div>'+
      '</div>'+
      '<div class="gl-cp-slider-row"><span class="gl-cp-label">A</span>'+
        '<div class="gl-cp-alpha-track" id="gl-cp-alpha-track" style="position:relative;flex:1">'+
          '<div class="gl-cp-track-thumb" id="gl-cp-alpha-th"></div>'+
          '<input type="range" id="gl-cp-alpha" min="0" max="100" value="35" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;margin:0;padding:0;">'+
        '</div>'+
      '</div>'+
      '<div class="gl-cp-bottom"><div class="gl-cp-preview" id="gl-cp-preview"></div><input class="gl-cp-hex" id="gl-cp-hex" type="text" maxlength="9" spellcheck="false" placeholder="#rrggbbaa"><button class="gl-cp-clear" id="gl-cp-clear">✕</button></div>'+
      /* Intensity — opacity of the tint layer, separate from color alpha */
      '<div class="gl-cp-intensity-row">'+
        '<span class="gl-cp-label">Intensidad</span>'+
        '<input type="range" class="gl-cp-range gl-cp-intensity-range" id="gl-cp-intensity" min="0" max="100" value="0">'+
        '<span class="gl-cp-rval" id="gl-cp-intensity-v">0%</span>'+
      '</div>'+
      '</div>'
    );
  }

  function eSlider(label,id,val){return '<div class="gl-le-slider-row"><div class="gl-le-slider-head">'+label+'<span id="'+id+'-v" class="gl-le-slider-val">'+val+'%</span></div><input type="range" class="gl-lente-editor_slider" id="'+id+'" min="0" max="100" value="'+val+'"></div>';}
  function eSliderFull(label,id,val,mn,mx,unit){mn=mn||0;mx=mx||100;unit=unit||'%';return '<div class="gl-le-slider-row"><div class="gl-le-slider-head">'+label+'<span id="'+id+'-v" class="gl-le-slider-val">'+val+unit+'</span></div><input type="range" class="gl-lente-editor_slider" id="'+id+'" min="'+mn+'" max="'+mx+'" value="'+val+'"></div>';}

  function buildCatalogOptionsHTML() {
    var catalog=window.GL_LENTE_CATALOG||[];
    var cats=window.GL_LENTE_CATEGORIES||[];
    var html='';
    cats.forEach(function(cat){
      var items=catalog.filter(function(g){return g.category===cat.id;});
      html+='<div class="gl-lente-editor_cat-header" data-cat="'+cat.id+'"><span class="gl-lente-editor_cat-label">'+cat.label+'</span><span class="gl-lente-editor_cat-sub">'+cat.sub+'</span></div>';
      if(items.length===0){
        html+='<div class="gl-lente-editor_cat-empty" data-cat-empty="'+cat.id+'">'+cat.sub+'</div>';
      } else {
        items.forEach(function(g){
          var ds=g.dot.indexOf('gradient')!==-1||g.dot.indexOf('conic')!==-1?'background-image:'+g.dot:'background-color:'+g.dot;
          html+='<div class="gl-lente-editor_opt" data-type="'+g.id+'" data-cat="'+g.category+'" data-search="'+(g.name+' '+g.sub).toLowerCase()+'"><span class="gl-lente-editor_dot" style="'+ds+'"></span><span class="gl-lente-editor_name">'+g.name+'</span><span class="gl-lente-editor_sub">'+g.sub+'</span></div>';
        });
      }
    });
    return html;
  }

  /* Build the Presets row HTML — horizontal scroller of catalog compositions */
  function buildPresetsHTML() {
    var presets = window.GL_LENTE_PRESETS || [];
    if (!presets.length) return '';
    var chips = presets.map(function (p) {
      var ds = p.dot && (p.dot.indexOf('gradient') !== -1 || p.dot.indexOf('conic') !== -1)
        ? 'background-image:' + p.dot
        : 'background-color:' + (p.dot || '#444');
      return '<button class="gl-le-preset" data-preset-id="'+p.id+'" title="'+p.name+' — '+p.sub+'">' +
        '<span class="gl-le-preset-dot" style="'+ds+'"></span>' +
        '<span class="gl-le-preset-name">'+p.name+'</span>' +
        '</button>';
    }).join('');
    return '<div class="gl-le-section gl-le-presets-header" style="margin-top:0"><span class="gl-lente-editor_section-label">Presets</span></div>' +
           '<div class="gl-le-presets-row">'+chips+'</div>';
  }

  /* Emit sliders for the category of s.type — uses SLIDER_DEFS + CATEGORY_SCHEMAS */
  function buildSlidersHTML(s) {
    var schema = CATEGORY_SCHEMAS[getCategoryForType(s.type)] || CATEGORY_SCHEMAS.vidrio;
    return schema.map(function(key){
      var def = SLIDER_DEFS[key];
      if (!def) return '';
      var val = readSetting(s, key);
      if (def.min === 0 && def.max === 100 && def.unit === '%') {
        return eSlider(def.label, def.id, val);
      }
      return eSliderFull(def.label, def.id, val, def.min, def.max, def.unit);
    }).join('');
  }

  function buildEditorHTML() {
    var opts=buildCatalogOptionsHTML();
    var L  = activeLayer(activeLens);
    var s  = L ? L.settings : DEFAULT_SETTINGS();
    /* Layers panel — each row has reorder arrows + drag grip + name + opacity + delete */
    var layersHTML = '';
    if (activeLens && activeLens.layers.length > 0) {
      var lastIdx = activeLens.layers.length - 1;
      layersHTML = activeLens.layers.map(function(layer, i) {
        var isActive = i === activeLens.activeLayerIdx;
        var cat = window.GL_LENTE_CATALOG||[];
        var entry = cat.find(function(g){return g.id===layer.settings.type;});
        var name  = entry ? entry.name : layer.settings.type;
        var upDisabled   = i === 0 ? ' disabled' : '';
        var downDisabled = i === lastIdx ? ' disabled' : '';
        return '<div class="gl-le-layer'+(isActive?' is-active':'')+'" data-layer-idx="'+i+'" draggable="true">' +
          '<div class="gl-le-layer-reorder">' +
            '<button class="gl-le-layer-arrow" data-move-idx="'+i+'" data-dir="up" aria-label="Subir capa"'+upDisabled+'>▲</button>' +
            '<button class="gl-le-layer-arrow" data-move-idx="'+i+'" data-dir="down" aria-label="Bajar capa"'+downDisabled+'>▼</button>' +
          '</div>' +
          '<span class="gl-le-layer-grip" aria-hidden="true">⋮</span>' +
          '<span class="gl-le-layer-name">'+name+'</span>' +
          '<span class="gl-le-layer-opacity">'+Math.round(layer.settings.layerOpacity||100)+'%</span>' +
          '<button class="gl-le-layer-del" data-del-idx="'+i+'" aria-label="Eliminar capa">✕</button>' +
          '</div>';
      }).join('');
    }
    return(
      /* Delete-lens button — top-right corner. Removes the whole glass item. */
      '<button class="gl-lente-editor_delete" id="gl-le-delete-lens" aria-label="Eliminar lente" title="Eliminar lente">'+
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
          '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'+
          '<path d="M10 11v6M14 11v6"/>'+
        '</svg>'+
      '</button>'+
      /* Clear-all — removes every other free-floating lens (preserves
         section-anchored interlude samples + this lens itself). Sits
         next to the delete button. */
      '<button class="gl-lente-editor_clear-all" id="gl-le-clear-all" aria-label="Limpiar todas las lentes" title="Limpiar todas las lentes">'+
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
          '<polyline points="3,6 5,6 21,6"/>'+
          '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>'+
          '<line x1="9" y1="11" x2="15" y2="17"/>'+
          '<line x1="15" y1="11" x2="9" y2="17"/>'+
        '</svg>'+
      '</button>'+
      /* Dismiss button — closes the editor panel only; lens stays */
      '<button class="gl-lente-editor_dismiss" id="gl-le-dismiss" aria-label="Cerrar panel" title="Cerrar panel">✕</button>'+
      /* ── Presets — catalog product compositions ── */
      buildPresetsHTML()+
      /* ── Layer stack ── */
      '<div class="gl-le-section"><span class="gl-lente-editor_section-label">Capas</span><button class="gl-le-add-layer" id="gl-le-add">+ Capa</button></div>'+
      '<div class="gl-le-layers-list" id="gl-le-layers">'+layersHTML+'</div>'+
      '<div class="gl-le-section"><span class="gl-lente-editor_section-label">Tipo</span></div>'+
      '<div class="gl-lente-editor_select-wrap"><button class="gl-lente-editor_trigger" id="gl-le-trigger"><span class="gl-lente-editor_dot" id="gl-le-dot"></span><span class="gl-lente-editor_name" id="gl-le-name">—</span><span class="gl-lente-editor_cat-tag" id="gl-le-cat-tag"></span><span style="margin-left:auto;font-size:0.5rem;color:rgba(255,255,255,0.3)">▾</span></button>'+
      '<div class="gl-lente-editor_dropdown" id="gl-le-dropdown">'+
        '<div class="gl-lente-editor_search-wrap"><input type="text" class="gl-lente-editor_search" id="gl-le-search" placeholder="Buscar tipo…" spellcheck="false" autocomplete="off"><button class="gl-lente-editor_search-clear" id="gl-le-search-clear" type="button" aria-label="Limpiar búsqueda">✕</button></div>'+
        '<div class="gl-lente-editor_opts-list" id="gl-le-opts">'+opts+'</div>'+
        '<div class="gl-lente-editor_no-results" id="gl-le-no-results" style="display:none">Sin resultados</div>'+
      '</div></div>'+
      buildCpHtml()+
      /* "Realista" toggle. On a reeded-glass layer it switches the cheap
         native frost blur to the true lenticular DISPLACEMENT smear
         (reededDeep — heavy/software-rendered, so one lens at a time). On a
         mesh (patron) layer it's the flat→SVG metal skin. (A reeded `va` layer
         is also a mesh type, so the reeded branch must win.) */
      ((s.reeded || s.reededDeep)
        ? '<div class="gl-le-skin-row"><label class="gl-le-skin-label" title="Vidrio acanalado real (displacement) — más pesado, úsalo en una sola lente"><input type="checkbox" id="gl-le-reeded"'+(s.reededDeep?' checked':'')+'><span class="gl-le-skin-text">Realista</span><span class="gl-le-skin-switch" aria-hidden="true"></span></label></div>'
        : MESH_SKINS[s.type]
          ? '<div class="gl-le-skin-row"><label class="gl-le-skin-label"><input type="checkbox" id="gl-le-skin"'+(s.skin?' checked':'')+'><span class="gl-le-skin-text">Realista</span><span class="gl-le-skin-switch" aria-hidden="true"></span></label></div>'
          : '')+
      /* Sliders — schema-driven by the active type's category */
      '<div id="gl-le-sliders" data-category="'+getCategoryForType(s.type)+'">'+buildSlidersHTML(s)+'</div>'
    );
  }

  editor.innerHTML = buildEditorHTML();
  document.body.appendChild(editor);
  gsap.set(editor, { autoAlpha: 0, y: 10 });

  /* Load the active layer's saved tint into the color-picker state
     (cpSolid / cpGrad) so the picker UI reflects the layer's current
     color when the user activates it. Without this, switching layers
     would leave the picker showing the previous layer's color — and
     since cpRender() writes cpToCss() back to settings.tint on every
     render, the wrong color would silently overwrite the layer's
     saved tint. */
  function loadLayerIntoCp() {
    var L = activeLayer(activeLens);
    if (!L) return;
    var tint = L.settings.tint;
    if (!tint || tint === 'none') return; /* keep picker defaults */
    /* Solid rgba(r,g,b,a) / rgb(r,g,b) */
    var m = tint.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)\s*$/);
    if (m) {
      cpMode = 'solid';
      var rgb = { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
      var a = m[4] != null ? parseFloat(m[4]) : 1;
      var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      cpSolid.h = hsv.h; cpSolid.s = hsv.s; cpSolid.v = hsv.v; cpSolid.a = a;
      return;
    }
    /* Gradient: leave picker in current state — parsing CSS gradients
       is brittle and the user can re-pick if they want to edit. */
  }

  function syncEditor() {
    if (!activeLens) return;
    var L = activeLayer(activeLens);
    var s = L ? L.settings : DEFAULT_SETTINGS();
    /* Pull the active layer's tint into the picker BEFORE cpRender so
       the render reads the right color and the writeback is a no-op. */
    loadLayerIntoCp();
    var catalog=window.GL_LENTE_CATALOG||[], cats=window.GL_LENTE_CATEGORIES||[];
    var entry=catalog.find(function(g){return g.id===s.type;})||catalog[0];
    var catEntry=entry?cats.find(function(c){return c.id===entry.category;}):null;
    var dot=editor.querySelector('#gl-le-dot'), name=editor.querySelector('#gl-le-name'), catTag=editor.querySelector('#gl-le-cat-tag');
    if(dot&&entry){var ds=entry.dot.indexOf('gradient')!==-1||entry.dot.indexOf('conic')!==-1?'background-image:'+entry.dot:'background-color:'+entry.dot;dot.setAttribute('style',ds);}
    if(name&&entry)name.textContent=entry.name;
    if(catTag)catTag.textContent=catEntry?catEntry.label:'';
    function sv(id,val,unit){var el=editor.querySelector('#'+id),vl=editor.querySelector('#'+id+'-v');if(el)el.value=val;if(vl)vl.textContent=val+(unit||'%');}
    Object.keys(SLIDER_DEFS).forEach(function(key){
      var d=SLIDER_DEFS[key];
      sv(d.id, readSetting(s, key), d.unit);
    });
    /* Sync intensity slider */
    var iv=editor.querySelector('#gl-cp-intensity'),ivv=editor.querySelector('#gl-cp-intensity-v');
    if(iv)iv.value=s.tintIntensity||0;if(ivv)ivv.textContent=(s.tintIntensity||0)+'%';
    if(cpInitDone) cpRender();
  }

  /* Wire input listeners for every slider currently in the DOM.
     Safe to call whenever the #gl-le-sliders block is rebuilt — sliders not
     present in the active category are simply skipped (ws() returns early). */
  function wireSliderInputs() {
    function ws(id, key, unit) {
      var el = editor.querySelector('#'+id), vl = editor.querySelector('#'+id+'-v');
      if (!el) return;
      el.addEventListener('input', function(){
        var v = parseInt(this.value);
        if (vl) vl.textContent = v + (unit || '%');
        var u = {}; u[key] = v;
        window.glLente.update(u);
      });
      el.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    }
    /* Iterate over SLIDER_DEFS so adding a new slider only needs a SLIDER_DEFS entry. */
    Object.keys(SLIDER_DEFS).forEach(function(key){
      var d = SLIDER_DEFS[key];
      ws(d.id, key, d.unit);
    });
  }

  function wireEditor() {
    var trigger=editor.querySelector('#gl-le-trigger'), dropdown=editor.querySelector('#gl-le-dropdown');
    var searchInput=editor.querySelector('#gl-le-search'), searchClear=editor.querySelector('#gl-le-search-clear'), noResults=editor.querySelector('#gl-le-no-results');
    if(trigger)trigger.addEventListener('click',function(e){
      e.stopPropagation();
      var opening=!dropdown.classList.contains('is-open');
      dropdown.classList.toggle('is-open');
      if(opening&&searchInput){
        /* Reset search state every time dropdown opens */
        searchInput.value='';
        applySearchFilter('');
        setTimeout(function(){searchInput.focus();},20);
      }
    });

    function applySearchFilter(q){
      q=(q||'').trim().toLowerCase();
      var anyVisible=false;
      var opts=editor.querySelectorAll('.gl-lente-editor_opt');
      var catVisible={};
      opts.forEach(function(o){
        var match=!q||o.dataset.search.indexOf(q)!==-1;
        o.style.display=match?'':'none';
        if(match){anyVisible=true;catVisible[o.dataset.cat]=true;}
      });
      /* Category headers: hide if searching AND no items match in that category */
      editor.querySelectorAll('.gl-lente-editor_cat-header').forEach(function(h){
        var cid=h.dataset.cat;
        var show=!q||catVisible[cid];
        h.style.display=show?'':'none';
      });
      /* Empty-category placeholder (Texturas): only show when no search active */
      editor.querySelectorAll('.gl-lente-editor_cat-empty').forEach(function(e2){
        e2.style.display=q?'none':'';
      });
      if(noResults)noResults.style.display=(q&&!anyVisible)?'block':'none';
      if(searchClear)searchClear.style.display=q?'flex':'none';
    }

    if(searchInput){
      searchInput.addEventListener('input',function(){applySearchFilter(this.value);});
      searchInput.addEventListener('mousedown',function(e){e.stopPropagation();});
      searchInput.addEventListener('click',function(e){e.stopPropagation();});
      searchInput.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Escape'){this.value='';applySearchFilter('');}
      });
    }
    if(searchClear){
      searchClear.style.display='none';
      searchClear.addEventListener('mousedown',function(e){e.stopPropagation();});
      searchClear.addEventListener('click',function(e){e.stopPropagation();if(searchInput){searchInput.value='';applySearchFilter('');searchInput.focus();}});
    }
    if(dropdown)dropdown.querySelectorAll('.gl-lente-editor_opt').forEach(function(opt){
      opt.addEventListener('click',function(e){
        e.stopPropagation();
        var type=opt.dataset.type;
        var prevType=(activeLayer(activeLens)||{settings:{}}).settings.type;
        var prevCat=getCategoryForType(prevType);
        var nextCat=getCategoryForType(type);
        /* Load type-appropriate default slider values */
        var td=TYPE_DEFAULTS[type];
        var upd={type:type};
        if(td){upd.blur=td.blur;upd.color=td.color;}
        window.glLente.update(upd);
        /* Rebuild slider block when category changes (schema differs) */
        if(prevCat!==nextCat){
          var slidersEl=editor.querySelector('#gl-le-sliders');
          if(slidersEl){
            slidersEl.dataset.category=nextCat;
            slidersEl.innerHTML=buildSlidersHTML(activeLayer(activeLens).settings);
            wireSliderInputs();
          }
        }
        /* Load natural color preset for this glass type */
        var preset=GLASS_PRESETS[type];
        if(preset){
          cpSolid={h:preset.h,s:preset.s,v:preset.v,a:preset.a};
          cpMode='solid';
          editor.querySelectorAll('.gl-cp-tab').forEach(function(b){b.classList.remove('is-active');});
          var st=editor.querySelector('.gl-cp-tab[data-m="solid"]');if(st)st.classList.add('is-active');
          var gs=document.getElementById('gl-cpgs');if(gs)gs.style.display='none';
          var aLp=activeLayer(activeLens);if(activeLens&&aLp){aLp.settings.tintIntensity=preset.intensity;aLp.settings.tint=cpToCss();}
          cpRender();
          /* Update intensity slider */
          var iv=editor.querySelector('#gl-cp-intensity'),ivv=editor.querySelector('#gl-cp-intensity-v');
          if(iv)iv.value=preset.intensity;if(ivv)ivv.textContent=preset.intensity+'%';
        } else {
          /* No natural color — clear tint */
          var aLn=activeLayer(activeLens);if(activeLens&&aLn){aLn.settings.tint='none';aLn.settings.tintIntensity=0;applyPickerColorToEl(aLn.layerEl,aLn.settings);}
          var iv=editor.querySelector('#gl-cp-intensity'),ivv=editor.querySelector('#gl-cp-intensity-v');
          if(iv)iv.value=0;if(ivv)ivv.textContent='0%';
        }
        dropdown.classList.remove('is-open');
      });
    });

    wireSliderInputs();

    /* Realista skin toggle */
    var skinChk = editor.querySelector('#gl-le-skin');
    if (skinChk) {
      skinChk.addEventListener('mousedown', function(e){ e.stopPropagation(); });
      skinChk.addEventListener('click', function(e){ e.stopPropagation(); });
      skinChk.addEventListener('change', function(e){
        e.stopPropagation();
        window.glLente.update({ skin: this.checked });
      });
    }

    /* "Realista" reeded toggle — cheap native blur ↔ true displacement smear */
    var reededChk = editor.querySelector('#gl-le-reeded');
    if (reededChk) {
      reededChk.addEventListener('mousedown', function(e){ e.stopPropagation(); });
      reededChk.addEventListener('click', function(e){ e.stopPropagation(); });
      reededChk.addEventListener('change', function(e){
        e.stopPropagation();
        window.glLente.update({ reededDeep: this.checked });
      });
    }

    /* Preset chips — load a multi-layer composition */
    editor.querySelectorAll('.gl-le-preset').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var pid = btn.dataset.presetId;
        window.glLente.loadPreset(pid);
      });
    });

    /* Layer management */
    var addBtn=editor.querySelector('#gl-le-add');
    if(addBtn)addBtn.addEventListener('click',function(e){e.stopPropagation();window.glLente.addLayer();closeEditorPanel();setTimeout(openEditor,0);});

    /* Layer rows — click selects, ignores clicks on buttons/arrows/grip */
    editor.querySelectorAll('.gl-le-layer').forEach(function(row){
      row.addEventListener('click',function(e){
        /* Don't reactivate when the user clicked an action button */
        if(e.target.closest('.gl-le-layer-del, .gl-le-layer-arrow, .gl-le-layer-grip, .gl-le-layer-reorder'))return;
        e.stopPropagation();
        window.glLente.setLayer(parseInt(row.dataset.layerIdx));
        closeEditorPanel(); setTimeout(openEditor,0);
      });

      /* Native HTML5 drag-and-drop reorder */
      row.addEventListener('dragstart',function(e){
        var idx=parseInt(row.dataset.layerIdx);
        e.dataTransfer.effectAllowed='move';
        try { e.dataTransfer.setData('text/plain', String(idx)); } catch(_) {}
        row.classList.add('is-dragging');
      });
      row.addEventListener('dragend',function(){
        row.classList.remove('is-dragging');
        editor.querySelectorAll('.gl-le-layer.is-drag-over').forEach(function(r){r.classList.remove('is-drag-over');});
      });
      row.addEventListener('dragover',function(e){
        e.preventDefault();
        e.dataTransfer.dropEffect='move';
        row.classList.add('is-drag-over');
      });
      row.addEventListener('dragleave',function(){ row.classList.remove('is-drag-over'); });
      row.addEventListener('drop',function(e){
        e.preventDefault();
        row.classList.remove('is-drag-over');
        var from=parseInt(e.dataTransfer.getData('text/plain'));
        var to=parseInt(row.dataset.layerIdx);
        if (!isNaN(from) && !isNaN(to) && from !== to) {
          window.glLente.moveLayer(from, to);
          closeEditorPanel(); setTimeout(openEditor,0);
        }
      });
    });

    /* Layer reorder arrows */
    editor.querySelectorAll('.gl-le-layer-arrow').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        if(btn.hasAttribute('disabled')) return;
        var idx=parseInt(btn.dataset.moveIdx);
        var dir=btn.dataset.dir;
        var target = dir==='up' ? idx-1 : idx+1;
        window.glLente.moveLayer(idx, target);
        closeEditorPanel(); setTimeout(openEditor,0);
      });
    });

    /* Layer delete button (per-row) */
    editor.querySelectorAll('.gl-le-layer-del').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        window.glLente.removeLayer(parseInt(btn.dataset.delIdx));
        closeEditorPanel(); setTimeout(openEditor,0);
      });
    });

    var dismissBtn=editor.querySelector('#gl-le-dismiss');
    if(dismissBtn)dismissBtn.addEventListener('click',function(e){e.stopPropagation();closeEditorPanel();});

    /* Delete-lens button — removes the entire glass item, not just the panel */
    var deleteLensBtn=editor.querySelector('#gl-le-delete-lens');
    if(deleteLensBtn)deleteLensBtn.addEventListener('click',function(e){
      e.stopPropagation();
      closeEditorPanel();
      window.glLente.close();
    });

    /* Clear-all button — removes every free-floating lens (preserves
       section-anchored interlude samples). Closes the editor too since
       its lens may itself be removed. */
    var clearAllBtn=editor.querySelector('#gl-le-clear-all');
    if(clearAllBtn)clearAllBtn.addEventListener('click',function(e){
      e.stopPropagation();
      closeEditorPanel();
      window.glLente.closeAllUnbounded();
    });

    var closeBtn=editor.querySelector('#gl-le-close');
    if(closeBtn)closeBtn.addEventListener('click',function(e){e.stopPropagation();closeEditorPanel();window.glLente.close();});

    initCp();
    document.addEventListener('click',function(){if(dropdown)dropdown.classList.remove('is-open');});
  }

  wireEditor();

  /* ─── Color picker logic ─────────────────────────────────────────── */
  function cpRender() {
    var c=cpGetActive();
    var bg=document.getElementById('gl-cp2dbg');if(bg)bg.style.backgroundImage='linear-gradient(to top, #000 0%, transparent 100%),linear-gradient(to right, #fff 0%, hsl('+c.h+',100%,50%) 100%)';
    var dot=document.getElementById('gl-cp2ddot');if(dot){dot.style.left=c.s+'%';dot.style.top=(100-c.v)+'%';dot.style.background=hsvToRgba(c.h,c.s,c.v,1);}
    var ht=document.getElementById('gl-cp-hue-th');if(ht)ht.style.left=(c.h/360*100)+'%';
    var hi=document.getElementById('gl-cp-hue');if(hi)hi.value=c.h;
    var at=document.getElementById('gl-cp-alpha-track');if(at)at.style.backgroundImage='linear-gradient(to right, transparent, hsl('+c.h+',100%,50%))';
    var ath=document.getElementById('gl-cp-alpha-th');if(ath)ath.style.left=(c.a*100)+'%';
    var ai=document.getElementById('gl-cp-alpha');if(ai)ai.value=Math.round(c.a*100);
    var rgb=hsvToRgb(c.h,c.s,c.v),aHex=Math.round(c.a*255).toString(16).padStart(2,'0');
    var hi2=document.getElementById('gl-cp-hex');if(hi2&&document.activeElement!==hi2)hi2.value=rgbToHex(rgb.r,rgb.g,rgb.b)+aHex;
    var prev=document.getElementById('gl-cp-preview');if(prev)prev.style.backgroundColor=hsvToRgba(c.h,c.s,c.v,c.a);
    if(cpMode==='gradient'){var gb=document.getElementById('gl-cpgbar');if(gb)gb.style.backgroundImage=cpToCss();cpRenderStops();var sp=document.getElementById('gl-cp-spread'),sv=document.getElementById('gl-cp-spread-v');if(sp)sp.value=cpGrad.stops[cpGrad.active].spread;if(sv)sv.textContent=cpGrad.stops[cpGrad.active].spread+'%';}
    var css=cpToCss();
    var aLr=activeLayer(activeLens);
    if(activeLens&&aLr){
      aLr.settings.tint=css;
      applyPickerColorToEl(aLr.layerEl,aLr.settings);
      applySkinToEl(aLr.layerEl,aLr.settings); /* recolor Realista skin live from picker */
      /* Update intensity slider display */
      var iv=document.getElementById('gl-cp-intensity'),ivv=document.getElementById('gl-cp-intensity-v');
      if(iv)iv.value=aLr.settings.tintIntensity;
      if(ivv)ivv.textContent=aLr.settings.tintIntensity+'%';
    }
  }

  function cpRenderStops(){var el=document.getElementById('gl-cpgstops');if(!el)return;el.innerHTML='';cpGrad.stops.forEach(function(st,i){var s=document.createElement('div');s.className='gl-cp-stop'+(i===cpGrad.active?' is-active':'');s.style.left=st.pos+'%';s.style.backgroundColor=hsvToRgba(st.h,st.s,st.v,1);s.addEventListener('mousedown',function(e){e.stopPropagation();draggingStop=i;cpGrad.active=i;cpRender();});s.addEventListener('dblclick',function(e){e.stopPropagation();if(cpGrad.stops.length<=2)return;cpGrad.stops.splice(i,1);cpGrad.active=Math.max(0,Math.min(cpGrad.active,cpGrad.stops.length-1));cpRender();});el.appendChild(s);});}

  /* When the user actively picks a color and intensity is still 0, bump it to
     a sensible default so they see immediate visual feedback. After this
     first bump the slider behaves normally (user can drag intensity freely). */
  var CP_DEFAULT_INTENSITY = 70;
  function bumpIntensityIfZero() {
    var L = activeLayer(activeLens);
    if (!L) return;
    if (!L.settings.tintIntensity || L.settings.tintIntensity === 0) {
      L.settings.tintIntensity = CP_DEFAULT_INTENSITY;
    }
  }

  function initCp() {
    if (cpInitDone) { cpRender(); return; }
    cpInitDone = true;
    var zone2d=document.getElementById('gl-cp2d');
    if(zone2d)zone2d.addEventListener('mousedown',function(e){dragging2d=true;bumpIntensityIfZero();update2d(e);e.preventDefault();e.stopPropagation();});
    function wire(id,fn){var el=editor.querySelector('#'+id);if(el){el.addEventListener('input',fn);el.addEventListener('mousedown',function(e){e.stopPropagation();});}}
    wire('gl-cp-hue',function(){bumpIntensityIfZero();cpGetActive().h=parseInt(this.value);cpRender();});
    wire('gl-cp-alpha',function(){bumpIntensityIfZero();cpGetActive().a=parseInt(this.value)/100;cpRender();});
    wire('gl-cp-angle',function(){bumpIntensityIfZero();cpGrad.angle=parseInt(this.value);var v=document.getElementById('gl-cp-angle-v');if(v)v.textContent=this.value+'°';cpRender();});
    wire('gl-cp-spread',function(){bumpIntensityIfZero();cpGrad.stops[cpGrad.active].spread=parseInt(this.value);var v=document.getElementById('gl-cp-spread-v');if(v)v.textContent=this.value+'%';cpRender();});
    var hexIn=editor.querySelector('#gl-cp-hex');if(hexIn){hexIn.addEventListener('mousedown',function(e){e.stopPropagation();});hexIn.addEventListener('input',function(){var v=this.value.replace('#','');if(v.length<6)return;bumpIntensityIfZero();var rgb=hexToRgb(v.slice(0,6)),hsv=rgbToHsv(rgb.r,rgb.g,rgb.b),c=cpGetActive();c.h=hsv.h;c.s=hsv.s;c.v=hsv.v;if(v.length===8)c.a=parseInt(v.slice(6,8),16)/255;cpRender();});}
    var clr=editor.querySelector('#gl-cp-clear');if(clr)clr.addEventListener('click',function(e){e.stopPropagation();var aLc=activeLayer(activeLens);if(activeLens&&aLc){aLc.settings.tint='none';aLc.settings.tintIntensity=0;applyPickerColorToEl(aLc.layerEl,aLc.settings);var iv=editor.querySelector('#gl-cp-intensity'),ivv=editor.querySelector('#gl-cp-intensity-v');if(iv)iv.value=0;if(ivv)ivv.textContent='0%';}});

    /* Intensity slider — opacity of the tint layer */
    var intensEl=editor.querySelector('#gl-cp-intensity'), intensVl=editor.querySelector('#gl-cp-intensity-v');
    if(intensEl){
      intensEl.addEventListener('input',function(){
        var v=parseInt(this.value);
        if(intensVl)intensVl.textContent=v+'%';
        var aLi=activeLayer(activeLens);if(activeLens&&aLi){aLi.settings.tintIntensity=v;applyPickerColorToEl(aLi.layerEl,aLi.settings);}
      });
      intensEl.addEventListener('mousedown',function(e){e.stopPropagation();});
    }
    editor.querySelectorAll('.gl-cp-tab').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();editor.querySelectorAll('.gl-cp-tab').forEach(function(b){b.classList.remove('is-active');});btn.classList.add('is-active');cpMode=btn.dataset.m;var gs=document.getElementById('gl-cpgs');if(gs)gs.style.display=cpMode==='gradient'?'block':'none';cpRender();});});
    editor.querySelectorAll('.gl-cp-gradtype').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();editor.querySelectorAll('.gl-cp-gradtype').forEach(function(b){b.classList.remove('is-active');});btn.classList.add('is-active');cpGrad.type=btn.dataset.t;var ar=document.getElementById('gl-cp-angle-row');if(ar)ar.style.display=cpGrad.type==='linear'?'flex':'none';cpRender();});});
    var add=editor.querySelector('#gl-cp-addstop');if(add)add.addEventListener('click',function(e){e.stopPropagation();var c=cpGetActive();cpGrad.stops.push({h:c.h,s:c.s,v:c.v,a:c.a,pos:50,spread:0});cpGrad.active=cpGrad.stops.length-1;cpRender();});
    cpRender();
  }

  /* ─── Editor positioning ─────────────────────────────────────────── */
  function positionEditor() {
    if (!activeLens) return;
    var r=activeLens.el.getBoundingClientRect(), VW=window.innerWidth, VH=window.innerHeight, GAP=14;
    var EW=Math.min(352,VW-16), EH=editor.offsetHeight||520;
    var sa=r.top-GAP, sb=VH-r.bottom-GAP, sr=VW-r.right-GAP, sl=r.left-GAP;
    var p;
    if(sa>=EH)p='above';else if(sb>=EH)p='below';else if(sr>=EW)p='right';else if(sl>=EW)p='left';
    else{var m=Math.max(sa,sb,sr,sl);p=m===sa?'above':m===sb?'below':m===sr?'right':'left';}
    var cx=r.left+r.width/2, cy=r.top+r.height/2, left, top, yPct=0;
    if(p==='above'){left=Math.max(8,Math.min(VW-EW-8,cx-EW/2));top=r.top-GAP;yPct=-100;}
    else if(p==='below'){left=Math.max(8,Math.min(VW-EW-8,cx-EW/2));top=r.bottom+GAP;}
    else if(p==='right'){left=r.right+GAP;top=Math.max(8,Math.min(VH-EH-8,cy-EH/2));}
    else{left=r.left-GAP-EW;top=Math.max(8,Math.min(VH-EH-8,cy-EH/2));}
    gsap.set(editor,{xPercent:0,yPercent:yPct,left:left+'px',top:top+'px'});
    editor.classList.remove('is-below','is-right','is-left');
    if(p==='below')editor.classList.add('is-below');if(p==='right')editor.classList.add('is-right');if(p==='left')editor.classList.add('is-left');
    var dd=editor.querySelector('#gl-le-dropdown');if(dd)dd.classList.toggle('opens-down',p==='right'||p==='left');
  }

  function openEditor() {
    if (!activeLens || editorOpen) return;
    cpInitDone = false; /* reset so color picker re-wires to new DOM elements */
    /* Pull the active layer's tint into the picker BEFORE wireEditor runs
       — initCp's final cpRender (called from wireEditor) writes cpToCss()
       back to the active layer's settings, so the picker state has to
       match the layer state before that fires, or the layer's saved tint
       gets clobbered with a stale picker color. */
    loadLayerIntoCp();
    editor.innerHTML = buildEditorHTML();
    wireEditor();
    syncEditor();
    positionEditor();
    editorOpen = true;
    gsap.to(editor, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
  }

  function closeEditorPanel() {
    if (!editorOpen) return;
    editorOpen = false;
    gsap.to(editor, { autoAlpha: 0, y: 10, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
  }

  document.addEventListener('click', function (e) {
    var inEditor = editor.contains(e.target);
    var inLens   = lenses.some(function(L){ return L.el.contains(e.target); });
    if (editorOpen && !inEditor && !inLens) closeEditorPanel();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (editorOpen) closeEditorPanel(); else window.glLente.close(); }
  });

})();
