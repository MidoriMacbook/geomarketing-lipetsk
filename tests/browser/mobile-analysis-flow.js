async original=>{
 const browser=original.context().browser(),base=new URL(original.url()).origin,ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await ctx.newPage(),errors=[];
 const check=(ok,text)=>{if(!ok)throw Error(text)};
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/static/vendor/leaflet/leaflet.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nL.Map.addInitHook(function(){window.__mobileTestMap=this;});'});});
 try{
 await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);
 check(await page.locator('#mobile-settings-open').count()===1,'Нет компактной кнопки настройки анализа');
 check(await page.locator('.kpis .kpi-replay:visible').count()===2,'Перед картой видны не две основные метрики');
 check(!await page.locator('#kpi-houses').isVisible()&&!await page.locator('#kpi-competitors').isVisible(),'Вторичные KPI не свернуты');
 await page.locator('#area-details>summary').tap();check(await page.locator('#kpi-houses').isVisible(),'Детали области не доступны');
 await page.locator('#kpi-houses').locator('..').locator('.kpi-replay').tap();check((await page.locator('#analysis-status').textContent()).startsWith('Дома:'),'Вторичный KPI не выделяет слой');await page.keyboard.press('Escape');
 await page.locator('#area-details>summary').tap();
 const order=await page.evaluate(()=>document.getElementById('map-card').compareDocumentPosition(document.getElementById('mobile-settings-bar'))&Node.DOCUMENT_POSITION_FOLLOWING);check(order,'Карта находится после настроек');
 await page.locator('#mobile-settings-open').tap();check(await page.locator('#mobile-settings-dialog').evaluate(e=>e.open),'Нижняя панель не открылась');
 check(await page.locator('#mobile-settings-dialog #settings').count()===1,'Форма не перенесена в панель');check(await page.locator('#run').count()===1,'Запуск дублируется');
 await page.locator('#business-trigger').tap();await page.getByRole('option',{name:'Аптека',exact:true}).tap();check(await page.locator('#business').inputValue()==='pharmacy','Категория не изменилась');check(await page.locator('#mobile-settings-dialog').evaluate(e=>e.open),'Выбор закрыл параметры');
 await page.locator('#run').tap();await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
 check(await page.locator('#mobile-settings-open').evaluate(e=>e===document.activeElement),'Фокус после расчёта потерян');
 const cards=page.getByTestId('recommendation-card');check(await cards.first().getAttribute('data-mobile-expanded')==='true','Лучшее место свернуто');check(await cards.nth(1).getAttribute('data-mobile-expanded')==='false','Вторая рекомендация не свернута');
 await cards.nth(1).locator('.mobile-rec-toggle').tap();check(await cards.nth(1).getAttribute('data-mobile-expanded')==='true','Нажатие не открыло вторую рекомендацию');
 check(await page.evaluate(async()=>(await import('/static/js/state.js')).state.selectedRank)===2,'Раскрытие не выбрало точку');
 await page.evaluate(()=>{window.__mobileTestMap.setView([52.6,39.9],15,{animate:false});});
 await cards.nth(1).locator('.mobile-show-place').tap();await page.waitForTimeout(600);
 check(await page.evaluate(async()=>{const {state}=await import('/static/js/state.js'),rec=state.current.recommendations.find(r=>r.rank===2);return window.__mobileTestMap.getBounds().contains([rec.lat,rec.lng])}),'Явная кнопка не возвращает место в кадр карты');
 await cards.nth(1).getByTestId('save-place').tap();await page.waitForFunction(()=>document.querySelectorAll('[data-testid="saved-card"]').length===1);
 await page.locator('#mobile-settings-open').tap();await page.route('**/api/calculate?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Проверка ошибки'})}));await page.locator('#run').tap();await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='error');
 check(await page.locator('#mobile-settings-dialog').evaluate(e=>e.open),'Ошибка скрыла настройки');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);await page.unroute('**/api/calculate?**');
 check(await page.locator('#mobile-settings-open').evaluate(e=>e===document.activeElement),'Escape потерял фокус');
 const sizes=[];
 for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[844,390],[768,1024],[1280,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(120);
  check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Горизонтальное переполнение '+width);
  if(width<=600||(width<=950&&height<=500)){check(await page.locator('#mobile-settings-open').isVisible(),'Нет мобильных настроек '+width);await page.locator('#mobile-settings-open').click();await page.waitForTimeout(300);check(await page.locator('#mobile-settings-dialog').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight+1),'Панель вышла за экран');await page.locator('#mobile-settings-close').click();}
  else{check(await page.locator('#workspace>#settings').count()===1,'Форма не восстановлена на большой ширине');check(await cards.nth(1).locator('.place-metrics').isVisible(),'Планшетная карточка скрыта');}
  sizes.push({width,height});
 }
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#mobile-settings-open').click();check(await page.locator('#mobile-settings-dialog').evaluate(e=>e.getAnimations().length===0),'Панель движется при reduced motion');await page.keyboard.press('Escape');
 check(errors.length===0,errors.join('; '));return {ok:true,sizes,pageErrors:errors};
 }finally{await ctx.close()}
}

