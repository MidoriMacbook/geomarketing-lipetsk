import {createMapAnalysis} from './map-analysis.js';
import {state} from './state.js';
import {node,button,fmt,distance,motionReduced} from './ui.js';
import {savePlace} from './saved-places.js';
import {scoreText} from './result-format.js';

// Этот слой читает готовый расчёт. Он не меняет рекомендации или сетку сервера.
export function createMapInspector(map){
 let analysis=null,popup=null;
 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const layer=L.layerGroup().addTo(map);
 map.getPane('popupPane').style.zIndex='1000';
 function close(){if(popup)map.closePopup(popup);popup=null;layer.clearLayers();}
 function keepVisible(){
  if(!popup?.isOpen())return;
  const element=popup.getElement(),box=element.getBoundingClientRect(),rect=map.getContainer().getBoundingClientRect();
  const sheet=document.getElementById('recommendations'),header=document.getElementById('site-header').getBoundingClientRect();
  const bottom=Math.min(rect.bottom,innerHeight-(sheet.dataset.sheetActive==='true'?parseFloat(sheet.style.getPropertyValue('--sheet-visible'))||148:0))-12;
  const top=Math.max(rect.top,header.bottom)+12,left=Math.max(0,rect.left)+12,right=Math.min(innerWidth,rect.right)-12;
  const dx=box.right>right?box.right-right:box.left<left?box.left-left:0;
  const dy=box.top<top?box.top-top:box.bottom>bottom?box.bottom-bottom:0;
  if(dx||dy)map.panBy([dx,dy],{animate:!motionReduced(),duration:.3});
 }
 function show(point,content){
  popup=L.popup({className:'map-inspection-popup',closeButton:false,autoPan:false,keepInView:false,maxWidth:300,minWidth:240,offset:[0,-12]})
   .setLatLng([point.lat,point.lng]).setContent(content).openOn(map);
  requestAnimationFrame(keepVisible);
 }
 function card(title){
  const box=node('section','map-inspection');box.setAttribute('aria-label',title);box.setAttribute('role','region');
  const heading=node('div','map-inspection-heading'),h=node('h3','',title),x=button('×','map-inspection-close',()=>{close();map.getContainer().focus({preventScroll:true});});
  x.setAttribute('aria-label','Закрыть выноску');heading.append(h,x);box.append(heading);return box;
 }
 function facts(box,rec){
  box.append(node('p','map-inspection-score',scoreText(rec.score)),node('p','',`≈ ${fmt(rec.residents_in_radius)} жителей в ${fmt(rec.radius_m)} м · ${fmt(rec.competitors_in_radius)} конкурентов`),node('p','',`Ближайший конкурент: ${distance(rec.nearest_competitor_m)}`));
 }
 function saveAction(box,rec,label){
  const feedback=node('p','map-inspection-feedback');feedback.setAttribute('role','status');
  const save=button(label,'button secondary',async()=>{
   save.disabled=true;
   const result=await savePlace(rec,{compare:true});
   if(!box.isConnected)return;
   save.disabled=false;
   feedback.textContent=result?.saved?(state.comparison.has(result.id)?'Сохранено и добавлено в сравнение':'Сохранено · в сравнении уже три места'):'Не удалось сохранить. Проверьте сообщение в сохранённых местах.';
   if(result?.saved){save.textContent='Сохранено';save.disabled=true;}
   requestAnimationFrame(keepVisible);
  });box.append(save,feedback);
 }
 function inspect(point){
  if(!analysis)return;
  close();const sample=analysis.sample(point),box=card(sample.inside?'Оценка этой точки':'Вне области расчёта');
  L.circleMarker([point.lat,point.lng],{radius:7,weight:2,color:token('--color-primary'),fillColor:token('--palette-cream'),fillOpacity:1,interactive:false}).addTo(layer);
  if(!sample.inside)box.append(node('p','','Выберите точку внутри границы области.'));
  else if(!sample.available)box.append(node('p','','В этой части сетки нет оценки. Выберите другую точку.'));
  else{
   const rec=sample.recommendation;facts(box,rec);box.dataset.score=String(Math.round(rec.score*100));
   if(sample.difference){const d=sample.difference,signed=n=>n>0?`+${fmt(n)}`:fmt(n);box.append(node('p','map-inspection-difference',`По сравнению с лучшим: ${signed(d.score)} баллов · ${signed(d.residents)} жителей`));}
   box.append(node('p','map-inspection-note','Оценка относительная, как у рекомендаций.'));
   saveAction(box,rec,'Сохранить как своё место');
  }
  show(point,box);
 }
 function openPlace(rec){
  close();const box=card(`Место ${rec.rank} · оценка`);facts(box,rec);
  saveAction(box,rec,'Сохранить');
  box.append(button('Подробнее','button secondary',()=>{
   close();document.dispatchEvent(new CustomEvent('gm:place-details',{detail:{rank:rec.rank}}));
   if(!matchMedia('(max-width:600px)').matches){const card=document.querySelector(`#recommendation-list [data-rank="${rec.rank}"]`);card?.scrollIntoView({behavior:motionReduced()?'instant':'smooth',block:'nearest'});}
  }));show(rec,box);
 }
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&popup?.isOpen()){event.preventDefault();close();map.getContainer().focus({preventScroll:true});}});
 document.addEventListener('gm:sheet-settled',keepVisible);
 window.addEventListener('resize',()=>requestAnimationFrame(keepVisible));
 return {inspect,openPlace,keepVisible,isOpen:()=>Boolean(popup?.isOpen()),setData(next){close();analysis=next?createMapAnalysis(next):null;}};
}
