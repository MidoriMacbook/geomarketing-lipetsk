async page => {
  const base = new URL(page.url()).origin, errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.analysisState === 'success');
  const initial = await page.evaluate(async () => structuredClone((await import('/static/js/state.js')).state.current));
  if (initial.data_delivery?.mode !== 'daily' || !initial.data_delivery.version) throw Error('Daily feed not active');
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({width, height:950});
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Overflow at '+width);
  }
  await page.setViewportSize({width:390,height:950});
  if (!await page.locator('#data-details').evaluate(e=>e.open)) await page.locator('#data-summary').click();
  await page.waitForTimeout(500);
  if (!(await page.locator('#source').textContent()).includes('раз в сутки')) throw Error('Missing daily source explanation');
  const response = page.waitForResponse(r=>r.url().includes('/api/calculate') && r.url().includes('refresh=1'));
  const started=Date.now(); await page.locator('#refresh-data').click();
  const data=await (await response).json();
  await page.waitForFunction(()=>!document.getElementById('refresh-data').disabled);
  const outcome=await page.locator('#refresh-status').textContent();
  if(data.data_delivery?.status!=='unchanged'||!outcome.includes('Новых данных пока нет')) throw Error('Incorrect recheck '+JSON.stringify({data:data.data_delivery,outcome}));
  if(data.data_delivery.version!==initial.data_delivery.version||data.data_meta.houses.fetched_at!==initial.data_meta.houses.fetched_at) throw Error('Recheck changed source date/version');
  const catalog=await (await page.request.get(base+'/api/catalog')).json(), matrix=[];
  for(const district of catalog.districts){
    const result=await (await page.request.get(base+'/api/calculate?district='+district.key+'&type=cafe')).json();
    if(result.status!=='success'||result.data_delivery?.version!==data.data_delivery.version||result.stats.houses<5)throw Error('District failed '+district.key);
    matrix.push({district:district.key,houses:result.stats.houses});
  }
  for(const business of catalog.businesses){
    const result=await (await page.request.get(base+'/api/calculate?district=eleytsky&type='+business.key)).json();
    if(result.status!=='success'||result.data_delivery?.version!==data.data_delivery.version)throw Error('Business failed '+business.key);
  }
  const custom=await (await page.request.get(base+'/api/calculate?district=custom&lat=52.5935&lng=39.48&radius=1500&type=fitness')).json();
  if(custom.status!=='success'||custom.data_delivery?.version!==data.data_delivery.version)throw Error('Custom area failed');
  await page.locator('#data-details').screenshot({path:'tests/artifacts/daily-data-mobile.png'});
  if(errors.length)throw Error(errors.join('; '));
  return {ok:true,version:data.data_delivery.version,fetched_at:data.data_meta.houses.fetched_at,
          recheckSeconds:Math.round((Date.now()-started)/10)/100,outcome,matrix,businesses:catalog.businesses.length,customHouses:custom.stats.houses,pageErrors:errors};
}
