import {test,expect} from '@playwright/test';
for(const [width,height] of [[320,667],[375,667],[390,844]])test.describe(`${width}`,()=>{
 test.use({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 test('карта не оставляет резерв в потоке после раскрытия и скрытия',async({page})=>{
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
  const sheet=page.locator('#recommendations');
  const check=async()=>{
   await expect(page.locator('#map-card .map-footer')).toHaveCSS('margin-bottom','0px');
   const gap=await page.evaluate(()=>document.querySelector('#workspace>.analysis-context-row').getBoundingClientRect().top-document.querySelector('#map-card').getBoundingClientRect().bottom);
   expect(gap).toBeGreaterThanOrEqual(0);expect(gap).toBeLessThanOrEqual(24);
  };
  await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));
  await expect(sheet).toHaveAttribute('data-sheet-active','true');await check();
  await page.locator('.sheet-handle').tap();await expect(sheet).toHaveAttribute('data-snap','expanded');await check();
  await page.locator('.sheet-close').tap();await expect(sheet).toHaveAttribute('data-snap','peek');await check();
  await page.locator('#trust-details-link').tap();await page.getByRole('button',{name:'Закрыть сведения о данных'}).tap();await check();
  await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
  await expect(sheet).toHaveAttribute('data-sheet-active','false');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.style.getPropertyValue('--results-inset'))).toBe('0px');await check();
  await page.setViewportSize({width,height:height-180});await check();
  await page.setViewportSize({width:height,height:width});
  await page.setViewportSize({width,height});await check();
 });
});
