async original=>{
 const context=await original.context().browser().newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 const assert=(ok,message)=>{if(!ok)throw new Error(message);},base=new URL(original.url()).origin;
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/legacy-fixture',route=>route.fulfill({path:'tests/fixtures/saved-places-v1.json',contentType:'application/json'}));
  await page.goto(base);
  const optionalCases=await page.evaluate(async()=>{
   const{checkedQuality,checkedExplanation}=await import('/static/js/data-quality.js');
   const qualities=[null,[],{version:1,completeness:{status:{toString:null,valueOf:null},reasons:[]}},{version:1,completeness:{status:'usable_for_model',reasons:[null]}}];
   const explanations=[null,[],{version:1,metrics:null,strengths:[],risks:[],field_checks:[]},{version:1,metrics:{},strengths:{length:1},risks:[],field_checks:[]}];
   return qualities.every(q=>checkedQuality(q)===null)&&explanations.every(e=>checkedExplanation(e)===null);
  });
  assert(optionalCases,'Invalid optional enrichment was treated as assessed');
  const damaged=await page.evaluate(async()=>{
   const rows=await fetch('/legacy-fixture').then(r=>r.json()),item=rows[0];
   item.data_quality={version:1,completeness:{status:'usable_for_model',reasons:{}}};
   item.recommendation.explanation={version:1,strengths:{length:1,0:'Повреждённые сведения'},risks:'строка',field_checks:[]};
   const raw=JSON.stringify([item]);localStorage.setItem('geomarketing.saved.v1',raw);return raw;
  });
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  assert(await page.getByTestId('saved-card').count()===1,'Damaged enrichment hides valid legacy base record');
  await page.evaluate(()=>{
   addEventListener('error',event=>{window.__legacyError=event.message;});
   const native=URL.createObjectURL;URL.createObjectURL=blob=>{blob.text().then(text=>{window.__legacyCsv=text;});return native(blob);};
   window.print=()=>{window.__legacyPrinted=true;};
  });
  await page.locator('#export-csv').click();await page.waitForFunction(()=>window.__legacyError||typeof window.__legacyCsv==='string');
  assert(!await page.evaluate(()=>window.__legacyError),'Malformed optional metadata blocks legacy CSV');
  assert((await page.evaluate(()=>window.__legacyCsv)).includes('Не оценено'),'Damaged quality is shown as assessed');
  await page.getByTestId('compare-place').check();await page.locator('#print-report').click();
  assert(await page.evaluate(()=>window.__legacyPrinted&&!window.__legacyError),'Malformed optional explanation blocks printing');
  assert((await page.locator('#print-report-content').textContent()).includes('не оценено'),'Malformed explanation has no honest fallback');
  assert(await page.evaluate(()=>localStorage.getItem('geomarketing.saved.v1'))===damaged,'Reading damaged enrichment silently rewrote storage');
  const localZero=await page.evaluate(async()=>{
   const{state}=await import('/static/js/state.js');return state.current.stats.competitors>0&&state.current.recommendations[0].competitors_in_radius===0;
  });
  assert(localZero,'Halo regression fixture no longer covers zero-local/nonempty sample');
  const explanation=await page.locator('#recommendation-list .explanation-block').first().textContent();
  assert(!explanation.includes('В выборке OSM конкуренты не отмечены'),'Zero local count falsely describes full sample');
  assert(!errors.length,errors.join(';'));
  return{legacyPreserved:true,csv:true,print:true,haloWording:true,pageErrors:errors};
 }finally{await context.close();}
}
