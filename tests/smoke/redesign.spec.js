import {test,expect} from '@playwright/test';

test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
});

test('мобильные параметры, меню и три положения результатов',async({page})=>{
 await page.setViewportSize({width:375,height:850});
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await expect(page.locator('#mobile-settings-open')).toBeVisible();
 await expect(page.locator('#mobile-settings-dialog')).not.toBeVisible();
 await page.locator('#nav-toggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-nav-open','true');
 await page.keyboard.press('Tab');
 await expect(page.locator('#nav-menu a.active')).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.locator('#nav-toggle')).toBeFocused();
 await page.locator('#map-card').scrollIntoViewIfNeeded();
 await expect(page.locator('#recommendations')).toHaveAttribute('data-sheet-active','true');
 await page.locator('.sheet-handle').click();await page.getByRole('button',{name:'Все — развернуть результаты полностью'}).click();
 await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','full');
 await page.getByRole('button',{name:'Карта — свернуть результаты'}).click();
 await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','peek');
 await page.locator('#mobile-settings-open').click();
 await expect(page.locator('#mobile-settings-dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#mobile-settings-open')).toBeVisible();
 await expect(page.locator('#mobile-settings-dialog')).not.toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('без острова и с уменьшенной анимацией интерфейс доступен',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/vendor/hero/**',route=>route.abort());
 await page.route('**/assets/fonts/**',route=>route.abort());
 await page.goto('/');
 await expect(page.locator('#page-title')).toHaveText('ГеоМаркетинг Липецк');
 await expect(page.locator('#hero-map-link')).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#run').click();
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await expect(page.locator('[data-testid=recommendation-card]')).toHaveCount(3);
});

test('быстрая смена порога прерывает предыдущий crossfade без ошибок',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#display-options-summary').click();
 await page.locator('#thr').evaluate(async el=>{for(const value of ['70','99','80']){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(requestAnimationFrame);}});
 await expect(page.locator('#thr-out')).toContainText('80');
 await expect(page.locator('.leaflet-zones-pane canvas')).toHaveCount(1);
 expect(errors).toEqual([]);
});

test('быстрые переключения, перетаскивание и порог не оставляют зависших состояний',async({page})=>{
 await page.setViewportSize({width:375,height:850});await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#nav-toggle').evaluate(el=>{el.click();el.click();});
 await expect(page.locator('html')).toHaveAttribute('data-nav-open','false');
 expect(await page.locator('main').evaluate(el=>el.inert)).toBe(false);
 await page.locator('#map-card').scrollIntoViewIfNeeded();
 await page.locator('.sheet-handle').click();await page.getByRole('button',{name:'Все — развернуть результаты полностью'}).click();
 const handle=page.locator('.sheet-handle');await handle.click({trial:true});const box=await handle.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,820,{steps:12});await page.mouse.up();
 await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','peek');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('.sheet-handle').click();await page.getByRole('button',{name:'Все — развернуть результаты полностью'}).click();
 await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','full');
 await page.locator('#recommendations-context').click();
 await page.locator('#display-options-summary').click();
 const threshold=page.locator('#thr');await threshold.focus();
 await threshold.press('Home');await threshold.press('End');await threshold.press('Home');
 await expect(page.locator('#thr-out')).toContainText('70');
 await expect(page.locator('.leaflet-zones-pane canvas')).toHaveCount(1);
 // Первый Esc закрывает вложенное «Отображение», второй — весь диалог.
 await page.keyboard.press('Escape');
 await expect(page.locator('#display-options-summary')).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.locator('#mobile-settings-dialog')).not.toBeVisible();
});
