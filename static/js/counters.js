import { motionReduced, node } from './ui.js';

const records = new Map(), values = new WeakMap();
let observer, frame = 0, duration;
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const format = (value, prefix, suffix) => `${prefix}${numberFormat.format(value)}${suffix}`;
const running = () => [...records.values()].some(record => record.started !== null);

function settle(element) {
  const record = records.get(element);
  if (!record) return;
  records.delete(element);
  observer?.unobserve(element);
  element.classList.remove('is-counting');
  record.visual.dataset.display = format(record.target, record.prefix, record.suffix);
  values.set(element, record.target);
  if (frame && !running()) { cancelAnimationFrame(frame); frame = 0; }
}

function tick(time) {
  frame = 0;
  for (const [element, record] of records) {
    if (!element.isConnected) { settle(element); continue; }
    if (record.started === null) continue;
    const progress = Math.min(1, Math.max(0, (time - record.started) / duration));
    record.current = Math.round(record.from + (record.target - record.from) * (1 - (1 - progress) ** 3));
    record.visual.dataset.display = format(record.current, record.prefix, record.suffix);
    if (progress === 1) settle(element);
  }
  if (running()) frame = requestAnimationFrame(tick);
}

function start(element) {
  const record = records.get(element);
  if (!record || record.started !== null) return;
  observer?.unobserve(element);
  if (motionReduced() || document.hidden || !element.isConnected || element.closest('[hidden]')) {
    settle(element);
    return;
  }
  record.started = performance.now();
  element.classList.add('is-counting');
  if (!frame) frame = requestAnimationFrame(tick);
}

// Only generated visual content changes each frame. Exact text, accessibility,
// copied values and the reserved final-value layout remain stable throughout.
export function counterValue(element) {
  return records.get(element)?.current ?? values.get(element);
}

export function countTo(element, target, { animate = true, prefix = '', suffix = '', from: initial } = {}) {
  if (!element) return;
  const previous = records.get(element);
  if (previous && previous.target === target && previous.prefix === prefix && previous.suffix === suffix && animate) return;
  const from = counterValue(element) ?? (Number.isSafeInteger(initial) && initial >= 0 ? initial : 0);
  settle(element);
  for (const queued of records.keys()) if (!queued.isConnected) settle(queued);
  if (!Number.isSafeInteger(target) || target < 0) {
    values.delete(element);
    element.textContent = '—';
    element.classList.remove('counter-number', 'is-counting');
    delete element.dataset.counterTarget;
    delete element.dataset.counterFrom;
    return;
  }
  const final = node('span', 'counter-final', format(target, prefix, suffix));
  const visual = node('span', 'counter-visual');
  visual.setAttribute('aria-hidden', 'true');
  visual.dataset.display = format(from, prefix, suffix);
  element.replaceChildren(final, visual);
  element.classList.add('counter-number');
  element.dataset.counterTarget = target;
  element.dataset.counterFrom = from;
  values.set(element, target);
  if (!animate || from === target || motionReduced() || document.hidden || typeof requestAnimationFrame !== 'function') return;
  if (duration === undefined) {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--motion-counter').trim();
    const parsed = parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
    duration = Number.isFinite(parsed) && parsed > 0 ? parsed : 1100;
  }
  records.set(element, { from, target, current: from, prefix, suffix, visual, started: null });
  if (typeof IntersectionObserver === 'undefined') start(element);
  else {
    observer ||= new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.target.isConnected || entry.target.closest('[hidden]')) settle(entry.target);
        else if (entry.isIntersecting && entry.intersectionRect.height > 0) start(entry.target);
      }
    });
    observer.observe(element);
  }
}

export function resetCounters(container) {
  if (!container) return;
  const elements = [...container.querySelectorAll('.counter-number')];
  if (container.classList.contains('counter-number')) elements.push(container);
  for (const element of elements) {
    settle(element);
    values.delete(element);
    element.classList.remove('counter-number', 'is-counting');
    delete element.dataset.counterTarget;
    delete element.dataset.counterFrom;
  }
}

const settleAll = () => [...records.keys()].forEach(settle);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { if (event.matches) settleAll(); });
matchMedia('print').addEventListener('change', event => { if (event.matches) settleAll(); });
window.addEventListener('beforeprint', settleAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) settleAll(); });
