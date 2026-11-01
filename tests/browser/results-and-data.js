async original=>{
 const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
 const check=(v,s)=>{if(!v)throw Error(s)};p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.route('**/api/calculate?**',async route=>{const response=await route.fetch(),data=await response.json();
   if(data.status!=='success'){await route.fulfill({response});return}
   data.source='demo';data.warning='Демонстрационные данные: пример не подходит для выбора помещения.';
   data.data_quality.source='demo';data.data_quality.freshness={status:'demo',oldest_data_at:null};data.data_quality.completeness.status='limited';
   data.data_quality.completeness.reasons.push({code:'mixed_fetch_dates',text:'Дома 2026-10-29T10:00:00Z; конкуренты 2026-10-28T12:00:00Z'});
   await route.fulfill({response,json:data});
  });
  await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  check((await p.locator('.mobile-rec-score').first().textContent())==='100 из 100','Балл выглядит процентом успеха');
  check((await p.locator('#trust-summary').textContent()).includes('Демонстрационные данные'),'Источник примера скрыт');
  check(!/\d{4}-\d\d-\d\dT/.test(await p.locator('#data-quality').textContent()),'ISO-даты в основном пояснении');
  check(await p.locator('#data-quality .quality-limitation').count()===1,'Нет единого основного ограничения');
  check(await p.locator('#data-details').evaluate(n=>n.textContent.split('Демонстрационные данные: пример не подходит для выбора помещения.').length-1)===1,'Предупреждение повторяется в блоке источников');
  await p.getByTestId('save-place').first().tap();
  await p.evaluate(()=>{const d=document.getElementById('saved-section').closest('details');if(d)d.open=true});
  await p.waitForSelector('.saved-card .saved-score');check((await p.locator('.saved-card').first().textContent()).includes('100 из 100'),'Сохранение теряет смысл балла');
  await p.locator('#scenario-save').tap();await p.locator('#scenario-submit').tap();await p.waitForSelector('.scenario-card',{state:'attached'});
  check(await p.evaluate(async()=>{const {readScenarios}=await import('/static/js/scenario-storage.js');return readScenarios()[0].analysis.source==='demo'}),'Архив теряет источник');
  await p.evaluate(()=>{window.print=()=>{};window.__csv=[];URL.createObjectURL=b=>{window.__csv.push(b.text());return 'blob:проверка'};URL.revokeObjectURL=()=>{}});
  await p.locator('#export-csv').tap();
  const csv=await p.evaluate(async()=>await window.__csv[0]);check(csv.includes('из 100')&&csv.includes('Демонстрационные данные'),'CSV теряет шкалу или источник');
  await p.locator('#print-report').tap();
  const report=await p.locator('#print-report-content').textContent();check(report.includes('100 из 100')&&report.includes('не вероятность успеха')&&report.includes('Демонстрационные данные'),'Печать неоднозначна');
  check(errors.length===0,errors.join('; '));return {ok:true,controlledDemo:true,csv:true,print:true,errors};
 }finally{await ctx.close()}
}
