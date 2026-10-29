async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
 const check=(v,s)=>{if(!v)throw Error(s)};p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);
 check(await p.locator('.hero-art').evaluate(e=>getComputedStyle(e).borderTopWidth==='0px'),'Перед мобильной схемой остаётся лишняя линия');
 check(await p.locator('#hero').evaluate(e=>getComputedStyle(e).borderBottomWidth==='0px'),'Перед показателями осталось два разделителя');
 check(await p.locator('.analysis-context-row').evaluate(e=>parseFloat(getComputedStyle(e).borderTopWidth)>0),'Потерян структурный разделитель');
 check(await p.locator('#hero-map-link').evaluate(e=>getComputedStyle(e,'::after').maskImage!=='none'),'Внутренний CTA без новой стрелки');
 check(!await p.evaluate(()=>/[⌄⌃↗↓]/u.test(document.body.innerText)),'В интерфейсе остались directional глифы');
 const card=p.getByTestId('recommendation-card').first();await card.getByTestId('save-place').tap();await p.waitForFunction(async()=>(await import('/static/js/state.js')).state.saved.length===1);
 check(await card.locator('.mobile-rec-toggle').evaluate(e=>getComputedStyle(e,'::after').transform==='matrix(-1, 0, 0, -1, 0, 0)'),'Открытая рекомендация показывает вниз при reduced motion');
 check(await p.locator('#comparison-guide').evaluate(e=>parseFloat(getComputedStyle(e).borderTopWidth)===0&&getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'),'Сравнение осталось тяжёлой карточкой');
 check(await card.locator('.save').evaluate(e=>getComputedStyle(e,'::after').content==='none'),'Лишнее подчеркивание сохранения осталось');
 const native=card.locator('.mobile-rec-details>summary');await native.focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('.mobile-rec-details>summary').getAttribute('aria-expanded')==='true');
 check(await native.evaluate(e=>getComputedStyle(e,'::after').transform==='matrix(-1, 0, 0, -1, 0, 0)'),'Chevron не развёрнут на180°');await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('.mobile-rec-details>summary').getAttribute('aria-expanded')==='false');
 const summary=p.locator('#data-summary');await summary.focus();await p.keyboard.press('Space');await p.waitForFunction(()=>document.getElementById('data-summary').getAttribute('aria-expanded')==='true');await p.keyboard.press('Enter');await p.waitForFunction(()=>document.getElementById('data-summary').getAttribute('aria-expanded')==='false');
 await p.locator('#mobile-settings-open').tap();await p.locator('#display-options-summary').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.getElementById('display-options-summary').getAttribute('aria-expanded')==='true');await p.keyboard.press('Space');
 await p.locator('#district-trigger').tap();check(await p.locator('.choice-arrow').first().evaluate(e=>e.textContent===''&&getComputedStyle(e).maskImage!=='none'),'Choice chevron остался глифом');await p.keyboard.press('Escape');await p.locator('#mobile-settings-close').tap();
 const audits=await p.evaluate(()=>{
  const choice=getComputedStyle(document.querySelector('.choice-arrow'));
  return [...document.querySelectorAll('details>summary')].map(e=>{const c=getComputedStyle(e),a=getComputedStyle(e,'::after');return {text:e.textContent,list:c.listStyleType,mask:a.maskImage,width:a.width,height:a.height,duration:a.transitionDuration,same:a.maskImage===choice.maskImage,padding:parseFloat(c.paddingInlineEnd),position:a.position,size:parseFloat(a.width)};});
 });
 check(audits.every(a=>a.list==='none'&&a.mask!=='none'&&a.same),'Нативные или разные маркеры: '+JSON.stringify(audits.filter(a=>a.list!=='none'||!a.same)));
 check(new Set(audits.map(a=>a.width+'/'+a.height)).size===1,'Разные размеры chevron');
 check(audits.filter(a=>a.position==='absolute').every(a=>a.padding>=a.size+12),'У вложенного раскрытия нет отступа для стрелки');
 check(await p.evaluate(()=>[...document.querySelectorAll('.icon-external')].every(e=>e.closest('a[target="_blank"]')?.href.startsWith('http'))),'Внешняя стрелка используется для внутреннего действия');
 const save=card.getByTestId('save-place'),color=await save.evaluate(e=>getComputedStyle(e).backgroundColor),rect=await save.boundingBox();await save.hover();check(await save.evaluate(e=>getComputedStyle(e).backgroundColor)===color,'Hover применяется к coarse-устройству');
 await save.dispatchEvent('pointerdown',{pointerType:'touch'});check(Math.abs((await save.boundingBox()).height-rect.height)<1,'Press меняет размер');
 await p.emulateMedia({reducedMotion:'no-preference'});await summary.evaluate(e=>{e.click();e.click();e.click()});await p.waitForTimeout(450);check(await summary.getAttribute('aria-expanded')==='true','Быстрые повторы потеряли состояние');
 await p.locator('#data-details').evaluate(e=>e.open=false);await p.waitForFunction(()=>document.getElementById('data-summary').getAttribute('aria-expanded')==='false');
 await p.locator('#data-details').evaluate(e=>e.open=true);await p.waitForFunction(()=>document.getElementById('data-summary').getAttribute('aria-expanded')==='true');await p.waitForTimeout(450);
 await summary.click();await p.emulateMedia({reducedMotion:'reduce'});check(await summary.getAttribute('aria-expanded')==='false','Смена reduced motion потеряла итог');
 await card.locator('.mobile-rec-details').evaluate(e=>e.open=true);await p.waitForFunction(()=>document.querySelector('.mobile-rec-details>summary').getAttribute('aria-expanded')==='true');
 check(errors.length===0,errors.join('; '));return {ok:true,disclosures:audits.length,keyboard:true,reduced:true,coarse:true,errors};
 }finally{await ctx.close()}
}
