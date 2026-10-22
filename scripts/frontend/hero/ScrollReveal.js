// React Bits ScrollReveal's enter-mode progress/render algorithm, adapted to
// five existing blocks. IntersectionObserver replaces text scrub/ScrollTrigger.
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const clamp01 = value => Math.min(Math.max(value, 0), 1);
const easeOut = value => 1 - Math.pow(1 - value, 3);
const selectors = ['.kpis','#workspace','#saved-section','#scenarios-section','#data-section'];

export function ScrollReveal({ enabled }) {
  const completed = useRef(new WeakSet());
  useEffect(() => {
    if (!enabled) return;
    const animations = new Map();
    const clear = el => {
      el.style.removeProperty('opacity');
      el.style.removeProperty('transform');
      el.style.removeProperty('will-change');
    };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const el = entry.target;
      if (!entry.isIntersecting || el.hidden || !el.getClientRects().length || completed.current.has(el)) return;
      completed.current.add(el);
      observer.unobserve(el);
      el.dataset.heroEntered = 'true';
      // Keep controls and data readable while entering; nothing pre-hides a block.
      const state = {p:0};
      const render = () => {
        const t = clamp01(state.p), settle = easeOut(t);
        el.style.opacity = String(.88 + .12*t);
        el.style.transform = `translateY(${(12*(1-settle)).toFixed(2)}px)`;
      };
      el.style.willChange = 'opacity, transform';
      animations.set(el, gsap.to(state, {p:1,duration:.55,ease:'none',onUpdate:render,onComplete:()=>{clear(el);animations.delete(el);}}));
    }), {threshold:.08});
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && !completed.current.has(el)) observer.observe(el);
    }
    return () => {
      observer.disconnect();
      for (const [el,animation] of animations) { animation.kill(); clear(el); }
    };
  }, [enabled]);
  return null;
}
