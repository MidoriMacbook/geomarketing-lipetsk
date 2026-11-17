import {test,expect} from '@playwright/test';

test.use({ viewport:{width:375,height:667},isMobile:true,hasTouch:true,reducedMotion:'reduce' });

test('три места сравниваются с возвратом к выбранному пину', async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#hero-map-link').tap();
 const settings=await page.locator('#mobile-settings-open').boundingBox();
 const header=await page.locator('#site-header').boundingBox();
 expect(settings.y).toBeGreaterThan(header.y+header.height);
 const layers=page.locator('.mobile-map-layers');
 await layers.locator('summary').tap();
 await expect(layers.getByRole('button',{name:/Центры спроса/})).toBeVisible();
 await layers.locator('summary').tap();
 await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-135,behavior:'instant'}));
 const sheet=page.locator('#recommendations');
 await expect(sheet).toHaveAttribute('data-sheet-active','true');
 for(const place of await page.locator('.sheet-place').all()){
  const box=await place.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(375);
  expect(box.y+box.height).toBeLessThanOrEqual(667);
 }
 const pin=page.locator('.recommendation-pin').nth(1);
 await pin.tap();
 const popup=page.locator('.map-inspection');
 await expect(popup).toContainText('Место 2');
 await expect(popup).toContainText('конкурентов по данным карты');
 await expect.poll(()=>page.evaluate(()=>{
  const popup=document.querySelector('.map-inspection').getBoundingClientRect();
  const zoom=document.querySelector('.leaflet-control-zoom').getBoundingClientRect();
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  return [...document.querySelectorAll('.recommendation-pin')].every(el=>{
   const pin=el.getBoundingClientRect();
   return !overlaps(pin,popup)&&!overlaps(pin,zoom);
  });
 })).toBe(true);
 await popup.getByRole('button',{name:'О месте'}).tap();
 await expect(sheet).toHaveAttribute('data-snap','expanded');
 const cards=page.getByTestId('recommendation-card');
 for(const card of await cards.all()){
  const disclosure=card.locator('.mobile-rec-toggle');
  if(await disclosure.getAttribute('aria-expanded')==='false')await disclosure.tap();
  await card.getByTestId('save-place').tap();
 }
 const rank=await page.locator('.recommendation-pin.is-selected').innerText();
 await page.locator('#comparison-guide-open').tap();
 await expect(sheet).toHaveAttribute('data-snap','peek');
 await expect(page.locator('#comparison-title')).toBeFocused();
 await expect(sheet).toHaveAttribute('data-sheet-active','false');
 const table=page.locator('#comparison .table-scroll');
 await expect(table.locator('thead th')).toHaveCount(4);
 await expect(table.locator('tbody tr')).toHaveCount(8);
 const metrics=await table.evaluate(el=>{
  const boundary=el.getBoundingClientRect(),first=el.querySelector('tbody th'),second=first.nextElementSibling;
  const initial=second.getBoundingClientRect().right<=boundary.right;
  el.scrollLeft=el.scrollWidth;
  return {initial,last:el.querySelector('td:last-child').getBoundingClientRect().right<=boundary.right+2,
   sticky:Math.abs(first.getBoundingClientRect().left-boundary.left)<=2,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 expect(metrics).toEqual({initial:true,last:true,sticky:true,overflow:0});
 expect(await table.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.locator('#compare-coverage').tap();
 await expect(page.locator('.coverage-pair')).toHaveCount(3);
 for(const label of ['Сравнить варианты 1 и 2','Сравнить варианты 1 и 3','Сравнить варианты 2 и 3']){
  await page.getByRole('button',{name:label,exact:true}).tap();
  await expect(page.locator('.map-overlap')).toBeVisible();
  await page.getByRole('button',{name:'Закрыть сравнение на карте'}).tap();
 }
 await page.locator('#comparison-map-link').tap();
 await expect(page.locator('#map-title')).toBeFocused();
 await expect(page.locator('.recommendation-pin.is-selected')).toHaveText(rank);
});

test('ошибка расчёта на телефоне оставляет действие для повтора', async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 let fail=false,release;
 const barrier=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/calculate?**',async route=>{
  if(!fail)return route.continue();
  await barrier;
  return route.fulfill({status:503,json:{}});
 });
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#mobile-settings-open').tap();
 fail=true;
 await page.locator('#run').tap();
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','refreshing');
 await expect(page.locator('#run')).toBeDisabled();
 release();
 await expect(page.locator('#error')).toContainText('повторить расчёт');
 await expect(page.locator('#error')).not.toContainText('503');
 await expect(page.locator('#run')).toBeEnabled();
 await expect(page.locator('#mobile-settings-dialog')).toBeVisible();
});
