import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const [point,phase]=process.argv.slice(2),dir=`docs/verification/polish/${point}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5057',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);
 const metrics={point,phase,cpu:4};
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
 await writeFile(`${dir}/${phase}.json`,JSON.stringify(metrics,null,2)+'\n');
}finally{await browser.close();}
