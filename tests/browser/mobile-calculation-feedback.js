async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];const check=(v,s)=>{if(!v)throw Error(s)};
 let release;const gate=new Promise(r=>release=r);p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.route('**/api/calculate?**',async route=>{await gate;await route.continue()});await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='calculating');
 check(await p.locator('#recommendation-loading').isVisible(),'Нет компактного skeleton рекомендаций');check(await p.locator('#run').isDisabled(),'Повторный запуск доступен');check((await p.locator('#run').textContent()).includes('Ищем места'),'Непонятная подпись ожидания');
 check(!await p.locator('#analysis-progress').isVisible(),'Несколько конкурирующих индикаторов ожидания');
 release();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.unroute('**/api/calculate?**');
 const previous=await p.evaluate(async()=>{const {state}=await import('/static/js/state.js');return {id:state.current.analysis_id,houses:state.current.stats.houses,business:state.current.business}});
 await p.locator('#mobile-settings-open').tap();await p.locator('#business-trigger').tap();await p.getByRole('option',{name:'Аптека',exact:true}).tap();
 check(await p.evaluate(async()=>!!(await import('/static/js/state.js')).state.current),'Смена параметров уничтожила предыдущий результат');
 check((await p.locator('#trust-summary').textContent()).includes('предыдущий'),'Качество данных не объясняет сохранённый результат при редактировании');
 await p.route('**/api/calculate?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Проверка ошибки'})}));await p.locator('#run').tap();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='error');
 check(await p.locator('#mobile-settings-dialog').evaluate(e=>e.open),'Ошибка закрыла настройки');check(await p.locator('#business').inputValue()==='pharmacy','Ошибка сбросила параметры');
 check(await p.evaluate(async id=>(await import('/static/js/state.js')).state.current?.analysis_id===id,previous.id),'Ошибка потеряла предыдущий успешный расчёт');check((await p.locator('#analysis-context').textContent()).includes('Кофейня'),'Старый результат подписан новыми параметрами');check((await p.locator('#error').textContent()).includes('предыдущий'),'Старый результат не объяснён');
 await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);await p.getByTestId('recommendation-card').first().getByTestId('save-place').tap();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('geomarketing.saved.v1')||'[]').length===1);
 check(await p.evaluate(id=>{const item=JSON.parse(localStorage.getItem('geomarketing.saved.v1'))[0];return item.analysis_id===id&&item.business==='cafe'},previous.id),'Сохранение старого результата использовало новые параметры');
 await p.locator('#scenario-save').tap();await p.locator('#scenario-name').fill('Предыдущий расчёт после ошибки');await p.locator('#scenario-submit').tap();await p.waitForFunction(()=>!!localStorage.getItem('geomarketing.scenarios.v1'));
 check(await p.evaluate(async id=>{const item=(await import('/static/js/state.js')).state.scenarios[0];return item?.selection.business==='cafe'&&item.analysis.analysis_id===id},previous.id),'Исследование смешало параметры формы со старым результатом');
 await p.locator('#mobile-settings-open').tap();
 await p.unroute('**/api/calculate?**');await p.locator('#run').tap();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
 const entrances=await p.getByTestId('recommendation-card').evaluateAll(cards=>cards.map(e=>e.getAnimations().find(a=>a.id==='gm:calculation-result')?.effect.getTiming().delay));check(entrances.length>=2&&entrances[0]>=0&&entrances[1]-entrances[0]>=40&&entrances[1]-entrances[0]<=60,'Нет последовательного появления результата с коротким шагом');
 await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
 check(await p.evaluate(async()=>(await import('/static/js/state.js')).state.current.business)==='pharmacy','Повтор не применил новые параметры');
 const card=p.getByTestId('recommendation-card').first();check(await card.locator('.mobile-rec-toggle').getAttribute('aria-expanded')==='true','Лучшее место не раскрыто после расчёта');const height=await card.locator('.recommendation-body').evaluate(e=>e.getBoundingClientRect().height);await card.getByTestId('save-place').tap();await p.waitForFunction(()=>document.querySelector('[data-testid="recommendation-card"] .confirmation-label').textContent.includes('Можно сравнить 2 места'));check(Math.abs(await card.locator('.recommendation-body').evaluate(e=>e.getBoundingClientRect().height)-height)<1,'Сохранение сдвинуло карточку');
 await card.locator('.mobile-rec-toggle').tap();await p.locator('#mobile-settings-open').tap();await p.locator('#run').tap();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');check(await p.getByTestId('recommendation-card').first().locator('.mobile-rec-toggle').getAttribute('aria-expanded')==='true','Лучшее место не раскрыто после повторного расчёта тех же параметров');
 check(errors.length===0,errors.join('; '));return {ok:true,previousKept:true,retry:true,saved:true,pageErrors:errors};
 }finally{release?.();await ctx.close()}
}
