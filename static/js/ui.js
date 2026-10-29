export const $ = id => document.getElementById(id);
export const fmt = n => Math.round(n).toLocaleString('ru-RU');
export const coords = p => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
export const distance = n => n === null ? 'Не найдены в данных области' : `${fmt(n)} м`;
export const STORAGE_KEY = 'geomarketing.saved.v1';
export const LIMITATIONS = 'Население оценено по площади и этажности домов. Расстояния по прямой. Данные OpenStreetMap могут быть неполными или устаревшими. Модель не учитывает аренду, наличие помещений, пешеходные маршруты, доходы и поток посетителей. Относительную оценку нельзя сравнивать между разными расчётами.';
export const node = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
export const button = (text, className, action) => {
  const b = node('button', className, text);
  b.type = 'button';
  b.addEventListener('click', action);
  return b;
};
export const dateText = value => value ? new Date(value).toLocaleDateString('ru-RU') : 'Не указана';
export const sourceText = source => source === 'demo' ? 'Демонстрационные данные' : `OpenStreetMap${source === 'cache' ? ', сохранённая копия' : ''}`;

export function showError(message) {
  $('error').textContent = message;
  $('error').hidden = false;
  reveal($('error'), 'notice');
}

export function storageStatus(message) {
  $('storage-status').textContent = message;
  $('storage-status').hidden = false;
  reveal($('storage-status'), 'notice');
}

export function dataDate(data) {
  const dates = Object.values(data.data_meta || {}).map(i => i.fetched_at).filter(Number.isFinite);
  return dates.length ? new Date(Math.min(...dates) * 1000).toISOString() : null;
}

// Motion never owns visibility, focus or application state. A cancelled animation
// simply exposes the final DOM, and every temporary snapshot has its own cleanup.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const effects = new Map(), snapshots = new Map(), pendingReveals = new Map();
let revealObserver;
let motionTokens, progressRevision = 0, motionReady = false;
function tokens() {
  if (motionTokens) return motionTokens;
  const styles = getComputedStyle(document.documentElement);
  const milliseconds = (name, fallback) => {
    const value = styles.getPropertyValue(name).trim();
    return value ? parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) : fallback;
  };
  motionTokens = {
    fast: milliseconds('--motion-fast', 140), base: milliseconds('--motion-base', 220),
    slow: milliseconds('--motion-slow', 420), workspace: milliseconds('--motion-workspace', 300), stagger: milliseconds('--motion-stagger', 75),
    standard: styles.getPropertyValue('--ease-standard').trim() || 'cubic-bezier(.2,0,0,1)',
    emphasized: styles.getPropertyValue('--ease-emphasized').trim() || 'cubic-bezier(.2,0,0,1)',
    spring: styles.getPropertyValue('--ease-spring').trim() || 'cubic-bezier(.2,.8,.2,1)'
  };
  return motionTokens;
}
export const motionReduced = () => reducedMotion.matches || matchMedia('print').matches;
export const motionStagger = () => tokens().stagger;

export function cancelUI(element) {
  if (!element) return;
  pendingReveals.delete(element);
  revealObserver?.unobserve(element);
  const effect = effects.get(element);
  if (effect) {
    effects.delete(element);
    effect.animation.cancel();
    effect.cleanup?.();
  }
}

export function animateUI(element, frames, purpose, options = {}) {
  if (!element) return null;
  cancelUI(element);
  const { cleanup, duration = 'base', delay = 0, easing = 'standard' } = options;
  if (motionReduced() || !element.isConnected || !element.animate) {
    cleanup?.();
    return null;
  }
  const values = tokens();
  try {
    const animation = element.animate(frames, {
      duration: typeof duration === 'number' ? duration : values[duration],
      easing: values[easing] || easing, delay, fill: 'backwards'
    });
    animation.id = `gm:${purpose}`;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (effects.get(element) === effect) effects.delete(element);
      cleanup?.();
    };
    const effect = { animation, cleanup: finish };
    effects.set(element, effect);
    // Both branches consume finished; cancel never creates an unhandled rejection.
    animation.finished.then(finish, finish);
    return animation;
  }
  catch {
    cleanup?.();
    return null;
  }
}

export function reveal(element, purpose, options = {}) {
  if (!element) return null;
  // The editorial island owns the five once-only block entrances. Its failure
  // leaves static content visible rather than replaying a second card animation.
  if (document.getElementById('hero-motion-root') && ['section', 'recommendation', 'scenario', 'saved-enter', 'kpi'].includes(purpose)) return null;
  const frames = [{ opacity: 0, transform: 'translateY(var(--motion-distance))' }, { opacity: 1, transform: 'translateY(0)' }];
  cancelUI(element);
  if (motionReduced() || !element.isConnected) return null;
  // Do not spend an entrance while its content is several screens below the user.
  // Pending content remains readable/focusable: only the eventual effect is deferred.
  for (const queued of pendingReveals.keys()) {
    if (!queued.isConnected || queued.closest('[hidden]')) cancelUI(queued);
  }
  const rect = element.getBoundingClientRect();
  const visible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  if (!visible && typeof IntersectionObserver !== 'undefined') {
    if (!revealObserver) revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const queued = pendingReveals.get(entry.target);
        if (!entry.target.isConnected || entry.target.closest('[hidden]')) cancelUI(entry.target);
        else if (queued && entry.isIntersecting && entry.intersectionRect.height > 0) {
          animateUI(entry.target, frames, queued.purpose, queued.options);
        }
      }
    });
    pendingReveals.set(element, { purpose, options });
    revealObserver.observe(element);
    return null;
  }
  return animateUI(element, frames, purpose, options);
}

export function cancelRevealsWithin(container) {
  for (const element of [...pendingReveals.keys(), ...effects.keys()]) {
    if (container?.contains(element)) cancelUI(element);
  }
}

export function clearSnapshot(element) {
  const ghost = snapshots.get(element);
  if (!ghost) return;
  snapshots.delete(element);
  cancelUI(ghost);
  ghost.remove();
}

export function exitSnapshot(element, purpose, rect = element?.getBoundingClientRect()) {
  if (!element) return;
  clearSnapshot(element);
  if (motionReduced() || !rect?.width || !rect.height || !element.isConnected) return;
  const ghost = element.cloneNode(true);
  for (const part of [ghost, ...ghost.querySelectorAll('*')]) {
    for (const attribute of ['id', 'data-testid', 'name', 'autofocus', 'aria-controls', 'aria-labelledby', 'aria-describedby']) part.removeAttribute(attribute);
    for (const attribute of [...part.attributes]) if (attribute.name.startsWith('data-')) part.removeAttribute(attribute.name);
    part.setAttribute('tabindex', '-1');
    if (part.matches('a')) part.removeAttribute('href');
    if (part.matches('button,input,select,textarea')) part.disabled = true;
  }
  ghost.hidden = false;
  ghost.inert = true;
  ghost.setAttribute('inert', '');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.removeAttribute('aria-modal');
  ghost.classList.add('motion-snapshot');
  ghost.dataset.motionSnapshot = '';
  const styles = getComputedStyle(element);
  for (const property of ['background', 'color', 'border', 'border-radius', 'padding', 'box-shadow', 'font', 'box-sizing']) ghost.style.setProperty(property, styles.getPropertyValue(property));
  Object.assign(ghost.style, {
    position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
    height: `${rect.height}px`, margin: '0', pointerEvents: 'none', zIndex: 'var(--z-ghost)', display: 'block'
  });
  ghost.style.setProperty('animation', 'none', 'important');
  document.body.append(ghost);
  snapshots.set(element, ghost);
  animateUI(ghost, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(calc(0px - var(--motion-distance-small)))' }], purpose, {
    duration: 'fast', cleanup: () => {
      ghost.remove();
      if (snapshots.get(element) === ghost) snapshots.delete(element);
    }
  });
}

export function setRevealed(element, visible, purpose) {
  if (!element) return;
  const changed = element.hidden === visible;
  if (changed && !visible) exitSnapshot(element, `${purpose}-exit`);
  element.hidden = !visible;
  element.setAttribute('aria-hidden', String(!visible));
  if (visible) {
    clearSnapshot(element);
    if (changed) reveal(element, `${purpose}-enter`);
  }
  else cancelUI(element);
}

function syncProgress() {
  const container = $('analysis-progress');
  if (!container) return;
  const progress = container.querySelector('md-linear-progress'), fallback = container.querySelector('.progress-fallback');
  const busy = !container.hidden, reduced = motionReduced(), revision = ++progressRevision;
  if (fallback) {
    fallback.hidden = !busy || (!reduced && !!customElements.get('md-linear-progress'));
    fallback.removeAttribute('aria-valuenow');
  }
  if (!progress) return;
  progress.hidden = !busy || reduced;
  progress.toggleAttribute('indeterminate', busy && !reduced);
  const stopShadowMotion = () => {
    if (revision !== progressRevision || (!motionReduced() && !container.hidden)) return;
    progress.shadowRoot?.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
  };
  stopShadowMotion();
  // Lit can create its internal animations after an attribute update.
  Promise.resolve(progress.updateComplete).then(stopShadowMotion, () => {});
}

export function setAnalysisState(value, message) {
  document.documentElement.dataset.analysisState = value;
  const busy = value === 'calculating' || value === 'refreshing';
  if ($('recommendation-loading')) $('recommendation-loading').hidden=!busy;
  if ($('recommendations')) $('recommendations').setAttribute('aria-busy',String(busy));
  if ($('result')) $('result').inert=busy;
  if ($('analysis-progress')) $('analysis-progress').hidden = !busy;
  $('map')?.setAttribute('aria-busy', String(busy));
  if ($('analysis-status')) $('analysis-status').textContent = message || ({
    initial: 'Выберите область для анализа', calculating: 'Рассчитываем спрос и конкуренцию…',
    refreshing: 'Обновляем данные · предыдущий расчёт доступен', success: 'Расчёт готов', error: 'Расчёт недоступен · повторите попытку'
  })[value];
  syncProgress();
  const trust = $('trust-summary');
  if (trust) {
    const summary = trust.dataset.resultSummary || '';
    trust.textContent = value === 'refreshing' ? `Обновляем данные · предыдущий расчёт. ${summary}`
      : value === 'error' && summary ? `Обновление не удалось · предыдущий расчёт. ${summary}`
      : value === 'initial' && summary ? `Параметры изменены · показан предыдущий расчёт. ${summary}`
      : value === 'initial' || value === 'calculating' ? 'Данные ещё не оценены · выполните расчёт'
      : summary || 'Данные ещё не оценены';
  }
}

// Native details owns semantics. Motion only bridges between its final states.
// Repeated initialization is harmless for saved cards and dynamically built reports.
const disclosures = new WeakMap();
export function initDisclosure(details, options = {}) {
  if (details?.hasAttribute('data-workspace-disclosure')) return details;
  if (!details?.matches('details') || disclosures.has(details)) return details;
  const summary = details.querySelector(':scope > summary');
  if (!summary) return details;
  details.dataset.expanded = String(details.open);
  summary.setAttribute('aria-expanded',String(details.open));
  const existingBody = details.querySelector(':scope > .disclosure-body');
  const body = existingBody || node('div', 'disclosure-body'), content = node('div', 'disclosure-content');
  [...(existingBody || details).childNodes].filter(child => child !== summary).forEach(child => content.append(child));
  body.append(content); if (!existingBody) details.append(body);
  let wanted = details.open, revision = 0, active = false;
  disclosures.set(details, body);
  const transition = open => {
    const from = details.open ? body.getBoundingClientRect().height : 0;
    const opacity = details.open ? getComputedStyle(body).opacity : '0';
    wanted = open;
    const current = ++revision;
    cancelUI(body);
    if (!open && body.contains(document.activeElement)) summary.focus();
    body.inert = !open;
    details.open = true;
    details.dataset.expanded = String(open);
    summary.setAttribute('aria-expanded',String(open));
    active = true;
    animateUI(body, [{ height: `${from}px`, opacity }, { height: `${open ? content.getBoundingClientRect().height : 0}px`, opacity: open ? 1 : 0 }], 'disclosure', {
      duration: options.duration || (open ? 400 : 300),
      cleanup: () => {
        if (current !== revision) return;
        active = false; details.open = wanted; body.inert = false;
      }
    });
  };
  summary.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    transition(!wanted);
  });
  details.addEventListener('toggle', () => {
    if (active || details.open === wanted) return;
    wanted = details.open; details.dataset.expanded = String(wanted);summary.setAttribute('aria-expanded',String(wanted));
    if (wanted) transition(true);
    else { ++revision; cancelUI(body); body.inert = false; }
  });
  return details;
}

export function initMotion() {
  if (motionReady) return;
  motionReady = true;
  tokens();
  const cancelAll = () => {
    [...pendingReveals.keys()].forEach(cancelUI);
    [...effects.keys()].forEach(cancelUI);
    [...snapshots.keys()].forEach(clearSnapshot);
    document.getAnimations?.().filter(animation => animation.id.startsWith('gm:')).forEach(animation => animation.cancel());
  };
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) cancelAll();
    syncProgress();
  });
  window.addEventListener('beforeprint', () => { cancelAll(); syncProgress(); });
  window.addEventListener('afterprint', syncProgress);
  document.addEventListener('material-web-ready', syncProgress);
  if (typeof customElements !== 'undefined') customElements.whenDefined('md-linear-progress').then(syncProgress);
  const sentinel = $('header-sentinel'), header = document.querySelector('.site-header');
  if (sentinel && header && typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(([entry]) => header.classList.toggle('is-scrolled', !entry.isIntersecting)).observe(sentinel);
  }
  setAnalysisState('initial');
  ['settings', 'map-card', 'recommendations', 'saved-section', 'data-section'].forEach((id, index) => reveal($(id), 'section', { duration: 'slow', easing: 'emphasized', delay: Math.min(index * 30, 90) }));
  document.querySelectorAll('details').forEach(details => initDisclosure(details));
  // Native dynamic details keep their own keyboard/toggle behaviour. Only the
  // accessible state is synchronised; no second disclosure controller is added.
  const syncNativeDetails=details=>details.querySelector(':scope>summary')?.setAttribute('aria-expanded',details.dataset.expanded||String(details.open));
  document.querySelectorAll('details').forEach(syncNativeDetails);
  document.addEventListener('toggle',event=>{if(event.target.matches?.('details'))syncNativeDetails(event.target);},true);
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(element=>{
    if(!(element instanceof HTMLElement))return;
    if(element.matches('details'))syncNativeDetails(element);
    element.querySelectorAll('details').forEach(syncNativeDetails);
  }))).observe(document.body,{childList:true,subtree:true});
  $('trust-details-link')?.addEventListener('click', event => {
    const details = $('data-details'), summary = $('data-summary');
    if (!details || !summary) return;
    event.preventDefault(); cancelUI(disclosures.get(details)); details.open = true;
    summary.focus({ preventScroll: true });
    $('data-section').scrollIntoView({ behavior: motionReduced() ? 'instant' : 'smooth', block: 'start' });
  });
}

const dialogBounds = new WeakMap();
export function openDialog(dialog) {
  clearSnapshot(dialog);
  dialog.showModal();
  dialogBounds.set(dialog, dialog.getBoundingClientRect());
  reveal(dialog, 'dialog-enter', { duration: 'base', easing: 'emphasized' });
}
export function closeDialog(dialog) {
  if (!dialog.open) return;
  exitSnapshot(dialog, 'dialog-exit');
  cancelUI(dialog);
  dialog.close();
}
export function initDialogMotion(dialog) {
  dialog.addEventListener('cancel', () => {
    exitSnapshot(dialog, 'dialog-exit');
    cancelUI(dialog);
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    cancelUI(dialog);
    if (!snapshots.has(dialog)) exitSnapshot(dialog, 'dialog-exit', dialogBounds.get(dialog));
  });
}
