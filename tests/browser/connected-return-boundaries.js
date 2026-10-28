async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];const check=(v,s)=>{if(!v)throw Error(s)};p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);
 await p.getByTestId('save-place').first().tap();await p.waitForFunction(async()=>(await import('/static/js/state.js')).state.saved.length===1);
 await p.locator('#comparison-guide-open').focus();
 await p.evaluate(()=>{localStorage.setItem('geomarketing.saved.v1','[]');dispatchEvent(new StorageEvent('storage',{key:'geomarketing.saved.v1',newValue:'[]'}))});
 check(await p.evaluate(()=>document.activeElement?.id==='recommendations-title'),'Исчезнувшая панель сравнения потеряла фокус');
 check(!await p.locator('#hero-return-context').isVisible(),'Удаление последнего сохранения оставило ложный контекст');
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#mobile-settings-open').tap();await p.locator('#run').tap();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success'&&!document.getElementById('mobile-settings-dialog').open);
 check((await p.locator('#hero-return-context').textContent()).startsWith('Продолжить анализ'),'Явный расчёт не предлагает продолжить');
 const refreshed=await p.evaluate(async()=>structuredClone((await import('/static/js/state.js')).state.current));
 await p.route('**/api/calculate?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(refreshed)}));
 await p.locator('#data-summary').tap();await Promise.all([p.waitForResponse(r=>r.url().includes('refresh=1')),p.locator('#refresh-data').tap()]);await p.waitForFunction(()=>!document.getElementById('refresh-data').disabled);
 check((await p.locator('#hero-return-context').textContent()).startsWith('Продолжить анализ'),'Обновление данных потеряло контекст продолжения');
 await p.unroute('**/api/calculate?**');
 const id=await p.evaluate(async()=>(await import('/static/js/state.js')).state.current.analysis_id);
 await p.route('**/api/calculate?**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await p.locator('#mobile-settings-open').tap();await p.locator('#run').tap();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='error');await p.locator('#mobile-settings-close').tap();
 await p.locator('#hero-map-link').tap();check(await p.evaluate(()=>document.activeElement?.id==='map-title'),'Возврат после ошибки потерял фокус');
 check(await p.evaluate(async id=>(await import('/static/js/state.js')).state.current.analysis_id===id,id),'Ошибка уничтожила прежний расчёт');
 await p.unroute('**/api/calculate?**');await p.reload();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');check(!await p.locator('#hero-return-context').isVisible(),'Несохранённый расчёт тайно восстанавливается после reload');
 await p.route('**/api/calculate?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(refreshed)}));await p.locator('#data-summary').tap();await Promise.all([p.waitForResponse(r=>r.url().includes('refresh=1')),p.locator('#refresh-data').tap()]);await p.waitForFunction(()=>!document.getElementById('refresh-data').disabled);
 check((await p.locator('#hero-return-context').textContent()).startsWith('Продолжить анализ'),'Первое явное обновление не предлагает продолжить');
 check(errors.length===0,errors.join('; '));return {ok:true,externalRemoval:true,explicitCalculation:true,error:true,reload:true,reduced:true,errors};
 }finally{await ctx.close()}
}
