import {test,expect} from '@playwright/test';
test.use({isMobile:true,hasTouch:true,reducedMotion:'reduce'});
test('шапка и обложка помещаются на узком экране и при крупном тексте',async({page})=>{
 for(const width of [320,360,375,390,430]){
  await page.setViewportSize({width,height:667});await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  const toggle=await page.locator('#nav-toggle').boundingBox(),brand=await page.locator('.brand').boundingBox();
  expect(toggle.width).toBeGreaterThanOrEqual(44);expect(toggle.height).toBeGreaterThanOrEqual(44);expect(brand.x+brand.width).toBeLessThanOrEqual(toggle.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  const cta=await page.locator('#hero-map-link').boundingBox();expect(cta.y+cta.height).toBeLessThanOrEqual(667);
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  const title=await page.locator('#page-title').boundingBox(),slogan=await page.locator('.hero-statement').boundingBox();
  expect(title.y+title.height).toBeLessThanOrEqual(slogan.y);
 }
});
