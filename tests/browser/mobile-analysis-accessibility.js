async original=>{
 const base=new URL(original.url()).origin,ctx=await original.context().browser().newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};p.on('pageerror',e=>errors.push(e.message));
 let release;const gate=new Promise(r=>release=r);
 try{
 await p.route('**/api/calculate?**',async route=>{await gate;await route.continue()});
 await p.goto(base);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='calculating');
 check(!await p.locator('.kpis').isVisible(),'Заглушки KPI занимают экран до расчёта');
 check(!await p.locator('#area-details').isVisible(),'Пустые детали видны до расчёта');
 release();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.unroute('**/api/calculate?**');
 await p.evaluate(()=>document.fonts.ready);
 check(await p.locator('#site-header').evaluate(e=>{const a=e.querySelector('.brand').getBoundingClientRect(),b=e.querySelector('#nav-toggle').getBoundingClientRect();return b.top<a.bottom&&a.top<b.bottom}),'Меню переносится под бренд на320px');
 check(await p.locator('#kpi-residents').evaluate(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)*1.1),'Число жителей переносится на320px');
 await p.locator('#mobile-settings-open').tap();await p.locator('#business-trigger').tap();await p.getByRole('option',{name:'Аптека',exact:true}).tap();check(await p.locator('#business').inputValue()==='pharmacy','Категория не изменилась');await p.locator('#run').tap();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
 await p.locator('#area-details>summary').tap();
 check(await p.locator('#kpi-houses').evaluate(async e=>e.textContent.replace(/\s/g,'')===String((await import('/static/js/state.js')).state.current.stats.houses)),'Дома остались пустыми после смены бизнеса при закрытых деталях');
 await p.locator('#area-details>summary').tap();
 await p.locator('#mobile-settings-open').tap();await p.evaluate(()=>{document.getElementById('mobile-settings-dialog').close();document.getElementById('mobile-settings-open').click()});await p.waitForTimeout(50);
 check(await p.locator('#mobile-settings-open').getAttribute('aria-expanded')==='true'&&await p.evaluate(()=>document.documentElement.dataset.mobileSheetOpen)==='true','Позднее событие закрыло состояние повторно открытой панели');
 await p.locator('#mobile-settings-close').click();await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
 await p.locator('#mobile-settings-open').tap();
 for(let i=0;i<35;i++){await p.keyboard.press('Tab');check(await p.locator('#mobile-settings-dialog').evaluate(e=>e.contains(document.activeElement)||document.activeElement===document.body),'Tab перешёл к фоновому элементу');}
 await p.locator('#district-trigger').click();await p.keyboard.press('Escape');check(await p.locator('#mobile-settings-dialog').evaluate(e=>e.open),'Escape списка закрыл всю панель');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
 await p.locator('#nav-toggle').tap();await p.locator('#nav-menu a[href="#saved-section"]').tap();await p.waitForFunction(()=>document.activeElement===document.getElementById('saved-section'));check(await p.locator('#saved-section').evaluate(e=>e.parentElement.open),'Навигация не раскрыла сохранённые места');

 await p.locator('#nav-toggle').tap();check(await p.locator('#nav-toggle').getAttribute('aria-expanded')==='true','Меню не открылось');await p.keyboard.press('Escape');check(await p.locator('#nav-toggle').evaluate(e=>document.activeElement===e),'Меню потеряло фокус');
 await p.locator('#mobile-settings-open').tap();await p.locator('#district-trigger').tap();await p.getByRole('option',{name:'мкр. Университетский',exact:true}).tap();check(await p.locator('#district').inputValue()==='universitetsky','Район не изменился');await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');check(await p.locator('#mobile-settings-dialog').evaluate(e=>e.open),'Автоматический расчёт закрыл редактирование');
 await p.locator('#district-trigger').tap();await p.keyboard.press('End');await p.keyboard.press('Enter');check(await p.locator('#district').inputValue()==='custom','Своя область недоступна');
 await p.locator('#mobile-custom-map').tap();check(!await p.locator('#mobile-settings-dialog').evaluate(e=>e.open),'Нельзя вернуться к карте');
 await p.locator('#map').tap({position:{x:100,y:100}});check(await p.evaluate(async()=>!!(await import('/static/js/state.js')).state.customPoint),'Карта не принимает центр');
 await p.locator('#mobile-settings-open').tap();check((await p.locator('#mobile-settings-state').textContent()).includes('Готово'),'Резюме не показывает готовность');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
 for(const width of [320,360,390,430]){
 await p.setViewportSize({width,height:800});await p.evaluate(()=>document.documentElement.style.fontSize='200%');await p.locator('#mobile-settings-open').click();await p.waitForTimeout(300);
 check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Переполнение200% '+width);
 const measure=await p.locator('#mobile-settings-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,height:innerHeight}});check(measure.left>=-1&&measure.right<=width+1&&measure.bottom<=measure.height+1,'Панель вне окна200%');
 await p.locator('#run').scrollIntoViewIfNeeded();check(await p.locator('#run').evaluate(e=>e.getBoundingClientRect().height>=44),'Малый запуск');await p.locator('#mobile-settings-close').click();await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
 await p.evaluate(()=>document.documentElement.style.fontSize='');
 }
 check(errors.length===0,errors.join('; '));return {ok:true,initialHidden:true,customArea:true,backgroundCalculationKeepsEditing:true,text200:[320,360,390,430],pageErrors:errors};
 }finally{release?.();await ctx.close()}
}
