import {chromium, webkit, devices, expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {auditPresentation} from './presentation-audit.mjs';
const [phase='after']=process.argv.slice(2);
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5071';
const dir=process.env.CAPTURE_DIR||'docs/verification/atlas-cover';
await mkdir(dir,{recursive:true});
const results=[];
for (const [name,type] of [['webkit',webkit],['chromium',chromium]]) {
 const browser=await type.launch(name==='chromium'?{channel:'chrome'}:{});
 try {
  for (const width of [320,375,768,1440]) {
   const mobile=width<=900;
   const device=name==='webkit'?devices['iPhone 13']:devices['Pixel 7'];
   const page=await browser.newPage({...mobile?device:{},viewport:{width,height:width>900?960:820}});
   const errors=[], tiles=new Set();
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.ok()&&r.url().includes('tile.openstreetmap.org'))tiles.add(r.url());});
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>document.fonts.ready);
   const shot=async part=>{
    if(name==='chromium'&&width!==320)await page.screenshot({path:dir+'/'+phase+'-'+width+'-'+part+'.png',scale:'css'});
   };
   await shot('hero');
   let cycles=0;
   let maxScrollDrift=0;
   if(mobile && width!==320) {
    const menu=page.locator('#mobile-navigation'), toggle=page.locator('#nav-toggle'), close=page.locator('#nav-close');
    const repeats=width===375?20:4;
    for(let i=0;i<repeats;i++){
     if(i===4)await page.emulateMedia({reducedMotion:'reduce'});
     if(i===10&&width===375)await page.setViewportSize({width,height:680});
     const scroll=i%2?420:0;
     await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),scroll);
     await page.waitForTimeout(35);
     const previous=await page.evaluate(()=>scrollY);
     const trigger=await toggle.boundingBox();
     await page.touchscreen.tap(trigger.x+trigger.width/2,trigger.y+trigger.height/2);
     await expect(toggle).toHaveAttribute('aria-expanded','true');
     await expect(menu).toBeVisible();
     if(i===0){await page.waitForTimeout(200);await shot('menu');}
     const rect=await menu.boundingBox();
     expect(rect.y).toBeGreaterThanOrEqual(0);
     expect(rect.y+rect.height).toBeLessThanOrEqual(page.viewportSize().height);
     if(i===0&&phase!=='before'){
      await page.keyboard.press('Tab');
      await expect(page.locator('#nav-menu a').first()).toBeFocused();
     }
     if(i%2===0)await page.keyboard.press('Escape');
     else if(phase==='after'){const b=await close.boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}
     else await close.tap();
     await expect(menu).toBeHidden();
     await expect(toggle).toHaveAttribute('aria-expanded','false');
     await expect(toggle).toBeFocused();
     const drift=Math.abs(await page.evaluate(()=>scrollY)-previous);
     maxScrollDrift=Math.max(maxScrollDrift,drift);
     if(phase==='after')expect(drift).toBeLessThanOrEqual(4);
     cycles++;
    }
    await toggle.tap();
    await page.locator('#nav-menu a[href="#workspace"]').tap();
    await expect(page).toHaveURL(/#workspace$/);
    await expect(menu).toBeHidden();
   }
   await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success',{timeout:30000});
   const map=page.locator('#map');
   await map.evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));
   await page.waitForTimeout(700);
   await shot('map');
   let contrast=null;
   if(name==='chromium'&&phase!=='before'){
    const audit=await page.evaluate(auditPresentation);
    contrast={min:audit.minContrast,issues:audit.issues.filter(issue=>issue.kind==='contrast')};
    expect(contrast.issues).toEqual([]);
   }
   if(phase!=='before'&&width===375) {
    const sheet=page.locator('#recommendations');
    await expect(sheet).toHaveAttribute('data-sheet-active','true');
    await page.locator('.sheet-handle').tap();
    await expect(sheet).toHaveAttribute('data-snap','expanded');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveAttribute('data-snap','peek');
    await page.locator('.recommendation-pin').first().tap();
    const popup=page.locator('.map-inspection');
    await expect(popup).toBeVisible();
    await shot('popup');
    await popup.getByRole('button',{name:'Сохранить',exact:true}).tap();
    await expect(popup.getByRole('status')).toContainText('Сохранено');
    await page.keyboard.press('Escape');
    const key=page.locator('.map-pin-key summary');
    await key.tap();
    await expect(page.locator('.map-pin-key')).toHaveAttribute('open','');
    await expect(page.locator('.map-pin-key>div')).toContainText('Точка, выбранная вручную');
    await key.tap();
    const sources=page.locator('#data-summary');
    await sources.tap();
    await expect(page.locator('#data-details')).toHaveAttribute('open','');
    await shot('sources');
   }
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   if(phase==='after'){expect(overflow).toBeLessThanOrEqual(0);expect(errors).toEqual([]);}
   results.push({name,width,cycles,maxScrollDrift,tiles:tiles.size,overflow,errors,contrast});
   console.log(phase,results.at(-1));
   await page.close();
  }
 } finally {await browser.close();}
}
await writeFile(dir+'/'+phase+'.json',JSON.stringify(results,null,2));
