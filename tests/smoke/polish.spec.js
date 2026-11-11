import {test,expect} from '@playwright/test';

test('меню и место параметров существуют до загрузки JavaScript',async({page,baseURL})=>{
 await page.setViewportSize({width:375,height:812});
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/*',async route=>{
  if(new URL(route.request().url()).origin!==baseURL)return route.abort();
  if(route.request().resourceType()==='script')await gate;
  await route.continue();
 });
 await page.goto('/',{waitUntil:'commit'});
 await expect(page.locator('#nav-toggle')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 const before=await page.locator('#workspace').boundingBox(),bar=await page.locator('#mobile-settings-bar').boundingBox();
 release();await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const after=await page.locator('#workspace').boundingBox(),ready=await page.locator('#mobile-settings-bar').boundingBox();
 expect(Math.abs(before.y-after.y)).toBeLessThan(1);
 expect(Math.abs(bar.height-ready.height)).toBeLessThan(1);
 expect(await page.locator('.atlas-city').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
