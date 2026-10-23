import { useEffect, useRef, useState } from 'react';

export function CityMotion({ enabled }) {
  const [paused,setPaused]=useState(false),played=useRef(false);
  useEffect(()=>{
    const button=document.getElementById('hero-motion-toggle');
    if(!button)return;
    button.hidden=false;
    const toggle=()=>setPaused(value=>!value);
    button.addEventListener('click',toggle);
    return()=>{button.hidden=true;button.removeEventListener('click',toggle);};
  },[]);
  useEffect(()=>{
    const hero=document.getElementById('hero'),button=document.getElementById('hero-motion-toggle');
    if(!hero)return;
    hero.classList.toggle('city-motion-active',enabled&&!paused);
    if(button){button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'Оживить схему':'Пауза схемы';}
    if(enabled&&!paused&&!played.current){hero.classList.add('city-motion-intro');played.current=true;}
    return()=>{hero.classList.remove('city-motion-active','city-motion-intro');};
  },[enabled,paused]);
  return null;
}
