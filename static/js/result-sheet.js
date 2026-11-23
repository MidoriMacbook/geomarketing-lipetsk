import {motionReduced,node} from './ui.js';
import {scoreText} from './result-format.js';
import {state} from './state.js';
import {selectPlace} from './recommendations.js';

const root=document.documentElement,sheet=document.getElementById('recommendations'),map=document.getElementById('map');
const mobile=matchMedia('(max-width:600px)'),controls=node('div','sheet-controls');
controls.innerHTML='<div class="sheet-top"><button class="sheet-handle" type="button" aria-expanded="false"><span class="sheet-summary">Мест нет</span><span class="sheet-more">Показать места <span aria-hidden="true">⌃</span></span></button><button class="sheet-close" type="button" aria-label="Закрыть результаты">×</button></div><div class="sheet-rail" aria-label="Места для проверки"></div>';
sheet.prepend(controls);
const handle=controls.querySelector('.sheet-handle'),rail=controls.querySelector('.sheet-rail'),closeButton=controls.querySelector('.sheet-close');
const scrim=node('button','sheet-scrim');scrim.type='button';scrim.tabIndex=-1;scrim.setAttribute('aria-label','Закрыть результаты');document.body.append(scrim);
const home=node('div','sheet-home');sheet.before(home);home.append(sheet);
const notes=[...sheet.querySelectorAll(':scope>.section-note,:scope>.recommendation-data-note')];
const details=node('details','result-data-details'),summary=node('summary','','Оценка и данные');details.append(summary,...notes);
let snap='peek',layout=false,active=false,ready=false,mapVisible=false,drag=null,skipClick=false,lastTapped=null;
let savedScroll=null,isolation=[],key='',settleTimer=0,readyTimer=0,pending=false;
const peekHeight=()=>128+Math.max(0,parseFloat(getComputedStyle(sheet).paddingBottom)-16);
const offset=()=>Math.max(0,sheet.getBoundingClientRect().height-peekHeight());
function syncReserve(){
 // Резерв нужен для прокрутки к последнему действию, а не как пустой блок под картой.
 const height=active&&sheet.isConnected?Math.min(sheet.getBoundingClientRect().height,snap==='peek'?peekHeight():Infinity):0;
 root.style.setProperty('--results-inset',`${height}px`);
}
function lockPage(lock){
 if(lock&&!savedScroll){
  savedScroll={x:scrollX,y:scrollY,position:document.body.style.position,top:document.body.style.top,width:document.body.style.width};
  Object.assign(document.body.style,{position:'fixed',top:`-${savedScroll.y}px`,width:'100%'});
 }else if(!lock&&savedScroll){
  const saved=savedScroll;savedScroll=null;Object.assign(document.body.style,{position:saved.position,top:saved.top,width:saved.width});
  scrollTo({left:saved.x,top:saved.y,behavior:'instant'});
 }
}
function isolate(on){
 if(on&&!isolation.length){
  for(let branch=sheet;branch.parentElement;branch=branch.parentElement){
   for(const sibling of branch.parentElement.children){
    if(sibling===branch||sibling===scrim||sibling.matches('#mobile-debug,#debug-toggle')||['SCRIPT','STYLE','LINK'].includes(sibling.tagName))continue;
    isolation.push([sibling,sibling.inert]);sibling.inert=true;
   }
   if(branch.parentElement===document.body)break;
  }
 }else if(!on&&isolation.length){for(const [el,value] of isolation)el.inert=value;isolation=[];}
}
function settle(){
 clearTimeout(settleTimer);delete sheet.dataset.moving;delete sheet.dataset.closing;delete root.dataset.sheetGesture;map.style.removeProperty('--map-gesture-height');
 if(pending){pending=false;document.dispatchEvent(new CustomEvent('gm:sheet-settled',{detail:{active,snap}}));}
}
function setSnap(next){
 if(snap==='expanded'&&next==='peek')sheet.dataset.closing='true';
 else if(next==='expanded')delete sheet.dataset.closing;
 snap=next;sheet.dataset.snap=snap;active=layout&&ready&&(mapVisible||snap==='expanded');
 const expanded=layout&&snap==='expanded';
 sheet.dataset.sheetLayout=String(layout);sheet.dataset.sheetActive=String(active);sheet.inert=layout&&!active;
 lockPage(expanded||Boolean(drag?.moved));isolate(expanded);
 scrim.dataset.open=String(expanded);scrim.inert=!expanded;
 sheet.setAttribute('role',expanded?'dialog':'region');
 if(expanded)sheet.setAttribute('aria-modal','true');else sheet.removeAttribute('aria-modal');
 handle.setAttribute('aria-expanded',String(expanded));closeButton.hidden=!expanded;rail.inert=expanded;
 sheet.style.setProperty('--sheet-offset',`${snap==='peek'?offset():0}px`);
 sheet.style.setProperty('--sheet-visible',`${snap==='peek'?peekHeight():sheet.getBoundingClientRect().height}px`);
 syncReserve();
 [...sheet.children].filter(el=>el!==controls).forEach(el=>{el.inert=layout&&snap==='peek';});
 const nextKey=[snap,active,layout,innerWidth,innerHeight].join(':');
 if(key!==nextKey){
  key=nextKey;pending=true;sheet.dataset.moving='true';clearTimeout(settleTimer);
  document.dispatchEvent(new CustomEvent('gm:sheet-position',{detail:{active,snap}}));
  if(layout)settleTimer=setTimeout(settle,motionReduced()?210:510);else settle();
 }
}
function sync(){
 if(!details.isConnected)document.getElementById('recommendation-list').before(details);
 const large=parseFloat(getComputedStyle(root).fontSize)>22;root.dataset.largeText=String(large);
 const next=mobile.matches&&!large;if(layout!==next)snap='peek';layout=next;setSnap(snap);
}
function close(){setSnap('peek');handle.focus({preventScroll:true});}
function expand(rank){
 if(!layout)return;
 setSnap('expanded');
 closeButton.focus({preventScroll:true});
 if(rank){
  const card=sheet.querySelector(`[data-rank="${rank}"]`),list=document.getElementById('result');
  if(card)requestAnimationFrame(()=>{list.scrollTop+=card.getBoundingClientRect().top-list.getBoundingClientRect().top;});
 }
}
function syncRail(){
 rail.querySelectorAll('[data-rank]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.rank)===state.selectedRank)));
}
function renderRail(data){
 const places=data.recommendations||[];rail.replaceChildren();lastTapped=null;
 controls.querySelector('.sheet-summary').textContent=places.length?`${places.length} ${places.length===1?'место':'места'} для проверки`:'Мест нет';
 for(const rec of places){
  const card=node('button','sheet-place');card.type='button';card.dataset.rank=rec.rank;
  card.setAttribute('aria-label',`Место ${rec.rank}, оценка ${scoreText(rec.score)}`);
  card.append(node('strong','',`Место ${rec.rank}`),node('span','',scoreText(rec.score)));
  card.addEventListener('click',()=>{
   const repeat=lastTapped===rec.rank&&state.selectedRank===rec.rank;lastTapped=rec.rank;selectPlace(rec.rank,false,true);
   if(repeat)expand(rec.rank);else document.dispatchEvent(new CustomEvent('gm:show-place',{detail:{rank:rec.rank}}));
  });rail.append(card);
 }
 if(!places.length)rail.append(node('p','sheet-empty','Попробуйте другую область или тип бизнеса.'));
 syncRail();
}
new IntersectionObserver(([entry])=>{
 const visible=entry.intersectionRatio>.4?true:entry.intersectionRatio<.2?false:mapVisible;
 if(visible!==mapVisible){mapVisible=visible;setSnap(snap);}
},{threshold:[0,.2,.4,1]}).observe(map);
new IntersectionObserver(([entry])=>{sheet.dataset.motionVisible=String(entry.isIntersecting);}).observe(sheet);
handle.addEventListener('click',event=>{if(skipClick&&event.detail){skipClick=false;return;}snap==='peek'?expand():close();});
closeButton.addEventListener('click',close);scrim.addEventListener('click',close);
handle.addEventListener('keydown',event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();event.key==='ArrowUp'?expand():close();}});
handle.addEventListener('pointerdown',event=>{
 if(!active||!event.isPrimary||event.button!==0)return;skipClick=false;
 drag={id:event.pointerId,y:event.clientY,offset:new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42,snap,moved:false};

});
window.addEventListener('pointermove',event=>{
 if(!drag||drag.id!==event.pointerId)return;
 drag.delta=event.clientY-drag.y;
 if(!drag.moved){
  if(Math.abs(drag.delta)<=8)return;
  drag.moved=true;
  map.style.setProperty('--map-gesture-height',`${map.getBoundingClientRect().height}px`);
  root.dataset.sheetGesture='true';sheet.dataset.dragging='true';
  handle.setPointerCapture(event.pointerId);lockPage(true);
 }
 sheet.style.setProperty('--sheet-offset',`${Math.max(0,Math.min(offset(),drag.offset+drag.delta))}px`);
});
function endDrag(event){
 if(!drag||drag.id!==event.pointerId)return;
 const previous=drag;drag=null;delete sheet.dataset.dragging;skipClick=previous.moved&&event.type==='pointerup';
 if(!previous.moved)return;
 key='';setSnap(event.type==='pointerup'&&Math.abs(previous.delta||0)>60?(previous.delta<0?'expanded':'peek'):previous.snap);
}
window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);
handle.addEventListener('lostpointercapture',endDrag);
window.addEventListener('touchmove',event=>{if(drag?.moved&&event.cancelable)event.preventDefault();},{passive:false});
window.addEventListener('wheel',event=>{if(drag?.moved&&event.cancelable)event.preventDefault();},{passive:false});
sheet.addEventListener('transitionend',event=>{if(event.target===sheet&&event.propertyName===(motionReduced()?'opacity':'transform'))settle();});
document.addEventListener('keydown',event=>{
 if(!layout||snap!=='expanded'||document.querySelector('dialog[open]'))return;
 if(event.key==='Escape'){event.preventDefault();close();}
 if(event.key==='Tab'){
  const items=[...sheet.querySelectorAll('button,a[href],input,summary,[tabindex="0"]')].filter(el=>!el.disabled&&!el.closest('[inert]')&&el.getClientRects().length);
  if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
 }
});
document.addEventListener('gm:analysis-rendered',event=>{
 if(event.detail.preserveViewport){renderRail(event.detail.data);if(ready)sync();return;}
 clearTimeout(readyTimer);renderRail(event.detail.data);ready=false;setSnap('peek');
 readyTimer=setTimeout(()=>{ready=true;sync();},175);
});
document.addEventListener('gm:recommendation-selected',syncRail);
document.addEventListener('gm:place-details',event=>expand(event.detail.rank));
document.addEventListener('gm:show-place',()=>setSnap('peek'));
document.addEventListener('gm:map-focus',()=>setSnap('peek'));
document.addEventListener('gm:settings-open',()=>setSnap('peek'));
document.addEventListener('gm:leave-results',()=>setSnap('peek'));
new MutationObserver(()=>{if(root.dataset.analysisState==='error'){clearTimeout(readyTimer);ready=true;controls.querySelector('.sheet-summary').textContent='Расчёт не завершён';setSnap('peek');}}).observe(root,{attributes:true,attributeFilter:['data-analysis-state']});
window.addEventListener('resize',sync);mobile.addEventListener('change',sync);new ResizeObserver(sync).observe(document.getElementById('site-header'));
new ResizeObserver(()=>{sheet.style.setProperty('--sheet-offset',`${snap==='peek'?offset():0}px`);syncReserve();}).observe(sheet);
let fontSize=root.style.fontSize;new MutationObserver(()=>{if(fontSize!==root.style.fontSize){fontSize=root.style.fontSize;sync();}}).observe(root,{attributes:true,attributeFilter:['style']});
window.addEventListener('beforeprint',()=>{layout=false;setSnap('peek');});window.addEventListener('afterprint',sync);
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',()=>{drag=null;delete sheet.dataset.dragging;settle();sync();});
sync();
