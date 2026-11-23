import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const dir='docs/verification/map-workbench/palette',base='http://127.0.0.1:5071';await mkdir(dir,{recursive:true});const browser=await chromium.launch({channel:'chrome'});
try{for(const variant of ['A','B'])for(const width of [375,768,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
 await page.evaluate(v=>document.documentElement.dataset.paletteVariant=v,variant);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1100);await page.screenshot({path:`${dir}/${variant}-hero-${width}.png`});
 await page.locator('#map-card').scrollIntoViewIfNeeded();await page.waitForTimeout(700);await page.screenshot({path:`${dir}/${variant}-map-${width}.png`});
 if(variant==='B'&&width===1440){const cdp=await page.context().newCDPSession(page);for(const type of ['deuteranopia','protanopia']){await cdp.send('Emulation.setEmulatedVisionDeficiency',{type});await page.screenshot({path:`${dir}/B-${type}.png`});}await cdp.send('Emulation.setEmulatedVisionDeficiency',{type:'none'});}
 if(width===375){await page.locator('.sheet-handle').click();await page.waitForTimeout(1600);await page.screenshot({path:`${dir}/${variant}-panel-${width}.png`});await page.keyboard.press('Escape');}
 await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');const {savePlace}=await import('/static/js/saved-places.js');for(const rec of state.current.recommendations.slice(0,2))await savePlace(rec,{compare:true});});
 if(width===375)await page.locator('.mobile-secondary-details>summary').filter({hasText:'Сохранённые места'}).click();await page.locator('#comparison').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.screenshot({path:`${dir}/${variant}-comparison-${width}.png`});await page.close();
}}finally{await browser.close();}
