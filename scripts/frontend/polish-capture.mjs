import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const [point,phase]=process.argv.slice(2),dir=`docs/verification/polish/${point}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 if(point==='05')await page.route('https://tile.openstreetmap.org/**',()=>new Promise(()=>{}));
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5057',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);
 const metrics={point,phase,cpu:4};
 if(point==='07'){
  for(const width of [375,768]){
   await page.setViewportSize({width,height:812});await page.waitForTimeout(400);
   if(width===375)await page.locator('#mobile-settings-open').click();else await page.locator('#settings').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${dir}/${phase}-${width}.png`});
   metrics[width]=await page.locator('#settings .field-label:visible').evaluateAll(els=>els.map(el=>({text:el.textContent,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
   if(width===375)await page.keyboard.press('Escape');
  }
 }
 if(point==='08'){
  await page.evaluate(async()=>{(await import('/static/js/ui.js')).setAnalysisState('calculating');});
  await page.locator('#map-card').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
  metrics.text=await page.locator('.analysis-bar').evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  await page.screenshot({path:`${dir}/${phase}-375.png`});
 }
 if(point==='09'){
  await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('[data-snap=full]').click();
  const cards=page.getByTestId('recommendation-card');await cards.first().getByTestId('save-place').click();await cards.nth(1).locator('.mobile-rec-toggle').click();await cards.nth(1).getByTestId('save-place').click();await page.locator('#comparison-guide-open').click();
  await page.locator('#comparison').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
  metrics.width=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  await page.screenshot({path:`${dir}/${phase}-375.png`});
 }
 if(point==='10'){
  await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('[data-snap=full]').click();await page.locator('.result-data-details summary').click();await page.waitForTimeout(400);
  metrics.occurrences=await page.evaluate(()=>document.body.textContent.match(/не вероятность успеха/gi)?.length||0);
  await page.screenshot({path:`${dir}/${phase}-375.png`});
 }
 if(point==='11'){
  await page.locator('#scenario-save').click();await page.locator('#scenario-submit').click();
  await page.getByTestId('scenario-delete').evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
  await page.getByTestId('scenario-delete').click();await page.waitForTimeout(400);
  metrics.text=await page.locator('#scenario-delete-dialog').innerText();await page.screenshot({path:`${dir}/${phase}-375.png`});
 }
 if(point==='05'){
  for(const width of [375,1440]){
   await page.setViewportSize({width,height:812});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(500);
   if(width===1440){await page.locator('h1').hover();await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('h1'));getSelection().removeAllRanges();getSelection().addRange(r);});}
   await page.screenshot({path:`${dir}/${phase}-${width}-hero.png`});
   await page.evaluate(()=>getSelection().removeAllRanges());await page.locator('#map-card').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
   await page.screenshot({path:`${dir}/${phase}-${width}-map.png`});
  }
  metrics.background=await page.locator('#map').evaluate(el=>getComputedStyle(el).backgroundColor);
  metrics.selection=await page.locator('h1').evaluate(el=>({background:getComputedStyle(el,'::selection').backgroundColor,color:getComputedStyle(el,'::selection').color}));
 }
 if(point==='02'){
  await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('button[data-snap=full]').click();await page.waitForTimeout(450);
  const rect=await page.locator('.sheet-handle').boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+22);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2,rect.y+180,{steps:8});
  await page.screenshot({path:`${dir}/${phase}-375-drag.png`});await page.mouse.up();await page.waitForTimeout(450);
  await page.locator('button[data-snap=full]').click();await page.waitForTimeout(450);await page.locator('button[data-snap=collapsed]').click();await page.waitForTimeout(100);
  metrics.moving=await page.locator('#result').evaluate(el=>({visibility:getComputedStyle(el).visibility,height:el.getBoundingClientRect().height,scrollTop:el.scrollTop}));
  await page.screenshot({path:`${dir}/${phase}-375-moving.png`});
 }
 if(point==='03'){
  await page.locator('#nav-toggle').click();await page.waitForTimeout(600);
  metrics.links=await page.locator('#nav-menu a:visible').evaluateAll(links=>links.map(el=>{const s=getComputedStyle(el);return {text:el.textContent,radius:s.borderRadius,clip:s.clipPath,background:s.backgroundColor};}));
  await page.screenshot({path:`${dir}/${phase}-375.png`});
 }
 if(point==='04'){
  await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('button[data-snap=full]').click();
  await page.getByTestId('recommendation-card').first().locator('.mobile-show-place').click();await page.waitForTimeout(1600);
  metrics.map=await page.locator('#map').boundingBox();metrics.circle=await page.locator('.leaflet-accessibility-pane path').boundingBox();metrics.layers=await page.locator('[data-layer-key]').evaluateAll(els=>els.map(el=>({text:el.textContent,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom})));metrics.sheet=await page.locator('#recommendations').boundingBox();
  await page.screenshot({path:`${dir}/${phase}-375.png`});
 }
 await writeFile(`${dir}/${phase}.json`,JSON.stringify(metrics,null,2)+'\n');
}finally{await browser.close();}
