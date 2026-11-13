/* Places Hairline figures on the Pernia pages. The kernel, runtime, variants and figure files are loaded by
   real <script defer> tags on each page (build-web only bundles referenced files); this file runs after them. */
(function () {
  "use strict";
  // Works with file names (pg-sistemas.html) and with the clean URLs the live sites use (/sistemas).
  var page = (location.pathname.split("/").pop() || "index").replace(/\.html$/, "");
  if (page === "index") page = "pg-index";
  if (!/^pg-/.test(page)) page = "pg-" + page;
  var qs = new URLSearchParams(location.search);

  // ---- figure name -> file ------------------------------------------------------------------------------------------
  var FILE = { pivote: "pivote", abatible: "abatible", gabinete: "gabinete", perfiles: "perfiles", corte: "corte",
    perforata: "perforata", arlecchino: "arlecchino", folded: "folded", float: "float", noguchi: "noguchi", pomarosa: "pomarosa",
    regia: "regia", stoa: "stoa", biplanar: "biplanar", acetato: "acetato", hashtag: "hashtag", fraca: "fraca" };
  function fileFor(name) { return /^pglass-[1-4][a-d]$/.test(name) ? "puerta" : FILE[name]; }
  function sysFig(code) {
    code = String(code || "").toLowerCase();
    if (code === "pglass-piv") return "pivote";
    if (code === "pglass-swi") return "abatible";
    if (code === "pglass-cab") return "gabinete";
    return /^pglass-[1-4][a-d]$/.test(code) ? code : null;
  }
  function pieceFig(slug) {
    slug = String(slug || "").toLowerCase().replace(/-tribute$/, "");
    return FILE[slug] && !/^(pivote|abatible|gabinete|perfiles|corte)$/.test(slug) ? slug : null;
  }

  // ---- styles -------------------------------------------------------------------------------------------------------
  var css = document.createElement("style");
  css.textContent =
    ".hlp-block{grid-column:1/-1;width:100%;box-sizing:border-box;max-width:var(--max-width--main,1400px);margin:0 auto;" +
    "padding:48px var(--site--margin,24px);--hls-muted:color-mix(in srgb,currentColor 62%,transparent);--hls-ink:currentColor}" +
    ".hlp-block.is-flush{padding-inline:0}" +
    ".hlp-label{display:block;margin:0 0 14px}" +
    ".hlp-slot{min-height:320px}" +
    "@media (max-width:767px){.hlp-block{padding-inline:0;padding-block:32px}.hlp-label{padding-inline:16px}}" +
    ".hlp-block .hls-stage[data-hairline]{--hl-plate:var(--hlp-bg)!important;background:var(--hlp-bg)!important;border:0!important;border-radius:0!important;box-shadow:none!important}" +
    ".hlp-block .hls-hint,.hlp-block .hls-disc,.hlp-block .hls-vname,.hlp-block .hls-mode{font-family:var(--hlp-font,inherit)!important;font-size:13px;letter-spacing:0}" +
    ".hlp-block .hls-read{font-family:var(--hlp-mono,ui-monospace,monospace)!important;letter-spacing:.04em;text-transform:uppercase}" +
    "@media (min-width:768px){.hlp-block .hls{width:min(100%,1000px,calc(92svh * var(--hls-ar-n,1.25)))}.hlp-block .hls-meta,.hlp-block .hls-pick,.hlp-block .hls-modes,.hlp-block .hls-disc{margin-inline:0}}";
  document.head.appendChild(css);
  // ---- slots --------------------------------------------------------------------------------------------------------
  var slots = [];
  function addSlot(host, where, fig, label, opts) {
    if (!host || !fig) return null;
    var block = document.createElement("div");
    block.className = "hlp-block" + (opts && opts.flush ? " is-flush" : "");
    block.setAttribute("data-hlp-fig", fig);
    var l = document.createElement("span");
    l.className = "gl-section-number hlp-label"; l.textContent = label;
    var slot = document.createElement("div");
    slot.className = "hlp-slot";
    block.append(l, slot);
    if (where === "before" && opts && opts.ref) host.insertBefore(block, opts.ref); else host.appendChild(block);
    slots.push({ block: block, slot: slot, fig: fig, opts: opts || {} });
    return block;
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function sectionByText(sel, re) { return $$(sel).filter(function (s) { return re.test(s.textContent); })[0]; }
  function codeIn(sec) { var m = sec.textContent.match(/pglass-(?:[1-4][a-d]|piv|swi|CAB)/i); return m && m[0]; }

  function layout() {
    if (page === "pg-sistema") {
      var s = sysFig(qs.get("code") || "pglass-1a");
      var ov = $(".pg-sistema_overview");
      if (s && ov) addSlot(ov, "end", s, "Figura // " + (qs.get("code") || "pglass-1a"));
      var sw = $(".pg-sistema_colors_inner .pg-sistema_swatches");
      if (sw) addSlot(sw.parentNode, "before", "perfiles", "Figura // Nueve acabados", { ref: sw, flush: true });
    } else if (page === "pg-mueble") {
      var p = pieceFig(qs.get("slug") || qs.get("code") || "perforata");
      var ov2 = $(".pg-sistema_overview");
      if (p && ov2) addSlot(ov2, "end", p, "Figura // Pieza");
    } else if (page === "pg-sistemas") {
      $$(".pg-mob_feature").forEach(function (sec) {
        var f = sysFig(codeIn(sec));
        var inner = $(".pg-mob_feature_inner", sec);
        if (f && inner) addSlot(inner, "end", f, "Figura // " + codeIn(sec));
      });
      var sw2 = $(".pg-sistema_colors .pg-sistema_swatches");
      if (sw2) addSlot(sw2.parentNode, "before", "perfiles", "Figura // Nueve acabados", { ref: sw2, flush: true });
    } else if (page === "pg-mobiliario") {
      $$(".pg-mob_feature").forEach(function (sec) {
        var a = $("a[href*='mueble']", sec);
        var m = a && a.getAttribute("href").match(/slug=([^&]+)/);
        var f = m && pieceFig(m[1]);
        var inner = $(".pg-mob_feature_inner", sec);
        if (f && inner) addSlot(inner, "end", f, "Figura // " + $(".pg-mob_feature_title", sec).textContent.trim());
      });
    } else if (page === "pg-index") {
      var feat = $(".pg-index_featured");
      if (feat) { var f2 = sysFig(codeIn(feat)); if (f2) addSlot(feat, "end", f2, "Figura // " + codeIn(feat)); }
      var perf = $(".pg-index_perfiles");
      if (perf) addSlot(perf, "end", "perfiles", "Figura // Nueve acabados");
    } else if (page === "pg-laboratorio") {
      var conf = sectionByText("section.gl-lab_process", /Configuraciones/);
      if (conf) addSlot(conf, "end", "pglass-4a", "Figura // Configuración 4 paneles", { flush: true });
      var fund = sectionByText("section.gl-values", /Fundamentos/);
      if (fund) addSlot(fund, "end", "corte", "Figura // Corte del perfil");
      var sw3 = $(".pg-sistema_colors .pg-sistema_swatches");
      if (sw3) addSlot(sw3.parentNode, "before", "perfiles", "Figura // Nueve acabados", { ref: sw3, flush: true });
    }
  }

  // ---- theme: darkest opaque ancestor background decides -------------------------------------------------------------
  function bgOf(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = getComputedStyle(n).backgroundColor, m = c.match(/[\d.]+/g);
      if (m && m.length >= 3 && !(m.length > 3 && +m[3] === 0)) return c;
    }
    return "#ede7dd";
  }
  function themeOf(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = getComputedStyle(n).backgroundColor, m = c.match(/[\d.]+/g);
      if (m && m.length >= 3 && !(m.length > 3 && +m[3] === 0)) {
        var l = (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255;
        return l < 0.45 ? "dark" : "light";
      }
    }
    return "light";
  }

  // ---- mounting ------------------------------------------------------------------------------------------------------
  // A figure that changes size moves everything below it, so the page's GSAP ScrollTriggers (the pinned theme
  // transition on pg-index) must re-measure, or they fire in the wrong place: the CTA vanishes and the pin stops midway.
  var refreshTimer = 0;
  function refreshTriggers() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }, 200);
  }
  var ro = "ResizeObserver" in window ? new ResizeObserver(refreshTriggers) : null;

  function mount(item) {
    if (item.done) return; item.done = true;
    Promise.resolve().then(function () {
      var f = window.HairlineSite.figures[item.fig];
      if (!f) throw new Error("figura ausente: " + item.fig);
      item.slot.style.minHeight = "";
      var cs = getComputedStyle(document.body);
      item.block.style.setProperty("--hlp-bg", bgOf(item.block));
      item.block.style.setProperty("--hlp-font", cs.fontFamily);
      var mono = $(".gl-mono"); if (mono) item.block.style.setProperty("--hlp-mono", getComputedStyle(mono).fontFamily);
      item.handle = window.HairlineSite.mount(item.slot, f, { theme: themeOf(item.block) });
      window.__hlpMounted = (window.__hlpMounted || []).concat(item.fig);
      if (ro) ro.observe(item.block); else refreshTriggers();
    }).catch(function (e) { console.error(e); });
  }

  function start() {
    layout();
    window.__hlpSlots = slots;
    if (!slots.length) return;
    // Mount every figure up front (two to four per page): their final heights are in place before the page's own
    // load-time ScrollTrigger.refresh(), instead of arriving mid-scroll and shifting the layout under a pin.
    slots.forEach(mount);
  }
  function ready() { start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();
