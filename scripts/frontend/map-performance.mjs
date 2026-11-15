import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:5071',dir='docs/verification/map-workbench/performance';await mkdir(dir,{recursive:true});const b=await chromium.launch({channel:'chrome'}),results=[];
try{for(const width of [375,1440]){
 const p=await b.newPage({viewport:{width,height:900}});await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await p.addInitScript(()=>{window.testCLS=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.testCLS+=e.value;}).observe({type:'layout-shift',buffered:true});});
 const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await p.goto(base);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.waitForTimeout(2000);
 await p.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-120,behavior:'instant'}));await p.waitForTimeout(700);
 const measure=await p.evaluate(async()=>{
  const {state}=await import('/static/js/state.js'),{drawMap}=await import('/static/js/map.js'),{selectPlace}=await import('/static/js/recommendations.js');
  const snapshot=structuredClone(state.current),[lat,lng]=snapshot.center;snapshot.houses=Array.from({length:1500},(_,i)=>({lat:lat+((i%50)-25)*28/111000,lng:lng+(Math.floor(i/50)-15)*28/(111000*Math.cos(lat*Math.PI/180)),residents:40+(i%100)}));state.current=snapshot;drawMap(snapshot);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const frames=[],tasks=[];let last=performance.now();
  for(let i=0;i<30;i++){await new Promise(resolve=>requestAnimationFrame(resolve));const now=performance.now();frames.push(now-last);last=now;const start=performance.now();selectPlace(i%2+1,false);tasks.push(performance.now()-start);}
  const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...values)};};
  return {houses:1500,samples:30,frame_ms:summarize(frames),selection_task_ms:summarize(tasks),cls:window.testCLS};
 });results.push({width,cpu:4,...measure});await p.screenshot({path:`${dir}/1500-houses-${width}.png`});await p.close();
}}finally{await b.close();}
await writeFile(`${dir}/metrics.json`,JSON.stringify(results,null,2));console.log(results);
