const header = document.getElementById('site-header');
const menu = document.getElementById('nav-menu');
const toggle = document.getElementById('nav-toggle');
if (header && menu && toggle) {
  const mobile = matchMedia('(max-width:900px)'), reduce = matchMedia('(prefers-reduced-motion:reduce)');
  const items = menu.querySelector('.nav-items'), indicator = menu.querySelector('.nav-indicator');
  const links = [...menu.querySelectorAll('a[href^="#"]')];
  let modelFromMenu = false, navigationTimer, pendingNavigation;
  const syncOffset = () => document.documentElement.style.setProperty('--header-offset', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  const syncMenuCap = () => {
    menu.style.setProperty('--nav-available-height', `${Math.max(44, innerHeight - header.getBoundingClientRect().bottom - 16)}px`);
  };
  const cancelNavigation = () => { clearTimeout(navigationTimer); pendingNavigation = null; };
  const updateIndicator = () => {
    if (mobile.matches) return;
    const active = links.find(link => link.classList.contains('active') && !link.hidden);
    if (!active) { indicator.style.opacity = '0'; return; }
    indicator.style.opacity = '1';
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.height = `${active.offsetHeight}px`;
    indicator.style.transform = `translate(${active.offsetLeft}px,${active.offsetTop}px)`;
  };
  const setActive = link => {
    links.forEach(item => {
      item.classList.toggle('active', item === link);
      if (item === link) item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    });
    updateIndicator();
  };
  const close = (returnFocus = false) => {
    cancelNavigation();
    header.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus || (mobile.matches && menu.contains(document.activeElement))) toggle.focus({ preventScroll:true });
    menu.inert = mobile.matches;
    if (mobile.matches) menu.setAttribute('aria-hidden', 'true');
    else menu.removeAttribute('aria-hidden');
  };
  const sync = () => {
    const hadMenuFocus = menu.contains(document.activeElement);
    toggle.hidden = !mobile.matches;
    close(mobile.matches && hadMenuFocus);
    syncMenuCap(); syncOffset(); updateIndicator();
  };
  toggle.addEventListener('click', () => {
    cancelNavigation();
    if (header.classList.contains('nav-open')) close();
    else {
      menu.inert = false; menu.removeAttribute('aria-hidden');
      syncMenuCap(); header.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('nav-open')) { event.preventDefault(); close(true); }
  });
  document.addEventListener('pointerdown', event => {
    if (!header.contains(event.target) && header.classList.contains('nav-open')) close(menu.contains(document.activeElement));
  });
  document.addEventListener('focusin', event => {
    if (!header.contains(event.target) && header.classList.contains('nav-open')) close();
  });
  document.querySelectorAll('#nav-menu a[href^="#"], .hero-links a[href^="#"], .skip-link[href^="#"]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    const wait = mobile.matches && header.classList.contains('nav-open') && !reduce.matches;
    close();
    const navigate = () => {
      pendingNavigation = null;
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      history.pushState(null, '', link.hash);
      target.focus({ preventScroll:true });
      target.scrollIntoView({ behavior:reduce.matches ? 'instant' : 'smooth', block:'start' });
      if (links.includes(link)) setActive(link);
    };
    if (wait) { pendingNavigation = navigate; navigationTimer = setTimeout(navigate, 300); }
    else navigate();
  }));
  reduce.addEventListener('change', () => {
    if (reduce.matches && pendingNavigation) { clearTimeout(navigationTimer); pendingNavigation(); }
  });
  document.getElementById('model-button')?.addEventListener('click', () => {
    modelFromMenu = mobile.matches && header.classList.contains('nav-open');
    if (modelFromMenu) close(true);
  }, { capture:true });
  document.getElementById('model-dialog')?.addEventListener('close', () => {
    if (modelFromMenu) { modelFromMenu = false; toggle.focus({ preventScroll:true }); }
  });
  document.getElementById('hero-model-button')?.addEventListener('click', () => document.getElementById('model-button')?.click());
  const updateSection = () => {
    const edge = header.getBoundingClientRect().bottom + innerHeight * .25;
    let active = links[0];
    for (const link of links) {
      const section = document.getElementById(link.hash.slice(1));
      if (!link.hidden && section && !section.hidden && section.getBoundingClientRect().top <= edge &&
          (!active || section.getBoundingClientRect().top > document.getElementById(active.hash.slice(1)).getBoundingClientRect().top)) active = link;
    }
    setActive(active);
  };
  mobile.addEventListener('change', sync);
  sync(); header.dataset.navigationReady = 'true'; syncOffset();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { syncMenuCap(); syncOffset(); updateIndicator(); }).observe(header);
    new ResizeObserver(updateIndicator).observe(items);
  }
  window.addEventListener('resize', () => { syncMenuCap(); syncOffset(); updateIndicator(); });
  window.addEventListener('scroll', updateSection, {passive:true});
  document.fonts?.ready.then(updateIndicator);
}
