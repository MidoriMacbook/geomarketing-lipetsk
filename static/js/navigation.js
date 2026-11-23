export function focusWorkspaceMap() {
  document.dispatchEvent(new Event('gm:map-focus'));
  const target=document.getElementById('map-title');
  if(!target)return;
  target.tabIndex=-1;target.focus({preventScroll:true});
  target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
}

const header = document.getElementById('site-header');
const menu = document.getElementById('nav-menu');
const toggle = document.getElementById('nav-toggle');
if (header && menu && toggle) {
  const mobile = matchMedia('(max-width:900px)'), reduce = matchMedia('(prefers-reduced-motion:reduce)');
  const items = menu.querySelector('.nav-items'), indicator = menu.querySelector('.nav-indicator');
  const links = [...menu.querySelectorAll('a[href^="#"]')];
  const dialog = document.getElementById('mobile-navigation');
  const closeButton = document.getElementById('nav-close');
  let lockedScroll, revision=0, closeTimer, closeResolve, firstFrame, secondFrame;
  const cancelTransition=()=>{
    revision++;clearTimeout(closeTimer);cancelAnimationFrame(firstFrame);cancelAnimationFrame(secondFrame);
    closeResolve?.(false);closeResolve=undefined;
  };
  const isolate=open=>{
    const root = document.documentElement;
    if (open) {
      lockedScroll = window.scrollY;
      root.style.setProperty('--nav-scroll-top', `-${lockedScroll}px`);
    }
    root.dataset.navOpen = String(open);
    if (!open && lockedScroll !== undefined) {
      window.scrollTo({ top: lockedScroll, behavior: 'instant' });
      root.style.removeProperty('--nav-scroll-top');
      lockedScroll = undefined;
    }
  };
  let modelFromMenu = false;
  // Подложка шапки и её градиент также закрывают содержимое при переходе к якорю.
  const syncOffset = () => {
    const reserve=header.closest('.header-reserve');
    const fade=reserve?parseFloat(getComputedStyle(reserve,'::after').height)||0:0;
    document.documentElement.style.setProperty('--header-offset', `${Math.ceil(header.getBoundingClientRect().bottom+fade)}px`);
  };
  const syncViewport = () => {
    if (!dialog.open) return;
    const viewport = window.visualViewport;
    dialog.style.setProperty('--nav-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    dialog.style.setProperty('--nav-viewport-height', `${viewport?.height ?? innerHeight}px`);
  };
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
  const close = (returnFocus = false, immediate = false) => {
    const wasOpen = dialog.open;
    const wasFocused = dialog.contains(document.activeElement);
    cancelTransition();
    header.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    dialog.dataset.phase='closing';
    const finish=()=>{
      if(dialog.open)dialog.close();
      isolate(false);dialog.dataset.phase='closed';
      if (mobile.matches && (returnFocus || wasFocused)) toggle.focus({ preventScroll:true });
    };
    if(!wasOpen||immediate){finish();return Promise.resolve(true);}
    return new Promise(resolve=>{closeResolve=resolve;closeTimer=setTimeout(()=>{closeResolve=undefined;finish();resolve(true);},200);});
  };
  const sync = () => {
    close(false,true);
    toggle.hidden = !mobile.matches;
    if (mobile.matches) dialog.append(menu);
    else header.append(menu);
    syncOffset(); updateIndicator();
  };
  toggle.addEventListener('click', () => {
    if (!mobile.matches) return;
    if (dialog.open&&dialog.dataset.phase!=='closing') { close(true); return; }
    cancelTransition();const current=revision;
    if(!dialog.open){dialog.dataset.phase='opening';dialog.showModal();isolate(true);}
    header.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    syncViewport();
    closeButton.focus({ preventScroll:true });
    firstFrame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(()=>{if(current===revision&&dialog.open)dialog.dataset.phase='open';});});
  });
  dialog.addEventListener('close', () => { if (!dialog.open && lockedScroll !== undefined) close(true,true); });
  closeButton.addEventListener('click', () => close(true));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(true); });
  let backdropPress = false;
  dialog.addEventListener('pointerdown', event => { backdropPress = event.target === dialog; });
  dialog.addEventListener('click', event => {
    if (!backdropPress || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(true);
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [closeButton, ...links.filter(link => !link.hidden)];
    const current = controls.indexOf(document.activeElement);
    const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0)
      : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    event.preventDefault();
    controls[next].focus({ preventScroll:true });
    controls[next].scrollIntoView({ block:'nearest' });
  });
  let swipeStart;
  dialog.addEventListener('touchstart', event => {
    if (event.touches.length === 1 && dialog.scrollHeight === dialog.clientHeight) swipeStart = event.touches[0].clientY;
  }, { passive:true });
  dialog.addEventListener('touchend', event => {
    if (swipeStart !== undefined && swipeStart - event.changedTouches[0].clientY > 60) close(true);
    swipeStart = undefined;
  }, { passive:true });
  dialog.addEventListener('touchcancel', () => { swipeStart = undefined; });
  document.querySelectorAll('#nav-menu a[href^="#"], .header-cta, .atlas-coordinates a, .hero-links a[href^="#"], .workspace-return a[href^="#"], .skip-link[href^="#"]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    const navigate = () => {
      history.pushState(null, '', link.hash);
      if(target.id==='map-title')focusWorkspaceMap();
      else {
        if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
        target.focus({ preventScroll:true });
        target.scrollIntoView({ behavior:reduce.matches ? 'instant' : 'smooth', block:'start' });
      }
      if (links.includes(link)) setActive(link);
    };
    if(dialog.open)close().then(finished=>{if(finished)navigate();});else navigate();
  }));
  document.getElementById('model-button')?.addEventListener('click', () => {
    modelFromMenu = mobile.matches && header.classList.contains('nav-open');
    if (modelFromMenu) close(false,true);
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
    new ResizeObserver(() => { syncOffset(); updateIndicator(); }).observe(header);
    new ResizeObserver(updateIndicator).observe(items);
  }
  window.addEventListener('resize', () => { syncViewport(); syncOffset(); updateIndicator(); });
  window.visualViewport?.addEventListener('resize',syncViewport);
  window.visualViewport?.addEventListener('scroll',syncViewport);
  window.addEventListener('scroll', updateSection, {passive:true});
  document.fonts?.ready.then(updateIndicator);
}
