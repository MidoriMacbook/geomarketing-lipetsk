import {createMapAnalysis,findSavedRecommendation,placeLabel} from './map-analysis.js';
import {isAlternative} from './place-role.js';
import {state} from './state.js';
import {node,button,fmt,coords,dateText,motionReduced} from './ui.js';
import {scoreText} from './result-format.js';

export function createMapComparison(map,{onOpen=()=>{},onClose=()=>{},onSelectSaved=()=>{},onOpenSaved=()=>{},savedAlternativeIcon}={}){
 let data=null,analysis=null,opened=null,frame=0;
 const layer=L.layerGroup().addTo(map),banner=node('section','map-overlap');banner.hidden=true;map.getContainer().append(banner);
 L.DomEvent.disableClickPropagation(banner);L.DomEvent.disableScrollPropagation(banner);
 const pairs=node('div','coverage-pairs');pairs.hidden=true;pairs.id='coverage-pairs';pairs.setAttribute('aria-label','Выберите пару мест');
 const action=button('Сравнить охват на карте','button secondary',()=>{
  if(items().length===3){pairs.hidden=!pairs.hidden;action.setAttribute('aria-expanded',String(!pairs.hidden));}
  else open(items());
 }),hint=node('p','map-overlap-hint'),actions=node('div','coverage-actions');
 action.id='compare-coverage';actions.append(action,pairs,hint);document.querySelector('#comparison .table-scroll').after(actions);
 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const items=()=>state.saved.filter(item=>state.comparison.has(item.id));
 function clear(){opened=null;cancelAnimationFrame(frame);layer.clearLayers();banner.hidden=true;onClose();}
 function sync(){
  const rows=items(),valid=pair=>data&&pair.every(item=>item.analysis_id===data.analysis_id);
  action.hidden=rows.length<2;action.disabled=rows.length===2&&!valid(rows);
  action.textContent=rows.length===3?'Сравнить охват':'Сравнить охват на карте';
  pairs.hidden=true;pairs.replaceChildren();
  if(rows.length===3){
   action.setAttribute('aria-expanded','false');action.setAttribute('aria-controls','coverage-pairs');
   for(const [a,b] of [[0,1],[0,2],[1,2]]){
    const pair=[rows[a],rows[b]],chip=button(`${a+1} и ${b+1}`,'coverage-pair',()=>open(pair));
    chip.setAttribute('aria-label',`Сравнить варианты ${a+1} и ${b+1}`);chip.disabled=!valid(pair);pairs.append(chip);
   }
  }else{action.removeAttribute('aria-expanded');action.removeAttribute('aria-controls');}
  hint.textContent=rows.length<2?'Выберите ещё одно место для сравнения.':!valid(rows)?'Откройте исходное исследование выбранной пары: для общего охвата нужны дома того же расчёта.':'Общая аудитория считается по домам в обоих радиусах.';
  if(opened==='comparison')clear();
 }
 function frameCircles(bounds){
  const rect=map.getContainer().getBoundingClientRect(),sheet=document.getElementById('recommendations');
  const sheetHeight=sheet.dataset.sheetActive==='true'?parseFloat(sheet.style.getPropertyValue('--sheet-visible'))||148:0;
  const top=Math.max(banner.offsetHeight+30,document.getElementById('site-header').getBoundingClientRect().bottom-rect.top+18);
  const bottom=Math.max(30,rect.bottom-(innerHeight-sheetHeight)+24);
  map.fitBounds(bounds,{paddingTopLeft:[26,top],paddingBottomRight:[26,bottom],maxZoom:16,animate:!motionReduced(),duration:.35});
 }
 function open(rows){
  if(rows.length!==2||!data||!rows.every(item=>item.analysis_id===data.analysis_id))return;
  onOpen();opened='comparison';cancelAnimationFrame(frame);layer.clearLayers();banner.replaceChildren();
  banner.setAttribute('aria-label','Общая аудитория мест');
  const [a,b]=rows.map(item=>item.recommendation),overlap=analysis.overlap(a,b),bounds=L.latLngBounds([]);
  for(const [index,rec] of [a,b].entries()){
   const circle=L.circle([rec.lat,rec.lng],{radius:rec.radius_m,pane:'accessibility',interactive:false,color:token(index?'--palette-ink':'--palette-rosewood-deep'),weight:2,dashArray:index?'6 4':null,fillOpacity:.12});circle.addTo(layer);bounds.extend(circle.getBounds());
  }
  for(const house of overlap.shared)L.circleMarker([house.lat,house.lng],{pane:'selection',radius:5,interactive:false,color:token('--palette-ink'),fillColor:token('--palette-rosewood'),fillOpacity:1,weight:1}).addTo(layer);
  const heading=node('div','map-overlap-heading');heading.append(node('strong','',`Общих жителей: ${overlap.percent===null?'нет данных':`${Math.round(overlap.percent)} %`}`),button('×','map-inspection-close',clear));heading.lastChild.setAttribute('aria-label','Закрыть сравнение на карте');
  banner.append(heading,node('p','',`${placeLabel(a)} и ${placeLabel(b)} · ≈ ${fmt(overlap.residents)} общих жителей`),node('small','',`Доля от жителей объединённого охвата (${fmt(overlap.union)}). Общих домов: ${fmt(overlap.houses)}.`));
  if(overlap.percent>50)banner.append(node('p','map-overlap-warning','Эти места почти не отличаются по аудитории.'));
  banner.hidden=false;document.dispatchEvent(new Event('gm:map-focus'));map.getContainer().scrollIntoView({behavior:'instant',block:'center'});
  frame=requestAnimationFrame(()=>{if(opened==='comparison')frameCircles(bounds);});
 }
 function openSaved(item){
  const saved=item.recommendation;
  if(!isAlternative(saved))return;
  const current=findSavedRecommendation(data,item);
  document.dispatchEvent(new Event('gm:map-focus'));
  map.getContainer().scrollIntoView({behavior:'instant',block:'center'});
  if(current){
   onSelectSaved(current);
   const title=document.getElementById('map-title');
   title.tabIndex=-1;title.focus({preventScroll:true});
   return;
  }
  if(!savedAlternativeIcon)return;
  onOpen();onOpenSaved();opened='saved';cancelAnimationFrame(frame);layer.clearLayers();
  const title=placeLabel(saved),latLng=L.latLng(saved.lat,saved.lng);
  const marker=L.marker(latLng,{icon:savedAlternativeIcon(saved),title,interactive:false,keyboard:false,zIndexOffset:1200}).addTo(layer);
  marker.getElement().dataset.savedPlaceId=item.id;
  const heading=node('div','map-overlap-heading'),label=node('strong','',title);
  label.tabIndex=-1;
  const close=button('×','map-inspection-close',()=>{clear();map.getContainer().focus({preventScroll:true});});
  close.setAttribute('aria-label','Закрыть сохранённое место на карте');
  heading.append(label,close);
  banner.setAttribute('aria-label','Сохранённое место');
  banner.replaceChildren(heading,node('p','',`Сохранённое место · ${item.district_name} · ${item.business_name}`),
   node('p','',`${coords(saved)} · ${scoreText(saved.score)} внутри сохранённого расчёта`),
   node('small','',`Дата данных: ${dateText(item.data_date)}`));
  banner.hidden=false;label.focus({preventScroll:true});
  frame=requestAnimationFrame(()=>{if(opened==='saved')frameCircles(latLng.toBounds(saved.radius_m*2));});
 }
 document.addEventListener('gm:comparison-changed',sync);document.addEventListener('gm:recommendation-selected',()=>{if(opened)clear();});
 document.addEventListener('gm:saved-place-open',event=>openSaved(event.detail.item));
 return {clear,isOpen:()=>opened!==null,setData(next){clear();data=next;analysis=next?createMapAnalysis(next):null;sync();}};
}
