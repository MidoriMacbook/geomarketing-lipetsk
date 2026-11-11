import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'before',url=process.env.PREVIEW_URL||'https://geomarketing-lipetsk-redesign.onrender.com';
const dir='docs/verification/polish/01';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular3g'});
 await page.addInitScript(()=>{
  window.polishShifts=[];window.polishFrames=[];
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)polishShifts.push({value:e.value,time:e.startTime,sources:e.sources.map(s=>({node:s.node?.id||s.node?.className,from:s.previousRect.toJSON(),to:s.currentRect.toJSON()}))});}).observe({type:'layout-shift',buffered:true});
  const sample=()=>{const w=document.getElementById('workspace');if(w){const menu=document.getElementById('nav-toggle'),a=document.querySelector('.atlas-city');polishFrames.push({time:performance.now(),workspace:w.getBoundingClientRect().top,menu:!!menu?.getClientRects().length,artOpacity:a?getComputedStyle(a).opacity:null});}if(performance.now()<20000)requestAnimationFrame(sample);};requestAnimationFrame(sample);
 });
 await page.goto(url,{waitUntil:'commit',timeout:90000});
 await page.waitForFunction(()=>performance.getEntriesByType('paint').length>0);
 await page.screenshot({path:`${dir}/${phase}-375-first.png`});
 await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success',null,{timeout:90000});
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(5000);
 await page.screenshot({path:`${dir}/${phase}-375-ready.png`});
 const result=await page.evaluate(()=>({shifts:polishShifts,frames:polishFrames,cls:polishShifts.reduce((n,e)=>n+e.value,0),navigation:performance.getEntriesByType('navigation')[0].toJSON()}));
 await writeFile(`${dir}/${phase}-loading.json`,JSON.stringify({url,network:'Fast 3G: 1.6 Mbps / 750 Kbps, latency 150 ms',cpu:4,...result},null,2)+'\n');console.log({phase,cls:result.cls,first:result.frames[0],last:result.frames.at(-1),shifts:result.shifts});
}finally{await browser.close();}
