import {motionReduced,animateUI} from './ui.js';
import {scoreText} from './result-format.js';

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
 animateUI(target,[{opacity:.75},{opacity:1}],'press-ring',{duration:350});
});

const sheet=document.getElementById('recommendations');
new IntersectionObserver(([entry])=>{sheet.dataset.motionVisible=String(entry.isIntersecting);}).observe(sheet);
const mobile=matchMedia('(max-width:600px)');
const controls=document.createElement('div');controls.className='sheet-controls';
controls.innerHTML='<button class="sheet-handle" type="button" aria-label="Изменить высоту результатов" aria-expanded="false"><span class="sheet-summary">Мест нет</span></button><button type="button" data-snap="peek" aria-label="Карта — свернуть результаты">Карта</button><button type="button" data-snap="half" aria-label="Места — показать половину панели результатов">Места</button><button type="button" data-snap="full" aria-label="Все — развернуть результаты полностью">Все</button>';
sheet.prepend(controls);
const handle=controls.querySelector('.sheet-handle');
const home=document.createElement('div');home.className='sheet-home';sheet.before(home);home.append(sheet);
let snap='peek',active=false,drag=null,suppressHandleClick=false,viewportKey='';
let mapVisible=false,ready=false,layout=false,scrollLock=null,pendingSettle=false;
let settleTimer=0;
let halfVisible=innerHeight*.48;
function lockPage(lock){
 if(lock&&!scrollLock){
  scrollLock={y:scrollY,x:scrollX,position:document.body.style.position,top:document.body.style.top,width:document.body.style.width};
  Object.assign(document.body.style,{position:'fixed',top:`-${scrollLock.y}px`,width:'100%'});
 }else if(!lock&&scrollLock){
  const saved=scrollLock;scrollLock=null;
  Object.assign(document.body.style,{position:saved.position,top:saved.top,width:saved.width});
  scrollTo({top:saved.y,left:saved.x,behavior:'instant'});
 }
}
function settleSheet(){
 clearTimeout(settleTimer);
 if(active&&snap!=='peek')sheet.style.setProperty('--sheet-content-visible',sheet.style.getPropertyValue('--sheet-visible'));
 delete sheet.dataset.moving;delete root.dataset.sheetGesture;
 document.getElementById('map').style.removeProperty('--map-gesture-height');
 if(pendingSettle){pendingSettle=false;document.dispatchEvent(new CustomEvent('gm:sheet-settled',{detail:{active,snap}}));}
}
sheet.addEventListener('transitionend',event=>{if(event.target===sheet&&event.propertyName===(motionReduced()?'opacity':'transform'))settleSheet();});
function offsets(){
 const height=sheet.getBoundingClientRect().height;
 return {peek:Math.max(0,height-72),half:Math.max(0,height-halfVisible),full:0};
}
function setSnap(value){
 snap=value;sheet.dataset.snap=snap;
 active=layout&&ready&&(mapVisible||snap!=='peek');
 sheet.dataset.sheetActive=String(active);sheet.dataset.sheetLayout=String(layout);
 sheet.inert=layout&&!active;
 lockPage(layout&&(snap!=='peek'||Boolean(drag)));
 handle.setAttribute('aria-expanded',String(snap!=='peek'));
 const nextKey=[active,snap,innerWidth,innerHeight].join(':');
 if(nextKey!==viewportKey&&active&&snap==='half'){
  const mapTop=Math.max(document.getElementById('site-header').getBoundingClientRect().bottom,document.getElementById('map').getBoundingClientRect().top);
  // В положении «Места» оставляем место карте, включая высокую строку слоёв.
  // Значение фиксируется на переходе, а не пересчитывается во время прокрутки/жеста.
  halfVisible=Math.max(200,Math.min(innerHeight*.48,innerHeight-mapTop-160));
 }
 controls.querySelectorAll('[data-snap]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.snap===snap)));
 if(layout){
  const offset=offsets()[snap];sheet.style.setProperty('--sheet-offset',`${offset}px`);
  sheet.style.setProperty('--sheet-visible',`${sheet.getBoundingClientRect().height-offset}px`);
 }
 if(nextKey!==viewportKey){
  viewportKey=nextKey;clearTimeout(settleTimer);
  const visible=parseFloat(sheet.style.getPropertyValue('--sheet-visible'))||0;
  const previous=parseFloat(sheet.style.getPropertyValue('--sheet-content-visible'))||visible;
  sheet.style.setProperty('--sheet-content-visible',`${Math.max(previous,visible)}px`);
  sheet.dataset.moving='true';pendingSettle=true;
  document.dispatchEvent(new CustomEvent('gm:sheet-position',{detail:{active,snap}}));
  if(!layout)settleSheet();else settleTimer=setTimeout(settleSheet,motionReduced()?200:380);
 }
 const collapsed=layout&&snap==='peek';
 controls.querySelectorAll('[data-snap]').forEach(button=>{button.inert=collapsed;});
 const busy=['calculating','refreshing'].includes(root.dataset.analysisState);
 [...sheet.children].filter(el=>el!==controls&& !el.classList.contains('section-heading')).forEach(el=>{el.inert=collapsed||(el.id==='result'&&busy);});
}
const notes=[...sheet.querySelectorAll(':scope>.section-note,:scope>.recommendation-data-note')].map(note=>{const home=document.createComment('note-home');note.before(home);return {note,home};});
const noteDetails=document.createElement('details');noteDetails.className='result-data-details';
const noteSummary=document.createElement('summary');noteSummary.textContent='Оценка и данные';noteDetails.append(noteSummary);
function sync(){
 if(!noteDetails.isConnected)document.getElementById('recommendation-list').before(noteDetails);
 for(const {note} of notes)if(note.parentElement!==noteDetails)noteDetails.append(note);
 const largeText=parseFloat(getComputedStyle(root).fontSize)>22;
 root.dataset.largeText=String(largeText);
 const nextLayout=mobile.matches&&!largeText;
 if(layout!==nextLayout)snap='peek';
 layout=nextLayout;
 setSnap(snap);
}
// Наблюдатель меняет только видимость: положение панели от прокрутки не зависит.
new IntersectionObserver(([entry])=>{
 const next=entry.intersectionRatio>.4?true:entry.intersectionRatio<.2?false:mapVisible;
 if(next!==mapVisible){mapVisible=next;setSnap(snap);}
},{threshold:[0,.2,.4,1]}).observe(document.getElementById('map'));
controls.addEventListener('click',event=>{const button=event.target.closest('[data-snap]');if(button)setSnap(button.dataset.snap);});
handle.addEventListener('click',()=>{if(suppressHandleClick){suppressHandleClick=false;return;}setSnap(snap==='peek'?'half':'peek');});
handle.addEventListener('keydown',event=>{
 if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();const steps=['peek','half','full'];setSnap(steps[Math.max(0,Math.min(2,steps.indexOf(snap)+(event.key==='ArrowUp'?1:-1)))]);}
});
handle.addEventListener('pointerdown',event=>{
 if(!active||event.button!==0)return;
 suppressHandleClick=false;
 const visualOffset=new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42;
 drag={id:event.pointerId,y:event.clientY,offset:visualOffset,snap,moved:false};
 lockPage(true);
 handle.setPointerCapture(event.pointerId);sheet.dataset.dragging='true';
 document.getElementById('map').style.setProperty('--map-gesture-height',`${document.getElementById('map').getBoundingClientRect().height}px`);
 root.dataset.sheetGesture='true';
 sheet.style.setProperty('--sheet-offset',`${visualOffset}px`);
});
handle.addEventListener('pointermove',event=>{
 if(!drag||drag.id!==event.pointerId)return;
 const delta=event.clientY-drag.y;if(Math.abs(delta)>5)drag.moved=true;
 drag.next=Math.max(0,Math.min(offsets().peek,drag.offset+delta));
 sheet.style.setProperty('--sheet-offset',`${drag.next}px`);
});
function endDrag(event){
 if(!drag||drag.id!==event.pointerId)return;
 const current=drag;drag=null;delete sheet.dataset.dragging;suppressHandleClick=current.moved;
 viewportKey='';
 if(event.type==='pointercancel')setSnap(current.snap);
 else if(current.moved&&Math.abs(current.next-current.offset)>70){
  const steps=['full','half','peek'],direction=current.next>current.offset?1:-1;
  const nearest=Object.entries(offsets()).sort((a,b)=>Math.abs(a[1]-current.next)-Math.abs(b[1]-current.next))[0][0];
  const adjacent=Math.max(0,Math.min(2,steps.indexOf(current.snap)+direction));
  // Короткий уверенный жест проходит хотя бы один шаг; длинный доходит до края.
  setSnap(steps[direction>0?Math.max(adjacent,steps.indexOf(nearest)):Math.min(adjacent,steps.indexOf(nearest))]);
 }
 else if(current.moved)setSnap(Object.entries(offsets()).sort((a,b)=>Math.abs(a[1]-current.next)-Math.abs(b[1]-current.next))[0][0]);
 else setSnap(snap);
 // Синтетический click после перетаскивания не переключает положение ещё раз.
 drag=null;
}
handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);
const preventGestureScroll=event=>{if(drag&&event.cancelable)event.preventDefault();};
window.addEventListener('touchmove',preventGestureScroll,{passive:false});
window.addEventListener('wheel',preventGestureScroll,{passive:false});
window.addEventListener('resize',sync);mobile.addEventListener('change',sync);
new ResizeObserver(sync).observe(document.getElementById('site-header'));
let fontSize=root.style.fontSize;
new MutationObserver(()=>{if(fontSize!==root.style.fontSize){fontSize=root.style.fontSize;sync();}}).observe(root,{attributes:true,attributeFilter:['style']});
document.addEventListener('gm:analysis-rendered',event=>{
 const places=event.detail.data.recommendations||[],count=places.length;
 controls.querySelector('.sheet-summary').textContent=count?`${count} ${count===1?'место':'места'} · лучшее ${scoreText(places[0].score)}`:'Мест нет';
 ready=true;setSnap('peek');sync();
});
new MutationObserver(()=>{if(root.dataset.analysisState==='error'){ready=true;controls.querySelector('.sheet-summary').textContent='Расчёт не завершён';setSnap('peek');}}).observe(root,{attributes:true,attributeFilter:['data-analysis-state']});
document.addEventListener('gm:pin-selected',()=>setSnap('half'));
document.addEventListener('gm:show-place',()=>setSnap('peek'));
document.addEventListener('gm:map-focus',()=>setSnap('peek'));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active&&!document.querySelector('dialog[open]')){handle.focus({preventScroll:true});setSnap('peek');}});
document.addEventListener('focusin',event=>{
 if(active&&!sheet.contains(event.target)&&!event.target.closest('dialog')&&snap!=='peek')setSnap('peek');
});
window.addEventListener('beforeprint',()=>{layout=false;setSnap('peek');});
window.addEventListener('afterprint',sync);
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',()=>{drag=null;delete sheet.dataset.dragging;settleSheet();sync();});
sync();
