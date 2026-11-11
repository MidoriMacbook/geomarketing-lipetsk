import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const url=process.env.PREVIEW_URL||'http://127.0.0.1:5057';
const dir=process.env.CAPTURE_DIR||'docs/verification/redesign/stage-08';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks={url,cpuSlowdown:4,widths:process.env.CAPTURE_WIDTHS?.split(',').map(Number)||[375,768,1440],pageErrors:[],journeys:[]};
try{
 for(const width of checks.widths){
  const phone=width===375;
  const context=await browser.newContext({viewport:{width,height:phone?812:1000},isMobile:phone,hasTouch:phone});
  const page=await context.newPage();page.on('pageerror',e=>checks.pageErrors.push(e.message));
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  const ready=()=>expect(page.locator('html')).toHaveAttribute('data-analysis-state','success',{timeout:90000});
  await ready();await page.evaluate(()=>document.fonts.ready);
  await page.emulateMedia({reducedMotion:'reduce'});
  const shot=name=>page.screenshot({path:`${dir}/${width}-${name}.png`});
  await shot('hero');
  if(phone)await page.locator('#mobile-settings-open').click();
  await page.locator('#district-trigger').click();
  await page.getByRole('option',{name:'Центр (Быханов сад)',exact:true}).click();
  await page.locator('#run').click();await ready();
  await expect(page.getByTestId('recommendation-card')).toHaveCount(3);
  await page.locator('#map-card').scrollIntoViewIfNeeded();
  if(phone){
   for(const snap of ['half','full','collapsed']){
    await page.locator(`button[data-snap=${snap}]`).click();await shot(snap);
   }
   await page.locator('button[data-snap=half]').click();await shot('workspace');
   await page.locator('#recommendations-context').click();await shot('settings');
   await page.keyboard.press('Escape');await page.locator('button[data-snap=collapsed]').click();
  }else{
   await page.setViewportSize({width,height:2000});
   await page.locator('#workspace').screenshot({path:`${dir}/${width}-workspace.png`});
   await page.setViewportSize({width,height:1000});
  }
  await page.locator('#map-card').screenshot({path:`${dir}/${width}-layers.png`});
  await page.locator('[data-layer-key=houses]').click();
  await expect(page.locator('[data-layer-key=houses]')).toHaveAttribute('aria-pressed','false');
  await page.locator('#map-card').screenshot({path:`${dir}/${width}-without-houses.png`});
  await page.locator('[data-layer-key=houses]').click();
  if(phone){await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('button[data-snap=full]').click();}
  const cards=page.getByTestId('recommendation-card');
  await cards.first().getByTestId('save-place').click();
  if(phone)await cards.nth(1).locator('.mobile-rec-toggle').click();
  await cards.nth(1).getByTestId('save-place').click();
  if(phone)await page.locator('#comparison-guide-open').click();
  else{
   await page.getByTestId('compare-place').nth(0).check();await page.getByTestId('compare-place').nth(1).check();
  }
  await expect(page.locator('#comparison tbody tr')).toHaveCount(2);
  await page.locator('#scenario-save').click();await shot('dialog');
  await page.locator('#scenario-submit').click();await expect(page.getByTestId('scenario-card')).toHaveCount(1);
  await page.reload({waitUntil:'domcontentloaded'});await ready();
  await expect(page.getByTestId('saved-card')).toHaveCount(2);await expect(page.getByTestId('scenario-card')).toHaveCount(1);
  await page.getByTestId('scenario-open').evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
  await page.getByTestId('scenario-open').click();
  await expect(page.locator('#recommendations-context')).toContainText('Центр (Быханов сад)');
  checks.journeys.push({width,recommendations:3,savedAfterReload:2,comparisonRows:2,researchOpened:true});
  // Сетевой отказ и отсутствие мест — только подмена ответа в этом тестовом браузере.
  if(phone)await page.locator('#mobile-settings-open').click();
  await page.route('**/api/calculate?**',r=>r.abort());await page.locator('#run').click();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state','error');
  if(!phone)await page.locator('#settings').scrollIntoViewIfNeeded();await shot('error');
  await page.unroute('**/api/calculate?**');
  const data=await page.evaluate(async()=>structuredClone((await import('/static/js/state.js')).state.current));
  data.recommendations=[];
  await page.route('**/api/calculate?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
  await page.locator('#run').click();await ready();
  await expect(page.locator('#result-empty h3')).toHaveText('Подходящих мест не найдено');
  if(phone){await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('button[data-snap=full]').click();}
  else await page.locator('#result-empty').scrollIntoViewIfNeeded();await shot('empty');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await context.close();
 }
 expect(checks.pageErrors).toEqual([]);
 await writeFile(`${dir}/checks.json`,JSON.stringify(checks,null,2)+'\n');
 console.log(checks);
}finally{await browser.close();}
