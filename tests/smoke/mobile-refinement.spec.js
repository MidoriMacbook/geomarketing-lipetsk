import {test,expect} from '@playwright/test';
for(const [width,height] of [[375,667],[390,844],[768,1024]]){
 test.describe(`${width}×${height}`,()=>{
  test.use({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  test('источник открывается листом без потери позиции',async({page})=>{
   await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
   await expect(page.locator('.hero-city')).toHaveCount(0);
   if(width===375)expect(await page.locator('.editorial-hero').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(height*.7);
   await page.locator('#hero-map-link').tap();
   const layers=page.locator(width<=600?'.mobile-map-layers':'#map-title');
   await layers.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
   const top=await layers.boundingBox(),header=await page.locator('#site-header').boundingBox();
   expect(top.y).toBeGreaterThanOrEqual(header.y+header.height);
   const chip=page.locator('#trust-summary');await chip.scrollIntoViewIfNeeded();
   expect(await chip.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   if(width<=600)expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--results-inset')))).toBeGreaterThanOrEqual(128);
   await chip.tap();const dialog=page.locator('#source-dialog');await expect(dialog).toBeVisible();
   await expect(dialog.locator('#data-quality')).toContainText('Дома');
   await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(chip).toBeFocused();
   await expect(page.locator('#data-details #data-quality')).toHaveCount(1);
  });
 });
}
