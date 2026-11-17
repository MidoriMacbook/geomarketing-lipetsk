import {firefox,webkit,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='docs/verification/map-workbench/browsers',base='http://127.0.0.1:5071',results=[];await mkdir(dir,{recursive:true});
for(const type of [firefox,webkit]){
 const browser=await type.launch();try{for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base);await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
  console.log('checking',type.name(),width);
  if(width===375)await page.locator('#mobile-settings-open').click();
  const trigger=page.locator('#business-trigger');await trigger.click();await expect(trigger).toHaveAttribute('aria-expanded','true');await page.screenshot({path:`${dir}/${type.name()}-choices-${width}.png`});
  // A second physical click must not invoke Playwright's scrollIntoView: Firefox
  // can adjust the document by 2 px, legitimately closing the menu before click.
  const box=await trigger.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await expect(trigger).toHaveAttribute('aria-expanded','false');await trigger.press('ArrowDown');await trigger.press('Escape');
  if(width===375)await page.locator('#mobile-settings-close').click();
  await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));await page.waitForTimeout(800);
  await page.locator('.recommendation-pin').first().click();await expect(page.locator('.map-inspection')).toHaveAttribute('aria-label','Место 1 · оценка');
  if(width===375){await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','peek');await page.getByRole('button',{name:'Подробнее',exact:true}).click();await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','expanded');await page.keyboard.press('Escape');await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','peek');}
  await page.waitForTimeout(700);await page.screenshot({path:`${dir}/${type.name()}-map-${width}.png`});
  results.push({browser:type.name(),width,errors,scrollbar:await page.evaluate(()=>getComputedStyle(document.documentElement).scrollbarWidth),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)});expect(errors).toEqual([]);await page.close();
 }}finally{await browser.close();}
}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(results);
