/* ════════════════════════════════════════════════════════════════════
   custom-select.js — progressive enhancement for native <select>
   Turns each <select> into a trigger + listbox panel that looks and moves
   like the navbar popover. The native <select> stays in the DOM (visually
   hidden, still focusable by label/forms.js) and is the source of truth:
   value, validity, FormData, change/input events and form.reset() all keep
   working. Opt out with data-gl-select="native".
   Public: window.glCustomSelect.enhance(el) / enhanceAll(root)
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var uid = 0;
  var openInst = null;

  function enhance(select) {
    if (!select || select.__glSelect || select.multiple || select.size > 1 ||
        select.getAttribute('data-gl-select') === 'native') return;
    select.__glSelect = true;
    uid += 1;
    var id = 'gl-select-' + uid;

    var wrap = document.createElement('div');
    wrap.className = 'gl-select';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('gl-select_native');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    var trigger = document.createElement('button');
    trigger.type = 'button';
    /* Same classes as the select so the field keeps its own look. */
    trigger.className = select.className.replace('gl-select_native', '') + ' gl-select_trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id + '-list');
    var valueEl = document.createElement('span');
    valueEl.className = 'gl-select_value';
    valueEl.id = id + '-value';
    trigger.appendChild(valueEl);

    var panel = document.createElement('div');
    panel.className = 'gl-select_panel';
    panel.id = id + '-list';
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('tabindex', '-1');

    wrap.appendChild(trigger);
    wrap.appendChild(panel);

    var label = select.id ? document.querySelector('label[for="' + select.id + '"]') : null;
    if (label) {
      if (!label.id) label.id = id + '-label';
      trigger.setAttribute('aria-labelledby', label.id + ' ' + valueEl.id);
      panel.setAttribute('aria-labelledby', label.id);
    }

    var items = [];
    var active = -1;
    var typed = '';
    var typedTimer = 0;

    function build() {
      panel.textContent = '';
      items = [];
      var opts = select.options;
      for (var i = 0; i < opts.length; i++) {
        var o = opts[i];
        var el = document.createElement('div');
        el.className = 'gl-select_option';
        el.id = id + '-opt-' + i;
        el.setAttribute('role', 'option');
        el.setAttribute('data-index', String(i));
        el.textContent = o.textContent;
        if (o.disabled) el.setAttribute('aria-disabled', 'true');
        panel.appendChild(el);
        items.push(el);
      }
      sync();
    }

    function sync() {
      var sel = select.selectedIndex;
      var o = select.options[sel];
      valueEl.textContent = o ? o.textContent : '';
      wrap.classList.toggle('is-empty', !o || o.value === '');
      for (var i = 0; i < items.length; i++) {
        var on = i === sel;
        items[i].classList.toggle('is-selected', on);
        items[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
      trigger.disabled = select.disabled;
    }

    function setActive(i, scroll) {
      if (active >= 0 && items[active]) items[active].classList.remove('is-active');
      active = i;
      if (i < 0 || !items[i]) { panel.removeAttribute('aria-activedescendant'); return; }
      items[i].classList.add('is-active');
      panel.setAttribute('aria-activedescendant', items[i].id);
      if (scroll !== false) {
        var el = items[i];
        if (el.offsetTop < panel.scrollTop) panel.scrollTop = el.offsetTop;
        else if (el.offsetTop + el.offsetHeight > panel.scrollTop + panel.clientHeight) {
          panel.scrollTop = el.offsetTop + el.offsetHeight - panel.clientHeight;
        }
      }
    }

    function enabled(i) { return items[i] && !select.options[i].disabled; }
    function step(from, dir) {
      var i = from + dir;
      while (i >= 0 && i < items.length && !enabled(i)) i += dir;
      return (i >= 0 && i < items.length) ? i : from;
    }

    /* Open downwards when there is room, upwards otherwise, and cap the
       height to the space available so it always fits the screen. */
    function place() {
      var r = wrap.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var want = Math.min(panel.scrollHeight + 2, 288);
      var below = vh - r.bottom - 16;
      var above = r.top - 16;
      var up = below < want && above > below;
      wrap.classList.toggle('opens-up', up);
      wrap.style.setProperty('--gl-select-max', Math.max(112, Math.min(288, up ? above : below)) + 'px');
    }

    /* Raise every ancestor (up to the form) above its later siblings. */
    function lift(on) {
      var stop = wrap.closest('form') || document.body;
      var el = wrap.parentElement;
      while (el && el !== document.body) {
        if (on) {
          if (getComputedStyle(el).position === 'static') el.classList.add('gl-select_lift-rel');
          el.classList.add('gl-select_lift');
        } else {
          el.classList.remove('gl-select_lift', 'gl-select_lift-rel');
        }
        if (el === stop) break;
        el = el.parentElement;
      }
    }

    function open() {
      if (select.disabled || wrap.classList.contains('is-open')) return;
      if (openInst && openInst !== api) openInst.close(false);
      openInst = api;
      place();
      lift(true);
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      setActive(select.selectedIndex >= 0 ? select.selectedIndex : step(-1, 1));
      panel.focus({ preventScroll: true });
    }

    function close(refocus) {
      if (!wrap.classList.contains('is-open')) return;
      wrap.classList.remove('is-open');
      lift(false);
      trigger.setAttribute('aria-expanded', 'false');
      setActive(-1);
      if (openInst === api) openInst = null;
      if (refocus !== false) trigger.focus({ preventScroll: true });
    }

    function choose(i) {
      if (!enabled(i)) return;
      var changed = select.selectedIndex !== i;
      select.selectedIndex = i;
      sync();
      close(true);
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    function typeahead(ch) {
      typed += ch.toLowerCase();
      clearTimeout(typedTimer);
      typedTimer = setTimeout(function () { typed = ''; }, 700);
      var n = items.length;
      var isOpen = wrap.classList.contains('is-open');
      var start = isOpen ? active : select.selectedIndex;
      var term = typed;
      /* Repeating one letter cycles through the matches. */
      if (term.length > 1 && term.split('').every(function (c) { return c === term.charAt(0); })) term = term.charAt(0);
      for (var k = 1; k <= n; k++) {
        var i = (start + k) % n;
        if (enabled(i) && select.options[i].textContent.trim().toLowerCase().indexOf(term) === 0) {
          if (isOpen) setActive(i); else choose(i);
          return;
        }
      }
    }

    function onKey(e) {
      var isOpen = wrap.classList.contains('is-open');
      var k = e.key;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { open(); return; }
        setActive(step(active, k === 'ArrowDown' ? 1 : -1));
      } else if (k === 'Home' || k === 'End') {
        if (!isOpen) return;
        e.preventDefault();
        setActive(k === 'Home' ? step(-1, 1) : step(items.length, -1));
      } else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        if (k === ' ' && typed) { typeahead(' '); return; }
        if (!isOpen) open(); else choose(active);
      } else if (k === 'Escape') {
        if (isOpen) { e.preventDefault(); e.stopPropagation(); close(true); }
      } else if (k === 'Tab') {
        if (isOpen) close(false);
      } else if (k.length === 1) {
        e.preventDefault();
        typeahead(k);
      }
    }

    trigger.addEventListener('click', function () {
      if (wrap.classList.contains('is-open')) close(true); else open();
    });
    trigger.addEventListener('keydown', onKey);
    panel.addEventListener('keydown', onKey);
    panel.addEventListener('pointermove', function (e) {
      var t = e.target.closest('.gl-select_option');
      if (t) setActive(+t.getAttribute('data-index'), false);
    });
    panel.addEventListener('click', function (e) {
      var t = e.target.closest('.gl-select_option');
      if (t) choose(+t.getAttribute('data-index'));
    });
    wrap.addEventListener('focusout', function (e) {
      if (wrap.classList.contains('is-open') && e.relatedTarget && !wrap.contains(e.relatedTarget)) close(false);
    });

    /* forms.js focuses the select to point at an invalid field: forward
       that to the trigger and mirror the invalid flag onto it. */
    select.addEventListener('focus', function () { trigger.focus(); });
    select.addEventListener('change', sync);
    new MutationObserver(function (m) {
      for (var i = 0; i < m.length; i++) {
        var a = m[i].attributeName;
        if (a === 'class') trigger.classList.toggle('is-invalid', select.classList.contains('is-invalid'));
        else if (a === 'aria-invalid') {
          if (select.hasAttribute('aria-invalid')) trigger.setAttribute('aria-invalid', select.getAttribute('aria-invalid'));
          else trigger.removeAttribute('aria-invalid');
        } else if (a === 'disabled') sync();
      }
    }).observe(select, { attributes: true, attributeFilter: ['class', 'aria-invalid', 'disabled'] });
    /* The locale switcher rewrites option text: rebuild when it changes. */
    new MutationObserver(build).observe(select, { childList: true, subtree: true, characterData: true });
    if (select.form) select.form.addEventListener('reset', function () { setTimeout(sync, 0); });

    var api = { close: close };
    build();
  }

  function enhanceAll(root) {
    var list = (root || document).querySelectorAll('select');
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }

  document.addEventListener('pointerdown', function (e) {
    if (openInst && !e.target.closest('.gl-select')) openInst.close(false);
  });
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (openInst && window.innerWidth !== lastW) openInst.close(false);
    lastW = window.innerWidth;
  });

  window.glCustomSelect = { enhance: enhance, enhanceAll: enhanceAll };

  function boot() {
    enhanceAll(document);
    new MutationObserver(function (m) {
      for (var i = 0; i < m.length; i++) {
        var added = m[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'SELECT') enhance(n);
          else if (n.querySelector && n.querySelector('select')) enhanceAll(n);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
