import {createMapAnalysis} from './map-analysis.js';
import {node,button,distance,motionReduced} from './ui.js';

export function createSelectionLayer(map){
 const pane=map.createPane('selection');pane.style.zIndex='424';pane.style.pointerEvents='none';
 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const palette={ink:token('--palette-ink'),house:token('--palette-sky-deep'),rosewood:token('--palette-rosewood-deep')};
 // Три рекомендации и один переиспользуемый слот ручной точки: память ограничена.
 const slots=Array.from({length:4},(_,index)=>{
  const name=`selection-${index}`,element=map.createPane(name,pane);element.style.visibility='hidden';
  return {name,element,key:null,group:null,renderer:null};
 });
 const control=button('Показать, как считается','map-explain-toggle',()=>{enabled=!enabled;control.setAttribute('aria-pressed',String(enabled));render();});
 control.id='map-explain-toggle';control.setAttribute('aria-pressed','true');document.querySelector('.map-legend').append(control);
 let analysis=null,selected=null,enabled=true,animation=null;
 function dispose(slot){slot.group?.clearLayers();slot.group?.remove();slot.renderer?.remove();slot.key=null;slot.group=null;slot.renderer=null;slot.element.style.visibility='hidden';}
 function prepare(slot,rec){
  const key=`${rec.lat}:${rec.lng}:${rec.radius_m}`;if(slot.key===key)return slot;
  dispose(slot);slot.key=key;slot.coverage=analysis.coverage(rec,rec.radius_m);
  slot.group=L.layerGroup().addTo(map);slot.renderer=L.canvas({pane:slot.name,padding:.5});
  slot.houses=L.layerGroup().addTo(slot.group);slot.rings=L.layerGroup().addTo(slot.group);
  for(const house of slot.coverage.members)L.circleMarker([house.lat,house.lng],{renderer:slot.renderer,interactive:false,radius:4,weight:1,color:palette.ink,fillColor:palette.house,fillOpacity:1}).addTo(slot.houses);
  for(const competitor of slot.coverage.nearby)L.circleMarker([competitor.lat,competitor.lng],{renderer:slot.renderer,interactive:false,radius:9,color:palette.rosewood,weight:2,fill:false}).addTo(slot.rings);
  const origin=[rec.lat,rec.lng],coverage=slot.coverage;
  if(coverage.nearest){
   const target=[coverage.nearest.lat,coverage.nearest.lng];
   L.polyline([origin,target],{pane:slot.name,interactive:false,color:palette.rosewood,weight:2,dashArray:'5 5'}).addTo(slot.group);
   L.marker([(origin[0]+target[0])/2,(origin[1]+target[1])/2],{pane:slot.name,interactive:false,icon:L.divIcon({className:'map-distance',html:node('span','',distance(coverage.nearestDistance)),iconSize:null})}).addTo(slot.group);
  }
  if(coverage.demand)L.polyline([origin,[coverage.demand.lat,coverage.demand.lng]],{pane:slot.name,interactive:false,color:palette.ink,weight:1.5,dashArray:'2 6'}).addTo(slot.group);
  return slot;
 }
 function render(){
  animation?.cancel();animation=null;slots.forEach(slot=>slot.element.style.visibility='hidden');
  const visible=enabled&&analysis&&selected;map.getContainer().dataset.explanation=String(Boolean(visible));if(!visible)return;
  const slot=prepare(slots[selected.origin==='manual'?3:Math.max(0,Math.min(2,selected.rank-1))],selected);
  for(const [key,id] of [['houses','layer-houses'],['rings','layer-competitors']]){
   const wanted=document.getElementById(id).checked;
   if(wanted&&!slot.group.hasLayer(slot[key]))slot.group.addLayer(slot[key]);
   else if(!wanted&&slot.group.hasLayer(slot[key]))slot.group.removeLayer(slot[key]);
  }
  slot.element.style.visibility='visible';
  if(!motionReduced())animation=slot.element.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'});
  map.getContainer().dataset.selectedHouses=String(slot.coverage.members.length);
 }
 for(const id of ['layer-houses','layer-competitors'])document.getElementById(id).addEventListener('change',render);
 return {select(rec){selected=rec;render();},setData(data){slots.forEach(dispose);analysis=data?createMapAnalysis(data):null;selected=null;
  if(data)for(const rec of data.recommendations.slice(0,3))prepare(slots[rec.rank-1],rec);
  render();}};
}
