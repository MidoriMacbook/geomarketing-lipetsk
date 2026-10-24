import { useEffect, useRef } from 'react';

export function CityMotion({ enabled }) {
  const played=useRef(false);
  useEffect(()=>{
    const hero=document.getElementById('hero');
    if(!hero)return;
    hero.classList.toggle('city-motion-active',enabled);
    if(enabled&&!played.current){hero.classList.add('city-motion-intro');played.current=true;}
    return()=>{hero.classList.remove('city-motion-active');};
  },[enabled]);
  return null;
}
