// React Bits Magnet: reach/maxOffset and spring solver adapted to one existing
// anchor. No global pointer registry, React wrapper, tilt or perpetual RAF.
import { useEffect } from 'react';

export function Magnet({ enabled }) {
  useEffect(() => {
    const wrapper=document.querySelector('.hero-magnet'),button=wrapper?.querySelector('a');
    if(!enabled || !button)return;
    const fine=matchMedia('(hover:hover) and (pointer:fine)');
    const current={x:0,y:0},velocity={x:0,y:0},target={x:0,y:0};
    let raf=0,last=0;
    const reset=()=>{
      cancelAnimationFrame(raf);raf=0;last=0;
      for(const key of ['x','y'])current[key]=velocity[key]=target[key]=0;
      button.style.removeProperty('translate');
    };
    const frame=now=>{
      raf=0;const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;
      const steps=Math.ceil(dt/(1/120));let resting=true;
      for(let i=0;i<steps;i++)for(const key of ['x','y']){
        const force=170*(target[key]-current[key])-26*velocity[key];
        velocity[key]+=force*dt/steps;current[key]+=velocity[key]*dt/steps;
      }
      for(const key of ['x','y'])if(Math.abs(target[key]-current[key])>.02||Math.abs(velocity[key])>.02)resting=false;
      const length=Math.hypot(current.x,current.y),factor=length>6?6/length:1;
      button.style.translate=`${(current.x*factor).toFixed(2)}px ${(current.y*factor).toFixed(2)}px`;
      if(!resting)raf=requestAnimationFrame(frame);
      else {last=0;if(target.x===0&&target.y===0)reset();}
    };
    const wake=()=>{if(!raf)raf=requestAnimationFrame(frame);};
    const move=event=>{
      if(!fine.matches||event.pointerType==='touch'||button.matches(':focus-visible'))return;
      const rect=wrapper.getBoundingClientRect();
      let x=(event.clientX-rect.left-rect.width/2)/4,y=(event.clientY-rect.top-rect.height/2)/4;
      const length=Math.hypot(x,y);if(length>6){x*=6/length;y*=6/length;}
      target.x=x;target.y=y;wake();
    };
    const leave=()=>{target.x=target.y=0;wake();};
    const keyboard=event=>{if(event.key==='Tab')reset();};
    wrapper.addEventListener('pointermove',move);wrapper.addEventListener('pointerleave',leave);
    wrapper.addEventListener('pointercancel',reset);button.addEventListener('focus',reset);
    window.addEventListener('keydown',keyboard);window.addEventListener('blur',reset);
    window.addEventListener('scroll',reset,{passive:true});fine.addEventListener('change',reset);
    return()=>{
      reset();wrapper.removeEventListener('pointermove',move);wrapper.removeEventListener('pointerleave',leave);
      wrapper.removeEventListener('pointercancel',reset);button.removeEventListener('focus',reset);
      window.removeEventListener('keydown',keyboard);window.removeEventListener('blur',reset);
      window.removeEventListener('scroll',reset);fine.removeEventListener('change',reset);
    };
  },[enabled]);
  return null;
}
