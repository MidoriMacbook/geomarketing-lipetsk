async page => {
 const base=new URL(page.url()).origin,ctx=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true}),p=await ctx.newPage(),failures=[];
 const check=(ok,msg)=>{if(!ok)failures.push(msg)};
 p.setDefaultTimeout(12000);
 try {
 await p.goto(base);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
 const fixture=await p.evaluate(async()=>structuredClone((await import('/static/js/state.js')).state.current));
 await p.locator('#nav-toggle').tap();await p.waitForTimeout(500);
 check(await p.locator('#nav-menu a').first().evaluate(e=>+getComputedStyle(e).opacity===1),'Menu links remain transparent');
 check(await p.locator('#nav-menu').evaluate(e=>e.querySelector('a').getBoundingClientRect().width>e.clientWidth*.8),'Menu rows do not fill panel');
 await p.locator('#nav-toggle').tap();await p.waitForTimeout(350);
 check(await p.locator('.kpi-replay').first().textContent()==='','Visible replay label');
 for(const key of ['competitors','places']){
  await p.locator('#kpi-'+key).scrollIntoViewIfNeeded();await p.waitForTimeout(1200);
  const sample=await p.locator('#kpi-'+key).evaluate(e=>{e.parentElement.querySelector('button').click();return {target:Number(e.dataset.counterTarget),display:e.querySelector('.counter-visual').dataset.display};});
  check(sample.target===0||Number(sample.display.replace(/\s/g,''))<sample.target,key+' replay never changes number');
 }
 await p.locator('#data-summary').click();await p.waitForTimeout(80);
 const body=p.locator('#data-details>.disclosure-body');
 check(await body.evaluate(e=>e.getBoundingClientRect().height<e.scrollHeight*.98),'Disclosure jumps straight to full height');
 await p.waitForTimeout(500);
 await p.route('**/api/calculate?**',async r=>{await new Promise(resolve=>setTimeout(resolve,500));await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Проверка: источник временно недоступен'})});});
 await p.locator('#refresh-data').click();
 check((await p.locator('#refresh-data').textContent()).includes('Проверяем'),'No refresh loading feedback near button');
 await p.waitForTimeout(800);
 check(await p.locator('#refresh-status').count()>0&&await p.locator('#refresh-status').isVisible(),'No local refresh outcome');

 check((await p.locator('#refresh-status').textContent()).includes('Проверка: источник временно недоступен'),'Refresh error not shown locally');
 check(await p.evaluate(async()=>!!(await import('/static/js/state.js')).state.current),'Refresh error destroyed previous analysis');
 await p.unroute('**/api/calculate?**');
 const reply=async data=>{
  await p.route('**/api/calculate?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
  await p.locator('#refresh-data').click();await p.waitForFunction(()=>!document.getElementById('refresh-data').disabled);
  await p.unroute('**/api/calculate?**');
 };
 const fresh=structuredClone(fixture);fresh.source='osm';fresh.warning=null;if(fresh.data_quality)fresh.data_quality.source='osm';
 delete fresh.data_delivery; // Keep explicit coverage of older/live API responses.
 Object.values(fresh.data_meta).forEach(meta=>{meta.cached=false;meta.warning=null;meta.fetched_at=Date.now()/1000;meta.stale=false;});
 await reply(fresh);
 check((await p.locator('#refresh-status').textContent()).startsWith('Данные получены'),'Fresh success not shown');
 const partial=structuredClone(fresh);partial.data_meta.houses.cached=true;partial.warning='Обновление домов не удалось.';
 await reply(partial);
 check((await p.locator('#refresh-status').textContent()).includes('не полностью'),'Partial refresh incorrectly called fresh');
 for(const [status, text] of [['updated','Новая версия'],['unchanged','Новых данных пока нет'],['unavailable','Не удалось проверить']]){
  const daily=structuredClone(fixture);daily.data_delivery={mode:'daily',status};await reply(daily);
  check((await p.locator('#refresh-status').textContent()).includes(text),'Missing daily status '+status);
 }
 check(await p.locator('#refresh-data').getAttribute('aria-busy')==='false','Refresh busy state stuck');
 const summary=p.locator('#data-summary');
 await summary.click();await p.waitForTimeout(70);
 check(await body.evaluate(e=>e.getBoundingClientRect().height>0&&e.getBoundingClientRect().height<e.scrollHeight),'No closing height transition');
 await summary.click();await p.waitForTimeout(500);
 check(await body.evaluate(e=>!e.inert&&Math.abs(e.getBoundingClientRect().height-e.scrollHeight)<2),'Rapid disclosure reversal clipped content');
 await p.locator('#scenario-save').click();await p.locator('#scenario-name').fill('Проверка дат');await p.locator('#scenario-submit').click();await p.waitForFunction(()=>!document.getElementById('scenario-dialog').open);
 const nested=p.locator('#scenario-list .quality-details>summary').first();await nested.click();await p.waitForTimeout(70);
 check(await nested.evaluate(e=>e.nextElementSibling.getAnimations().some(a=>a.id==='gm:disclosure')),'Nested dates do not animate');
 await p.emulateMedia({reducedMotion:'reduce'});await summary.click();
 check(await p.locator('#data-details').evaluate(e=>!e.open),'Reduced disclosure did not close immediately');
 await summary.click();
 check(await body.evaluate(e=>!e.inert&&e.getAnimations().length===0),'Reduced disclosure leaves motion or inert content');
 if(failures.length)throw Error(failures.join('; '));return {ok:true,checks:'menu width, invisible KPI hit areas, small integers, height/open-close/reversal/nested/reduce, refresh pending/error/fresh/partial'};
 } finally { await ctx.close(); }
}
