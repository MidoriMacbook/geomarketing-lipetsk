import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const [phase='before',point='baseline']=process.argv.slice(2),base=process.env.PREVIEW_URL||'http://127.0.0.1:5071';
const dir=`docs/verification/map-workbench/${point}`;await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const metrics=[];
try{for(const width of (process.env.WIDTHS?process.env.WIDTHS.split(',').map(Number):[375,768,1440])){
 const page=await browser.newPage({viewport:{width,height:900},isMobile:width===375,hasTouch:width===375});
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(800);
 if(point==='choices'){
  if(width===375)await page.locator('#mobile-settings-open').click();
  await page.locator('#district-trigger').click();await page.waitForTimeout(450);await page.screenshot({path:`${dir}/${phase}-${width}.png`});
  await page.locator('#district-trigger').click();metrics.push({width,secondTap:await page.locator('#district-trigger').getAttribute('aria-expanded')});
 }else{
  if(point==='typography')metrics.push(await page.locator('.hero-title em').evaluate((el,width)=>({width,italic:getComputedStyle(el).fontStyle,color:getComputedStyle(el).color,opacity:getComputedStyle(el).opacity,filter:getComputedStyle(el).filter,right:el.getBoundingClientRect().right,overflow:document.documentElement.scrollWidth-innerWidth}),width));
  await page.screenshot({path:`${dir}/${phase}-hero-${width}.png`});
  await page.locator('#map-card').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.screenshot({path:`${dir}/${phase}-map-${width}.png`});
  if(point==='sheet'&&width===375){await page.locator('.sheet-handle').click();await page.waitForTimeout(550);await page.screenshot({path:`${dir}/${phase}-expanded-${width}.png`});}
  if(point==='inspection'){
   await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));await page.waitForTimeout(700);
   const box=await page.locator('#map').boundingBox();await page.locator('#map').click({position:{x:box.width*.45,y:box.height*.55}});await page.waitForTimeout(600);
   await page.screenshot({path:`${dir}/${phase}-point-${width}.png`});
  }
  if(point==='popover'){
   await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));await page.waitForTimeout(700);
   await page.locator('.recommendation-pin').first().click();await page.waitForTimeout(650);await page.screenshot({path:`${dir}/${phase}-popover-${width}.png`});
  }
  if(point==='coverage'){
   await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');const {savePlace}=await import('/static/js/saved-places.js');for(const rec of state.current.recommendations.slice(0,2))await savePlace(rec,{compare:true});});
   if(width===375)await page.locator('.mobile-secondary-details>summary').filter({hasText:'Сохранённые места'}).click();
   await page.locator('#compare-coverage').click();await page.waitForTimeout(600);await page.screenshot({path:`${dir}/${phase}-coverage-${width}.png`});
  }
  if(point==='centers'){
   const center=page.getByRole('button',{name:'Центр спроса 1',exact:true});await center.focus();await center.press('Enter');await page.waitForTimeout(600);await page.screenshot({path:`${dir}/${phase}-center-${width}.png`});
  }
 }
 await page.close();
}}finally{await browser.close();}
await writeFile(`${dir}/${phase}.json`,JSON.stringify(metrics,null,2));console.log(metrics);
