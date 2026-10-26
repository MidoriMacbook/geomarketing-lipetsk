async original=>{
 const base=new URL(original.url()).origin,browser=original.context().browser(),results=[];
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const context=await browser.newContext({viewport:{width:390,height:1000},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1400);
  const kpi=key=>page.locator('#kpi-'+key).locator('..').locator('.kpi-replay');
  await kpi('competitors').tap();await page.waitForTimeout(350);
  check(await kpi('competitors').getAttribute('aria-pressed')==='true','Touch KPI focus absent');
  check((await page.locator('#map-guide-message').textContent()).includes('Категория:'),'Touch category explanation');
  const id=await page.evaluate(async()=>(await import('/static/js/state.js')).state.current.analysis_id);
  await page.locator('#business-trigger').click();await page.getByRole('option').nth(1).click();
  await page.waitForTimeout(50);
  check(await page.locator('.kpi-replay[aria-pressed=true]').count()===0,'Filter reset retains focus');
  check((await page.locator('#analysis-context').textContent()).includes('не выполнен'),'Filter reset keeps old date');
  await page.locator('#run').click();await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  check(await page.evaluate(async()=>(await import('/static/js/state.js')).state.current.analysis_id)!==id,'New category did not calculate');
  for(const scale of [1,2])for(const width of [320,360,390,430]){
   await page.setViewportSize({width,height:1000});await page.evaluate(scale=>document.documentElement.style.fontSize=scale===2?'200%':'',scale);await page.waitForTimeout(80);
   const state=await page.evaluate(()=>{
    const title=document.getElementById('page-title'),em=title.querySelector('em'),previous=em.previousElementSibling,a=em.getBoundingClientRect(),b=previous.getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,text:title.textContent.replace(/\s+/g,' ').trim(),gap:a.left-b.right,sameLine:Math.abs(a.top-b.top)<10};
   });
   check(!state.overflow,`Hero overflow ${width}/${scale}`);
   check(state.text.includes('есть своё место.'),'Hero text changed');
   check(!state.sameLine||state.gap>=1,`Italic word sticks ${width}/${scale}`);
  }
  await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await kpi('residents').tap();await page.waitForTimeout(400);
  const message=page.locator('#map-guide-message');
  const clipped=await message.evaluate(e=>e.scrollHeight>e.clientHeight+1);
  if(clipped)check(await message.evaluate(e=>e.tabIndex>=0),'Scrollable guide text is not keyboard reachable');
  await page.screenshot({path:'tests/artifacts/workspace-guide-touch-200.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await kpi('houses').tap();
  check(await page.locator('#map').evaluate(e=>e.getAnimations({subtree:true}).length===0),'Reduced map still animates');
  check(errors.length===0,errors.join('; '));results.push({touch:true,heroWidths:[320,360,390,430],textScale200:true,reduced:true});
 }finally{await context.close();}
 const fallback=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
 try{
  const page=await fallback.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/static/vendor/leaflet/leaflet.js',route=>route.abort());await page.goto(base);
  await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  await page.locator('#kpi-residents').locator('..').locator('.kpi-replay').click();
  check(await page.locator('#map-guide').evaluate(e=>e.open),'No-Leaflet explanation unavailable');
  check(await page.locator('#map-status').isVisible(),'No-Leaflet warning missing');
  check(errors.length===0,errors.join('; '));results.push({noLeaflet:true,pageErrors:errors});
 }finally{await fallback.close();}
 return {ok:true,results};
}
