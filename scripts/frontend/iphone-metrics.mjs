import {chromium,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const dir='docs/verification/iphone-layout/metrics';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),rows=[],fonts=[];
try{for(const width of [375,1440]){
 const page=await browser.newPage({viewport:{width,height:width===375?667:1000},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5071');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');await page.evaluate(()=>document.fonts.ready);
 const sample=async(state,selectors)=>{
  const samples=await page.evaluate(selectors=>{
   const rgb=s=>s.match(/[\d.]+/g).map(Number),mix=(a,b)=>{const alpha=a[3]??1;return a.slice(0,3).map((v,i)=>v*alpha+b[i]*(1-alpha));};
   const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   return selectors.map(selector=>{
    const el=document.querySelector(selector);if(!el)return {selector,missing:true};
    const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);
    let fill=[255,255,255];for(const p of chain)fill=mix(rgb(getComputedStyle(p).backgroundColor),fill);
    const style=getComputedStyle(el),ink=mix(rgb(style.color),fill),a=luminance(ink),b=luminance(fill);
    return {selector,text:el.textContent.trim().slice(0,75),ink,fill,ratio:+((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2),font:style.fontFamily,weight:style.fontWeight};
   });
  },selectors);rows.push(...samples.map(r=>({width,state,...r})));
 };
 await sample('cover',['.brand','#page-title em','.hero-statement','#hero-map-link','.hero-description']);
 fonts.push({width,...await page.evaluate(async()=>{const {debugSnapshot}=await import('/static/js/mobile-debug.js');return {fonts:debugSnapshot().fonts};})});
 if(width===375){await page.locator('#nav-toggle').click();await sample('menu',['#mobile-navigation-title','#nav-menu a.active']);await page.locator('#nav-close').click();await expect(page.locator('#mobile-navigation')).not.toBeVisible();await page.locator('#mobile-settings-open').click();}
 await sample('settings',['#district-value','#business-value','#run']);
 if(width===375){await page.locator('#mobile-settings-close').click();await expect(page.locator('#mobile-settings-dialog')).not.toBeVisible();}
 await sample('map',['#map-title','#trust-summary','#trust-details-link']);
 await page.close();
}
 const page=await browser.newPage({viewport:{width:375,height:667}});
 await page.route('**/*.woff2',r=>r.abort());await page.addInitScript(()=>{window.shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.shifts.push({time:e.startTime,value:e.value});}).observe({type:'layout-shift',buffered:true});});
 await page.goto('http://127.0.0.1:5071');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');await page.waitForTimeout(1500);
 const fallback=await page.evaluate(async()=>({...(await import('/static/js/mobile-debug.js')).debugSnapshot(),cls:window.shifts.reduce((s,e)=>s+e.value,0),shifts:window.shifts}));
 await page.screenshot({path:dir+'/fonts-blocked.png',scale:'css'});await writeFile(dir+'/fonts-blocked.json',JSON.stringify(fallback,null,2));
 await page.close();
 const enlarged=await browser.newPage({viewport:{width:320,height:667},reducedMotion:'reduce'});await enlarged.goto('http://127.0.0.1:5071');await enlarged.evaluate(()=>{document.documentElement.style.fontSize='200%';});await enlarged.screenshot({path:dir+'/text-200.png',fullPage:true,scale:'css'});await enlarged.close();
 await writeFile(dir+'/contrast.json',JSON.stringify(rows,null,2));await writeFile(dir+'/font-metrics.json',JSON.stringify(fonts,null,2));
 console.log({fallbackCLS:fallback.cls,contrastFailures:rows.filter(r=>r.missing||r.ratio<4.5)});
}finally{await browser.close();}
