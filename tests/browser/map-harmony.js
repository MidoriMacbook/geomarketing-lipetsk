async original=>{
 const context=await original.context().browser().newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 const assert=(ok,message)=>{if(!ok)throw new Error(message);};
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(new URL(original.url()).origin);
  await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  const sizes=[];
  for(const [width,scale] of [[360,1],[390,1],[430,1],[768,1],[1440,1],[390,2]]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(scale=>{document.documentElement.style.fontSize=100*scale+'%';},scale);
   const geometry=await page.evaluate(()=>{
    const panel=document.getElementById('recommendations'),style=getComputedStyle(panel),rect=panel.getBoundingClientRect();
    const notes=[...panel.querySelectorAll('.section-note,.score-note')].map(n=>n.getBoundingClientRect().left-rect.left);
    const buttons=[...document.querySelectorAll('.place-actions .button')].map(n=>({padding:parseFloat(getComputedStyle(n).paddingLeft),height:n.getBoundingClientRect().height}));
    const selectPadding=parseFloat(getComputedStyle(document.getElementById('business-trigger')||document.getElementById('business')).paddingLeft);
    return {width:innerWidth,scale:parseFloat(document.documentElement.style.fontSize)/100,padding:parseFloat(style.paddingLeft),notes,buttons,selectPadding,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert(geometry.padding>=16&&geometry.notes.every(n=>n>=16),'Recommendation text touches its panel border');
   assert(!geometry.overflow,'Mobile text overflows');
   assert(geometry.buttons.every(b=>b.height>=44),'Button target shrank');
   if(width<=600)assert(geometry.buttons.every(b=>b.padding>=12)&&geometry.selectPadding>=12,'Phone control labels remain too close to frame');
   sizes.push(geometry);
  }
  const map=await page.evaluate(async()=>{
   const {drawMap}=await import('/static/js/map.js'),{state}=await import('/static/js/state.js');
   const options=[],original=L.circleMarker;
   L.circleMarker=(p,o)=>{options.push(o);return original(p,o);};
   try{drawMap(state.current);}finally{L.circleMarker=original;}
   const style=getComputedStyle(document.documentElement);
   const roles=['house','competitor','centroid','zone-high'];
   const colors=roles.map(role=>style.getPropertyValue('--color-map-'+role).trim().toLowerCase());
   const legend=getComputedStyle(document.querySelector('.sw.competitors')),housesLegend=getComputedStyle(document.querySelector('.sw.houses'));
   const houses=options.filter(o=>o.fillColor?.toLowerCase()===colors[0]),competitors=options.filter(o=>o.fillColor?.toLowerCase()===colors[1]);
   const area=document.getElementById('map').getBoundingClientRect();
   return {colors,houseCount:houses.length,houseOpacities:[...new Set(houses.map(o=>o.fillOpacity))],competitorCount:competitors.length,competitorOutline:competitors[0]?.color,competitorOpacities:[...new Set(competitors.map(o=>o.fillOpacity))],ring:options.some(o=>o.fill===false&&o.color?.toLowerCase()===colors[2]),canvases:document.querySelectorAll('#map canvas').length,geometry:{width:area.width,height:area.height},legend:{fill:legend.backgroundColor,outline:legend.borderTopColor,houseFill:housesLegend.backgroundColor}};
  });
  assert(map.colors.join(',')==='#a9b7c6,#b46a72,#a8b58a,#c3d09f','Map roles must follow the approved editorial palette');
  assert(map.houseOpacities.length===1&&map.houseOpacities[0]===.78,'House circles must use approved .78 fill opacity');
  assert(map.houseCount>=100&&map.competitorCount>0&&map.geometry.width>=250&&map.geometry.height>=300,'Color check must render a real dense map with both marker roles');
  assert(map.competitorOutline.toLowerCase()==='#f7c8d3'&&map.competitorOpacities.length===1&&map.competitorOpacities[0]===1&&map.ring&&map.canvases===2,'Markers lose distinguishing outlines/rings or shared canvas');
  assert(map.legend.houseFill==='rgb(169, 183, 198)','House legend does not match the map');
  assert(map.legend.fill==='rgb(180, 106, 114)'&&map.legend.outline==='rgb(247, 200, 211)','Competitor legend does not match the map');
  assert(!errors.length,errors.join(';'));
  return {sizes,map,pageErrors:errors};
 }finally{await context.close();}
}
