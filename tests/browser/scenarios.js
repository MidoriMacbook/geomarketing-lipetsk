async original => {
 const context=await original.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
 const base=new URL(original.url()).origin,errors=[],assert=(ok,message)=>{if(!ok)throw new Error(message);};
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/scenario-fixture',route=>route.fulfill({path:'tests/fixtures/scenario-custom-api-v1.json',contentType:'application/json'}));
  let apiCalls=0;
  await page.route('**/api/calculate?**',route=>{
   apiCalls++;
   if(new URL(route.request().url()).searchParams.get('district')==='custom')return route.fulfill({path:'tests/fixtures/scenario-custom-api-v1.json',contentType:'application/json'});
   return route.continue();
  });
  await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  assert(await page.locator('#scenario-save').count()===1,'Full analysis scenarios are not available');
  assert(await page.locator('#data-quality [data-testid="data-quality-block"]').count()===1,'Result quality is missing');
  await page.locator('#district').selectOption('custom',{force:true});
  await page.evaluate(async()=>{
   const data=await fetch('/scenario-fixture').then(r=>r.json()),{state}=await import('/static/js/state.js');
   state.customPoint=data.center;
  });
  await page.locator('#run').click();await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  await page.locator('.place-select').nth(1).click();
  await page.locator('#thr').evaluate(n=>{n.value='95';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#layer-houses').uncheck();await page.locator('#layer-zones').uncheck();
  await page.locator('#scenario-save').click();await page.locator('#scenario-name').fill('Своя область — контекст');
  await page.locator('#scenario-note').fill('Проверить помещение и конкурентов');await page.locator('#scenario-submit').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="scenario-card"]').length===1||!document.getElementById('scenario-form-error').hidden);
  assert(await page.getByTestId('scenario-card').count()===1,'Real custom API snapshot was rejected: '+await page.locator('#scenario-form-error').textContent());
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('geomarketing.scenarios.v1')).scenarios[0]);
  assert(saved.selection.district==='custom'&&saved.analysis.district==='custom_52.6000_39.5000_1000','Custom control and backend identities are mixed');
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  const before=apiCalls;await page.getByTestId('scenario-open').click();
  const restored=await page.evaluate(async()=>{const{state}=await import('/static/js/state.js');return{analysis:state.current.analysis_id,rank:state.selectedRank,point:state.customPoint,key:state.currentRequestKey};});
  assert(restored.analysis===saved.analysis.analysis_id&&restored.rank===2,'Snapshot or selected recommendation was not restored');
  assert(await page.locator('#district').inputValue()==='custom'&&await page.locator('#thr').inputValue()==='95','Scenario controls were not restored');
  assert(!await page.locator('#layer-houses').isChecked()&&!await page.locator('#layer-zones').isChecked(),'Scenario layers were not restored');
  assert(apiCalls===before,'Opening snapshot makes a new calculate request');
  assert(restored.key.includes('district=custom')&&restored.key.includes('lat=52.60000'),'Restored request key differs from custom input');
  await page.evaluate(async()=>{
   const {state}=await import('/static/js/state.js'),data=structuredClone(state.current),native=window.fetch;
   data.analysis_id='late-ignored-response';
   window.fetch=(input,options)=>{
    if(String(input).startsWith('/api/calculate?')){
     window.fetch=native;
     return new Promise(resolve=>{window.__releaseScenarioRequest=()=>resolve(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));});
    }
    return native(input,options);
   };
  });
  await page.locator('#data-details').evaluate(details=>{details.open=true;});
  await page.locator('#refresh-data').click();await page.waitForFunction(()=>typeof window.__releaseScenarioRequest==='function');
  await page.getByTestId('scenario-open').click();await page.evaluate(()=>window.__releaseScenarioRequest());
  await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  assert(await page.evaluate(async()=>{const{state}=await import('/static/js/state.js');return state.current.analysis_id;})===saved.analysis.analysis_id,'Late response overwrote restored snapshot');
  const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));
  await other.goto(base);await other.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  await other.evaluate(()=>{
   navigator.locks.request('geomarketing.scenarios.v1.write',async()=>{
    window.__scenarioLocked=true;await new Promise(resolve=>{window.__releaseScenarioLock=resolve;});
   });
  });
  await other.waitForFunction(()=>window.__scenarioLocked);
  await page.locator('#scenario-save').click();await page.locator('#scenario-name').fill('Снимок до ожидания');await page.locator('#scenario-submit').click();
  await page.evaluate(()=>{const field=document.getElementById('business');field.value='pharmacy';field.dispatchEvent(new Event('change',{bubbles:true}));});
  await other.evaluate(()=>window.__releaseScenarioLock());
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="scenario-card"]').length===2);
  const queued=await page.evaluate(()=>JSON.parse(localStorage.getItem('geomarketing.scenarios.v1')).scenarios.at(-1));
  assert(queued.analysis.analysis_id===saved.analysis.analysis_id&&queued.selection.business==='cafe','Queued save captured the changed filters instead of original analysis');
  await other.waitForFunction(()=>document.querySelectorAll('[data-testid="scenario-card"]').length===2);
  await page.getByTestId('scenario-compare').first().click();await page.getByTestId('scenario-compare').nth(1).click();
  assert(await page.locator('#scenario-comparison table').count()===1,'Two-scenario comparison missing');
  await other.evaluate(async()=>{const{mutateScenarios}=await import('/static/js/scenario-storage.js');await mutateScenarios(items=>items.slice(0,1));});
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="scenario-card"]').length===1);
  assert(await page.locator('#scenario-comparison table').count()===0,'Deleted cross-tab scenario remains in comparison');
  assert(await page.evaluate(async()=>{const{state}=await import('/static/js/state.js');return state.current===null&&state.openedScenarioId===null;}),'Changed filters retain archive result');
  await page.getByTestId('scenario-open').click();
  await page.getByTestId('save-place').first().click();await page.waitForFunction(()=>document.querySelectorAll('[data-testid="saved-card"]').length===1);
  await page.evaluate(()=>{
   const create=URL.createObjectURL;URL.createObjectURL=blob=>{blob.text().then(text=>{window.__scenarioCsv=text;});return create(blob);};
   window.print=()=>{window.__scenarioPrint=true;};
  });
  await page.locator('#export-csv').click();await page.waitForFunction(()=>typeof window.__scenarioCsv==='string');
  const csv=await page.evaluate(()=>window.__scenarioCsv);
  assert(csv.includes('Относительная оценка (только внутри расчёта)')&&csv.includes('Свежесть данных')&&csv.includes('Пригодность данных'),'Legacy CSV metadata or original columns missing');
  await page.locator('#print-report').click();assert(await page.evaluate(()=>window.__scenarioPrint),'Current report no longer prints');
  await page.emulateMedia({media:'print'});
  const printFacts=await page.locator('#print-report-content').evaluate(n=>({quality:!!n.querySelector('.quality-block'),explanations:n.querySelectorAll('.explanation-block').length,checks:[...n.querySelectorAll('.explanation-block li')].filter(e=>e.getBoundingClientRect().height>0).length}));
  assert(printFacts.quality&&printFacts.explanations===3&&printFacts.checks>0,'Printed quality/explanations are hidden');
  await page.emulateMedia({media:null});
  // Old API snapshots remain readable; a missing future category does not replace current analysis.
  await other.evaluate(async()=>{
   const{duplicateScenario,mutateScenarios}=await import('/static/js/scenario-storage.js');
   await mutateScenarios(items=>{const copy=duplicateScenario(items[0]);copy.selection.business='future-category';copy.analysis.business='future-category';copy.analysis.business_name='Будущая категория';copy.name='Архив недоступной категории';return [...items,copy];});
  });
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="scenario-card"]').length===2);
  await page.getByTestId('scenario-open').nth(1).click();
  assert(/недоступн/.test(await page.locator('#scenario-status').textContent()),'Missing category restoration has no reason');
  assert(await page.evaluate(async()=>{const{state}=await import('/static/js/state.js');return state.current.analysis_id;})===saved.analysis.analysis_id,'Missing category destroyed current analysis');
  const slow=await context.newPage();let releaseCatalog,releaseAuto;
  const catalogGate=new Promise(resolve=>{releaseCatalog=resolve;}),autoGate=new Promise(resolve=>{releaseAuto=resolve;});
  slow.on('pageerror',error=>errors.push(error.message));
  try{
   await slow.route('**/api/catalog',async route=>{await catalogGate;await route.continue().catch(()=>{});});
   await slow.route('**/api/calculate?**',async route=>{await autoGate;await route.continue().catch(()=>{});});
   await slow.goto(base);await slow.getByTestId('scenario-card').first().waitFor();
   await slow.getByTestId('scenario-open').first().click();
   assert(await slow.evaluate(async()=>{const{state}=await import('/static/js/state.js');return state.current===null;}),'Snapshot applied before catalog validation');
   releaseCatalog();await slow.waitForFunction(()=>document.documentElement.dataset.analysisState==='calculating');
   await slow.getByTestId('scenario-open').first().click();releaseAuto();
   await slow.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
   assert(await slow.evaluate(async()=>{const{state}=await import('/static/js/state.js');return state.current.analysis_id;})===saved.analysis.analysis_id,'Catalog auto-run overwrote restored snapshot');
  }finally{releaseCatalog();releaseAuto();await slow.close();}
  assert(errors.length===0,errors.join(';'));
  return {passed:['real custom API save/reload/restore','rank/threshold/layers','no-network restore','late response ignored','queued immutable save','two-tab storage/delete comparison','filter reset','legacy CSV quality','print visible explanations','unknown category preserves current','catalog/auto-run race'],apiCalls,printFacts,pageErrors:errors};
 }finally{await context.close();}
}
