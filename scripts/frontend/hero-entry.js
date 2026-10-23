import { createElement, Fragment, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SplitText } from './hero/SplitText.js';
import { BlurText } from './hero/BlurText.js';
import { ScrollReveal } from './hero/ScrollReveal.js';
import { PointerDrift } from './hero/PointerDrift.js';
import { Magnet } from './hero/Magnet.js';
import { CityMotion } from './hero/CityMotion.js';

function HeroMotion({mount}) {
  const canObserve = typeof IntersectionObserver === 'function';
  const [conditions,setConditions] = useState({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,print:matchMedia('print').matches,visible:!document.hidden,heroVisible:true});
  useEffect(() => {
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),print=matchMedia('print');
    const update = patch => flushSync(()=>setConditions(current=>({...current,...patch})));
    const motionChange = () => update({reduced:reduced.matches});
    const printChange = () => update({print:print.matches});
    const beforePrint = () => update({print:true}),afterPrint=()=>update({print:false});
    const visibleChange = () => update({visible:!document.hidden});
    const observer = canObserve ? new IntersectionObserver(([entry])=>update({heroVisible:entry.isIntersecting})) : null;
    const hero=document.querySelector('.editorial-hero');
    if(hero)observer?.observe(hero);
    if(!canObserve)document.querySelectorAll('.kpis,#workspace,#saved-section,#scenarios-section,#data-section').forEach(el=>{el.dataset.heroEntered='true';});
    reduced.addEventListener('change',motionChange);print.addEventListener('change',printChange);
    window.addEventListener('beforeprint',beforePrint);window.addEventListener('afterprint',afterPrint);
    document.addEventListener('visibilitychange',visibleChange);
    mount.dataset.heroReady='true';
    return () => {
      observer?.disconnect();
      reduced.removeEventListener('change',motionChange);print.removeEventListener('change',printChange);
      window.removeEventListener('beforeprint',beforePrint);window.removeEventListener('afterprint',afterPrint);
      document.removeEventListener('visibilitychange',visibleChange);
      delete mount.dataset.heroReady;
    };
  }, [mount,canObserve]);
  const enabled = canObserve && !conditions.reduced && !conditions.print && conditions.visible;
  const heroEnabled = enabled && conditions.heroVisible;
  useEffect(()=>{mount.dataset.heroState=!canObserve?'fallback':conditions.reduced?'reduced':conditions.print?'print':enabled?'active':'paused';},[mount,conditions,enabled,canObserve]);
  return createElement(Fragment,null,
    createElement(SplitText,{enabled:heroEnabled}),createElement(BlurText,{enabled:heroEnabled}),
    createElement(ScrollReveal,{enabled}),createElement(PointerDrift,{enabled:heroEnabled}),
    createElement(Magnet,{enabled:heroEnabled}),createElement(CityMotion,{enabled:heroEnabled}));
}

const mount=document.getElementById('hero-motion-root');
if(mount && !mount.dataset.heroMounted) {
  mount.dataset.heroMounted='true';
  const root=createRoot(mount);
  root.render(createElement(HeroMotion,{mount}));
  const dispose = event => {
    if(event.persisted)return;
    root.unmount();
    delete mount.dataset.heroMounted;
    window.removeEventListener('pagehide',dispose);
  };
  window.addEventListener('pagehide',dispose);
}
