import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'before',base='http://127.0.0.1:5071',dir='docs/verification/visual-polish/05';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const metrics=[];
try{for(const width of [375,768,1440,1920])for(const state of ['loading','error','no-data']){
 const page=await browser.newPage({viewport:{width,height:1000},isMobile:width===375,hasTouch:width===375});let release;
 const gate=new Promise(resolve=>release=resolve);
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.route('**/api/calculate?**',async r=>{
  if(state==='loading'){await gate;return r.abort();}
  if(state==='error')return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Источник временно недоступен'})});
  const response=await r.fetch(),data=await response.json();data.recommendations=[];return r.fulfill({response,json:data});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(expected=>document.documentElement.dataset.analysisState===expected,state==='loading'?'calculating':state==='error'?'error':'success');
 await page.evaluate(()=>document.fonts.ready);
 if(width===375){await page.locator('#map-card').scrollIntoViewIfNeeded();if(state!=='loading'){await page.locator('.sheet-handle').click();await page.locator('button[data-snap=full]').click();}}
 else await page.locator('#recommendations').evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY-100,behavior:'instant'}));
 await page.waitForTimeout(450);await page.screenshot({path:`${dir}/${phase}-${state}-${width}.png`});
 metrics.push({width,state,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),heading:await page.locator('#result-empty h3').textContent()});
 release();await page.close();console.log(`${phase} ${state} ${width}`);
}}finally{await browser.close();}
await writeFile(`${dir}/${phase}-states.json`,JSON.stringify(metrics,null,2));
