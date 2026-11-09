/**
 * Colour variants for the Hairline site figures. Data only: HairlineSite.variants[key] = [{ id, label, en, hex, ral? }].
 * A figure opts in with `variants: "<key>"` (see the header of ../hairline-site.js). Needs hairline-site.js loaded first.
 *
 *   "perfil"            the 9 anodized profile finishes of Pernia (ids, names and RAL exactly as
 *                       pernia-systems.json -> family.perfilColores). hex = the colour of the METAL, SAMPLED from the finish
 *                       render src/assets/media/pernia/perfiles/<id>.webp (PIL): mask = the coloured, non-background pixels
 *                       (the neutral light backdrop and the silver end-cap dropped), then the median of the lit faces
 *                       (the darkest 30% = the slot interior and shadow, removed). Each mask was checked against the render.
 *                       Black is read from pixels darker than L 100. Blanco: the render's white faces are the same grey
 *                       as its backdrop (214 to 218), so no mask is possible; hex is the median of three hand-placed face
 *                       boxes. These are RENDERED colours (lit, in shade), so they are deeper than the paint swatch.
 *   "<piece slug>"      every furniture piece's colourways straight from pernia-mobiliario.json (pieces[].colorways):
 *                       hex as given, label = Spanish name, en = English name. Slugs: folded float noguchi-tribute perforata
 *                       arlecchino pomarosa regia biplanar acetato hashtag fraca stoa.
 *
 * Pairings (biplanar's "Amarillo · Azul"): the data gives ONE hex per pairing (the first colour). A figure that colours
 * several planes writes its own `variants` array with `colors: { tint: "#..", "tint-2": "#.." }` instead of using the key.
 */
(function () {
  const HS = (window.HairlineSite = window.HairlineSite || {});
  HS.variants = Object.assign(HS.variants || {}, {
  perfil: [
    { id: "black", label: "Black", en: "Black", hex: "#3f3f3f" },
    { id: "blanco", label: "Blanco", en: "White", ral: "RAL 9016", hex: "#d7d7d7" },
    { id: "brass", label: "Brass", en: "Brass", hex: "#8a857a" },
    { id: "burgundy", label: "Burgundy", en: "Burgundy", ral: "RAL 3007", hex: "#3d3536" },
    { id: "cobalt-blue", label: "Cobalt Blue", en: "Cobalt Blue", ral: "RAL 5013", hex: "#343641" },
    { id: "gold-rose", label: "Gold Rose", en: "Gold Rose", hex: "#9e897d" },
    { id: "marron", label: "Marrón", en: "Brown", hex: "#665e5d" },
    { id: "olive", label: "Olive", en: "Olive", ral: "RAL 6003", hex: "#43473d" },
    { id: "orange", label: "Orange", en: "Orange", ral: "RAL 8002", hex: "#724e4a" },
  ],
  "folded": [
    { id: "azul", label: "Azul", en: "Blue", hex: "#1c4281" },
    { id: "rojo", label: "Rojo", en: "Red", hex: "#b65657" },
  ],
  "float": [
    { id: "azul-petroleo", label: "Azul petróleo", en: "Petrol blue", hex: "#49768b" },
    { id: "ambar", label: "Ámbar", en: "Amber", hex: "#e9b548" },
  ],
  "noguchi-tribute": [
    { id: "ambar", label: "Ámbar", en: "Amber", hex: "#c49547" },
    { id: "verde-agua", label: "Verde agua", en: "Aqua green", hex: "#52929c" },
  ],
  "perforata": [
    { id: "azul", label: "Azul", en: "Blue", hex: "#2693d4" },
    { id: "ciruela", label: "Ciruela", en: "Plum", hex: "#7e2752" },
  ],
  "arlecchino": [
    { id: "morado", label: "Morado", en: "Purple", hex: "#560e9e" },
    { id: "naranja", label: "Naranja", en: "Orange", hex: "#d97225" },
  ],
  "pomarosa": [
    { id: "vino", label: "Vino", en: "Wine", hex: "#680243" },
    { id: "ambar", label: "Ámbar", en: "Amber", hex: "#d2a832" },
  ],
  "regia": [
    { id: "azul", label: "Azul", en: "Blue", hex: "#0d4b84" },
    { id: "ambar", label: "Ámbar", en: "Amber", hex: "#af6f28" },
  ],
  "biplanar": [
    { id: "amarillo-azul", label: "Amarillo · Azul", en: "Yellow · Blue", hex: "#e1c73e" },
    { id: "verde-amarillo-rojo", label: "Verde · Amarillo · Rojo", en: "Green · Yellow · Red", hex: "#afca47" },
    { id: "azul-rojo-esmerilado", label: "Azul · Rojo (esmerilado)", en: "Blue · Red (frosted)", hex: "#12aac2" },
    { id: "naranja-morado-esmerilado", label: "Naranja · Morado (esmerilado)", en: "Orange · Purple (frosted)", hex: "#e96d17" },
  ],
  "acetato": [
    { id: "ambar", label: "Ámbar", en: "Amber", hex: "#d6a614" },
    { id: "rojo", label: "Rojo", en: "Red", hex: "#a8121b" },
    { id: "azul-noche", label: "Azul noche", en: "Night blue", hex: "#1c2d51" },
  ],
  "hashtag": [
    { id: "amarillo", label: "Amarillo", en: "Yellow", hex: "#e0ca5b" },
    { id: "rosa", label: "Rosa", en: "Pink", hex: "#dd66a8" },
  ],
  "fraca": [
    { id: "azul", label: "Azul", en: "Blue", hex: "#1c96c7" },
    { id: "naranja", label: "Naranja", en: "Orange", hex: "#d97e22" },
  ],
  "stoa": [
    { id: "bronce", label: "Bronce", en: "Bronze", hex: "#8a5a2e" },
    { id: "bronce-oscuro", label: "Bronce oscuro", en: "Dark bronze", hex: "#5a3f2a" },
    { id: "humo", label: "Humo", en: "Smoke", hex: "#8c8a85" },
    { id: "grafito", label: "Grafito", en: "Graphite", hex: "#4a4946" },
  ],
  });
})();
