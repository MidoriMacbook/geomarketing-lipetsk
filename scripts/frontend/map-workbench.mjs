import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const [phase='before',point='baseline']=process.argv.slice(2),base=process.env.PREVIEW_URL||'http://127.0.0.1:5071';
const dir=`docs/verification/map-workbench/${point}`;await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const metrics=[];
try{for(const width of [375,768,1440]){
 const page=await browser.newPage({viewport:{width,height:900},isMobile:width===375,hasTouch:width===375});
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(800);
 if(point==='choices'){
  if(width===375)await page.locator('#mobile-settings-open').click();
  await page.locator('#district-trigger').click();await page.waitForTimeout(450);await page.screenshot({path:`${dir}/${phase}-${width}.png`});
  await page.locator('#district-trigger').click();metrics.push({width,secondTap:await page.locator('#district-trigger').getAttribute('aria-expanded')});
 }else{
  await page.screenshot({path:`${dir}/${phase}-hero-${width}.png`});
  await page.locator('#map-card').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.screenshot({path:`${dir}/${phase}-map-${width}.png`});
  if(point==='sheet'&&width===375){await page.locator('.sheet-handle').click();await page.waitForTimeout(550);await page.screenshot({path:`${dir}/${phase}-expanded-${width}.png`});}
 }
 await page.close();
}}finally{await browser.close();}
await writeFile(`${dir}/${phase}.json`,JSON.stringify(metrics,null,2));console.log(metrics);
