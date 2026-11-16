import {createMapAnalysis} from './map-analysis.js';
import {state} from './state.js';
import {node,button,fmt,distance,motionReduced} from './ui.js';
import {savePlace} from './saved-places.js';
import {scoreText} from './result-format.js';

// Этот слой читает готовый расчёт. Он не меняет рекомендации или сетку сервера.
export function createMapInspector(map,{selectPoint=()=>{},selectRecommendation=()=>{}}={}){
 let analysis=null,popup=null,data=null,anchor=null;
 const mobile=matchMedia('(max-width:600px)');
 const plural=new Intl.PluralRules('ru');
 const count=(n,forms)=>fmt(n)+' '+forms[plural.select(n)];
 const signed=n=>(n<0?'−':n>0?'+':'')+fmt(Math.abs(n));
 let docked=false;

 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const layer=L.layerGroup().addTo(map);
 map.getPane('popupPane').style.zIndex='1000';
 function close(){if(popup){if(popup.getElement())popup.getElement().inert=true;map.closePopup(popup);}popup=null;anchor=null;docked=false;layer.clearLayers();}
 function keepVisible(){
  if(!popup?.isOpen())return;
  const element=popup.getElement(),rect=map.getContainer().getBoundingClientRect();
  const sheet=document.getElementById('recommendations'),header=document.getElementById('site-header').getBoundingClientRect();
  const viewport=window.visualViewport;
  const viewportEnd=(viewport?.offsetTop??0)+(viewport?.height??innerHeight);
  const sheetTop=sheet.dataset.sheetActive==='true'&&sheet.dataset.snap==='peek'?sheet.getBoundingClientRect().top:viewportEnd;
  const bottom=Math.min(rect.bottom,sheetTop,viewportEnd)-12;
  const top=Math.max(rect.top,header.bottom)+12,left=Math.max(0,rect.left)+12,right=Math.min(innerWidth,rect.right)-12;
  const compact=mobile.matches&&element.querySelector('.map-inspection-compact');
  if(compact) {
   element.style.setProperty('--inspection-max-height',Math.max(112,Math.floor((bottom-top+24)*.45))+'px');
   element.style.setProperty('--inspection-top',Math.max(0,top-rect.top)+'px');
   if(docked)return;
   docked=true;
   map.getContainer().append(element);
   element.classList.add('map-inspection-docked');
   const overlay=element.getBoundingClientRect();
   const points=[anchor,...(data?.recommendations||[]).map(rec=>[rec.lat,rec.lng])];
   const paddingTop=Math.max(32,overlay.bottom-rect.top+28);
   const paddingBottom=Math.max(58,rect.bottom-bottom+24);
   if(rect.height-paddingTop-paddingBottom>=48){
    map.fitBounds(points,{paddingTopLeft:[32,paddingTop],paddingBottomRight:[64,paddingBottom],maxZoom:map.getZoom(),animate:false});
   }
   return;
  }
  const box=element.getBoundingClientRect();
  const dx=box.right>right?box.right-right:box.left<left?box.left-left:0;
  const dy=box.top<top?box.top-top:box.bottom>bottom?box.bottom-bottom:0;
  if(dx||dy)map.panBy([dx,dy],{animate:!motionReduced(),duration:.3});
 }
 function show(point,content){
  anchor=[point.lat,point.lng];
  popup=L.popup({className:'map-inspection-popup',closeButton:false,autoPan:false,keepInView:false,maxWidth:300,minWidth:240,offset:[0,-12]})
   .setLatLng(anchor).setContent(content).openOn(map);
  requestAnimationFrame(keepVisible);
 }
 function card(title){
  const box=node('section','map-inspection');box.setAttribute('aria-label',title);box.setAttribute('role','region');
  const heading=node('div','map-inspection-heading'),h=node('h3','',title),x=button('×','map-inspection-close',()=>{close();map.getContainer().focus({preventScroll:true});});
  x.setAttribute('aria-label','Закрыть выноску');heading.append(h,x);box.append(heading);return box;
 }
 function facts(box,rec){
  box.classList.add('map-inspection-compact');
  const score=node('p','map-inspection-score',scoreText(rec.score));
  const reading=node('div','map-inspection-reading');
  reading.append(node('span','map-inspection-place-label',rec.origin==='manual'?'Ваша точка':`Место ${rec.rank}`),score);box.append(reading);
  const summary=node('p','map-inspection-mobile-summary');
  const residents=count(rec.residents_in_radius,{one:'житель',few:'жителя',many:'жителей',other:'жителей'});
  const rivals=count(rec.competitors_in_radius,{one:'конкурент',few:'конкурента',many:'конкурентов',other:'конкурентов'});
  summary.textContent=`В ${fmt(rec.radius_m)} м: ≈ ${residents} · ${rivals} по данным карты`;
  box.append(summary,node('p','map-inspection-desktop-facts',`≈ ${residents} в ${fmt(rec.radius_m)} м · ${rivals}`),
   node('p','map-inspection-desktop-facts',`Ближайший конкурент: ${distance(rec.nearest_competitor_m)}`));
  if(Math.round(rec.score*100)<40)reading.append(node('span','map-inspection-weak','слабое место'));
 }
 function saveAction(box,rec,label,showDetails){
  const actions=node('div','map-inspection-actions');
  const feedback=node('p','map-inspection-feedback');feedback.setAttribute('role','status');
  const save=button(label,'button secondary map-inspection-save',async()=>{
   save.disabled=true;
   const result=await savePlace(rec,{compare:true});
   if(!box.isConnected)return;
   save.disabled=false;
   feedback.textContent=result?.saved?(state.comparison.has(result.id)?'Сохранено и добавлено в сравнение':'Сохранено · в сравнении уже три места'):'Не удалось сохранить. Проверьте сообщение в сохранённых местах.';
   if(result?.saved){save.textContent='Сохранено';save.disabled=true;}
   requestAnimationFrame(keepVisible);
  });
  if(rec.origin==='manual'){
   save.replaceChildren(node('span','map-inspection-save-long',label),node('span','map-inspection-save-short','Сохранить'));
  }
  actions.append(save,button('О месте','button secondary',showDetails));
  box.append(actions,feedback);
 }
 function relativeNote(box) {
  const note=node('p','map-inspection-note','Оценка относительная, как у рекомендаций.');
  note.hidden=true;
  const info=button('i','map-inspection-info',()=>{
   note.hidden=!note.hidden;
   info.setAttribute('aria-expanded',String(!note.hidden));
   requestAnimationFrame(keepVisible);
  });
  info.title=note.textContent;
  info.setAttribute('aria-label','Об относительной оценке');
  info.setAttribute('aria-expanded','false');
  box.append(info,note);
 }
 function inspect(point){
  if(!analysis)return;
  close();const sample=analysis.sample(point),box=card(sample.inside?'Оценка этой точки':'Вне области расчёта');
  L.marker([point.lat,point.lng],{interactive:false,keyboard:false,icon:L.divIcon({className:'map-probe-target',iconSize:[20,20]})}).addTo(layer);
  if(!sample.inside)box.append(node('p','','Выберите точку внутри границы области.'));
  else if(!sample.available)box.append(node('p','','В этой части сетки нет оценки. Выберите другую точку.'));
  else{
   const rec=sample.recommendation;selectPoint(rec);facts(box,rec);box.dataset.score=String(Math.round(rec.score*100));
   relativeNote(box);
   const details=node('div','map-inspection-more');details.hidden=true;
   details.append(node('p','',`Радиус охвата: ${fmt(rec.radius_m)} м`));
   if(sample.difference){
    const d=sample.difference, heading=d.score<0?'Хуже лучшего':d.score>0?'Лучше лучшего':'На уровне лучшего';
    details.append(node('p','map-inspection-difference',`${heading}: ${signed(d.score)} баллов, ${signed(d.residents)} жителей`));
   }
   saveAction(box,rec,'Сохранить как своё место',event=>{
    details.hidden=!details.hidden;
    event.currentTarget.setAttribute('aria-expanded',String(!details.hidden));
    if(!details.hidden)details.scrollIntoView({block:'nearest'});
   });
   box.append(details);
  }
  show(point,box);
 }
 function openPlace(rec){
  close();const box=card(`Место ${rec.rank} · оценка`);facts(box,rec);
  relativeNote(box);
  saveAction(box,rec,'Сохранить',()=>{
   close();document.dispatchEvent(new CustomEvent('gm:place-details',{detail:{rank:rec.rank}}));
   if(!matchMedia('(max-width:600px)').matches){const card=document.querySelector(`#recommendation-list [data-rank="${rec.rank}"]`);card?.scrollIntoView({behavior:motionReduced()?'instant':'smooth',block:'nearest'});}
  });show(rec,box);
 }
 function openDemand(center,index){
  close();const box=card('Центр спроса');box.append(node('p','',`≈ ${fmt(center.residents)} жителей в кластере`));
  const related=data.recommendations.filter(rec=>rec.cluster_id===index+1);
  if(related.length){box.append(node('p','map-inspection-note','Связанные места для проверки:'));for(const rec of related)box.append(button(`Место ${rec.rank} · ${scoreText(rec.score)}`,'button secondary',()=>{selectRecommendation(rec);openPlace(rec);}));}
  else box.append(node('p','map-inspection-note','В этом кластере нет отдельной рекомендации.'));
  show(center,box);
 }
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&popup?.isOpen()){event.preventDefault();close();map.getContainer().focus({preventScroll:true});}});
 document.addEventListener('gm:sheet-settled',keepVisible);
 window.addEventListener('resize',()=>requestAnimationFrame(keepVisible));
 return {close,inspect,openPlace,openDemand,keepVisible,isOpen:()=>Boolean(popup?.isOpen()),setData(next){close();data=next;analysis=next?createMapAnalysis(next):null;}};
}
