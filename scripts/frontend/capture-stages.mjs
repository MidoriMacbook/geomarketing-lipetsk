import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const stage=process.argv[2]||'01';
const dir=`docs/verification/redesign/stage-${stage}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try {
 for(const width of [375,1440]) {
  const context=await browser.newContext({viewport:{width,height:width===375?812:1000},isMobile:width===375,hasTouch:width===375,deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5057');
  await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success',{},{timeout:90000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.screenshot({path:`${dir}/${width}-hero.png`});
  if(width===375)await page.locator('#mobile-settings-open').click();
  await page.locator('#district-trigger').click();
  await page.getByRole('option',{name:'Центр (Быханов сад)',exact:true}).click();
  await page.locator('#run').click();
  await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success',{},{timeout:90000});
  if(width===1440)await page.setViewportSize({width,height:1900});
  await page.locator('#map-card').scrollIntoViewIfNeeded();
  if(width===375)await page.locator('button[data-snap=half]').click();
  else await page.evaluate(()=>scrollTo(0,document.getElementById('workspace').getBoundingClientRect().top+scrollY-110));
  await page.waitForTimeout(1000);
  // Статический снимок показывает конечные числа, в том числе вне viewport.
  await page.emulateMedia({reducedMotion:'reduce'});
  if(width===1440)await page.locator('#workspace').screenshot({path:`${dir}/${width}-workspace.png`});
  else await page.screenshot({path:`${dir}/${width}-workspace.png`});
  if(width===375&&Number(stage)>=4){
    for(const snap of ['full','collapsed']){
      await page.locator(`button[data-snap=${snap}]`).click();
      await page.screenshot({path:`${dir}/375-${snap}.png`});
    }
    await page.locator('button[data-snap=half]').click();
    await page.locator('#recommendations-context').click();
    await page.screenshot({path:`${dir}/375-settings.png`});
  }
  await context.close();
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`${dir}/checks.json`,JSON.stringify({cpuSlowdown:4,widths:[375,1440],pageErrors:errors},null,2)+'\n');
} finally {await browser.close();}
