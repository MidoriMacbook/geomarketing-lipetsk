import {chromium,webkit,devices,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'before', engine=process.env.TEST_ENGINE==='webkit'?webkit:chromium;
const dir='docs/verification/mobile-refinement',results=[];
await mkdir(dir,{recursive:true});
const browser=await engine.launch(engine===chromium?{channel:'chrome'}:{});
try {
 for(const [width,height] of [[375,667],[390,844],[768,1024]]){
  const page=await browser.newPage({...devices['iPhone 13'],viewport:{width,height},reducedMotion:'reduce'});
  page.setDefaultTimeout(12000);
  const row={width,height,engine:engine.name()};results.push(row);
  try {
   await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5071');
   await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success',{timeout:90000});
   await page.evaluate(()=>document.fonts.ready);
   const shot=name=>page.screenshot({path:`${dir}/${phase}-${engine.name()}-${width}-${name}.png`,scale:'css'});
   await shot('cover');
   row.coverHeight=await page.locator('.editorial-hero').evaluate(el=>el.getBoundingClientRect().height);
   await page.locator('#nav-toggle').tap();await page.waitForTimeout(600);
   row.menu=await page.locator('#mobile-navigation').evaluate(el=>{const r=el.getBoundingClientRect();return {opacity:getComputedStyle(el).opacity,top:r.top,bottom:r.bottom,visible:el.open};});
   await shot('menu');await page.locator('#nav-menu a[href="#workspace"]').tap();
   await expect(page.locator('#mobile-navigation')).not.toBeVisible();
   await page.locator('#map-title').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
   await page.waitForTimeout(600);await shot('map');
   await page.locator('.recommendation-pin').nth(1).tap();await page.waitForTimeout(400);await shot('popover');
   await page.locator('.map-inspection').getByRole('button',{name:'О месте',exact:true}).tap();
   if(width<=600)await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','expanded');
   for(const card of await page.getByTestId('recommendation-card').all()){
    const disclosure=card.locator('.mobile-rec-toggle');
    if(width<=600&&await disclosure.getAttribute('aria-expanded')==='false')await disclosure.tap();
    await card.getByTestId('save-place').tap();
   }
   if(width<=600)await page.locator('#comparison-guide-open').tap();
   else {for(const check of await page.getByTestId('compare-place').all())await check.check();await page.locator('#comparison-title').evaluate(el=>el.scrollIntoView({block:'start'}));}
   await page.waitForTimeout(400);await shot('comparison');
   row.table=await page.locator('#comparison .table-scroll').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth}));
   await page.locator('#comparison-map-link').tap();await page.waitForTimeout(500);
   await page.locator('#trust-details-link').tap();await page.waitForTimeout(400);await shot('source');
  }catch(e){row.failure=e.message;}
  console.log(JSON.stringify(row));await page.close();
 }
}finally{await browser.close();await writeFile(`${dir}/${phase}-${engine.name()}.json`,JSON.stringify(results,null,2));}
if(phase!=='before')expect(results.filter(r=>r.failure)).toEqual([]);
