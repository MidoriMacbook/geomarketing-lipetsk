async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
 const base=new URL(original.url()).origin,check=(v,s)=>{if(!v)throw Error(s)};p.on('pageerror',e=>errors.push(e.message));
 try{
  await ctx.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='www.openstreetmap.org')return route.fulfill({contentType:'text/html',body:'<title>Проверка перехода</title>'});
   if(url.origin!==base||url.pathname==='/static/vendor/hero/hero-motion.js')return route.abort();
   return route.continue();
  });
  await p.goto(base);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  await p.waitForFunction(()=>document.getElementById('hero-motion-root').dataset.heroState==='fallback');
  check(await p.locator('#page-title').isVisible(),'Отказ анимации скрывает заголовок');
  check(await p.getByTestId('recommendation-card').count()===3,'Отказ анимации мешает расчёту');
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}}));
  await p.locator('#copy').click();check(await p.locator('#copy').textContent()==='Скопировано','Нет подтверждения координат');
  check(await p.evaluate(()=>/^52\.\d+, 39\.\d+$/.test(window.__copied)),'Копируются неверные координаты');
  const popupReady=p.waitForEvent('popup');await p.locator('#osm-link').click();const popup=await popupReady;await popup.waitForLoadState();
  check(new URL(popup.url()).searchParams.has('mlat')&&new URL(popup.url()).hash.startsWith('#map=18/'),'Внешний переход теряет точку');await popup.close();
  for(const radius of [500,1500]){
   const response=await p.request.get(base+`/api/calculate?district=custom&type=cafe&lat=52.5935&lng=39.48&radius=${radius}`),data=await response.json();
   check(response.ok()&&data.half_m===radius&&data.source!=='demo','Граничный радиус не рассчитывается: '+radius);
  }
  const invalid=await p.request.get(base+'/api/calculate?district=custom&type=cafe&lat=52.5935&lng=39.48&radius=499');check(invalid.status()===400,'Неверный радиус не отклонён');
  await p.locator('#scenario-save').click();await p.locator('#scenario-submit').click();await p.waitForSelector('.scenario-card',{state:'attached'});
  check(errors.length===0,errors.join('; '));return {ok:true,animationFailure:true,clipboardStub:true,externalNavigationStub:true,controlledRadii:[500,1500],errors};
 }finally{await ctx.close()}
}
