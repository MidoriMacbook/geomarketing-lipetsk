// React Bits ScrollReveal adapted to one-time block entrances, without scrub.
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
const selectors = ['.kpis','#workspace','#saved-section','#scenarios-section','#data-section'];
export function ScrollReveal({ enabled }) {
  const completed = useRef(new WeakSet());
  useEffect(() => {
    if (!enabled) return;
    const animations = new Map(), blocks = selectors.map(s=>document.querySelector(s)).filter(Boolean);
    const clear = el => {
      el.classList.remove('motion-prepared');
      for (const key of ['opacity','transform','will-change']) el.style.removeProperty(key);
    };
    const finish = el => {
      animations.get(el)?.kill(); animations.delete(el);
      clear(el); completed.current.add(el); observer.unobserve(el);
      el.dataset.heroEntered = 'true';
    };
    const observer = new IntersectionObserver(entries => entries.forEach(({target:el,isIntersecting}) => {
      if (!isIntersecting || el.hidden || !el.getClientRects().length || completed.current.has(el)) return;
      completed.current.add(el); observer.unobserve(el); el.dataset.heroEntered='true';
      if (el.contains(document.activeElement)) { finish(el); return; }
      el.classList.remove('motion-prepared');
      animations.set(el,gsap.fromTo(el,{opacity:0,y:24,willChange:'transform, opacity'},
        {opacity:1,y:0,duration:.7,ease:'power3.out',onComplete:()=>{clear(el);animations.delete(el);}}));
    }),{threshold:0,rootMargin:'0px 0px -24px 0px'});
    // A pointer can arrive during an entrance (especially after native scroll
    // to an off-screen control). Freeze geometry through the click so down/up
    // cannot land on different controls. Keyboard focus exposes it immediately.
    const hold = el => { const animation=animations.get(el); if(animation){animation.pause();el.style.opacity='1';} };
    let pointerHeld=false,resumeFrame=0,releaseTimer=0;
    const onPointer = event => {clearTimeout(releaseTimer);pointerHeld=true;blocks.forEach(el=>{if(el.contains(event.target))hold(el);});};
    const release = () => {
      clearTimeout(releaseTimer);
      cancelAnimationFrame(resumeFrame);
      // Touch generates compatibility mouse/focus events after pointerup.
      // Keep the hold through that complete click dispatch as well.
      resumeFrame=requestAnimationFrame(()=>{resumeFrame=0;pointerHeld=false;animations.forEach(animation=>animation.resume());});
    };
    const onUp=()=>{releaseTimer=setTimeout(release,500);};
    const onKey=()=>{pointerHeld=false;release();};
    const onFocus = event => blocks.forEach(el=>{
      if(!el.contains(event.target))return;
      if(pointerHeld)hold(el);else finish(el);
    });
    for (const el of blocks) {
      if (completed.current.has(el)) continue;
      el.classList.add('motion-prepared'); observer.observe(el);
    }
    document.addEventListener('focusin',onFocus);
    document.addEventListener('pointerdown',onPointer,true);
    document.addEventListener('pointerup',onUp,true);
    document.addEventListener('click',release,true);
    document.addEventListener('keydown',onKey,true);
    document.addEventListener('pointercancel',release,true);
    return () => {
      observer.disconnect(); document.removeEventListener('focusin',onFocus);
      cancelAnimationFrame(resumeFrame);
      clearTimeout(releaseTimer);
      document.removeEventListener('pointerdown',onPointer,true);
      document.removeEventListener('pointerup',onUp,true);
      document.removeEventListener('click',release,true);
      document.removeEventListener('keydown',onKey,true);
      document.removeEventListener('pointercancel',release,true);
      blocks.forEach(el=>{animations.get(el)?.kill();clear(el);});
      animations.clear();
    };
  },[enabled]);
  return null;
}
