/* ════════════════════════════════════════════════════════════════════
   gl-reviews.js — Google reviews carousel for the "09 // Clientes"
   section. Content is hardcoded in the HTML (verbatim review text);
   this only handles slide rotation + the counter.

   The counter is derived from the number of [data-review-slide]
   elements, so adding a review = duplicating a slide in the markup.
   No JS change needed.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function initReviews(root) {
    if (root._glReviewsInit) return;
    root._glReviewsInit = true;

    var slides = root.querySelectorAll('[data-review-slide]');
    var counter = root.querySelector('[data-reviews-counter]');
    var prev = root.querySelector('[data-reviews-prev]');
    var next = root.querySelector('[data-reviews-next]');
    if (!slides.length) return;

    var total = slides.length;
    var index = 0;

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function show(i) {
      index = (i + total) % total;
      for (var s = 0; s < total; s++) {
        slides[s].classList.toggle('is-active', s === index);
      }
      if (counter) counter.textContent = pad(index + 1) + ' / ' + pad(total);
    }

    if (prev) prev.addEventListener('click', function () { show(index - 1); });
    if (next) next.addEventListener('click', function () { show(index + 1); });

    /* Hide the arrows entirely when there's only one review */
    if (total < 2) {
      if (prev) prev.style.display = 'none';
      if (next) next.style.display = 'none';
    }

    show(0);
  }

  function initAll() {
    var nodes = document.querySelectorAll('[data-gl-reviews]');
    for (var i = 0; i < nodes.length; i++) { initReviews(nodes[i]); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
