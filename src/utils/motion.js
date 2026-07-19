// ============================================
// Motion — scroll-reveal + stagger (IntersectionObserver)
// Markers:  [data-reveal]   [data-stagger]
// ============================================
(function () {
  const REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    // Assign stagger index to direct children of stagger groups
    document.querySelectorAll('[data-reveal][data-stagger]').forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        child.style.setProperty('--stagger', i);
      });
    });

    if (REDUCE || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    els.forEach((el) => io.observe(el));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
