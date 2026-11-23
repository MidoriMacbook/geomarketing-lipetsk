import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {auditPresentation} from './presentation-audit.mjs';
const [phase='before',point='01']=process.argv.slice(2),base=process.env.PREVIEW_URL||'http://127.0.0.1:5071';
const dir=`docs/verification/recommendation-polish/${point}`;await mkdir(dir,{recursive:true});
const states=point==='02'?['1','2','3']:point==='08'?['1','2','3','error','empty','saved','comparison']:['2'];
const browser=await chromium.launch({channel:'chrome'}),rows=[];
try{for(const width of [375,768,1440,1920])for(const stateName of states){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
  const path=url.pathname==='/'?'static/index.html':url.pathname.slice(1);
  if(process.env.CAPTURE_REF&&/^static\/(css\/|js\/|index.html)/.test(path)){
   const body=execFileSync('git',['show',`${process.env.CAPTURE_REF}:${path}`]);
   return route.fulfill({body,contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'text/html'});
  }return route.continue();
 });
 await page.route('**/api/calculate?**',async route=>{
  if(stateName==='error')return route.fulfill({status:503,json:{error:'Не удалось загрузить данные. Повторите попытку.'}});
  const response=await route.fetch(),data=await response.json();
  const count=stateName==='empty'?0:/^[123]$/.test(stateName)?Number(stateName):2;
  data.recommendations=data.recommendations.slice(0,count);if(!count)data.best=null;
  // Presentation fixture: a weak second alternative exercises its label.
  if(data.recommendations[1])data.recommendations[1].score=.26;
  await route.fulfill({response,json:data});
 });
 await page.goto(base);await expect(page.locator('html')).toHaveAttribute('data-analysis-state',stateName==='error'?'error':'success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);
 if(['saved','comparison'].includes(stateName)){
  await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');const {savePlace}=await import('/static/js/saved-places.js');for(const rec of state.current.recommendations)await savePlace(rec,{compare:true});});
  if(width===375)await page.locator('.mobile-secondary-details>summary').filter({hasText:'Сохранённые места'}).click();
  await page.locator(stateName==='saved'?'#saved-section':'#comparison').scrollIntoViewIfNeeded();
 }else if(stateName==='error'){
  if(width===375)await page.locator('#mobile-settings-open').click();else await page.locator('#error').scrollIntoViewIfNeeded();
 }else if(point==='06'){
  await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-75,behavior:'instant'}));
  for(const delta of [420,-350,450,-520]){await page.mouse.wheel(0,delta);await page.waitForTimeout(100);}
  await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-75,behavior:'instant'}));
 }else if(width===375){
  await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));await page.waitForTimeout(700);await page.locator('.sheet-handle').click();
 }else await page.locator('#recommendations').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));
 if(point==='04'){await page.evaluate(async()=>{const {selectPlace}=await import('/static/js/recommendations.js');selectPlace(1);});await page.mouse.move(0,0);}
 await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/${phase}-${width}-${stateName}.png`});
 rows.push({width,state:stateName,errors,...(point==='08'?{audit:await page.evaluate(auditPresentation)}:{}),...await page.evaluate(()=>{
  const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const selector='.recommendation,.saved-card,.comparison,#selection-note,.notice,.kpi-card,.hero-steps article,.settings,.map-card,.site-header,.choice-trigger,.button,.sheet-place';
  return {overflow:document.documentElement.scrollWidth-innerWidth,section:rect(document.querySelector('#recommendations')),map:rect(document.querySelector('#map-card')),
   cards:[...document.querySelectorAll('#recommendation-list>.recommendation')].map(rect),
   styles:[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length&&!el.closest('[hidden]')).map(el=>{const s=getComputedStyle(el);return {tag:el.tagName,id:el.id,class:el.className,text:el.textContent.trim().slice(0,60),radius:s.borderRadius,padding:s.padding,weight:s.fontWeight,color:s.color,background:s.backgroundColor,overflow:el.scrollWidth-el.clientWidth,...rect(el)};})};
 })});await page.close();console.log(point,phase,width,stateName);
}}finally{await browser.close();}
await writeFile(`${dir}/${phase}.json`,JSON.stringify(rows,null,2));
