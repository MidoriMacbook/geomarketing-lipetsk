import {test,expect} from '@playwright/test';

test.use({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
});

test('видимые подписи входят в доступные имена действий',async({page})=>{
 await expect(page.locator('.brand')).toHaveAccessibleName(/ГеоМаркетинг Липецк.*Городская аналитика/);
 await page.locator('#map-card').scrollIntoViewIfNeeded();
 for(const [snap,label] of [['peek','Карта'],['half','Места'],['full','Все']]){
  await expect(page.locator(`button[data-snap=${snap}]`)).toHaveAccessibleName(new RegExp('^'+label));
 }
 await page.locator('.sheet-handle').click();await page.locator('button[data-snap=full]').click();
 const save=page.getByTestId('save-place').first();
 await expect(save).toHaveAccessibleName(/^Сохранить для сравнения — место 1/);
 await save.click();await expect(save).toHaveAccessibleName(/^В сравнении — место 1/);
 await expect(page.getByTestId('recommendation-card').first().getByRole('heading',{name:'Почему это место',level:3})).toBeVisible();
});

test('касание ручки двигает панель, а касание карты не захватывает панель',async({page})=>{
 const cdp=await page.context().newCDPSession(page);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('#map-card').scrollIntoViewIfNeeded();await page.locator('.sheet-handle').click();
 const handle=page.locator('.sheet-handle'),sheet=page.locator('#recommendations'),pane=page.locator('.leaflet-map-pane');
 const box=await handle.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 const mapTransform=await pane.evaluate(el=>el.style.transform),scroll=await page.evaluate(()=>-parseFloat(document.body.style.top));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-220}]});
 await expect(sheet).toHaveAttribute('data-dragging','true');
 expect(await pane.evaluate(el=>el.style.transform)).toBe(mapTransform);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(sheet).toHaveAttribute('data-snap','full');
 expect(await page.evaluate(()=>-parseFloat(document.body.style.top))).toBe(scroll);
 const fullHandle=await handle.boundingBox(),fullStart={x:fullHandle.x+fullHandle.width/2,y:fullHandle.y+fullHandle.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[fullStart]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:fullStart.x,y:800}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(sheet).toHaveAttribute('data-snap','peek');
 expect(await page.evaluate(()=>scrollY)).toBe(scroll);
 const mapBox=await page.locator('#map').boundingBox(),start={x:mapBox.x+100,y:mapBox.y+100};
 const before=await pane.evaluate(el=>el.style.transform);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
 for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+i*8,y:start.y+i*5}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>pane.evaluate(el=>el.style.transform)).not.toBe(before);
 await expect(sheet).toHaveAttribute('data-snap','peek');
 expect(await page.evaluate(()=>scrollY)).toBe(scroll);
});

test('планшетная иллюстрация не перекрывает текст и следующий раздел',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>document.fonts.ready);
 for(const width of [768,1024]){
  await page.setViewportSize({width,height:1000});
  const row=await page.locator('.hero-editorial-row').boundingBox(),art=await page.locator('#hero-art').boundingBox(),coordinates=await page.locator('.atlas-coordinates').boundingBox();
  expect(art.y).toBeGreaterThanOrEqual(row.y+row.height);
  expect(art.y+art.height).toBeLessThanOrEqual(coordinates.y);
 }
});
