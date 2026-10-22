// Progressive enhancement: static text and all app modules are independent.
(() => {
  const mount = document.getElementById('hero-motion-root');
  if (!mount || mount.dataset.heroLoading) return;
  mount.dataset.heroLoading = 'true';
  const load = () => import('/static/vendor/hero/hero-motion.js').catch(() => {
    mount.dataset.heroState = 'fallback';
  });
  const schedule = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(load,{timeout:350});
    else setTimeout(load,0);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load',schedule,{once:true});
})();
