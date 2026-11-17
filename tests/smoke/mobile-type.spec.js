import {test,expect} from '@playwright/test';
test.use({isMobile:true,hasTouch:true,reducedMotion:'reduce'});
test('шапка и обложка помещаются на узком экране и при крупном тексте',async({page})=>{
 for(const width of [320,360,375,390,430]){
  await page.setViewportSize({width,height:667});await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  const toggle=await page.locator('#nav-toggle').boundingBox(),brand=await page.locator('.brand').boundingBox();
  expect(toggle.width).toBeGreaterThanOrEqual(44);expect(toggle.height).toBeGreaterThanOrEqual(44);expect(brand.x+brand.width).toBeLessThanOrEqual(toggle.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await expect(page.locator('#page-title em')).toHaveCSS('font-style','italic');
  const cta=await page.locator('#hero-map-link').boundingBox();expect(cta.y+cta.height).toBeLessThanOrEqual(667);
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  const title=await page.locator('#page-title').boundingBox(),slogan=await page.locator('.hero-statement').boundingBox();
  expect(title.y+title.height).toBeLessThanOrEqual(slogan.y);
 }
});
test('сбой загрузки шрифтов не сдвигает рабочую область',async({page})=>{
 await page.setViewportSize({width:375,height:667});
 await page.route('**/*.woff2',route=>route.abort());
 await page.addInitScript(()=>{window.layoutShift=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.layoutShift+=e.value;}).observe({type:'layout-shift',buffered:true});});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');await page.waitForTimeout(700);
 expect(await page.evaluate(()=>window.layoutShift)).toBeLessThanOrEqual(.05);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(375);
});
