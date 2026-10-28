async original=>{
 const browser=original.context().browser(),errors=[],matrix=[];let ctx,p;
 let current;const check=(v,s)=>{if(!v)throw Error(s)};
 try{
 for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[1280,900]])for(const scale of [1,2]){
 current={width,height,scale};ctx=await browser.newContext({viewport:{width,height},isMobile:width<=600,hasTouch:true});p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(700);
 await p.getByTestId('recommendation-card').first().getByTestId('save-place').tap();await p.waitForFunction(async()=>(await import('/static/js/state.js')).state.saved.length===1);
 if(width>600)await p.getByTestId('compare-place').first().check();
 await p.locator('#scenario-save').tap();await p.locator('#scenario-name').fill('Архив для проверки');await p.locator('#scenario-submit').tap();await p.waitForFunction(()=>!document.getElementById('scenario-dialog').open);
await p.evaluate(n=>document.documentElement.style.fontSize=n===2?'200%':'',scale);await p.waitForTimeout(100);
  check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Горизонтальный скролл '+width+'/'+scale);
  check(await p.locator('#comparison-guide').isVisible(),'Переход сравнения скрыт '+width);
  check(await p.getByTestId('recommendation-card').first().locator('.decision-reasons').isVisible(),'Нет причины '+width);
  const duplicated=await p.getByTestId('recommendation-card').first().evaluate(card=>{const value=card.querySelector('.place-metrics strong .counter-final')?.textContent||card.querySelector('.place-metrics strong').textContent;return card.querySelector('.decision-reasons').textContent.includes(value.trim());});check(!duplicated,'Причина повторяет крупное население');
  for(const id of ['hero-map-link','comparison-guide-open'])check(await p.locator('#'+id).evaluate(e=>e.getBoundingClientRect().height>=44),'Малая цель '+id);
  await p.locator('#comparison-guide-open').tap();await p.waitForFunction(()=>document.activeElement?.id==='comparison-title');
  await p.locator('#comparison-map-link').tap();await p.waitForFunction(()=>document.activeElement?.id==='map-title');
  await p.locator('#comparison-guide-open').tap();await p.locator('#comparison-settings-link').tap();
  if(width<=600){await p.waitForFunction(()=>document.getElementById('mobile-settings-dialog').open);await p.locator('#mobile-settings-close').tap();await p.waitForTimeout(260);}else check(await p.evaluate(()=>document.activeElement?.id==='settings'),'Фокус параметров потерян');
  const hierarchy=await p.evaluate(()=>({saved:getComputedStyle(document.getElementById('saved-title')).fontSize,archive:getComputedStyle(document.getElementById('scenarios-title')).fontSize}));
  check(parseFloat(hierarchy.archive)<parseFloat(hierarchy.saved),'Архив конкурирует с сохранёнными местами');
  matrix.push({width,height,scale});
  if(scale===1&&(width===390||width===1280)){
   await p.locator('#recommendations').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.waitForTimeout(400);await p.screenshot({path:`tests/artifacts/connected-${width}.png`});
  }
 await p.emulateMedia({reducedMotion:'reduce'});
 await p.locator('#comparison-guide-open').tap();await p.locator('#comparison-map-link').tap();check(await p.evaluate(()=>document.activeElement?.id==='map-title'),'Reduced motion навигация ждёт анимацию');
 check(await p.locator('#comparison-guide-count').evaluate(e=>!e.getAnimations().length),'Счётчик анимируется при reduce');
 await ctx.close();ctx=null;
 }
 check(errors.length===0,errors.join('; '));return {ok:true,matrix,reduced:true,errors};
 }catch(error){await p.screenshot({path:'tests/artifacts/connected-layout-failure.png'});const box=await p.locator('#mobile-settings-close').evaluate(e=>{const r=e.getBoundingClientRect();return {rect:r.toJSON(),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML,scroll:scrollY,dialog:document.getElementById('mobile-settings-dialog').getBoundingClientRect().toJSON()}});throw Error(JSON.stringify({current,box})+' '+error.message)}finally{if(ctx)await ctx.close()}
}
