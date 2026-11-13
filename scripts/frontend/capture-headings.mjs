import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const dir='docs/verification/redesign/stage-05';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const measurements=[];
try{
 for(const width of [375,1440])for(const variant of ['A','B','C']){
  const context=await browser.newContext({viewport:{width,height:width===375?812:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto('http://127.0.0.1:5057',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  if(variant==='A')await page.addStyleTag({content:'.hero-statement em{font-style:normal;font-weight:600}'});
  if(variant==='C'){
   const font=await readFile('tests/artifacts/fonts/Lora-Italic.ttf');
   await page.addStyleTag({content:`@font-face{font-family:HeadingCandidate;src:url(data:font/ttf;base64,${font.toString('base64')});font-style:italic;font-weight:400 700}.hero-title em{font-family:HeadingCandidate;font-style:italic}`});
  }
  await page.evaluate(()=>document.fonts.ready);
  measurements.push({width,variant,...await page.evaluate(()=>({heroHeight:document.getElementById('hero').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}))});
  await page.screenshot({path:`${dir}/${width}-variant-${variant}.png`});await context.close();
 }
 await writeFile(`${dir}/heading-comparison.json`,JSON.stringify(measurements,null,2)+'\n');
}finally{await browser.close();}
