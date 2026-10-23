// React Bits BlurText's blur/direction snapshots and buildKeyframes algorithm.
// Uses Motion's smaller React animation hook on the existing short paragraph.
import { useEffect, useRef } from 'react';
import { useAnimate } from 'motion/react-mini';

const buildKeyframes = (from, steps) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap(step => Object.keys(step))]);
  const keyframes = {};
  keys.forEach(key => { keyframes[key] = [from[key], ...steps.map(step => step[key])]; });
  return keyframes;
};

export function BlurText({ enabled }) {
  const [, animate] = useAnimate(), played = useRef(false);
  useEffect(() => {
    const el = document.getElementById('hero-description');
    if (!enabled || played.current || !el) return;
    played.current = true;
    let animation, active = true;
    const original = ['filter','opacity','transform'].map(key=>[key,el.style.getPropertyValue(key),el.style.getPropertyPriority(key)]);
    const restore = () => original.forEach(([key,value,priority])=>{
      if(value)el.style.setProperty(key,value,priority);else el.style.removeProperty(key);
    });
    const start = () => { if (!active) return;
    try {
      // Restrained whole-paragraph adaptation: no duplicate SR text or flex spans.
      const from = {filter:'blur(8px)',opacity:0,transform:'translateY(14px)'};
      const steps = [
        {filter:'blur(2px)',opacity:.75,transform:'translateY(-0.8px)'},
        {filter:'blur(0px)',opacity:1,transform:'translateY(0px)'},
      ];
      animation = animate(el, buildKeyframes(from,steps), {duration:.75,delay:.48,ease:'easeOut',times:[0,.5,1]});
      animation.then(restore);
    } catch { /* The static paragraph remains the fallback. */ }
    };
    if (!document.fonts || document.fonts.status === 'loaded') start();
    else document.fonts.ready.then(start);
    return () => { active = false; animation?.cancel(); restore(); };
  }, [enabled, animate]);
  return null;
}
