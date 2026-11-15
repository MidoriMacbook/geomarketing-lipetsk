import {createMapAnalysis,placeLabel} from './map-analysis.js';
import {state} from './state.js';
import {node,button,fmt,motionReduced} from './ui.js';

export function createMapComparison(map,{onOpen=()=>{},onClose=()=>{}}={}){
 let data=null,analysis=null,opened=false,frame=0;
 const layer=L.layerGroup().addTo(map),banner=node('section','map-overlap');banner.hidden=true;banner.setAttribute('aria-label','Общая аудитория мест');map.getContainer().append(banner);
 L.DomEvent.disableClickPropagation(banner);L.DomEvent.disableScrollPropagation(banner);
 const action=button('Сравнить охват на карте','button secondary',open),hint=node('p','map-overlap-hint');
 action.id='compare-coverage';document.getElementById('comparison-title').after(action,hint);
 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const items=()=>state.saved.filter(item=>state.comparison.has(item.id));
 function clear(){opened=false;cancelAnimationFrame(frame);layer.clearLayers();banner.hidden=true;onClose();}
 function sync(){
  const rows=items(),valid=rows.length===2&&data&&rows.every(item=>item.analysis_id===data.analysis_id);
  action.disabled=!valid;
  hint.textContent=rows.length!==2?'Для карты выберите ровно два места.':!valid?'Откройте их исходное исследование: для общего охвата нужны дома того же расчёта.':'Общая аудитория считается по домам в обоих радиусах.';
  if(opened)clear();
 }
 function frameCircles(bounds){
  const rect=map.getContainer().getBoundingClientRect(),sheet=document.getElementById('recommendations');
  const sheetHeight=sheet.dataset.sheetActive==='true'?parseFloat(sheet.style.getPropertyValue('--sheet-visible'))||148:0;
  const top=Math.max(banner.offsetHeight+30,document.getElementById('site-header').getBoundingClientRect().bottom-rect.top+18);
  const bottom=Math.max(30,rect.bottom-(innerHeight-sheetHeight)+24);
  map.fitBounds(bounds,{paddingTopLeft:[26,top],paddingBottomRight:[26,bottom],maxZoom:16,animate:!motionReduced(),duration:.35});
 }
 function open(){
  const rows=items();if(action.disabled||rows.length!==2)return;
  onOpen();opened=true;layer.clearLayers();banner.replaceChildren();
  const [a,b]=rows.map(item=>item.recommendation),overlap=analysis.overlap(a,b),bounds=L.latLngBounds([]);
  for(const [index,rec] of [a,b].entries()){
   const circle=L.circle([rec.lat,rec.lng],{radius:rec.radius_m,pane:'accessibility',interactive:false,color:token(index?'--palette-ink':'--palette-rosewood-deep'),weight:2,dashArray:index?'6 4':null,fillOpacity:.12});circle.addTo(layer);bounds.extend(circle.getBounds());
  }
  for(const house of overlap.shared)L.circleMarker([house.lat,house.lng],{pane:'selection',radius:5,interactive:false,color:token('--palette-ink'),fillColor:token('--palette-rosewood'),fillOpacity:1,weight:1}).addTo(layer);
  const heading=node('div','map-overlap-heading');heading.append(node('strong','',`Общих жителей: ${overlap.percent===null?'нет данных':`${Math.round(overlap.percent)} %`}`),button('×','map-inspection-close',clear));heading.lastChild.setAttribute('aria-label','Закрыть сравнение на карте');
  banner.append(heading,node('p','',`${placeLabel(a)} и ${placeLabel(b)} · ≈ ${fmt(overlap.residents)} общих жителей`),node('small','',`Доля от жителей объединённого охвата (${fmt(overlap.union)}). Общих домов: ${fmt(overlap.houses)}.`));
  if(overlap.percent>50)banner.append(node('p','map-overlap-warning','Эти места почти не отличаются по аудитории.'));
  banner.hidden=false;document.dispatchEvent(new Event('gm:map-focus'));map.getContainer().scrollIntoView({behavior:'instant',block:'center'});
  frame=requestAnimationFrame(()=>{if(opened)frameCircles(bounds);});
 }
 document.addEventListener('gm:comparison-changed',sync);document.addEventListener('gm:recommendation-selected',()=>{if(opened)clear();});
 return {clear,isOpen:()=>opened,setData(next){clear();data=next;analysis=next?createMapAnalysis(next):null;sync();}};
}
