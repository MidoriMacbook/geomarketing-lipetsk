async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[],matrix=[];const check=(v,s)=>{if(!v)throw Error(s)};p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(700);
 for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[768,1024],[1280,900]])for(const scale of [1,2]){
  await p.setViewportSize({width,height});await p.evaluate(scale=>document.documentElement.style.fontSize=scale===2?'200%':'',scale);await p.waitForTimeout(80);const phone=width<=600||(width<=950&&height<=500),card=p.getByTestId('recommendation-card').first();
  check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Переполнение '+width+'/'+scale);
  if(phone){
   check(await card.locator('.mobile-reasons').isVisible(),'Нет кратких причин');check(await card.getByTestId('save-place').evaluate(e=>e.getBoundingClientRect().height>=44),'Малая цель сохранения');
   const toggle=card.locator('.mobile-rec-toggle');await toggle.evaluate(e=>{e.click();e.click()});await p.waitForTimeout(330);check(await toggle.getAttribute('aria-expanded')==='true','Быстрый повтор сломал карточку');
   if(width===390&&scale===1){await p.locator('#recommendations').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.waitForTimeout(700);await p.screenshot({path:'tests/artifacts/decision-card-390.png'});}
  }else{check(await card.locator('.place-title').isVisible()&&await card.locator('.recommendation-brief').isVisible(),'Широкие данные скрыты');check(!await card.locator('.mobile-reasons').isVisible(),'Мобильный блок продублирован на компьютере');}
  matrix.push({width,height,scale});
 }
 await p.evaluate(()=>document.documentElement.style.fontSize='');await p.getByTestId('recommendation-card').first().getByTestId('save-place').tap();await p.waitForFunction(async()=>(await import('/static/js/state.js')).state.saved.length===1);check(await p.evaluate(async()=>(await import('/static/js/state.js')).state.comparison.size)===0,'Широкая версия самовольно выбрала место');
 await p.setViewportSize({width:390,height:844});await p.emulateMedia({reducedMotion:'reduce'});const card=p.getByTestId('recommendation-card').first();await card.getByTestId('save-place').tap();await p.waitForFunction(async()=>(await import('/static/js/state.js')).state.comparison.size===1);check(await p.locator('#comparison-guide-count').evaluate(e=>!e.getAnimations().length),'Счётчик движется при reduced motion');await card.locator('.mobile-rec-toggle').tap();check(await card.locator('.recommendation-body').evaluate(e=>e.inert&&e.getBoundingClientRect().height<1),'Закрытие не мгновенное');
 check(errors.length===0,errors.join('; '));return {ok:true,matrix,reduced:true,pageErrors:errors};
 }finally{await ctx.close()}
}
