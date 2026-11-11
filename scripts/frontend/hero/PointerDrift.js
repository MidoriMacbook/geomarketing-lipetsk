import { useEffect } from 'react';

export function PointerDrift({ enabled }) {
  useEffect(() => {
    const art = document.getElementById('hero');
    if (!enabled || !art) return;
    const fine = matchMedia('(hover:hover) and (pointer:fine)');
    const pieces = [...art.querySelectorAll('[data-hero-drift]')],light=art.querySelector('.hero-pointer-light');
    let lightX=0,lightY=0;
    let raf = 0, x = 0, y = 0;
    const reset = () => {
      cancelAnimationFrame(raf); raf = 0;
      pieces.forEach(el => el.style.removeProperty('translate'));
      if(light)light.style.opacity='0';
    };
    const paint = () => {
      raf = 0;
      if(light){light.style.transform=`translate(${lightX}px,${lightY}px)`;light.style.opacity='1';}
      pieces.forEach((el,index) => {
        const depth = .5 + .5*(index%3)/2;
        el.style.translate = `${(x*depth).toFixed(2)}px ${(y*depth).toFixed(2)}px`;
      });
    };
    const move = event => {
      if (!fine.matches || event.pointerType === 'touch') return;
      const box = art.getBoundingClientRect();
      lightX=event.clientX-box.left-110;lightY=event.clientY-box.top-110;
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
