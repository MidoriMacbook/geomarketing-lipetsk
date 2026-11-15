import {createMapAnalysis} from './map-analysis.js';
import {node,button,distance,motionReduced} from './ui.js';

export function createSelectionLayer(map){
 const pane=map.createPane('selection');pane.style.zIndex='424';pane.style.pointerEvents='none';
 const renderer=L.canvas({pane:'selection',padding:.5}),houses=L.layerGroup().addTo(map),rings=L.layerGroup().addTo(map),lines=L.layerGroup().addTo(map);
 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const control=button('Показать, как считается','map-explain-toggle',()=>{enabled=!enabled;control.setAttribute('aria-pressed',String(enabled));render();});
 control.id='map-explain-toggle';control.setAttribute('aria-pressed','true');document.querySelector('.map-legend').append(control);
 let analysis=null,selected=null,enabled=true,animation=null;
 const houseMarkers=new Map(),ringMarkers=new Map();
 function reconcile(layer,cache,items,options){
  const wanted=new Set(items.map(x=>x.index));
  layer.eachLayer(marker=>{if(!wanted.has(marker.options.itemIndex))layer.removeLayer(marker);});
  for(const item of items){let marker=cache.get(item.index);if(!marker){marker=L.circleMarker([item.lat,item.lng],{renderer,interactive:false,itemIndex:item.index,...options});cache.set(item.index,marker);}if(!layer.hasLayer(marker))marker.addTo(layer);}
 }
 function render(){
  lines.clearLayers();animation?.cancel();animation=null;
  const visible=enabled&&analysis&&selected;
  map.getContainer().dataset.explanation=String(Boolean(visible));
  if(!visible){houses.clearLayers();rings.clearLayers();return;}
  const coverage=analysis.coverage(selected,selected.radius_m);
  const houseVisible=document.getElementById('layer-houses').checked,competitorVisible=document.getElementById('layer-competitors').checked;
  reconcile(houses,houseMarkers,houseVisible?coverage.members:[],{radius:4,stroke:true,weight:1,color:token('--palette-ink'),fillColor:token('--palette-sky'),fillOpacity:1});
  reconcile(rings,ringMarkers,competitorVisible?coverage.nearby:[],{radius:9,color:token('--palette-rosewood-deep'),weight:2,fill:false});
  const origin=[selected.lat,selected.lng];
  if(coverage.nearest){
   const target=[coverage.nearest.lat,coverage.nearest.lng];
   L.polyline([origin,target],{pane:'selection',interactive:false,color:token('--palette-rosewood-deep'),weight:2,dashArray:'5 5'}).addTo(lines);
   L.marker([(origin[0]+target[0])/2,(origin[1]+target[1])/2],{pane:'selection',interactive:false,icon:L.divIcon({className:'map-distance',html:node('span','',distance(coverage.nearestDistance)),iconSize:null})}).addTo(lines);
  }
  if(coverage.demand)L.polyline([origin,[coverage.demand.lat,coverage.demand.lng]],{pane:'selection',interactive:false,color:token('--palette-ink'),weight:1.5,dashArray:'2 6'}).addTo(lines);
  if(!motionReduced())animation=pane.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'});
  map.getContainer().dataset.selectedHouses=String(coverage.members.length);
 }
 for(const id of ['layer-houses','layer-competitors'])document.getElementById(id).addEventListener('change',render);
 return {select(rec){selected=rec;render();},setData(data){analysis=data?createMapAnalysis(data):null;selected=null;houses.clearLayers();rings.clearLayers();houseMarkers.clear();ringMarkers.clear();render();}};
}
