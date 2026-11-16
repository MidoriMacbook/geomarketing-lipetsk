import {test,expect} from '@playwright/test';
test.setTimeout(60000); // Несколько полных загрузок с локальными шрифтами в одной проверке ширин.

test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
});

test('название помещается, а точка отделена от букв',async({page})=>{
 for(const width of [320,375,601,768,900,1280,1440,1920]){
  await page.setViewportSize({width,height:1000});await page.goto('/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1100);
  await expect(page.locator('#page-title em')).toHaveCSS('font-style',width<=600?'normal':'italic');
  await expect(page.locator('#page-title em')).toHaveCSS('color','rgb(143, 74, 83)');
  const title=await page.locator('#page-title em').boundingBox();
  const pin=await page.locator('.atlas-place-pin').boundingBox();
  expect(pin.y).toBeGreaterThanOrEqual(title.y+title.height);
  if(width<=600){
   const geo=await page.locator('#page-title .hero-title-word').first().boundingBox();
   const action=await page.locator('#hero-map-link').boundingBox();
   const description=await page.locator('#hero-description').boundingBox();
   expect(title.y).toBeGreaterThan(geo.y);
   expect(action.y).toBeLessThan(description.y);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('знак приблизительного числа сохраняется при повторе счётчика',async({page})=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const residents=page.locator('#kpi-residents');await residents.scrollIntoViewIfNeeded();
 await expect(residents).toHaveText('≈\u00a05\u00a0100');
 await page.locator('[data-kpi=residents] .kpi-replay').click();
 await expect(residents.locator('.counter-visual')).toHaveAttribute('data-display',/^≈\u00a0/);
 await expect(residents).not.toHaveClass(/is-counting/);
 await expect(residents.locator('.counter-visual')).toHaveAttribute('data-display','≈\u00a05\u00a0100');
 await expect(page.locator('[data-kpi=residents]>span').first()).toHaveText('Жителей в области');
});

test('схема и действие доступны с отключённым движением',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('/');
  await expect(page.locator('#hero-map-link')).toBeVisible();
  await expect(page.locator('.atlas-place-pin')).toBeVisible();
  await expect(page.locator('.hero-route-mask')).toHaveCSS('animation-name','none');
  const boxes=await page.locator('.hero-steps article').evaluateAll(items=>items.map(item=>item.getBoundingClientRect().width));
  expect(boxes).toHaveLength(3);
  expect(Math.max(...boxes)-Math.min(...boxes)).toBeLessThan(1);
 }
});

test('заголовок копируется без разрыва названия и выделение не касается соседних строк',async({page})=>{
 for(const width of [375,768,1440,1920]){
  await page.setViewportSize({width,height:1000});await page.goto('/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1100);
  const result=await page.locator('#page-title').evaluate(h=>{
   const range=document.createRange();range.setStartBefore(h.firstElementChild);range.setEndAfter(h.querySelector('em'));
   const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
   const rects=[...range.getClientRects()],top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom));
   return {text:selection.toString(),topGap:top-document.querySelector('.hero-copy>.eyebrow').getBoundingClientRect().bottom,bottomGap:h.querySelector('.hero-city').getBoundingClientRect().top-bottom,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  expect(result.text).toBe('ГеоМаркетинг');expect(result.topGap).toBeGreaterThan(5);expect(result.bottomGap).toBeGreaterThan(5);expect(result.overflow).toBe(false);
 }
});
