import {test,expect} from '@playwright/test';
test.use({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
test('меню проходит промежуточные состояния и отменяет незавершённое открытие',async({page})=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const panel=page.locator('#mobile-navigation'),toggle=page.locator('#nav-toggle');
 const frames=await page.evaluate(async()=>{
  const panel=document.querySelector('#mobile-navigation'),rows=[],start=performance.now();
  document.querySelector('#nav-toggle').click();
  await new Promise(resolve=>{const frame=()=>{const s=getComputedStyle(panel);rows.push({t:performance.now()-start,opacity:+s.opacity,y:new DOMMatrixReadOnly(s.transform).m42});if(performance.now()-start<400)requestAnimationFrame(frame);else resolve();};frame();});return rows;
 });
 expect(frames[0].opacity).toBe(0);expect(frames[0].y).toBe(-8);
 expect(frames.filter(f=>f.opacity>0&&f.opacity<1).length).toBeGreaterThan(1);
 await expect(panel).toHaveCSS('opacity','1');
 await page.keyboard.press('Escape');await expect(panel).not.toBeVisible();await expect(toggle).toBeFocused();
 await toggle.evaluate(el=>{el.click();el.click();el.click();});await expect(panel).toHaveCSS('opacity','1');
 await page.locator('#nav-close').tap();await expect(panel).not.toBeVisible();
 await toggle.evaluate(el=>{el.click();el.click();});await expect(panel).not.toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-nav-open','false');
 await toggle.tap();await page.locator('#nav-menu a[href="#workspace"]').tap();await expect(panel).not.toBeVisible();await expect(page).toHaveURL(/#workspace$/);
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await toggle.tap();
 await panel.evaluate(el=>{for(const [type,key,y] of [['touchstart','touches',200],['touchend','changedTouches',100]]){const event=new Event(type);Object.defineProperty(event,key,{value:[{clientY:y}]});el.dispatchEvent(event);}});await expect(panel).not.toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await toggle.tap();await expect(panel).toHaveCSS('transform','none');
 await page.mouse.click(2,650);await expect(panel).not.toBeVisible();
});
