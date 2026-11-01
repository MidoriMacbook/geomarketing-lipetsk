// Постепенное улучшение: статический текст и все модули приложения независимы.
(() => {
  const mount = document.getElementById('hero-motion-root');
  if (!mount || mount.dataset.heroLoading) return;
  mount.dataset.heroLoading = 'true';
  const load = () => import('/static/vendor/hero/hero-motion.js').catch(() => {
    mount.dataset.heroState = 'fallback';
  });
  // Отложенному скрипту DOM уже доступен. Плитки и запросы API не должны
  // задерживать появление первого экрана до события window load.
  load();
})();
