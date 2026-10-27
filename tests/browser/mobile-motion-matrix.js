async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[],sizes=[];const check=(v,s)=>{if(!v)throw Error(s)};p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);
 for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[768,1024],[1280,900]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(80);const phone=width<=600||(width<=950&&height<=500);
  check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Переполнение '+width);
  if(phone){
   await p.locator('#mobile-settings-open').click();await p.waitForTimeout(60);await p.locator('#mobile-settings-close').evaluate(e=>e.click());await p.waitForTimeout(40);await p.locator('#mobile-settings-open').evaluate(e=>e.click());await p.waitForTimeout(350);
   check(await p.locator('#mobile-settings-dialog').evaluate(e=>e.open)&&await p.locator('#mobile-settings-open').getAttribute('aria-expanded')==='true','Быстрая смена состояния панели '+width);
   check(await p.locator('#mobile-settings-dialog').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}),'Панель выходит за экран '+width);
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);check(!await p.evaluate(()=>document.documentElement.dataset.mobileSheetOpen),'Панель оставила блокировку прокрутки');
   const card=p.getByTestId('recommendation-card').nth(1),toggle=card.locator('.mobile-rec-toggle');await toggle.scrollIntoViewIfNeeded();await p.waitForTimeout(100);const y=await p.evaluate(()=>scrollY);
   await toggle.evaluate(e=>{e.click();e.click();e.click();e.click()});await p.waitForTimeout(350);
   check(await toggle.getAttribute('aria-expanded')==='false'&&await card.locator('.recommendation-body').evaluate(e=>e.inert&&e.getBoundingClientRect().height<1),'Быстрые раскрытия не завершились '+width);check(Math.abs(await p.evaluate(()=>scrollY)-y)<2,'Выбор карточки прокрутил страницу '+width);
  }else{check(await p.locator('#workspace>#settings').count()===1,'Потеряна широкая форма');check(await p.getByTestId('recommendation-card').nth(1).locator('.place-metrics').isVisible(),'Потеряна широкая карточка');}
  sizes.push({width,height});
 }
 for(const width of [320,390,430]){await p.setViewportSize({width,height:844});await p.evaluate(()=>document.documentElement.style.fontSize='200%');await p.locator('#mobile-settings-open').click();await p.waitForTimeout(330);check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Переполнение текста200% '+width);await p.locator('#run').scrollIntoViewIfNeeded();check(await p.locator('#run').evaluate(e=>e.getBoundingClientRect().height>=44),'Маленькая кнопка');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);await p.evaluate(()=>document.documentElement.style.fontSize='');}
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#mobile-settings-open').click();check(await p.locator('#mobile-settings-dialog').evaluate(e=>e.getAnimations().length===0&&getComputedStyle(e,'::backdrop').animationName==='none'),'Панель движется в reduced motion');await p.keyboard.press('Escape');
 check(errors.length===0,errors.join('; '));return {ok:true,sizes,text200:[320,390,430],rapid:true,reduced:true,pageErrors:errors};
 }finally{await ctx.close()}
}
