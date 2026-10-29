async original=>{
 const browser=original.context().browser(),matrix=[],errors=[],check=(v,s)=>{if(!v)throw Error(s)};
 for(const width of [320,360,390,430,768,1280])for(const scale of [1,2]){
  const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<=600,hasTouch:width<=600,reducedMotion:'reduce'}),p=await ctx.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);
   await p.evaluate(n=>document.documentElement.style.fontSize=n===2?'200%':'',scale);
   if(width<=600){
    for(const key of ['residents','places']){
     const card=p.locator('[data-kpi='+key+']'),action=card.locator('.kpi-action-label'),button=card.locator('button');
     const geometry=()=>card.evaluate(e=>{const c=e.getBoundingClientRect(),a=e.querySelector('.kpi-action-label'),r=a.getBoundingClientRect(),s=getComputedStyle(a),small=e.querySelector('small').getBoundingClientRect();return {height:c.height,font:parseFloat(s.fontSize),decoration:s.textDecorationLine,row:r.height,bottom:c.bottom-r.bottom,gap:r.top-small.bottom,width:r.width,available:c.width-24,scroll:a.scrollWidth,client:a.clientWidth}});
     if(scale===1)check(await action.evaluate(e=>{const r=document.createRange();r.selectNode(e.firstChild);return r.getClientRects().length===1}),'KPI: случайный перенос действия');
     const before=await geometry();check(before.decoration==='none','KPI: подчёркивание '+width);check(before.font>=14*scale-.1,'KPI: мелкий текст');check(before.row>=44,'KPI: малая строка');check(before.bottom>=10,'KPI: нет нижнего отступа');check(before.gap>=6,'KPI: действие пересекает пояснение');check(before.scroll<=before.client+1,'KPI: обрезано действие');
     await card.scrollIntoViewIfNeeded();
     for(const [part,pressed] of [['corner','true'],['number','false'],['opposite','true'],['corner','false']]){
      const r=await (part==='number'?card.locator('strong'):card).boundingBox();
      await p.touchscreen.tap(part==='number'?r.x+r.width/2:part==='opposite'?r.x+r.width-8:r.x+8,part==='number'?r.y+r.height/2:r.y+8);
      check(await button.getAttribute('aria-pressed')===pressed,'KPI: область плашки не кликабельна: '+part);
     }
     check(await button.getAttribute('aria-pressed')==='false','KPI: число/угол не управляет выбором');
     await button.tap();check(await button.getAttribute('aria-pressed')==='true','KPI: не выбрано');check((await action.textContent()).includes('Снять выделение'),'KPI: нет текстового состояния');
     check(Math.abs((await geometry()).height-before.height)<1,'KPI: скачок высоты');
     check(await card.locator('.kpi-indicator,.kpi-progress').count()===0,'KPI: лишние индикаторы');
     await button.focus();await p.keyboard.press('Enter');check(await button.getAttribute('aria-pressed')==='false','KPI: Enter не снимает выбор');
     check(await button.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'||getComputedStyle(e.parentElement).outlineStyle!=='none'),'KPI: нет focus-visible');
    }
   }
   await p.getByTestId('save-place').first().click();
   const saved=p.locator('#saved-section');await p.evaluate(()=>{const e=document.getElementById('saved-section').closest('details');if(e)e.open=true});
   await p.waitForSelector('.saved-card-actions button');
   for(const selector of ['.saved-card-actions button','.mobile-show-place','#trust-details-link']){
    const target=p.locator(selector).first();if(await target.isVisible())check(await target.evaluate(e=>getComputedStyle(e).textDecorationLine==='none'),'Подчёркнутая кнопка '+selector);
   }
   await p.locator('#scenario-save').click();await p.locator('#scenario-name').fill('Проверка интерфейса');await p.locator('#scenario-submit').click();
   await p.waitForSelector('.quality-details>summary',{state:'attached'});
   await p.evaluate(()=>{const e=document.getElementById('scenario-list').closest('details');if(e)e.open=true});
   const summary=p.locator('.quality-details>summary').first();await summary.scrollIntoViewIfNeeded();
   const q=await summary.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),a=getComputedStyle(e,'::after');return {height:r.height,padding:parseFloat(s.paddingLeft),right:parseFloat(s.paddingRight),marker:getComputedStyle(e,'::marker').content,mask:a.maskImage}});
   check(q.height>=44&&q.padding>=12&&q.right>=36,'Тесный заголовок дат');check(q.marker==='""'&&q.mask!=='none','Нативный или отсутствующий шеврон');
   await summary.focus();await p.keyboard.press('Space');check(await summary.getAttribute('aria-expanded')==='true','Даты: Space не раскрывает');
   const gap=await summary.evaluate(e=>e.nextElementSibling.firstElementChild.firstElementChild.getBoundingClientRect().top-e.getBoundingClientRect().bottom);check(gap>=8,'Даты: контент прилип к заголовку');
   await p.keyboard.press('Enter');check(await summary.getAttribute('aria-expanded')==='false','Даты: Enter не закрывает');
   check(!await p.locator('body').innerText().then(t=>t.includes('Данных достаточно для модели')),'Слишком сильное обещание полноты');
   check(await p.evaluate(w=>document.documentElement.scrollWidth<=w+1,width),'Горизонтальный скролл '+width+'/'+scale);
   matrix.push({width,scale});
  }catch(e){throw Error(width+'/'+scale+': '+e.message)}finally{await ctx.close()}
 }
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage();
 try{
  await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  await p.locator('#scenario-save').tap();await p.locator('#scenario-submit').tap();await p.waitForSelector('.quality-details>summary',{state:'attached'});
  await p.evaluate(()=>{const e=document.getElementById('scenario-list').closest('details');if(e)e.open=true});
  const summary=p.locator('.quality-details>summary').first();await summary.tap();
  check(await summary.evaluate(e=>e.nextElementSibling.getAnimations().some(a=>a.id==='gm:disclosure')),'Даты: нет анимации');
  await p.waitForTimeout(450);await summary.tap();await summary.tap();await p.waitForTimeout(450);check(await summary.getAttribute('aria-expanded')==='true','Даты: быстрые повторы сломали раскрытие');
  await p.emulateMedia({reducedMotion:'reduce'});await summary.tap();check(await summary.getAttribute('aria-expanded')==='false','Даты: reduce не закрыл');
 }finally{await ctx.close()}
 check(errors.length===0,errors.join('; '));return {ok:true,matrix,keyboard:true,touch:true,motion:true,errors};
}
