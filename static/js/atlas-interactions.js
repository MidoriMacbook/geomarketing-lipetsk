import {motionReduced,animateUI} from './ui.js';

// Только представление. Расчёт, состояние и сохранения принадлежат прежним модулям.
const root=document.documentElement;
let frame=0;
const updateProgress=()=>{
 frame=0;
 root.style.setProperty('--reading-progress',String(scrollY/Math.max(1,root.scrollHeight-innerHeight)));
};
window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(updateProgress);},{passive:true});
const visibility=()=>{root.dataset.pageVisible=String(!document.hidden);};
document.addEventListener('visibilitychange',visibility);visibility();updateProgress();
document.addEventListener('click',event=>{
 const target=event.target.closest('.button');
 if(!target||target.disabled||motionReduced())return;
 animateUI(target,[{boxShadow:'0 0 0 0 var(--color-glow)'},{boxShadow:'0 0 0 8px transparent'}],'press-ring',{duration:350});
});

const sheet=document.getElementById('recommendations'),map=document.getElementById('map-card');
new IntersectionObserver(([entry])=>{sheet.dataset.motionVisible=String(entry.isIntersecting);}).observe(sheet);
const mobile=matchMedia('(max-width:600px)');
const controls=document.createElement('div');controls.className='sheet-controls';
controls.innerHTML='<button class="sheet-handle" type="button" aria-label="Изменить высоту результатов"></button><button type="button" data-snap="collapsed" aria-label="Свернуть результаты">Карта</button><button type="button" data-snap="half" aria-label="Показать половину панели результатов">Места</button><button type="button" data-snap="full" aria-label="Развернуть результаты полностью">Все</button>';
sheet.prepend(controls);
const handle=controls.querySelector('.sheet-handle');
const home=document.createElement('div');home.className='sheet-home';sheet.before(home);home.append(sheet);
let snap='collapsed',active=false,drag=null,scrollFrame=0,suppressHandleClick=false;
function offsets(){
 const height=sheet.getBoundingClientRect().height;
 return {collapsed:Math.max(0,height-112),half:Math.max(0,height-innerHeight*.48),full:0};
}
function setSnap(value){
 snap=value;sheet.dataset.snap=snap;
 controls.querySelectorAll('[data-snap]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.snap===snap)));
 if(active){
  const offset=offsets()[snap];sheet.style.setProperty('--sheet-offset',`${offset}px`);
  sheet.style.setProperty('--sheet-visible',`${sheet.getBoundingClientRect().height-offset}px`);
 }
 const collapsed=active&&snap==='collapsed';
 const busy=['calculating','refreshing'].includes(root.dataset.analysisState);
 [...sheet.children].filter(el=>el!==controls&& !el.classList.contains('section-heading')).forEach(el=>{el.inert=collapsed||(el.id==='result'&&busy);});
}
function sync(){
 scrollFrame=0;
 const rect=map.getBoundingClientRect(),header=document.getElementById('site-header').getBoundingClientRect().bottom;
 const largeText=parseFloat(getComputedStyle(root).fontSize)>22;
 root.dataset.largeText=String(largeText);
 const wanted=mobile.matches&&!largeText&&rect.top<innerHeight*.75&&rect.bottom>header+60;
 if(wanted!==active){
  if(wanted)home.style.minHeight=`${sheet.getBoundingClientRect().height}px`;
  active=wanted;sheet.dataset.sheetActive=String(active);root.dataset.atlasSheet=String(active);
  if(!active){home.style.minHeight='';sheet.style.removeProperty('--sheet-offset');}
 }
 setSnap(snap);
}
controls.addEventListener('click',event=>{const button=event.target.closest('[data-snap]');if(button)setSnap(button.dataset.snap);});
handle.addEventListener('click',()=>{if(suppressHandleClick){suppressHandleClick=false;return;}setSnap(snap==='collapsed'?'half':snap==='half'?'full':'collapsed');});
handle.addEventListener('keydown',event=>{
 if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();const steps=['collapsed','half','full'];setSnap(steps[Math.max(0,Math.min(2,steps.indexOf(snap)+(event.key==='ArrowUp'?1:-1)))]);}
});
handle.addEventListener('pointerdown',event=>{
 if(!active||event.button!==0)return;
 suppressHandleClick=false;
 const visualOffset=new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42;
 drag={id:event.pointerId,y:event.clientY,offset:visualOffset,moved:false};
 handle.setPointerCapture(event.pointerId);sheet.dataset.dragging='true';
 sheet.style.setProperty('--sheet-offset',`${visualOffset}px`);
});
handle.addEventListener('pointermove',event=>{
 if(!drag||drag.id!==event.pointerId)return;
 const delta=event.clientY-drag.y;if(Math.abs(delta)>5)drag.moved=true;
 drag.next=Math.max(0,Math.min(offsets().collapsed,drag.offset+delta));
 sheet.style.setProperty('--sheet-offset',`${drag.next}px`);
});
function endDrag(event){
 if(!drag||drag.id!==event.pointerId)return;
 const current=drag;delete sheet.dataset.dragging;suppressHandleClick=current.moved;
 if(current.moved)setSnap(Object.entries(offsets()).sort((a,b)=>Math.abs(a[1]-current.next)-Math.abs(b[1]-current.next))[0][0]);
 else setSnap(snap);
 // Синтетический click после перетаскивания не переключает положение ещё раз.
 drag=null;
}
handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);
window.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(sync);},{passive:true});
window.addEventListener('resize',sync);mobile.addEventListener('change',sync);
new ResizeObserver(()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(sync);}).observe(document.getElementById('workspace'));
let fontSize=root.style.fontSize;
new MutationObserver(()=>{if(fontSize!==root.style.fontSize){fontSize=root.style.fontSize;sync();}}).observe(root,{attributes:true,attributeFilter:['style']});
document.addEventListener('gm:analysis-rendered',()=>{setSnap('half');sync();});
document.addEventListener('click',event=>{if(event.target.closest('.mobile-show-place'))setSnap('collapsed');});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active&&!document.querySelector('dialog[open]'))setSnap('collapsed');});
sheet.addEventListener('focusin',event=>{if(active&&snap==='collapsed'&&!controls.contains(event.target))setSnap('half');});
document.addEventListener('focusin',event=>{
 if(active&&!sheet.contains(event.target)&&!event.target.closest('dialog')&&snap!=='collapsed')setSnap('collapsed');
});
window.addEventListener('beforeprint',()=>{active=false;sheet.dataset.sheetActive='false';home.style.minHeight='';setSnap('collapsed');});
window.addEventListener('afterprint',sync);
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',()=>{drag=null;delete sheet.dataset.dragging;sync();});
sync();
