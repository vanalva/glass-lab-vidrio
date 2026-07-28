/* ════════════════════════════════════════════════════════════════════
   forms.js — real contact-form submitter (gl-contacto / pg-contacto).
   Posts the form to its own Formspree endpoint via fetch, so the page
   never navigates away, and reports back in Spanish through the
   [data-gl-form-status] region (aria-live="polite").

   Unlike newsletter.js — which fakes it — this one actually submits.
   Each form declares its own copy via data-gl-form-success /
   data-gl-form-error so Glass Lab can speak "tú" and Pernia "usted".

   Delegated on document so it survives SPA (gl-page-transition) swaps;
   guarded so re-executed body scripts don't re-bind. No dependencies.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FORM_SEL = '[data-gl-form]';
  var PLACEHOLDER_ID = 'REPLACE_WITH_FORMSPREE_ID';

  var COPY = {
    pending: 'Enviando...',
    success: 'Mensaje enviado. Gracias por escribirnos — respondemos en menos de 24 horas hábiles.',
    error: 'No pudimos enviar el mensaje. Vuelve a intentarlo en un momento o escríbenos por correo.',
    unconfigured: 'El formulario aún no está conectado. Escríbenos por correo mientras lo activamos.',
    missing: 'Falta completar: ',
    badEmail: 'Revisa el correo electrónico: no parece una dirección válida.',
    invalid: 'Revisa el campo marcado antes de enviar.'
  };

  /* ── helpers ──────────────────────────────────────────────────────── */

  function statusNode(form) {
    return form.querySelector('[data-gl-form-status]');
  }

  function say(form, message, state) {
    var node = statusNode(form);
    if (!node) return;
    node.textContent = message || '';
    node.classList.remove('is-pending', 'is-success', 'is-error');
    if (state) node.classList.add('is-' + state);
  }

  /* Visible label text for a control, so the error message can name it. */
  function labelFor(control) {
    var label = control.id ? control.form.querySelector('label[for="' + control.id + '"]') : null;
    if (!label) label = control.closest('label');
    var text = label ? label.textContent.trim() : '';
    return text.replace(/\s*\(opcional\)\s*$/i, '').toLowerCase();
  }

  function flagInvalid(control) {
    control.classList.add('is-invalid');
    control.setAttribute('aria-invalid', 'true');
    control.focus();
    setTimeout(function () { control.classList.remove('is-invalid'); }, 1600);
  }

  function clearFlags(form) {
    var flagged = form.querySelectorAll('[aria-invalid]');
    for (var i = 0; i < flagged.length; i++) {
      flagged[i].removeAttribute('aria-invalid');
      flagged[i].classList.remove('is-invalid');
    }
  }

  /* The form carries novalidate — we do the checking so the messages
     stay in Spanish and land in the aria-live region. */
  function firstInvalid(form) {
    var controls = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < controls.length; i++) {
      var c = controls[i];
      if (c.name === '_gotcha' || c.type === 'hidden' || c.disabled) continue;
      if (!c.checkValidity()) return c;
    }
    return null;
  }

  function messageFor(control) {
    if (control.validity.valueMissing) {
      var name = labelFor(control);
      return name ? COPY.missing + name + '.' : COPY.invalid;
    }
    if (control.type === 'email' && control.validity.typeMismatch) return COPY.badEmail;
    return COPY.invalid;
  }

  /* ── submit ───────────────────────────────────────────────────────── */

  function setPending(form, pending) {
    var button = form.querySelector('[data-gl-form-submit]');
    var label = form.querySelector('[data-gl-form-submit-label]');
    if (!button) return;
    button.disabled = pending;
    button.setAttribute('aria-busy', pending ? 'true' : 'false');
    button.classList.toggle('is-sending', pending);
    if (!label) return;
    if (pending) {
      if (!label.dataset.idleLabel) label.dataset.idleLabel = label.textContent;
      label.textContent = COPY.pending;
    } else if (label.dataset.idleLabel) {
      label.textContent = label.dataset.idleLabel;
    }
  }

  function send(form) {
    var endpoint = form.getAttribute('action') || '';
    var success = form.getAttribute('data-gl-form-success') || COPY.success;
    var failure = form.getAttribute('data-gl-form-error') || COPY.error;

    /* Nothing to post to yet — say so instead of firing a doomed request. */
    if (endpoint.indexOf(PLACEHOLDER_ID) !== -1) {
      say(form, form.getAttribute('data-gl-form-unconfigured') || COPY.unconfigured, 'error');
      return;
    }

    setPending(form, true);
    say(form, COPY.pending, 'pending');

    fetch(endpoint, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        if (res.ok) return null;
        /* Formspree answers 4xx with {errors:[{message}]} — surface it. */
        return res.json().then(function (data) {
          var first = data && data.errors && data.errors[0];
          throw new Error((first && first.message) || 'HTTP ' + res.status);
        }, function () {
          throw new Error('HTTP ' + res.status);
        });
      })
      .then(function () {
        form.reset();
        clearFlags(form);
        say(form, success, 'success');
      })
      .catch(function () {
        say(form, failure, 'error');
      })
      .then(function () {
        setPending(form, false);
      });
  }

  function onSubmit(e) {
    var form = e.target.closest && e.target.closest(FORM_SEL);
    if (!form) return;
    e.preventDefault();

    /* Honeypot filled → a bot. Play dead, drop the payload. */
    var trap = form.querySelector('[name="_gotcha"]');
    if (trap && trap.value) {
      say(form, form.getAttribute('data-gl-form-success') || COPY.success, 'success');
      return;
    }

    clearFlags(form);
    var bad = firstInvalid(form);
    if (bad) {
      say(form, messageFor(bad), 'error');
      flagInvalid(bad);
      return;
    }

    send(form);
  }

  /* ── boot ─────────────────────────────────────────────────────────── */

  function boot() {
    if (!document.querySelector(FORM_SEL)) return;
    if (window.__glFormsBooted) return;
    window.__glFormsBooted = true;
    document.addEventListener('submit', onSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
