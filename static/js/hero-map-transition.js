// Декоративное продолжение радиуса. Не управляет прокруткой, картой или расчётом.
const hero=document.getElementById('hero'),workspace=document.getElementById('workspace');
const reduced=matchMedia('(prefers-reduced-motion:reduce)'),wide=matchMedia('(min-width:901px) and (hover:hover)');
const ring=document.createElement('span');ring.className='hero-map-transition';ring.setAttribute('aria-hidden','true');ring.hidden=true;document.body.append(ring);
let frame=0;
function render(){
 frame=0;
 if(reduced.matches||!wide.matches||document.hidden){ring.hidden=true;return;}
 const h=hero.getBoundingClientRect(),w=workspace.getBoundingClientRect();
 const start=h.top+scrollY+h.height*.4,end=w.top+scrollY-innerHeight*.2;
 const progress=(scrollY-start)/Math.max(1,end-start);
 if(progress<=0||progress>=1){ring.hidden=true;return;}
 const from=hero.querySelector('.hero-radius-ring')?.getBoundingClientRect();
 const to=document.querySelector('.leaflet-accessibility-pane path')?.getBoundingClientRect();
 if(!from?.width||!to?.width){ring.hidden=true;return;}
 const t=progress*progress*(3-2*progress),mix=(a,b)=>a+(b-a)*t;
 const size=mix(from.width,to.width),x=mix(from.x+from.width/2,to.x+to.width/2),y=mix(from.y+from.height/2,to.y+to.height/2);
 ring.hidden=false;
 ring.style.transform=`translate3d(${x-100}px,${y-100}px,0) scale(${size/200})`;
 ring.style.opacity=String(Math.sin(progress*Math.PI)*.55);
}
const schedule=()=>{if(!frame)frame=requestAnimationFrame(render);};
window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);wide.addEventListener('change',schedule);
document.addEventListener('gm:analysis-rendered',schedule);
