import {chromium,webkit,devices,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const phase=process.argv[2]||'before',engine=process.env.TEST_ENGINE==='webkit'?webkit:chromium;
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5071',dir='docs/verification/iphone-layout';
await mkdir(dir,{recursive:true});const browser=await engine.launch(engine===chromium?{channel:'chrome'}:{}),rows=[];
try{for(const [width,height] of [[320,667],[375,667],[390,844]]){
 const page=await browser.newPage({...devices['iPhone 13'],viewport:{width,height},reducedMotion:'reduce'});
 if(phase==='before')for(const file of ['static/css/palette.css','static/css/atlas.css','static/js/result-sheet.js','static/js/navigation.js']){
  const body=execFileSync('git',['show',`2333eef:${file}`],{encoding:'utf8'});
  await page.route(`**/${file}`,route=>route.fulfill({body,contentType:file.endsWith('.css')?'text/css':'text/javascript'}));
 }
 await page.goto(base);await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');await page.evaluate(()=>document.fonts.ready);
 const capture=name=>page.screenshot({path:`${dir}/${phase}-${engine.name()}-${width}-${name}.png`,scale:'css'});
 await capture('cover');await page.locator('#hero-map-link').tap();await page.waitForTimeout(400);await capture('workspace');
 const measure=async name=>{
  await page.waitForTimeout(550);
  const value=await page.evaluate(async()=>{const {debugSnapshot}=await import('/static/js/mobile-debug.js');return debugSnapshot();});
  rows.push({width,height,name,...value.gap});return value;
 };
 await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));await measure('peek');
 await page.locator('.sheet-handle').tap();await measure('expanded');
 await page.locator('.sheet-close').tap();await measure('closed');
 await page.locator('#trust-details-link').tap();await page.getByRole('button',{name:'Закрыть сведения о данных'}).tap();await measure('source-closed');
 await page.locator('#map-card .map-footer').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-130,behavior:'instant'}));await measure('past-map');await capture('gap');
 await page.setViewportSize({width,height:height-180});await measure('short-viewport');
 await page.setViewportSize({width:height,height:width});await measure('landscape');await page.setViewportSize({width,height});
 await page.goto(base+'/?debug=1');await expect(page.locator('#mobile-debug')).toBeVisible();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);await capture('debug');
 await page.close();
}}finally{await browser.close();await writeFile(`${dir}/${phase}-${engine.name()}.json`,JSON.stringify(rows,null,2));}
console.log(rows.map(r=>({width:r.width,state:r.name,reserve:r.reserve,gap:r.cardGap,footerMargin:r.footer?.marginBottom})));
