const header = document.getElementById('site-header');
const menu = document.getElementById('nav-menu');
const toggle = document.getElementById('nav-toggle');
if (header && menu && toggle) {
  const mobile = matchMedia('(max-width:900px)');
  let modelFromMenu = false;
  const syncOffset = () => document.documentElement.style.setProperty('--header-offset', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  const syncMenuCap = () => {
    if (!header.classList.contains('nav-open')) return;
    const bottomPadding = parseFloat(getComputedStyle(header).paddingBottom) || 0;
    const available = Math.max(44, innerHeight - menu.getBoundingClientRect().top - bottomPadding);
    menu.style.setProperty('--nav-available-height', `${available}px`);
  };
  const close = (returnFocus = false) => {
    header.classList.remove('nav-open');
    menu.style.removeProperty('--nav-available-height');
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus({ preventScroll: true });
    menu.inert = mobile.matches;
    syncOffset();
  };
  const sync = () => {
    const hadMenuFocus = menu.contains(document.activeElement);
    toggle.hidden = !mobile.matches;
    close(mobile.matches && hadMenuFocus);
  };
  toggle.addEventListener('click', () => {
    if (header.classList.contains('nav-open')) close();
    else {
      menu.inert = false;
      header.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      syncMenuCap();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('nav-open')) {
      event.preventDefault(); close(true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!header.contains(event.target) && header.classList.contains('nav-open')) close(menu.contains(document.activeElement));
  });
  document.addEventListener('focusin', event => {
    if (!header.contains(event.target) && header.classList.contains('nav-open')) close();
  });
  document.querySelectorAll('#nav-menu a[href^="#"], .hero-links a[href^="#"], .skip-link[href^="#"]').forEach(link => link.addEventListener('click', () => {
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    close();
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }));
  document.getElementById('model-button')?.addEventListener('click', () => {
    modelFromMenu = mobile.matches && header.classList.contains('nav-open');
    if (modelFromMenu) close(true);
  }, { capture: true });
  document.getElementById('model-dialog')?.addEventListener('close', () => {
    if (modelFromMenu) { modelFromMenu = false; toggle.focus({ preventScroll: true }); }
  });
  document.getElementById('hero-model-button')?.addEventListener('click', () => document.getElementById('model-button')?.click());
  mobile.addEventListener('change', sync);
  sync();
  header.dataset.navigationReady = 'true';
  syncOffset();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { syncMenuCap(); syncOffset(); }).observe(header);
  else window.addEventListener('resize', syncOffset);
  window.addEventListener('resize', syncMenuCap);
}
