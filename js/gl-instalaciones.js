(function () {
  "use strict";

  const assetRoot = "assets/media/glass-lab/instalaciones/";

  // The installations archive — curated photographs of real Glass Lab glass
  // work in situ (colour panels, gradient partitions, reeded doors, sculptural
  // mirrors, tinted tables + reception desks, glass staircases). Optimised
  // through the media pipeline (WebP, capped 1920w). The literal assetRoot
  // directory above is what build-web.js scans to copy the whole folder into
  // the deploy — keep it as a plain string.
  function buildArchive(count) {
    return Array.from({ length: count }, function (_, index) {
      const file = "instalacion-" + String(index + 1).padStart(2, "0") + ".webp";
      return {
        set: "",
        sequence: index + 1,
        file: file,
        // Full-size (≤1920px) is ONLY for the lightbox. The grid tile is ~282px
        // and the list image ~384px — pointing those at the full-size file meant
        // ~63 tiles x up to 1920x2560 ≈ 930MB of decoded bitmap, which Chrome
        // evicts under pressure, leaving tiles blank. Thumbs fix that.
        src: assetRoot + file,
        thumb: assetRoot + "thumbs/" + file
      };
    });
  }

  const photos = buildArchive(66);

  function modulo(value, length) {
    return ((value % length) + length) % length;
  }

  function padNumber(value) {
    return String(value).padStart(2, "0");
  }

  function getGridMetrics() {
    if (window.innerWidth <= 478) {
      return { itemWidth: 176, itemHeight: 128, columnGap: 18, rowGap: 18 };
    }
    if (window.innerWidth <= 767) {
      return { itemWidth: 210, itemHeight: 152, columnGap: 20, rowGap: 20 };
    }
    if (window.innerWidth <= 991) {
      return { itemWidth: 240, itemHeight: 172, columnGap: 22, rowGap: 22 };
    }
    return { itemWidth: 280, itemHeight: 202, columnGap: 24, rowGap: 24 };
  }

  function initInstallationsGallery() {
    const root = document.querySelector(".gl-installations");
    if (!root) return;

    const stage = root.querySelector(".gl-installations_grid-stage");
    const plane = root.querySelector(".gl-installations_grid-plane");
    const gridPanel = root.querySelector(".gl-installations_grid-panel");
    const listPanel = root.querySelector(".gl-installations_list-panel");
    const list = root.querySelector(".gl-installations_list");
    const status = root.querySelector(".gl-installations_status");
    const viewButtons = Array.from(root.querySelectorAll("[data-installations-view]"));
    if (!stage || !plane || !gridPanel || !listPanel || !list || !viewButtons.length) return;

    let currentView = "grid";
    let offsetX = 0;
    let offsetY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let isDragging = false;
    let dragMoved = false;
    let pointerId = null;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let lastMoveTime = 0;
    let inertiaFrame = null;
    const visibleTiles = new Map();

    root.dataset.photoCount = String(photos.length);

    function createTile(photo, index) {
      const tile = document.createElement("article");
      const image = document.createElement("img");
      const label = document.createElement("div");
      const name = document.createElement("span");
      const count = document.createElement("span");

      tile.className = "gl-installations_grid-item";
      tile.dataset.photoIndex = String(index);
      tile.setAttribute("role", "button");
      tile.setAttribute("tabindex", "0");
      tile.setAttribute("aria-label", "Ampliar fotografía " + (index + 1) + " de " + photos.length);
      image.className = "gl-installations_grid-image";
      image.src = photo.thumb || photo.src;
      image.alt = photo.set || "";
      image.loading = "lazy";
      image.decoding = "async";
      image.draggable = false;
      label.className = "gl-installations_grid-label gl-mono gl-mono_label";
      name.textContent = photo.set;
      count.className = "gl-installations_grid-count";
      count.textContent = padNumber(index + 1) + " / " + padNumber(photos.length);
      label.appendChild(name);
      label.appendChild(count);
      tile.appendChild(image);
      tile.appendChild(label);

      tile.addEventListener("mouseenter", function () {
        image.classList.add("gl-installations_grid-image-hover");
      });
      tile.addEventListener("mouseleave", function () {
        image.classList.remove("gl-installations_grid-image-hover");
      });

      return tile;
    }

    function updateDiagnostics() {
      stage.dataset.glOffsetX = offsetX.toFixed(2);
      stage.dataset.glOffsetY = offsetY.toFixed(2);
      stage.dataset.glDragging = String(isDragging);
    }

    function renderGrid() {
      if (currentView !== "grid") return;

      const metrics = getGridMetrics();
      const cellWidth = metrics.itemWidth + metrics.columnGap;
      const cellHeight = metrics.itemHeight + metrics.rowGap;
      const startColumn = Math.floor(-offsetX / cellWidth) - 1;
      const endColumn = startColumn + Math.ceil(stage.clientWidth / cellWidth) + 3;
      const startRow = Math.floor(-offsetY / cellHeight) - 1;
      const endRow = startRow + Math.ceil(stage.clientHeight / cellHeight) + 3;
      const required = new Set();

      for (let row = startRow; row <= endRow; row += 1) {
        for (let column = startColumn; column <= endColumn; column += 1) {
          const key = row + ":" + column;
          const photoIndex = modulo(row * 17 + column * 11, photos.length);
          const photo = photos[photoIndex];
          let tile = visibleTiles.get(key);

          required.add(key);
          if (!tile) {
            tile = createTile(photo, photoIndex);
            tile.dataset.gridRow = String(row);
            tile.dataset.gridColumn = String(column);
            plane.appendChild(tile);
            visibleTiles.set(key, tile);
          }

          tile.style.width = metrics.itemWidth + "px";
          tile.style.height = metrics.itemHeight + "px";
          tile.style.transform = "translate3d(" + (column * cellWidth + offsetX) + "px," + (row * cellHeight + offsetY) + "px,0px)";
        }
      }

      visibleTiles.forEach(function (tile, key) {
        if (!required.has(key)) {
          tile.remove();
          visibleTiles.delete(key);
        }
      });

      updateDiagnostics();
    }

    function buildList() {
      const fragment = document.createDocumentFragment();

      photos.forEach(function (photo, index) {
        const item = document.createElement("article");
        const image = document.createElement("img");
        const name = document.createElement("h3");
        const count = document.createElement("span");

        item.className = "gl-installations_list-item";
        item.dataset.photoIndex = String(index);
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-label", "Ampliar fotografía " + (index + 1) + " de " + photos.length);
        image.className = "gl-installations_list-image";
        image.src = photo.thumb || photo.src;
        image.alt = photo.set || "";
        image.loading = "lazy";
        image.decoding = "async";
        name.className = "gl-installations_list-name";
        name.textContent = photo.set;
        count.className = "gl-installations_list-count gl-mono gl-mono_label";
        count.textContent = padNumber(index + 1) + " / " + padNumber(photos.length);
        item.appendChild(image);
        item.appendChild(name);
        item.appendChild(count);
        fragment.appendChild(item);
      });

      list.appendChild(fragment);
    }

    function setView(nextView, savePreference) {
      currentView = nextView === "list" ? "list" : "grid";
      const showGrid = currentView === "grid";

      gridPanel.classList.toggle("gl-installations_panel-hidden", !showGrid);
      listPanel.classList.toggle("gl-installations_panel-hidden", showGrid);
      viewButtons.forEach(function (button) {
        const active = button.dataset.installationsView === currentView;
        const wrap = button.closest(".gl-btn_skew_wrap");
        button.setAttribute("aria-pressed", String(active));
        if (wrap) wrap.classList.toggle("gl-btn_skew_wrap_filled", active);
      });
      if (status) {
        status.textContent = photos.length + " fotografías · Vista " + (showGrid ? "retícula" : "lista");
      }
      if (savePreference) {
        try {
          sessionStorage.setItem("gl-installations:view", currentView);
        } catch (error) {}
      }
      if (showGrid) requestAnimationFrame(renderGrid);
    }

    /* ── Ambient drift ──────────────────────────────────────────────
       The retícula creeps slowly on its own so the archive reads as a
       living plane instead of a static wall. It yields to the user:
       any drag/inertia stops it, and it fades back in once things
       settle. Paused when the grid is off-screen or the tab is hidden,
       and disabled entirely under prefers-reduced-motion. */
    const DRIFT_X = -0.14;   // px per frame (~8px/s at 60fps)
    const DRIFT_Y = -0.05;
    const DRIFT_RESUME_MS = 1400;

    const reduceMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    let driftFrame = null;
    let driftEase = 0;          // 0..1, eases drift in so it never snaps
    let driftHoldUntil = 0;
    let stageOnScreen = true;

    function driftAllowed() {
      return currentView === "grid" &&
        stageOnScreen &&
        !document.hidden &&
        !isDragging &&
        !inertiaFrame &&
        !(reduceMotion && reduceMotion.matches);
    }

    function driftStep(now) {
      if (!driftAllowed()) {
        driftEase = 0;
        driftFrame = requestAnimationFrame(driftStep);
        return;
      }
      if (now < driftHoldUntil) {
        driftEase = 0;
        driftFrame = requestAnimationFrame(driftStep);
        return;
      }
      driftEase = Math.min(1, driftEase + 0.02);
      offsetX += DRIFT_X * driftEase;
      offsetY += DRIFT_Y * driftEase;
      renderGrid();
      driftFrame = requestAnimationFrame(driftStep);
    }

    function startDrift() {
      if (driftFrame) return;
      driftFrame = requestAnimationFrame(driftStep);
    }

    function holdDrift() {
      driftEase = 0;
      driftHoldUntil = performance.now() + DRIFT_RESUME_MS;
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { stageOnScreen = entry.isIntersecting; });
      }, { threshold: 0 }).observe(stage);
    }

    function stopInertia() {
      if (inertiaFrame) {
        cancelAnimationFrame(inertiaFrame);
        inertiaFrame = null;
      }
    }

    function startInertia() {
      stopInertia();

      function step() {
        velocityX *= 0.92;
        velocityY *= 0.92;
        if (Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01) {
          inertiaFrame = null;
          return;
        }
        offsetX += velocityX * 16;
        offsetY += velocityY * 16;
        renderGrid();
        inertiaFrame = requestAnimationFrame(step);
      }

      inertiaFrame = requestAnimationFrame(step);
    }

    // Resolve the grid tile under a screen point. Tile children (image,
    // label) are pointer-events:none, so elementFromPoint returns the tile
    // <article> itself.
    let tapTile = null;
    function tileFromPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      return el ? el.closest(".gl-installations_grid-item") : null;
    }

    stage.addEventListener("pointerdown", function (event) {
      if (currentView !== "grid") return;
      stopInertia();
      holdDrift();
      isDragging = true;
      dragMoved = false;
      tapTile = tileFromPoint(event.clientX, event.clientY);
      pointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      lastMoveTime = performance.now();
      velocityX = 0;
      velocityY = 0;
      stage.classList.add("gl-installations_grid-stage-dragging");
      try {
        stage.setPointerCapture(pointerId);
      } catch (error) {}
      updateDiagnostics();
      event.preventDefault();
    });

    stage.addEventListener("pointermove", function (event) {
      if (!isDragging || event.pointerId !== pointerId) return;
      const now = performance.now();
      const elapsed = Math.max(16, now - lastMoveTime);
      const deltaX = event.clientX - lastPointerX;
      const deltaY = event.clientY - lastPointerY;

      offsetX += deltaX;
      offsetY += deltaY;
      velocityX = deltaX / elapsed;
      velocityY = deltaY / elapsed;
      dragMoved = dragMoved || Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      lastMoveTime = now;
      renderGrid();
    });

    function releasePointer(event) {
      if (!isDragging || (event.pointerId !== undefined && event.pointerId !== pointerId)) return;
      isDragging = false;
      stage.classList.remove("gl-installations_grid-stage-dragging");
      try {
        stage.releasePointerCapture(pointerId);
      } catch (error) {}
      pointerId = null;
      updateDiagnostics();
      if (dragMoved) {
        startInertia();
      } else if (event.type === "pointerup") {
        // A tap (no drag) opens the lightbox. Resolve the tile from the
        // pointer position, not the click event — pointer capture +
        // preventDefault on pointerdown make the synthesised click's target
        // retarget to the stage, so a click-based closest() misses the tile.
        const tile = tapTile || tileFromPoint(event.clientX, event.clientY);
        if (tile && tile.dataset.photoIndex) {
          lbOpenAt(Number(tile.dataset.photoIndex));
        }
      }
      tapTile = null;
    }

    stage.addEventListener("pointerup", releasePointer);
    stage.addEventListener("pointercancel", releasePointer);
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("resize", function () {
      requestAnimationFrame(renderGrid);
    });

    viewButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setView(button.dataset.installationsView, true);
      });
    });

    buildList();

    let savedView = "grid";
    try {
      savedView = sessionStorage.getItem("gl-installations:view") || "grid";
    } catch (error) {}
    /* ── Lightbox ───────────────────────────────────────────────────
       Ratio-agnostic viewer: the frame adapts to whatever the photo is
       (portrait, landscape, square, panorama). The image is never
       cropped — it is contained inside the viewport with max-width /
       max-height, so any aspect ratio is honoured as-is. */
    let lbIndex = 0;
    let lbOpen = false;
    let lastFocused = null;

    const lb = document.createElement("div");
    lb.className = "gl-lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Visor de instalaciones");
    lb.hidden = true;
    lb.innerHTML =
      '<div class="gl-lightbox_backdrop" data-lb-close></div>' +
      '<div class="gl-lightbox_frame">' +
        '<figure class="gl-lightbox_figure">' +
          '<img class="gl-lightbox_image" alt="" decoding="async">' +
          '<figcaption class="gl-lightbox_caption">' +
            '<span class="gl-mono gl-mono_label gl-lightbox_set"></span>' +
            '<span class="gl-mono gl-mono_muted gl-lightbox_count"></span>' +
          '</figcaption>' +
        '</figure>' +
      '</div>' +
      '<button type="button" class="gl-lightbox_close" data-lb-close aria-label="Cerrar visor">' +
        '<span class="gl-mono gl-mono_label gl-lightbox_close-label">Cerrar</span>' +
        '<span class="gl-lightbox_close-icon" aria-hidden="true"></span>' +
      '</button>' +
      '<button type="button" class="gl-lightbox_nav gl-lightbox_nav-prev" data-lb-prev aria-label="Fotografía anterior">' +
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<button type="button" class="gl-lightbox_nav gl-lightbox_nav-next" data-lb-next aria-label="Siguiente fotografía">' +
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 4L14 10L8 16" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>';
    document.body.appendChild(lb);

    const lbImage = lb.querySelector(".gl-lightbox_image");
    const lbSet = lb.querySelector(".gl-lightbox_set");
    const lbCount = lb.querySelector(".gl-lightbox_count");
    const lbFigure = lb.querySelector(".gl-lightbox_figure");

    function lbRender() {
      const photo = photos[modulo(lbIndex, photos.length)];
      if (!photo) return;
      lbFigure.classList.add("gl-lightbox_figure-loading");
      lbImage.src = photo.src;
      lbImage.alt = photo.set ? photo.set + " — instalación" : "Instalación de Glass Lab";
      lbSet.textContent = photo.set || "Archivo";
      lbCount.textContent = padNumber(modulo(lbIndex, photos.length) + 1) + " / " + padNumber(photos.length);
    }

    lbImage.addEventListener("load", function () {
      lbFigure.classList.remove("gl-lightbox_figure-loading");
      /* Hand the real ratio to CSS so the frame hugs the photo whatever
         its shape — no letterboxing, no cropping. */
      if (lbImage.naturalWidth && lbImage.naturalHeight) {
        lbFigure.style.setProperty("--lb-ratio", lbImage.naturalWidth + " / " + lbImage.naturalHeight);
      }
    });

    function lbOpenAt(index) {
      lbIndex = modulo(index, photos.length);
      lastFocused = document.activeElement;
      lb.hidden = false;
      lbOpen = true;
      document.body.classList.add("gl-lightbox-lock");
      lbRender();
      requestAnimationFrame(function () { lb.classList.add("gl-lightbox-visible"); });
      const closeBtn = lb.querySelector(".gl-lightbox_close");
      if (closeBtn) closeBtn.focus();
    }

    function lbClose() {
      lbOpen = false;
      lb.classList.remove("gl-lightbox-visible");
      document.body.classList.remove("gl-lightbox-lock");
      window.setTimeout(function () { if (!lbOpen) lb.hidden = true; }, 200);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function lbGo(step) {
      if (!lbOpen) return;
      lbIndex = modulo(lbIndex + step, photos.length);
      lbRender();
    }

    lb.addEventListener("click", function (event) {
      // closest() so a click on the inner <svg>/<path>/label still resolves
      // to the control button.
      if (event.target.closest("[data-lb-close]")) lbClose();
      else if (event.target.closest("[data-lb-prev]")) lbGo(-1);
      else if (event.target.closest("[data-lb-next]")) lbGo(1);
    });

    document.addEventListener("keydown", function (event) {
      if (!lbOpen) return;
      if (event.key === "Escape") { lbClose(); }
      else if (event.key === "ArrowLeft") { lbGo(-1); }
      else if (event.key === "ArrowRight") { lbGo(1); }
      else if (event.key === "Tab") {
        /* Simple focus trap — keep tabbing inside the dialog */
        const focusables = lb.querySelectorAll("button");
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
        else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
      }
    });

    /* Swipe between photos on touch */
    let lbTouchX = null;
    lb.addEventListener("touchstart", function (e) { lbTouchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (lbTouchX === null) return;
      const dx = e.changedTouches[0].clientX - lbTouchX;
      if (Math.abs(dx) > 45) lbGo(dx < 0 ? 1 : -1);
      lbTouchX = null;
    }, { passive: true });

    /* Grid tiles open via the pointerup tap handler above (a click-based
       handler is unreliable here — see releasePointer). */

    /* List rows */
    list.addEventListener("click", function (event) {
      const item = event.target.closest(".gl-installations_list-item");
      if (!item || !item.dataset.photoIndex) return;
      lbOpenAt(Number(item.dataset.photoIndex));
    });

    /* Keyboard: Enter / Space opens the focused tile or row */
    function keyOpen(event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target.closest("[data-photo-index]");
      if (!target) return;
      event.preventDefault();
      lbOpenAt(Number(target.dataset.photoIndex));
    }
    stage.addEventListener("keydown", keyOpen);
    list.addEventListener("keydown", keyOpen);

    setView(savedView, false);
    startDrift();

    window.__glInstallationsGallery = {
      count: photos.length,
      setView: function (view) {
        setView(view, false);
      },
      getState: function () {
        return {
          view: currentView,
          offsetX: offsetX,
          offsetY: offsetY,
          visibleTiles: visibleTiles.size,
          isDragging: isDragging
        };
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInstallationsGallery);
  } else {
    initInstallationsGallery();
  }
})();
