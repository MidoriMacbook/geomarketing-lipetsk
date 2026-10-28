async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];const check=(v,s)=>{if(!v)throw Error(s)};p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/static/vendor/leaflet/leaflet.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nL.Map.addInitHook(function(){window.__decisionMap=this;});'});});
 try{
 await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(700);
 const cards=p.getByTestId('recommendation-card'),first=cards.first();check(await first.locator('.mobile-reasons').isVisible(),'Нет кратких фактических причин');check(await first.locator('.mobile-reasons li').count()>=1,'Недостаточно причин');check(!/\d/.test(await first.locator('.mobile-rec-difference').textContent()),'Верх повторяет крупные числа');
 const height=await first.evaluate(e=>e.getBoundingClientRect().height);check(height<=450,'Лучшая карточка не уплотнена: '+height);const fullDetails=first.locator('.mobile-rec-details');check(!await fullDetails.evaluate(e=>e.open),'Подробности открыты');
 for(let index=0;index<3;index++){
  const card=cards.nth(index);if(index)await card.locator('.mobile-rec-toggle').tap();await p.waitForTimeout(330);
  const map=await p.evaluate(()=>({center:window.__decisionMap.getCenter(),zoom:window.__decisionMap.getZoom()}));
  const before=await card.evaluate(e=>e.getBoundingClientRect().height);await card.getByTestId('save-place').tap();await p.waitForFunction(async count=>(await import('/static/js/state.js')).state.comparison.size===count,index+1);
  check((await card.locator('.confirmation-label').textContent()).includes(['Сохранено','Можно сравнить 2','Готово к сравнению: 3'][index]),'Нет подтверждения');check(Math.abs(await card.evaluate(e=>e.getBoundingClientRect().height)-before)<1,'Сохранение меняет высоту карточки');
  check((await p.locator('#comparison-guide-count').textContent()).includes(String(index+1)),'Счётчик не обновлён');check(!await p.locator('#saved-section').evaluate(e=>e.parentElement.open),'Сохранение самовольно открыло раздел');
  check(await p.evaluate(before=>JSON.stringify({center:window.__decisionMap.getCenter(),zoom:window.__decisionMap.getZoom()})===JSON.stringify(before),map),'Сохранение сдвинуло карту');
 }
 check((await p.locator('#comparison-guide-caption').textContent()).includes('3 места'),'Нет состояния трёх мест');await p.locator('#comparison-guide-open').tap();await p.waitForFunction(()=>document.activeElement===document.getElementById('comparison-title'));check(await p.locator('#comparison tbody tr').count()===3,'Не открыта прежняя таблица сравнения');
 const second=cards.nth(1);await second.locator('.mobile-show-place').tap();check((await p.locator('#analysis-status').textContent()).includes('место 2'),'Карта не сообщает выбранный номер');
 check(errors.length===0,errors.join('; '));return {ok:true,height,selected:3,comparison:true,pageErrors:errors};
 }finally{await ctx.close()}
}
