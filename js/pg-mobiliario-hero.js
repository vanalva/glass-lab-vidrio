/* Mobiliario hero float shuffle — picks 5 distinct random renders for the
   floating hero slots on each load.

   The pool is the PERNIA STUDIO 2022 catalogue: two views of each of the
   eleven pieces, plus the four Biplanar colourways. It replaced a pool of AI
   renders of pieces that do not exist in the catalogue ("Console Table",
   "Mesa de Comedor", and three separate "mesitas" that were really Biplanar
   colourways) — do not reintroduce those.

   This lives in a real .js file (not an inline <script>) on purpose: the
   deploy build (plugin/scripts/build-web.js) copies assets referenced as
   HTML img-src, in JSON, or as literal paths inside src/js/*.js — but it does
   NOT scan inline <script> blocks. It also cannot match paths that contain
   spaces, which is why every filename here is hyphenated (the old pool lost
   half its images to exactly that). */
(function () {
  "use strict";
  var base = (window.__FLWR_BASE__||"")+"assets/media/pernia/catalogo/";
  var slugs = ["folded", "float", "noguchi-tribute", "perforata", "arlecchino",
               "pomarosa", "regia", "biplanar", "acetato", "hashtag", "fraca"];
  var pool = [];
  slugs.forEach(function (slug) {
    pool.push(base + slug + "-render-a.webp");
    pool.push(base + slug + "-render-b.webp");
  });
  pool.push(base + "biplanar-amarillo-azul.webp");
  pool.push(base + "biplanar-verde-amarillo-rojo.webp");
  pool.push(base + "biplanar-azul-rojo.webp");
  pool.push(base + "biplanar-naranja-morado.webp");

  var imgs = document.querySelectorAll(".gl-lab_hero_float_img");
  if (!imgs.length) return;
  for (var i = pool.length - 1; i > 0; i--) {        // Fisher–Yates
    var j = Math.floor(Math.random() * (i + 1));
    var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  imgs.forEach(function (img, k) { img.src = pool[k % pool.length]; });
})();
