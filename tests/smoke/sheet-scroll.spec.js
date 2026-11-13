import {test,expect} from '@playwright/test';
test.use({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
});
const toMap=async page=>{
 await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-140,behavior:'instant'}));
 await expect(page.locator('#recommendations')).toHaveAttribute('data-sheet-active','true');
 await page.waitForTimeout(320);
};
test('20 проходов через карту не раскрывают панель, гистерезис сохраняет peek',async({page})=>{
 test.setTimeout(60000);
 const sheet=page.locator('#recommendations');
 await expect(sheet).toHaveAttribute('data-snap','peek');
 expect(await page.evaluate(()=>scrollY)).toBe(0);
 await toMap(page);
 await expect(page.locator('.sheet-summary')).toHaveText('3 места · лучшее 100 из 100');
 expect((await page.locator('#map').boundingBox()).height).toBeGreaterThanOrEqual(667*.55);
 const y=await page.evaluate(()=>scrollY);
 await page.evaluate(()=>{window.sheetStates=[];new MutationObserver(()=>window.sheetStates.push(document.querySelector('#recommendations').dataset.snap)).observe(document.querySelector('#recommendations'),{attributes:true,attributeFilter:['data-snap']});});
 for(let i=0;i<20;i++){
  await page.evaluate(smooth=>scrollTo({top:document.documentElement.scrollHeight,behavior:smooth?'smooth':'instant'}),i%2===0);
  await expect(sheet).toHaveAttribute('data-sheet-active','false');
  await page.evaluate(({y,smooth})=>scrollTo({top:y,behavior:smooth?'smooth':'instant'}),{y,smooth:i%2===0});
  await expect(sheet).toHaveAttribute('data-sheet-active','true');
  await expect(sheet).toHaveAttribute('data-snap','peek');
 }
 expect(await page.evaluate(()=>window.sheetStates.every(s=>s==='peek'))).toBe(true);
 const bottom=await page.locator('#map').evaluate(el=>scrollY+el.getBoundingClientRect().bottom),height=(await page.locator('#map').boundingBox()).height;
 for(const ratio of [.3,.35,.25,.32]){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),bottom-height*ratio);await page.waitForTimeout(60);await expect(sheet).toHaveAttribute('data-sheet-active','true');}
 await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),bottom-height*.1);await expect(sheet).toHaveAttribute('data-sheet-active','false');
 await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),bottom-height*.3);await page.waitForTimeout(90);await expect(sheet).toHaveAttribute('data-sheet-active','false');
});
test('тап, жест, клавиши и пин: фон неподвижен, высота карты сохраняется',async({page})=>{
 await toMap(page);
 const sheet=page.locator('#recommendations'),handle=page.locator('.sheet-handle');
 const before=await page.locator('#map').boundingBox(),y=await page.evaluate(()=>scrollY);
 await handle.click();await expect(sheet).toHaveAttribute('data-snap','half');
 await expect(page.locator('body')).toHaveCSS('position','fixed');
 await page.mouse.wheel(0,400);await page.waitForTimeout(400);
 expect((await page.locator('#map').boundingBox()).y).toBeCloseTo(before.y,0);
 const cdp=await page.context().newCDPSession(page),box=await handle.boundingBox(),point={x:box.x+80,y:box.y+24};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 for(let i=1;i<=6;i++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-i*30}]});
  expect((await page.locator('#map').boundingBox()).height).toBeCloseTo(before.height,0);
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(sheet).toHaveAttribute('data-snap','full');
 await page.keyboard.press('Escape');await expect(sheet).toHaveAttribute('data-snap','peek');
 expect(await page.evaluate(()=>scrollY)).toBe(y);
 await handle.press('ArrowUp');await expect(sheet).toHaveAttribute('data-snap','half');
 await handle.press('ArrowDown');await expect(sheet).toHaveAttribute('data-snap','peek');
 await page.waitForTimeout(500);await page.locator('.recommendation-pin').first().click();
 await expect(sheet).toHaveAttribute('data-snap','half');
 await expect.poll(async()=>{const circle=await page.locator('.leaflet-accessibility-pane path').boundingBox(),panel=await sheet.boundingBox(),map=await page.locator('#map').boundingBox();return circle.y>=Math.max(80,map.y)&&circle.y+circle.height<panel.y;}).toBe(true);
});
test('повторный расчёт оставляет peek, reduced motion меняет только opacity',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await toMap(page);
 const sheet=page.locator('#recommendations'),handle=page.locator('.sheet-handle');
 await handle.click();await handle.press('ArrowUp');await page.keyboard.press('Escape');
 await expect(sheet).toHaveAttribute('data-snap','peek');
 await expect(sheet).toHaveCSS('transition-property','opacity');
 const y=await page.evaluate(()=>scrollY);
 await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');document.dispatchEvent(new CustomEvent('gm:analysis-rendered',{detail:{data:state.current}}));});
 await expect(sheet).toHaveAttribute('data-snap','peek');expect(await page.evaluate(()=>scrollY)).toBe(y);
});
