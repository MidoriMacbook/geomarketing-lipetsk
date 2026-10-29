async original=>{
 const browser=original.context().browser(),errors=[],matrix=[],check=(v,s)=>{if(!v)throw Error(s)};
 for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[1280,900]])for(const scale of [1,2]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:width<=600,hasTouch:width<=600,reducedMotion:'reduce'}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);await p.waitForSelector('#district-trigger',{state:'attached'});
   if(width<=600)await p.locator('#mobile-settings-open').tap();
   await p.locator('#district-trigger').click();await p.getByRole('option',{name:'мкр. Университетский',exact:true}).click();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
   await p.locator('#business-trigger').click();await p.getByRole('option',{name:'Продуктовый магазин',exact:true}).click();
   await p.evaluate(n=>document.documentElement.style.fontSize=n===2?'200%':'',scale);
   check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Переполнение '+width+'/'+scale);
   for(const id of ['district-trigger','business-trigger','run','nav-toggle']){const control=p.locator('#'+id);if(await control.isVisible())check(await control.evaluate(e=>e.getBoundingClientRect().height>=44),'Цель меньше44px '+id);}
   const choices=await p.locator('.choice-trigger').evaluateAll(items=>items.filter(e=>e.getClientRects().length).map(e=>{const text=e.querySelector('.choice-value').getBoundingClientRect(),arrow=e.querySelector('.choice-arrow').getBoundingClientRect();return {gap:arrow.left-text.right,arrow:arrow.width,box:e.getBoundingClientRect().toJSON()}}));check(choices.every(c=>c.gap>=7&&c.arrow===16*scale),'Текст налезает на chevron '+JSON.stringify({width,scale,choices}));
   if(width<=600){
    const gap=await p.evaluate(()=>document.getElementById('display-options').getBoundingClientRect().top-document.querySelector('[aria-labelledby="business-group-title"]').getBoundingClientRect().bottom);check(gap>=12,'Отображение прилипло к описанию бизнеса: '+gap);
    await p.locator('#mobile-settings-close').click();
   }
   if(width<=430&&scale===2){
    const wordLines=await p.locator('.brand>span:last-child').evaluate(e=>{const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);for(let t=walk.nextNode();t;t=walk.nextNode()){const start=t.textContent.indexOf('Маркетинг');if(start<0)continue;const r=document.createRange();r.setStart(t,start);r.setEnd(t,start+9);return r.getClientRects().length;}return 0;});check(wordLines===1,'Название бренда разорвано внутри слова '+width);
   }
   const card=p.getByTestId('recommendation-card').first();await card.getByTestId('save-place').click();await p.waitForFunction(async()=>(await import('/static/js/state.js')).state.saved.length===1);
   if(width<=600)await p.locator('#saved-section').locator('..').locator(':scope>summary').click();
   const checks=p.locator('.field-checks>summary').first();
   const fieldGap=await checks.evaluate(e=>{const a=getComputedStyle(e,'::after'),title=e.querySelector('span').getBoundingClientRect();return e.getBoundingClientRect().right-parseFloat(getComputedStyle(e).paddingRight)-parseFloat(a.width)-title.right;});check(fieldGap>=11,'Чек-лист налезает на стрелку '+width+'/'+scale);
   await checks.focus();await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('.field-checks>summary').getAttribute('aria-expanded')==='true');await p.keyboard.press('Enter');
   const reserved=await p.locator('details>summary').evaluateAll(items=>items.filter(e=>getComputedStyle(e,'::after').position==='absolute').every(e=>parseFloat(getComputedStyle(e).paddingInlineEnd)>=parseFloat(getComputedStyle(e,'::after').width)+12));check(reserved,'У вложенного раскрытия нет отступа '+width+'/'+scale);
   check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'Переполнение после сохранения '+width+'/'+scale);
   const summaries=await p.locator('details>summary').evaluateAll(items=>items.map(e=>({list:getComputedStyle(e).listStyleType,width:getComputedStyle(e,'::after').width,height:getComputedStyle(e,'::after').height})));check(summaries.every(s=>s.list==='none'&&s.width===16*scale+'px'&&s.height===s.width),'Разные маркеры '+width+'/'+scale);
   await p.locator('#data-summary').focus();await p.keyboard.press('Enter');check(await p.locator('#data-summary').getAttribute('aria-expanded')==='true','Enter не открыл источник');await p.keyboard.press('Space');check(await p.locator('#data-summary').getAttribute('aria-expanded')==='false','Space не закрыл источник');
   matrix.push({width,height,scale});
  }catch(e){await p.screenshot({path:'tests/artifacts/polish-layout-failure.png'});throw Error(width+'/'+scale+': '+e.message);}finally{await ctx.close()}
 }
 const ctx=await browser.newContext({viewport:{width:1280,height:900}}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));try{
  await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.waitForSelector('#district-trigger');
  const durations=await p.evaluate(()=>[...document.querySelectorAll('details>summary')].map(e=>getComputedStyle(e,'::after').transitionDuration));check(new Set(durations).size===1&&durations[0]!=='0s','Неодинаковая скорость chevron');
  await p.locator('#data-summary').click();await p.waitForTimeout(240);check(await p.locator('#data-summary').evaluate(e=>getComputedStyle(e,'::after').transform==='matrix(-1, 0, 0, -1, 0, 0)'),'Поворот не завершён');
  const trigger=p.locator('#district-trigger');await trigger.hover();await p.waitForTimeout(240);const before=await trigger.boundingBox();await p.mouse.down();const pressed=await trigger.boundingBox();await p.mouse.up();check(Math.abs(before.width-pressed.width)<1&&Math.abs(before.height-pressed.height)<1,'Press меняет размеры поля');
  check(errors.length===0,errors.join('; '));return {ok:true,matrix,motion:true,press:true,errors};
 }finally{await ctx.close()}
}
