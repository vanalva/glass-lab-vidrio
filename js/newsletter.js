/* ════════════════════════════════════════════════════════════════════
   newsletter.js — footer newsletter subscription (faked).
   Validates the email, then shows a confirmation modal. No backend.
   Delegated on document so it survives SPA (gl-page-transition) swaps;
   guarded so re-executed body scripts don't re-bind.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__nlBooted) return;
  window.__nlBooted = true;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var FORM_SEL = '.pg-footer_newsletter-form, .gl-home_footer_newsletter-form';
  var modal = null;

  function buildModal() {
    // Re-append if a prior SPA swap removed it from <body>.
    if (modal && document.body.contains(modal)) return modal;
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'nl-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Suscripcion confirmada');
      modal.innerHTML =
        '<div class="nl-modal_backdrop" data-nl-close></div>' +
        '<div class="nl-modal_card" role="document">' +
          '<span class="nl-modal_eyebrow gl-mono">Newsletter</span>' +
          '<h3 class="nl-modal_title">¡Gracias por suscribirte!</h3>' +
          '<p class="nl-modal_text">Te avisaremos de sistemas, proyectos y novedades en <span class="nl-modal_email"></span>. Sin spam.</p>' +
          '<button type="button" class="nl-modal_close" data-nl-close>Cerrar</button>' +
        '</div>';
      modal.addEventListener('click', function (e) {
        if (e.target.closest('[data-nl-close]')) closeModal();
      });
    }
    document.body.appendChild(modal);
    return modal;
  }

  function onKey(e) { if (e.key === 'Escape') closeModal(); }

  function openModal(email) {
    var m = buildModal();
    m.querySelector('.nl-modal_email').textContent = email;
    void m.offsetWidth; // reflow so the transition plays
    m.classList.add('is-open');
    document.addEventListener('keydown', onKey);
    var btn = m.querySelector('.nl-modal_close');
    if (btn) btn.focus();
  }

  function closeModal() {
    if (modal) modal.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
  }

  function subscribe(container) {
    var input = container.querySelector('[data-nl-input]');
    var email = input ? input.value.trim() : '';
    if (!EMAIL_RE.test(email)) {
      if (input) {
        input.focus();
        input.classList.add('is-invalid');
        setTimeout(function () { input.classList.remove('is-invalid'); }, 900);
      }
      return;
    }
    openModal(email);
    if (input) input.value = '';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-nl-submit]');
    if (!btn) return;
    e.preventDefault();
    var container = btn.closest(FORM_SEL);
    if (container) subscribe(container);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var input = e.target.closest && e.target.closest('[data-nl-input]');
    if (!input) return;
    e.preventDefault();
    var container = input.closest(FORM_SEL);
    if (container) subscribe(container);
  });
})();
