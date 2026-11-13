import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'before',base=process.env.PREVIEW_URL||'http://127.0.0.1:5071';
const dir='docs/verification/visual-polish/06';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.addInitScript(()=>{window.shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.shifts.push(e.value);}).observe({type:'layout-shift',buffered:true});});
 await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1600);
 const records=[];
 const snapshot=async name=>{records.push(await page.evaluate(name=>({name,time:performance.now(),snap:document.querySelector('#recommendations').dataset.snap,active:document.querySelector('#recommendations').dataset.sheetActive,scrollY,mapHeight:document.querySelector('#map').getBoundingClientRect().height,cls:window.shifts.reduce((a,b)=>a+b,0)}),name));await page.screenshot({path:`${dir}/${phase}-${name}.png`});};
 await snapshot('hero');
 const frames=async action=>{const start=Date.now();for(const ms of [0,100,200,400]){await page.waitForTimeout(Math.max(0,start+ms-Date.now()));await snapshot(`${action}-${ms}`);}};
 await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-140,behavior:'instant'}));await frames('appear');
 if(phase==='after'){
  await page.locator('.sheet-handle').click();await frames('expand');
  await page.keyboard.press('Escape');await page.waitForTimeout(450);
  await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await frames('hide');
 }
 await writeFile(`${dir}/${phase}.json`,JSON.stringify(records,null,2)+'\n');console.log(records);
}finally{await browser.close();}
