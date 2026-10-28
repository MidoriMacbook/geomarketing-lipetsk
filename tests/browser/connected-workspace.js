async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
 const check=(v,s)=>{if(!v)throw Error(s)},wait=()=>p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(new URL(original.url()).origin);await wait();await p.evaluate(()=>document.fonts.ready);
  check(await p.locator('#hero-return-context').count()===1,'Нет контекста продолжения');
  check(!await p.locator('#hero-return-context').isVisible(),'Чистый визит выдан за повторный');
  const cards=p.getByTestId('recommendation-card');
  for(let i=0;i<3;i++){
   const card=cards.nth(i);if(i)await card.locator('.mobile-rec-toggle').tap();await p.waitForTimeout(330);
   const before=await card.evaluate(e=>e.getBoundingClientRect().height);
   await card.getByTestId('save-place').tap();await p.waitForFunction(async n=>(await import('/static/js/state.js')).state.comparison.size===n,i+1);
   check((await p.locator('#comparison-guide-count').textContent()).includes(String(i+1)),'Неверный выбор');
   const confirmation=await card.locator('.confirmation-label').textContent();check(confirmation.includes(['добавьте ещё одно','сравнить 2','сравнению: 3'][i]),'Нет контекстного шага: '+confirmation);
   check(Math.abs(await card.evaluate(e=>e.getBoundingClientRect().height)-before)<1,'Сохранение сдвигает карточку');
   if(!i){
    const repeat=await ctx.newPage();try{await repeat.goto(new URL(original.url()).origin);await repeat.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');check((await repeat.locator('#hero-return-context').textContent()).includes('Сохранённое место'),'Повторный визит с местом не определён');}finally{await repeat.close()}
   }
  }
  check(await p.locator('#hero-return-context').isVisible(),'Нет продолжения после сохранения');
  check((await p.locator('#hero-map-link').textContent()).includes('Вернуться'),'Прежняя кнопка не стала возвратом');
  await p.locator('#comparison-guide-open').tap();await p.waitForFunction(()=>document.activeElement?.id==='comparison-title');
  check(await p.locator('#comparison tbody tr').count()===3,'Таблица не раскрылась');
  await p.locator('#comparison-map-link').tap();await p.waitForFunction(()=>document.activeElement?.id==='map-title');
  await p.locator('#comparison-guide-open').tap();await p.locator('#comparison-settings-link').tap();await p.waitForFunction(()=>document.getElementById('mobile-settings-dialog').open);await p.locator('#mobile-settings-close').tap();await p.waitForTimeout(300);
  await p.locator('#comparison-guide-open').tap();await p.locator('#comparison-research-button').tap();await p.waitForFunction(()=>document.getElementById('scenario-dialog').open);await p.locator('#scenario-name').fill('Проверка пути');await p.locator('#scenario-submit').tap();await p.waitForFunction(()=>document.getElementById('scenario-dialog').open===false);
  // Reload keeps snapshots, but selection is still the original transient Set.
  await p.reload();await wait();check((await p.locator('#hero-return-context').textContent()).includes('исследование'),'Нет контекста исследования после reload');
  check((await p.locator('#comparison-guide-count').textContent()).includes('0'),'Выбор сравнения тайно восстановлен');
  const before=await p.evaluate(async()=>(await import('/static/js/state.js')).state.current.analysis_id);
  await p.locator('#hero-map-link').tap();await p.waitForFunction(()=>document.activeElement?.id==='map-title');
  check(await p.evaluate(async id=>(await import('/static/js/state.js')).state.current.analysis_id===id,before),'Возврат подменил расчёт архивом');
  const disclosure=p.locator('#saved-section').locator('..');await disclosure.locator(':scope > summary').tap();await p.getByTestId('compare-place').nth(0).check();await p.getByTestId('compare-place').nth(1).check();
  check((await p.locator('#comparison-guide-count').textContent()).includes('2'),'Флажки не связаны с панелью');
  await p.locator('#comparison-guide-open').tap();check(await p.locator('#comparison tbody tr').count()===2,'Флажки не связаны с таблицей');
  check(errors.length===0,errors.join('; '));return {ok:true,firstVisit:true,repeatScenario:true,comparison:true,focus:true,errors};
 }finally{await ctx.close()}
}
