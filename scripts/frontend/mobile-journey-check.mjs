import {chromium,webkit,devices,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const [phase='before']=process.argv.slice(2);
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5071';
const dir=process.env.CAPTURE_DIR||'docs/verification/mobile-journey';
const engine=process.env.TEST_ENGINE==='webkit'?webkit:chromium;
const mobileDevice=engine===webkit?devices['iPhone 13']:devices['Pixel 7'];
const browser=await engine.launch(engine===chromium?{channel:'chrome'}:{});
await mkdir(dir,{recursive:true});
const cases=process.env.QUICK?[ [375,667],[390,844] ]:[[320,667],[375,667],[390,844],[768,900],[1440,960]];
const result=[];
try {
 for(const [width,height] of cases){
  const mobile=width<=600;
  const page=await browser.newPage({...mobile?mobileDevice:{},viewport:{width,height},reducedMotion:'reduce'});
  if(process.env.CAPTURE_REF)await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   const file=url.pathname==='/'?'static/index.html':url.pathname.slice(1);
   if(url.origin!==base||!/^static\/(css\/|js\/|index\.html$)/.test(file))return route.continue();
   const body=execFileSync('git',['show',process.env.CAPTURE_REF+':'+file]);
   return route.fulfill({body,contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html'});
  });
  page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success',{timeout:90000});
  await page.evaluate(()=>document.fonts.ready);
  const shot=part=>page.screenshot({path:dir+'/'+phase+'-'+width+'-'+part+'.png',scale:'css'});
  const row={width,height,errors};
  result.push(row);
  try {
   await shot('hero');
   if(mobile&&width===320){
    await page.evaluate(()=>document.documentElement.style.fontSize='32px');
    await page.waitForTimeout(200);
    row.overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(row.overflow).toBeLessThanOrEqual(0);
    continue;
   }
   await page.locator('#hero-map-link').click();
   const map=page.locator('#map'),sheet=page.locator('#recommendations');
   row.anchor=await page.evaluate(()=>{
    const bounds=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
    const bar=document.querySelector('#mobile-settings-open');
    return { header:bounds(document.querySelector('#site-header')), settings:bounds(bar.offsetHeight?bar:document.querySelector('#settings')),
     layers:bounds(document.querySelector('.map-legend')), map:bounds(document.querySelector('#map')) };
   });
   if(mobile)await page.locator('#mobile-settings-open').click();
   await page.locator('#business-trigger').click();
   await page.getByRole('option',{name:process.env.JOURNEY_BUSINESS||'Пекарня',exact:true}).click();
   const request=page.waitForResponse(r=>r.url().includes('/api/calculate?')&&r.ok(),{timeout:90000});
   await page.locator('#run').click();
   const data=await (await request).json();row.source=data.source;row.recommendations=data.recommendations.length;
   await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success',{timeout:90000});
   if(mobile&&await page.locator('#mobile-settings-dialog').isVisible())await page.locator('#mobile-settings-close').click();
   await map.evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-106,behavior:'instant'}));
   await page.waitForTimeout(650);
   await shot('map');
   if(mobile){
    await expect(sheet).toHaveAttribute('data-sheet-active','true');
    await shot('peek');
   }
   const pins=page.locator('.recommendation-pin'),popup=page.locator('.map-inspection');
   const rects=() => page.evaluate(()=>{
    const bounds=el=>{const r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom];};
    const zoom=document.querySelector('.leaflet-control-zoom');
    const pins=[...document.querySelectorAll('.recommendation-pin')];
    return {zoom:bounds(zoom),pins:pins.map(bounds),layerWidth:[document.querySelector('.map-legend').clientWidth,document.querySelector('.map-legend').scrollWidth],
      sheet:bounds(document.querySelector('#recommendations')),peekCards:[...document.querySelectorAll('.sheet-place')].map(bounds)};
   });
   await pins.nth(Math.min(1,data.recommendations.length-1)).click();
   await expect(popup).toBeVisible();
   await page.waitForTimeout(350);
   row.popup=await rects();await shot('popup');
   await popup.getByRole('button',{name:/О месте|Подробнее/}).click();
   if(mobile)await expect(sheet).toHaveAttribute('data-snap','expanded');
   if(mobile)await shot('results');
   const cards=page.getByTestId('recommendation-card');
   for(const card of await cards.all()){
    const disclosure=card.locator('.mobile-rec-toggle');
    if(mobile&&await disclosure.getAttribute('aria-expanded')==='false')await disclosure.click();
    await card.getByTestId('save-place').click();
   }
   await expect(page.getByTestId('saved-card')).toHaveCount(data.recommendations.length);
   if(mobile){
    await page.locator('#comparison-guide-open').click();
    row.snapAfterCompare=await sheet.getAttribute('data-snap');
    if(phase.endsWith('before')&&row.snapAfterCompare==='expanded'){
     // Снимок исходной таблицы после ручного выхода из блокирующего листа.
     await page.keyboard.press('Escape');
     await page.locator('#comparison-title').evaluate(el=>el.scrollIntoView({block:'center'}));
    }else expect(row.snapAfterCompare).toBe('peek');
   }else{
    const checks=page.getByTestId('compare-place');
    for(const checkbox of await checks.all())await checkbox.check();
    await page.locator('#comparison').scrollIntoViewIfNeeded();
   }
   await expect(page.locator('#comparison tbody tr')).toHaveCount(data.recommendations.length);
   await page.locator('#comparison-title').evaluate(el=>el.scrollIntoView({block:'start'}));
   await shot('comparison');
   const back=page.locator('#comparison-map-link');
   if(await back.isVisible())await back.click();
   else await page.locator('#map-title').scrollIntoViewIfNeeded();
   row.selected=await pins.filter({hasText:/./}).evaluateAll(elements=>elements.find(e=>e.classList.contains('is-selected'))?.textContent);
   row.overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   expect(row.overflow).toBeLessThanOrEqual(0);
  } catch(e){row.failure=e.message;await shot('failure');}
  finally{console.log(phase,width,height,row.source,row.recommendations,row.failure||'OK');await page.close();}
 }
} finally{await browser.close();await writeFile(dir+'/'+phase+'.json',JSON.stringify(result,null,2));}
if(!phase.endsWith('before'))expect(result.filter(row=>row.failure||row.errors.length)).toEqual([]);
