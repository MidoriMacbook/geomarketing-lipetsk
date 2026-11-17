import {chromium,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome'}),results=[];
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5071',dir='docs/verification/mobile-refinement';
try {
 for(const phase of ['before','after']){
  const page=await browser.newPage({viewport:{width:375,height:667}});
  await page.route('**/*',route=>new URL(route.request().url()).origin!==base||['script','font'].includes(route.request().resourceType())?route.abort():route.continue());
  if(phase==='before')await page.route('**/static/css/palette.css',route=>route.fulfill({body:execFileSync('git',['show','11daee2:static/css/palette.css']),contentType:'text/css'}));
  await page.goto(base);
  const visible=await page.locator('.map-heading>#trust-status').isVisible();
  expect(visible).toBe(phase==='before');
  await page.screenshot({path:`${dir}/loading-${phase}-375.png`,scale:'css'});await page.close();
 }
 for(let i=0;i<3;i++){
  const page=await browser.newPage({viewport:{width:375,height:812}});
  await page.addInitScript(()=>{window.shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.shifts.push({value:e.value,time:e.startTime,nodes:e.sources.map(s=>s.node?.id||s.node?.className||'text')});}).observe({type:'layout-shift',buffered:true});});
  await page.route('**/*',async r=>{if(new URL(r.request().url()).origin!==base)return r.abort();if(['script','font'].includes(r.request().resourceType()))await new Promise(resolve=>setTimeout(resolve,350));return r.continue();});
  await page.goto(base);await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
  const shifts=await page.evaluate(()=>window.shifts),cls=shifts.reduce((sum,e)=>sum+e.value,0);results.push({run:i+1,cls,shifts});expect(cls).toBeLessThan(.05);await page.close();
 }
}finally{await browser.close();await writeFile(`${dir}/loading-cls.json`,JSON.stringify(results,null,2));}
console.log(results.map(r=>({run:r.run,cls:r.cls})));
