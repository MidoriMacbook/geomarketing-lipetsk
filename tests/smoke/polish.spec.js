import {test,expect} from '@playwright/test';

test('задержанные стили и модули не сдвигают рабочую область',async({page,baseURL})=>{
 await page.setViewportSize({width:375,height:812});
 await page.addInitScript(()=>{window.shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.shifts.push(e.value);}).observe({type:'layout-shift',buffered:true});});
 await page.route('**/*',async r=>{
  if(new URL(r.request().url()).origin!==baseURL)return r.abort();
  if(['script','font'].includes(r.request().resourceType()))await new Promise(resolve=>setTimeout(resolve,350));
  return r.continue();
 });
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
 expect(await page.evaluate(()=>window.shifts.reduce((a,b)=>a+b,0))).toBeLessThan(.05);
});

test('долгое первое подключение использует существующую строку статуса',async({page,baseURL})=>{
 await page.setViewportSize({width:375,height:812});
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/calculate?**',async r=>{await gate;await r.continue();});
 await page.goto('/');const before=await page.locator('#mobile-settings-bar').boundingBox();
 await expect(page.locator('#mobile-settings-state')).toHaveText('Сервис просыпается…',{timeout:6000});
 expect((await page.locator('#mobile-settings-bar').boundingBox()).height).toBeCloseTo(before.height,0);
 release();await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await expect(page.locator('#mobile-settings-state')).toHaveText('Расчёт готов');
});

test('радиус выбранного места и четыре слоя помещаются над панелью',async({page,baseURL})=>{
 await page.setViewportSize({width:375,height:812});await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('[data-snap=full]').click();
 await page.locator('.mobile-show-place').first().click();
 await expect.poll(async()=>{
  const circle=await page.locator('.leaflet-accessibility-pane path').boundingBox(),map=await page.locator('#map').boundingBox(),sheet=await page.locator('#recommendations').boundingBox();
  return circle.width>20&&circle.x>=map.x&&circle.x+circle.width<=map.x+map.width&&circle.y>=map.y&&circle.y+circle.height<sheet.y;
 }).toBe(true);
 const sheet=await page.locator('#recommendations').boundingBox();
 for(const layer of await page.locator('[data-layer-key]').all()){const box=await layer.boundingBox();expect(box.y).toBeGreaterThan(80);expect(box.y+box.height).toBeLessThan(sheet.y);}
 expect(errors).toEqual([]);
});

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

test('пункты меню не обрезаются скруглением общего контейнера',async({page,baseURL})=>{
 await page.setViewportSize({width:375,height:812});await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await page.locator('#nav-toggle').click();
 const styles=await page.locator('.nav-items').evaluate(el=>({radius:getComputedStyle(el).borderRadius,clip:getComputedStyle(el).clipPath}));
 expect(styles).toEqual({radius:'0px',clip:'none'});
 for(const link of await page.locator('#nav-menu a:visible').all())expect(await link.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('12px');
 await expect(page.locator('#nav-menu a.active')).toHaveCSS('background-color','rgb(247, 200, 211)');
});

test('закрытие панели не скрывает содержимое и не меняет карту в процессе',async({page,baseURL})=>{
 await page.setViewportSize({width:375,height:812});await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('button[data-snap=full]').click();
 await expect(page.locator('#recommendations')).not.toHaveAttribute('data-moving','true');
 const map=await page.locator('#map').boundingBox(),result=await page.locator('#result').boundingBox();
 await page.locator('button[data-snap=collapsed]').evaluate(el=>el.click());
 await page.waitForTimeout(100);
 expect(await page.locator('#result').evaluate(el=>getComputedStyle(el).visibility)).toBe('visible');
 expect((await page.locator('#result').boundingBox()).height).toBeCloseTo(result.height,0);
 expect((await page.locator('#map').boundingBox()).height).toBeCloseTo(map.height,0);
});
