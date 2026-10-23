// Progressive enhancement: static text and all app modules are independent.
(() => {
  const mount = document.getElementById('hero-motion-root');
  if (!mount || mount.dataset.heroLoading) return;
  mount.dataset.heroLoading = 'true';
  const load = () => import('/static/vendor/hero/hero-motion.js').catch(() => {
    mount.dataset.heroState = 'fallback';
  });
  // This deferred script already has the DOM. Tiles and API requests must not
  // postpone the first-screen entrance until the window load event.
  load();
})();
