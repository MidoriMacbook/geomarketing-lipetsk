async original=>{
 const context=await original.context().browser().newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 const assert=(ok,message)=>{if(!ok)throw new Error(message);};
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(new URL(original.url()).origin);
  await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  const sizes=[];
  for(const [width,scale] of [[360,1],[390,1],[430,1],[768,1],[390,2]]){
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
   const colors=roles.map(role=>style.getPropertyValue('--color-map-'+role).trim());
   const legend=getComputedStyle(document.querySelector('.sw.competitors'));
   return {colors,houseOpacity:options[0].fillOpacity,competitorOutline:options.find(o=>o.fillColor===colors[1])?.color,ring:options.some(o=>o.fill===false&&o.color===colors[2]),canvases:document.querySelectorAll('#map canvas').length,legend:{fill:legend.backgroundColor,outline:legend.borderTopColor}};
  });
  assert(map.colors.join(',')==='#c58ca6,#b94f7b,#e4d2ee,#8c709a','Map colours are outside the approved rose/mauve family');
  assert(map.competitorOutline==='#f0d9e4'&&map.houseOpacity>=.95&&map.ring&&map.canvases===2,'Markers lose distinguishing outlines/rings or shared canvas');
  assert(map.legend.fill==='rgb(185, 79, 123)'&&map.legend.outline==='rgb(240, 217, 228)','Competitor legend does not match the map');
  assert(!errors.length,errors.join(';'));
  return {sizes,map,pageErrors:errors};
 }finally{await context.close();}
}
