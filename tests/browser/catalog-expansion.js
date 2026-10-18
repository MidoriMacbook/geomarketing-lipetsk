async original => {
  const context=await original.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  const base=new URL(original.url()).origin,errors=[],calls=[],checked=[];
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(new URL(request.url()).pathname==='/api/calculate')calls.push(request.url());});
  const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success'&&!document.getElementById('run').disabled,null,{timeout:70000});
  const choose=async(id,label)=>{await page.locator('#'+id+'-trigger').click();await page.getByRole('option',{name:label,exact:true}).click();};
  try{
    await page.goto(base);await ready();
    const catalog=await page.evaluate(()=>fetch('/api/catalog').then(r=>r.json()));
    assert(catalog.districts.length===10&&catalog.businesses.length===10,'Expanded catalog must contain ten districts and ten businesses');
    assert(catalog.districts.every(d=>d.radius_m===1000),'Preset radius changed');
    for(const [district,business] of [['pobeda','florist'],['traktorny','fitness'],['matyrsky','dentist']]){
      const area=catalog.districts.find(d=>d.key===district),type=catalog.businesses.find(b=>b.key===business);
      assert(area&&type,'Approved catalog entry missing');
      await choose('business',type.name);
      const before=calls.length,pending=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/calculate'&&url.searchParams.get('district')===district&&url.searchParams.get('type')===business;},{timeout:70000});
      await choose('district',area.name);
      const response=await pending,data=await response.json();await ready();
      assert(response.ok()&&data.source==='cache','New preset must work from a real snapshot');
      assert(calls.length===before+1,'Preset selection must make exactly one automatic request');
      const expected=[Math.round(data.stats.residents),data.stats.houses,data.stats.competitors,data.recommendations.length];
      assert(JSON.stringify((await page.locator('.kpis strong').allTextContents()).map(s=>Number(s.replace(/\s/g,''))))===JSON.stringify(expected),'New preset KPIs differ from API');
      assert(await page.getByTestId('recommendation-marker').count()===data.recommendations.length,'New preset markers are missing');
      assert(await page.locator('#map canvas').count()===2,'Map renderers leaked');
      assert((await page.locator('#business-parameters').textContent()).includes(String(type.radius_m)),'Model parameters differ from new category');
      checked.push({district,business,stats:expected});
    }
    const originalId=await page.evaluate(async()=>{const{state}=await import('/static/js/state.js');return state.current.analysis_id;});
    await page.locator('#scenario-save').click();await page.locator('#scenario-name').fill('Матырский — стоматология');
    await page.locator('#scenario-submit').click();await page.getByTestId('scenario-card').waitFor();
    await choose('business',catalog.businesses.find(b=>b.key==='fast_food').name);
    await choose('district',catalog.districts.find(d=>d.key==='nlmk').name);await ready();
    const beforeRestore=calls.length;await page.getByTestId('scenario-open').click();
    const restored=await page.evaluate(async()=>{const{state}=await import('/static/js/state.js');return{id:state.current.analysis_id,district:state.current.district,business:state.current.business};});
    assert(restored.id===originalId&&restored.district==='matyrsky'&&restored.business==='dentist','Expanded scenario did not restore');
    assert(calls.length===beforeRestore,'Opening expanded scenario recalculates it');
    await page.getByTestId('save-place').first().click();await page.getByTestId('saved-card').waitFor();
    await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{blob.text().then(text=>{window.__catalogCsv=text;});return original(blob);};window.print=()=>{window.__catalogPrinted=true;};});
    await page.locator('#export-csv').click();await page.waitForFunction(()=>typeof window.__catalogCsv==='string');
    assert(await page.evaluate(()=>window.__catalogCsv.includes('Стоматология')&&window.__catalogCsv.includes('Матырский')),'New catalog names absent from CSV');
    await page.locator('#print-report').click();
    assert(await page.evaluate(()=>window.__catalogPrinted&&document.getElementById('print-report-content').textContent.includes('Стоматология')),'New category missing from print');
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:900});await page.locator('#business-trigger').click();
      assert(await page.getByRole('option').count()===10,'Business menu lost categories');
      const box=await page.getByRole('listbox').boundingBox();
      assert(box.x>=8&&box.x+box.width<=width-8&&box.y>=8&&box.y+box.height<=900-8,'Expanded menu escapes viewport');
      await page.locator('#business-trigger').press('Escape');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow after catalog expansion');
    }
    assert(errors.length===0,errors.join(';'));
    return{pass:true,catalog:[10,10],checked,restored,csv:true,print:true,viewports:[390,768,1440],pageErrors:errors};
  }finally{await context.close();}
}
