import {test,expect} from '@playwright/test';

test('параметры только в листе, свайп и фон закрывают его без скачка страницы',async({page,baseURL})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.setViewportSize({width:375,height:812});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await expect(page.locator('#workspace #settings')).toHaveCount(0);
 await page.locator('#mobile-settings-open').click();
 const before=await page.evaluate(()=>scrollY);
 const dialog=page.locator('#mobile-settings-dialog'),grip=page.locator('.mobile-sheet-heading');
 await grip.click({trial:true});const box=await grip.boundingBox();
 const run=await page.locator('#run').boundingBox();expect(run.y+run.height).toBeLessThanOrEqual(812);
 await page.mouse.move(box.x+40,box.y+20);await page.mouse.down();await page.mouse.move(box.x+40,box.y+130,{steps:12});await page.mouse.up();
 await expect(dialog).not.toBeVisible();expect(await page.evaluate(()=>scrollY)).toBe(before);
 await page.locator('#mobile-settings-open').click();await dialog.click({trial:true});
 const panel=await dialog.boundingBox();await page.mouse.click(5,panel.y-10);
 await expect(dialog).not.toBeVisible();
 await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('button[data-snap=half]').click();
 const sheet=await page.locator('#recommendations').boundingBox();
 for(const pin of await page.locator('.recommendation-pin').all()){
  await expect.poll(async()=>{const r=await pin.boundingBox();return r.y+r.height<sheet.y;}).toBe(true);
 }
});
