async original=>{
 const base=new URL(original.url()).origin,ctx=await original.context().browser().newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[];
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/static/vendor/leaflet/leaflet.js',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nL.Map.addInitHook(function(){window.__guidanceMap=this;window.__guidanceCreations=(window.__guidanceCreations||0)+1;});'});
 });
 try{
  await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);
  let calls=0;page.on('request',request=>{if(request.url().includes('/api/calculate'))calls++;});
  const button=key=>page.locator('#kpi-'+key).locator('..').locator('.kpi-replay');
  const snapshot=()=>page.evaluate(async()=>{const {state}=await import('/static/js/state.js');const map=window.__guidanceMap;return {data:JSON.stringify(state.current),rank:state.selectedRank,threshold:document.getElementById('thr').value,layers:[...document.querySelectorAll('.layers input')].map(e=>e.checked),raw:[...Object.keys(localStorage).sort()].map(key=>[key,localStorage.getItem(key)]),view:{center:map.getCenter(),zoom:map.getZoom(),size:map.getSize()},canvases:document.querySelectorAll('#map canvas').length};});
  const before=await snapshot();check(before.canvases===5,'Expected five persistent renderers');
  check(!await page.locator('#display-options').evaluate(e=>e.open),'Display should begin compact');
  await page.locator('#display-options-summary').focus();await page.keyboard.press('Enter');await page.waitForTimeout(350);
  check(await page.locator('#layer-houses').isVisible(),'Display Enter did not open layers');
  await page.keyboard.press('Escape');await page.waitForTimeout(350);
  check(!await page.locator('#display-options').evaluate(e=>e.open),'Display Escape did not close');
  for(const key of ['residents','houses','competitors','places']){
   await button(key).scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
   await button(key).click();await page.waitForTimeout(450);
   check(await page.locator('#map-card').getAttribute('data-kpi-focus')===key,'Missing map focus '+key);
   check(await page.locator('.kpi-replay[aria-pressed=true]').count()===1,'Multiple KPI pressed');
   const after=await snapshot();check(JSON.stringify(after)===JSON.stringify(before),'KPI changed data/view/storage '+key);
   check(Math.abs(await page.evaluate(()=>scrollY)-scroll)<2,'KPI automatically scrolled '+key);
   check(await page.locator('#map-guide').evaluate(e=>e.open),'Missing map explanation '+key);
   const message=await page.locator('#map-guide-message').textContent();check(message.length>40,'Empty explanation');
   if(key==='competitors')check(message.includes(JSON.parse(before.data).business_name),'Missing category');
  }
  await button('places').click();await page.waitForTimeout(450);check(await button('places').getAttribute('aria-pressed')==='false','Repeated KPI did not clear');
  await button('residents').focus();await page.keyboard.press('Enter');check(await button('residents').getAttribute('aria-pressed')==='true','Enter KPI');
  await page.keyboard.press('Space');check(await button('residents').getAttribute('aria-pressed')==='false','Space KPI');
  await page.keyboard.press('Enter');await page.keyboard.press('Escape');check(await button('residents').getAttribute('aria-pressed')==='false','Escape KPI');
  await page.locator('#display-options-summary').click();await page.waitForTimeout(350);await page.locator('#layer-houses').uncheck();await page.waitForTimeout(450);
  const hidden=await snapshot();const paths=()=>page.evaluate(()=>Object.values(window.__guidanceMap._layers).filter(layer=>layer.options?.renderer?.options?.pane==='houses'&&layer._latlng).length);
  check(await paths()===0,'House layer did not hide');
  await button('houses').click();await page.waitForTimeout(450);check(await paths()===JSON.parse(before.data).houses.length,'KPI did not temporarily expose houses');
  check(!await page.locator('#layer-houses').isChecked(),'KPI changed checkbox preference');
  check((await page.locator('#map-guide-message').textContent()).includes('Временно'),'Missing temporary-layer explanation');
  await page.locator('#scenario-save').click();await page.locator('#scenario-name').fill('Связь KPI и карты');await page.locator('#scenario-submit').click();await page.waitForFunction(()=>!document.getElementById('scenario-dialog').open);
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('geomarketing.scenarios.v1')).scenarios?.[0]||JSON.parse(localStorage.getItem('geomarketing.scenarios.v1')).records?.[0]);
  check(record&&record.view.layers.houses===false,'Research captured temporary visibility');
  await button('houses').click();await page.waitForTimeout(450);check(await paths()===0,'KPI clear did not restore hidden preference');
  await page.locator('#layer-houses').check();await page.waitForTimeout(60);await page.locator('#layer-houses').uncheck();await page.waitForTimeout(60);await page.locator('#layer-houses').check();await page.waitForTimeout(500);
  check(await paths()===JSON.parse(before.data).houses.length,'Rapid layer toggles lost latest visibility');
  await button('places').click();await page.locator('#map-guide-first').click();await page.waitForTimeout(500);
  check(await page.locator('[data-testid=recommendation-card] .place-select').first().evaluate(e=>document.activeElement===e),'Explicit jump did not focus first place');
  const card=page.getByTestId('recommendation-card').nth(1),rank=await card.getAttribute('data-rank');
  const oldRank=await page.evaluate(async()=>(await import('/static/js/state.js')).state.selectedRank),view=await page.evaluate(()=>JSON.stringify({center:window.__guidanceMap.getCenter(),zoom:window.__guidanceMap.getZoom()}));
  await card.locator('.place-select').focus();check(await card.evaluate(e=>e.classList.contains('is-preview')),'Keyboard card preview absent');
  check(await page.evaluate(async()=>(await import('/static/js/state.js')).state.selectedRank)===oldRank,'Preview selected a new rank');
  await card.locator('.place-select').click();await page.waitForTimeout(450);
  check(await page.evaluate(()=>JSON.stringify({center:window.__guidanceMap.getCenter(),zoom:window.__guidanceMap.getZoom()}))===view,'Recommendation selection panned map');
  check(await card.locator('.recommendation-brief>div').count()===4,'Missing structured explanation');
  const save=card.getByTestId('save-place'),saveBox=await save.boundingBox();await save.click();await page.waitForFunction(rank=>document.querySelector(`[data-testid="recommendation-card"][data-rank="${rank}"] .save-confirmation`).textContent.includes('Сохранено для сравнения'),rank);
  check(Math.abs((await save.boundingBox()).width-saveBox.width)<1,'Save changed button width');
  await page.evaluate(()=>Object.defineProperty(navigator,'locks',{configurable:true,value:undefined}));
  const denied=page.getByTestId('recommendation-card').first();await denied.getByTestId('save-place').click();await page.waitForTimeout(250);
  check(!(await denied.locator('.save-confirmation').textContent()).includes('Сохранено'),'Failed storage showed save success');await page.evaluate(()=>delete navigator.locks);
  const widths=[];
  for(const width of [390,768,1024,1440]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
   check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Overflow at '+width);
   const size=await page.locator('#map').boundingBox();await button('residents').click();await page.waitForTimeout(400);await page.locator('#map-guide-clear').click();await page.waitForTimeout(400);
   check(Math.abs((await page.locator('#map').boundingBox()).height-size.height)<1,'Guide changed map height '+width);
   widths.push(width);await page.locator('#workspace').scrollIntoViewIfNeeded();await page.screenshot({path:`tests/artifacts/workspace-after-${width}.png`});
  }
  await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.waitForTimeout(200);await button('competitors').click();await page.waitForTimeout(400);
  check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'200% overflow');
  const guide=await page.locator('#map-guide').boundingBox(),map=await page.locator('#map').boundingBox();check(guide.x>=map.x&&guide.x+guide.width<=map.x+map.width+1,'200% guide escapes map');
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  await page.emulateMedia({reducedMotion:'reduce'});await button('houses').click();check(await page.locator('.kpis').evaluate(e=>e.getAnimations({subtree:true}).length===0),'Reduced KPI still animates');
  await page.locator('#display-options-summary').focus();await page.keyboard.press('Escape');await page.waitForTimeout(20);
  check(!await page.locator('#display-options').evaluate(e=>e.open),'Reduced display did not close');
  check(await page.evaluate(()=>window.__guidanceCreations)===1,'Map instance recreated');
  check(calls===0,'Guidance interaction requested recalculation');
  await page.emulateMedia({reducedMotion:'no-preference'});
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-csv').click();
  const download=await downloadPromise;await download.saveAs('tests/artifacts/workspace-guidance.csv');
  await page.evaluate(()=>{window.__guidancePrint=0;window.print=()=>window.__guidancePrint++;});
  await button('competitors').click();await page.locator('#print-report').click();
  check(await page.evaluate(()=>window.__guidancePrint)===1,'Print not invoked');
  check(await page.locator('#print-report-content .report-place').count()>=1,'Missing report places');
  check(await page.locator('#print-report-content #map-guide').count()===0,'Transient guide leaked into print');
  const apiBeforeArchive=calls;await page.getByTestId('scenario-open').first().click();await page.waitForTimeout(400);
  check(calls===apiBeforeArchive,'Opening research requested API');
  check((await page.locator('#analysis-context').textContent()).includes('сохранённый'),'Archive source context missing');
  check(!await page.locator('#layer-houses').isChecked(),'Archive did not restore saved layer preference');
  await page.locator('#run').click();await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  check(calls===apiBeforeArchive+1,'New calculation request count');
  check(!(await page.locator('#analysis-context').textContent()).includes('сохранённый'),'New result retains archive context');
  if(!await page.locator('#data-details').evaluate(e=>e.open))await page.locator('#data-summary').click();
  await page.waitForTimeout(500);await page.locator('#refresh-data').click();await page.waitForFunction(()=>!document.getElementById('refresh-data').disabled);
  check((await page.locator('#refresh-status').textContent()).includes('данных')||(await page.locator('#refresh-status').textContent()).includes('версия'),'Refresh lost feedback');
  check(calls===apiBeforeArchive+2,'Refresh request count');
  check(errors.length===0,errors.join('; '));
  return {ok:true,widths,canvas:before.canvases,calls,checks:'focus semantics/keyboard/hidden layers/rapid toggles/guide dimensions/recommendations/save denial/scenario view/200%/reduce',pageErrors:errors};
 }finally{await ctx.close();}
}
