import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const [phase='before',only='all']=process.argv.slice(2),base=process.env.PREVIEW_URL||'http://127.0.0.1:5071';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const point of (only==='all'?['01','02','03','04','05']:[only])){
  const dir=`docs/verification/visual-polish/${point}`;await mkdir(dir,{recursive:true});const metrics=[];
  for(const width of (point==='04'?[375,768,1280,1440,1920]:[375,768,1440,1920])){
   const page=await browser.newPage({viewport:{width,height:1000},isMobile:width===375,hasTouch:width===375});
   await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1800);
   if(point==='01')await page.keyboard.press('Control+a');
   if(point==='03'){
    if(width===375){await page.locator('#area-details>summary').click();await page.locator('#mobile-settings-bar').scrollIntoViewIfNeeded();}
    else await page.locator('.analysis-context-row').scrollIntoViewIfNeeded();
   }
   if(point==='05'){
    if(width===375)await page.locator('.mobile-secondary-details>summary').filter({hasText:'Сохранённые места'}).click();
    await page.locator('#saved-section').scrollIntoViewIfNeeded();
   }
   await page.screenshot({path:`${dir}/${phase}-${width}.png`});
   metrics.push(await page.evaluate(({width})=>{
    const h=document.querySelector('#page-title'),sel=getSelection();const range=document.createRange();range.selectNodeContents(h);sel.removeAllRanges();sel.addRange(range);const copied=sel.toString();sel.removeAllRanges();
    return {width,copied,overflow:document.documentElement.scrollWidth>innerWidth,heading:getComputedStyle(h).lineHeight,italic:getComputedStyle(h.querySelector('em')).fontStyle,selection:getComputedStyle(h,'::selection').backgroundColor,annotations:[...document.querySelectorAll('.hero-annotation text')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent,height:e.getBoundingClientRect().height})),kpis:[...document.querySelectorAll('.kpi-card')].filter(e=>e.getClientRects().length).map(e=>({text:e.innerText,padding:getComputedStyle(e).padding,border:getComputedStyle(e).borderLeftWidth,before:getComputedStyle(e,'::before').content}))};
   },{width}));
   await page.close();
  }
  await writeFile(`${dir}/${phase}.json`,JSON.stringify(metrics,null,2)+'\n');console.log(`${point} ${phase} готов`);
 }
}finally{await browser.close();}

