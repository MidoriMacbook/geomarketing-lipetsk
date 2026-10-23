import { useEffect } from 'react';

export function PointerDrift({ enabled }) {
  useEffect(() => {
    const art = document.getElementById('hero');
    if (!enabled || !art) return;
    const fine = matchMedia('(hover:hover) and (pointer:fine)');
    const pieces = [...art.querySelectorAll('[data-hero-drift]')];
    let raf = 0, x = 0, y = 0;
    const reset = () => {
      cancelAnimationFrame(raf); raf = 0;
      pieces.forEach(el => el.style.removeProperty('translate'));
    };
    const paint = () => {
      raf = 0;
      pieces.forEach((el,index) => {
        const depth = .5 + .5*(index%3)/2;
        el.style.translate = `${(x*depth).toFixed(2)}px ${(y*depth).toFixed(2)}px`;
      });
    };
    const move = event => {
      if (!fine.matches || event.pointerType === 'touch') return;
      const box = art.getBoundingClientRect();
      x = Math.max(-6,Math.min(6,((event.clientX-box.left)/box.width-.5)*12));
      y = Math.max(-6,Math.min(6,((event.clientY-box.top)/box.height-.5)*12));
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const visibility = () => { if (document.hidden) reset(); };
    const observer = new IntersectionObserver(([entry])=>{if(!entry.isIntersecting)reset();});
    observer.observe(art);
    art.addEventListener('pointermove',move);
    art.addEventListener('pointerleave',reset);
    window.addEventListener('blur',reset);
    document.addEventListener('visibilitychange',visibility);
    fine.addEventListener('change',reset);
    return () => {
      reset(); observer.disconnect();
      art.removeEventListener('pointermove',move);
      art.removeEventListener('pointerleave',reset);
      window.removeEventListener('blur',reset);
      document.removeEventListener('visibilitychange',visibility);
      fine.removeEventListener('change',reset);
    };
  }, [enabled]);
  return null;
}
