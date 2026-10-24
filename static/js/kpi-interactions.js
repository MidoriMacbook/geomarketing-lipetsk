import { replayCounter } from './counters.js';
import { animateUI, cancelUI, motionReduced, node } from './ui.js';

document.querySelectorAll('.kpis>div').forEach(card => {
  const number = card.querySelector('strong');
  const label = card.firstElementChild.textContent.replace('≈', '').trim();
  const replay = node('button', 'kpi-replay');
  replay.type = 'button';
  const wave = node('span', 'kpi-wave'), progress = node('span', 'kpi-progress');
  wave.setAttribute('aria-hidden', 'true'); progress.setAttribute('aria-hidden', 'true');
  card.append(wave, progress, replay);
  let tintTimer;
  const reset = () => {
    [card, wave, progress].forEach(cancelUI);
    clearTimeout(tintTimer); card.classList.remove('is-replaying');
  };
  const sync = () => {
    reset();
    replay.disabled = !number.hasAttribute('data-counter-target');
    replay.setAttribute('aria-label', `Повторить анимацию: ${label.toLocaleLowerCase('ru')}, ${number.textContent}`);
  };
  new MutationObserver(sync).observe(number, { childList:true, attributes:true, attributeFilter:['data-counter-target'] });
  sync();
  replay.addEventListener('click', event => {
    reset(); replayCounter(number);
    card.classList.add('is-replaying');
    tintTimer = setTimeout(() => card.classList.remove('is-replaying'), 620);
    if (motionReduced()) return;
    const box = card.getBoundingClientRect();
    const x = event.detail ? event.clientX - box.left : box.width / 2;
    const y = event.detail ? event.clientY - box.top : box.height / 2;
    Object.assign(wave.style, { left:`${x}px`, top:`${y}px`, width:`${Math.hypot(box.width, box.height) * 2}px`, height:`${Math.hypot(box.width, box.height) * 2}px` });
    animateUI(card, [{transform:'scale(1)'},{transform:'scale(.985)',offset:.45},{transform:'scale(1)'}], 'kpi-press', {duration:180});
    animateUI(wave, [{opacity:.13,transform:'translate(-50%,-50%) scale(0)'},{opacity:0,transform:'translate(-50%,-50%) scale(1)'}], 'kpi-wave', {duration:560});
    animateUI(progress, [{opacity:0,transform:'scaleX(0)'},{opacity:.7,transform:'scaleX(.75)',offset:.65},{opacity:0,transform:'scaleX(1)'}], 'kpi-progress', {duration:600});
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', reset);
  window.addEventListener('beforeprint', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
});
