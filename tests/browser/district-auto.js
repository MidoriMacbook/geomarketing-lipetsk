async original => {
  const context = await original.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page = await context.newPage(), base = new URL(original.url()).origin, errors = [], requests = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  page.on('pageerror', error => errors.push(error.message));
  try {
    const catalog = await (await context.request.get(base+'/api/catalog')).json(), fixtures = {};
    for (const district of catalog.districts) {
      const response = await context.request.get(base+`/api/calculate?district=${district.key}&type=cafe`,{timeout:70000});
      fixtures[district.key] = await response.json();
      assert(response.ok() && fixtures[district.key].status==='success','District fixture unavailable: '+district.key);
    }
    let hold = false, fail = false;
    await page.route('**/api/calculate?**', async route => {
      const district = new URL(route.request().url()).searchParams.get('district');
      const request = {district}; requests.push(request);
      if (hold) await new Promise(resolve => { request.release = resolve; });
      await route.fulfill(fail
        ? {status:503,json:{message:'Проверка недоступности данных'}}
        : {json:fixtures[district]}).catch(()=>{});
    });
    const waitDistrict = async key => {
      await page.waitForFunction(key => document.documentElement.dataset.analysisState==='success'
        && !document.getElementById('run').disabled && document.getElementById('district').value===key,key,{timeout:5000});
      assert(await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');return state.current?.district;})===key,'Rendered result differs from selected district');
    };
    const choose = async key => {
      await page.locator('#district-trigger').click();
      const name = key==='custom' ? 'Своя область на карте' : catalog.districts.find(d=>d.key===key).name;
      await page.getByRole('option',{name,exact:true}).click();
    };
    const checkNumbers = async key => {
      const data = fixtures[key], expected = [Math.round(data.stats.residents),data.stats.houses,data.stats.competitors,data.recommendations.length];
      const actual = await page.locator('.kpis strong').allTextContents();
      assert(JSON.stringify(actual.map(s=>Number(s.replace(/\s/g,''))))===JSON.stringify(expected),'Wrong district KPI values: '+key+' / '+JSON.stringify(actual));
      assert((await page.locator('#map-context').textContent()).includes(data.district_name),'Map label differs from numbers');
      assert(await page.getByTestId('recommendation-card').count()===data.recommendations.length,'Recommendations are missing');
    };
    await page.goto(base); await waitDistrict('eleytsky');
    const initialCalls = requests.length;
    hold = true;
    await choose('universitetsky');
    await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='calculating',null,{timeout:2000});
    assert(requests.length===initialCalls+1,'Changing district must start exactly one calculation');
    assert(await page.locator('#loading-hint').isVisible() && await page.locator('#run').isDisabled(),'Automatic calculation has no loading state');
    assert(await page.locator('#map').getAttribute('aria-busy')==='true','Map does not announce calculation');
    requests.at(-1).release(); await waitDistrict('universitetsky'); await checkNumbers('universitetsky');
    hold = false;
    await choose('center'); await waitDistrict('center'); await checkNumbers('center');
    // A previous response can arrive after the user has already chosen another area.
    await page.evaluate(async()=>{
      const {state}=await import('/static/js/state.js'), data=structuredClone(state.current), native=window.fetch;
      data.analysis_id='late-district-response';
      window.fetch=(input,options)=>{
        if(String(input).includes('district=universitetsky')){
          return new Promise(resolve=>{window.__releaseDistrict=()=>resolve(new Response(JSON.stringify(data),{status:200}));});
        }
        return native(input,options);
      };
    });
    await choose('universitetsky'); await page.waitForFunction(()=>typeof window.__releaseDistrict==='function');
    await choose('eleytsky'); await waitDistrict('eleytsky');
    await page.evaluate(async()=>{window.__releaseDistrict();await new Promise(resolve=>setTimeout(resolve,50));});
    await checkNumbers('eleytsky');
    assert(await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');return state.current.analysis_id;})===fixtures.eleytsky.analysis_id,'Late response replaced latest selection');
    fail = true; await choose('center');
    await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='error');
    assert(await page.locator('#error').isVisible() && await page.locator('#run').isEnabled(),'Failed automatic calculation has no retry');
    fail = false; await page.locator('#run').click(); await waitDistrict('center'); await checkNumbers('center');
    const beforeCustom = requests.length; await choose('custom');
    assert(await page.locator('#custom-box').isVisible(),'Custom area controls missing');
    assert(requests.length===beforeCustom && await page.locator('#error').isHidden(),'Custom area requested without a point');
    assert(await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');return state.current===null;}),'Preset result remains active in custom mode');
    await page.setViewportSize({width:390,height:844});
    await choose('center'); await waitDistrict('center'); await checkNumbers('center');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile layout overflows');
    assert(errors.length===0,'Browser errors: '+errors.join('; '));
    return {pass:true,checks:['automatic district calculation','loading status','all preset KPI values','late response ignored','failure and retry','custom requires a point','mobile selection'],pageErrors:errors};
  } finally { await context.close(); }
}
