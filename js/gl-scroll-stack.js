/* ════════════════════════════════════════════════════════════════════
   gl-scroll-stack.js — mobile scroll-driven panel stack.

   On phones a stack of panels (the "Un espectro de materia" spectrum,
   and anything else tagged the same way) reads as a dead list: every
   panel is the same short height and the desktop hover-to-expand does
   nothing on touch. This pins the stack and lets scroll drive it —
   one panel expands at a time, the rest stay as slim edges, so you
   pass through the whole set in a single sticky moment.

   Opt in from markup, no per-section JS:

       <div class="…_panels" data-gl-scroll-stack>   ← direct children are the panels

   Optional tuning attribute on the same element:
       data-gl-scroll-stack-pace="45"   ← svh of scroll per panel (default 45)

   Geometry is CSS's job (see .gl-scroll-stack rules in project.css);
   this file only decides WHICH panel is active. Active panel gets
   `.is-active`; the expansion itself is a CSS flex-grow transition, so
   it stays smooth and interruptible instead of being tweened per frame.

   Mobile only. Desktop keeps its existing hover behaviour untouched.
   Honours prefers-reduced-motion by not engaging at all.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.__GL_SCROLL_STACK_BOOTED__) return;
    window.__GL_SCROLL_STACK_BOOTED__ = true;

    var stacks = [].slice.call(document.querySelectorAll('[data-gl-scroll-stack]'));
    if (!stacks.length) return;

    var mqMobile = window.matchMedia('(max-width: 767px)');
    var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    var DEFAULT_PACE = 45;   // svh of scroll runway per panel
    var ACTIVE_SVH  = 56;   // height of the expanded panel (must stay >= 50)
    var engaged = false;
    var entries = [];
    var ticking = false;

    function buildEntries() {
        entries = stacks.map(function (stack) {
            var items = [].slice.call(stack.children).filter(function (n) {
                return n.nodeType === 1;
            });
            /* The runway lives on the nearest section: the header scrolls away
               normally, then the stack pins for the rest of that height. */
            var host = stack.closest('section') || stack.parentElement;
            var pace = parseFloat(stack.getAttribute('data-gl-scroll-stack-pace')) || DEFAULT_PACE;
            return { stack: stack, items: items, host: host, pace: pace, last: -1 };
        }).filter(function (e) { return e.items.length > 1 && e.host; });
    }

    function engage() {
        if (engaged) return;
        engaged = true;
        entries.forEach(function (e) {
            e.stack.classList.add('gl-scroll-stack');
            e.host.classList.add('gl-scroll-stack_host');
            /* Runway = one viewport for the pin itself + pace per panel. */
            e.host.style.setProperty('--gl-stack-runway',
                'calc(100svh + ' + (e.items.length * e.pace) + 'svh)');
            /* The active panel is pinned to ACTIVE_SVH; the remainder is split
               evenly across the others. Only JS knows the panel count, so it
               owns this half of the geometry — the CSS just consumes it. */
            var rest = (100 - ACTIVE_SVH) / Math.max(1, e.items.length - 1);
            e.stack.style.setProperty('--gl-stack-active', ACTIVE_SVH + 'svh');
            e.stack.style.setProperty('--gl-stack-rest', rest.toFixed(3) + 'svh');
        });
        update();
    }

    function disengage() {
        if (!engaged) return;
        engaged = false;
        entries.forEach(function (e) {
            e.stack.classList.remove('gl-scroll-stack');
            e.host.classList.remove('gl-scroll-stack_host');
            e.host.style.removeProperty('--gl-stack-runway');
            e.stack.style.removeProperty('--gl-stack-active');
            e.stack.style.removeProperty('--gl-stack-rest');
            e.items.forEach(function (el) { el.classList.remove('is-active'); });
            e.last = -1;
        });
    }

    function update() {
        if (!engaged) return;
        var vh = window.innerHeight;
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var r = e.host.getBoundingClientRect();
            var travel = r.height - vh;          // distance the stack stays pinned
            if (travel <= 0) continue;
            var scrolled = Math.min(Math.max(-r.top, 0), travel);
            var p = scrolled / travel;
            /* Bias slightly so the first panel is already active as the stack
               pins, and the last one still reads before the section releases. */
            var idx = Math.floor(p * e.items.length);
            if (idx > e.items.length - 1) idx = e.items.length - 1;
            if (idx < 0) idx = 0;
            if (idx === e.last) continue;
            e.last = idx;
            for (var j = 0; j < e.items.length; j++) {
                e.items[j].classList.toggle('is-active', j === idx);
            }
        }
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () { ticking = false; update(); });
    }

    function sync() {
        if (mqMobile.matches && !mqReduce.matches) engage();
        else disengage();
    }

    buildEntries();
    if (!entries.length) return;

    sync();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { sync(); update(); }, { passive: true });

    /* Re-evaluate when the user crosses the breakpoint or flips reduced-motion
       mid-session — several modules in this project read matchMedia once at
       load and go stale; this one shouldn't. */
    var onMq = function () { sync(); update(); };
    if (mqMobile.addEventListener) {
        mqMobile.addEventListener('change', onMq);
        mqReduce.addEventListener('change', onMq);
    } else if (mqMobile.addListener) {
        mqMobile.addListener(onMq);
        mqReduce.addListener(onMq);
    }
})();
