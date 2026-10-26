async original=>{
 const context=await original.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),page=await context.newPage(),errors=[];
 const assert=(ok,message)=>{if(!ok)throw new Error(message);};
 const base=new URL(original.url()).origin;
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.addInitScript(()=>{
   window.__typed=false;
   new MutationObserver(()=>{if(document.querySelector('.typed-char'))window.__typed=true;}).observe(document,{childList:true,subtree:true});
  });
  await page.goto(base);
  assert(!await page.evaluate(()=>window.__typed),'Letter-by-letter typing is still enabled');
  await page.waitForFunction(()=>document.getElementById('hero-motion-root')?.dataset.heroReady==='true');
  await page.waitForFunction(()=>!document.querySelector('#page-title .hero-word'));
  const heading=page.locator('#page-title');

  const exact=await heading.textContent(),ax=await heading.ariaSnapshot();
  const opacity=await heading.evaluate(n=>Number(getComputedStyle(n).opacity));
  assert(opacity===1,'Completed editorial heading is not fully visible');
  assert(ax.includes('У каждого бизнеса есть своё место.'),'The full heading is not accessible');

  await page.waitForFunction(()=>getComputedStyle(document.getElementById('page-title')).opacity==='1');
  const geometry=[];
  for(const [width,scale] of [[390,1],[768,1],[390,2]]){
   await page.setViewportSize({width,height:1000});
   await page.reload();
   await page.waitForFunction(()=>document.getElementById('hero-motion-root')?.dataset.heroReady==='true');
  await page.waitForFunction(()=>!document.querySelector('#page-title .hero-word'));
   await page.evaluate(scale=>{document.documentElement.style.fontSize=100*scale+'%';},scale);
   await page.evaluate(()=>document.fonts.ready);
   const before=await heading.evaluate(n=>n.offsetHeight);

   const after=await heading.evaluate(n=>n.offsetHeight);
   assert(before===after,'Heading entrance changes geometry');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Heading creates overflow');
   assert(await page.locator('.kpis>div').evaluateAll(cards=>cards.every(n=>parseFloat(getComputedStyle(n).paddingLeft)>=16)),'KPI card text touches its border');
   geometry.push({width,scale,height:after});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  const surfaces=await page.evaluate(()=>['settings','map-card','recommendations'].map(id=>getComputedStyle(document.getElementById(id)).backgroundColor));
  assert(surfaces.every(color=>color==='rgb(255, 255, 255)'),'Editorial work panels should use white surfaces');
  const map=await page.evaluate(async()=>{
   const {drawMap,drawZones}=await import('/static/js/map.js'),{state}=await import('/static/js/state.js');
   const circles=[],zones=[],circle=L.circleMarker,rectangle=L.rectangle;
   L.circleMarker=(p,o)=>{circles.push(o);return circle(p,o);};
   L.rectangle=(b,o)=>{zones.push(o);return rectangle(b,o);};
   try{drawMap(state.current);drawZones();}finally{L.circleMarker=circle;L.rectangle=rectangle;}
   const styles=getComputedStyle(document.documentElement);
   return {colors:['house','competitor','centroid','zone-high'].map(role=>styles.getPropertyValue('--color-map-'+role).trim()),ring:circles.some(o=>o.fill===false&&o.weight>=3),opacity:Math.max(...zones.map(o=>o.fillOpacity)),canvases:document.querySelectorAll('#map canvas').length};
  });
  const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  assert(map.colors.every((color,i)=>map.colors.slice(i+1).every(other=>Math.hypot(...rgb(color).map((v,j)=>v-rgb(other)[j]))>=20)),'Map roles need different colours and distinguishing rings');
  assert(map.ring&&map.opacity<=.45&&map.canvases===5,'Map styles/renderers regressed');
  assert(await page.locator('.sw.centroids').evaluate(n=>parseFloat(getComputedStyle(n).borderTopWidth)>=2),'Centroid legend lacks ring');
  for(const mode of ['reduce','print']){
   await page.reload();
   await page.waitForFunction(()=>document.getElementById('hero-motion-root')?.dataset.heroReady==='true');
  await page.waitForFunction(()=>!document.querySelector('#page-title .hero-word'));
   await page.emulateMedia(mode==='reduce'?{reducedMotion:'reduce'}:{media:'print'});
   assert(await heading.textContent()===exact,'Motion preference changes heading text');
   assert(await heading.evaluate(n=>getComputedStyle(n).animationName)==='none','Heading animation ignores reduced motion/print');
   await page.emulateMedia({media:'screen',reducedMotion:'no-preference'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  assert(await heading.evaluate(n=>getComputedStyle(n).opacity)==='1','Initial reduced motion hides heading');
  const fallback=await context.newPage();
  fallback.on('pageerror',error=>errors.push(error.message));
  try{
   await fallback.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked');}});Element.prototype.animate=()=>{throw new Error('unsupported');};});
   await fallback.goto(base);
   await fallback.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
   assert(await fallback.locator('#page-title').textContent()===exact,'Storage/animation failure loses heading');
   assert(await fallback.locator('.typed-char').count()===0,'Typing nodes remain');
  }finally{await fallback.close();}
  assert(!errors.length,errors.join(';'));
  return {exact,ax,opacity,geometry,surfaces,map,pageErrors:errors};
 }finally{await context.close();}
}
