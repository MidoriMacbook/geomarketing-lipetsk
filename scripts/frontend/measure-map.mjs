import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 await page.goto('http://127.0.0.1:5057',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('button[data-snap=collapsed]').click();
 const renderMs=await page.evaluate(async()=>{
  const {state}=await import('/static/js/state.js'),{drawMap}=await import('/static/js/map.js');
  const houses=Array.from({length:1500},(_,i)=>({lat:state.current.center[0]+(i%50-25)*.00015,lng:state.current.center[1]+(Math.floor(i/50)-15)*.00025,residents:80+i%500}));
  const start=performance.now();drawMap({...state.current,houses});return performance.now()-start;
 });
 await page.evaluate(()=>{window.frameSamples=[];let last=0;function tick(now){if(last)frameSamples.push(now-last);last=now;if(frameSamples.length<120)requestAnimationFrame(tick);}requestAnimationFrame(tick);});
 await page.locator('.leaflet-control-zoom-in').click();
 const box=await page.locator('#map').boundingBox();
 await page.mouse.move(box.x+90,box.y+120);await page.mouse.down();await page.mouse.move(box.x+180,box.y+180,{steps:24});await page.mouse.up();
 await page.locator('.leaflet-control-zoom-out').click();
 await page.waitForFunction(()=>window.frameSamples.length>=120);
 const frames=await page.evaluate(()=>frameSamples.sort((a,b)=>a-b));
 const result={houses:1500,cpuSlowdown:4,renderMs,frameMedianMs:frames[60],frameP95Ms:frames[114],frameMaxMs:frames.at(-1),note:'Синтетические дома; отрисовка, масштабирование и панорамирование в Chrome. Не физический телефон.'};
 await mkdir('docs/verification/redesign/stage-07',{recursive:true});
 await writeFile('docs/verification/redesign/stage-07/map-performance.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await browser.close();}
