import {test,expect} from '@playwright/test';
test.use({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#mobile-settings-open').click();
});
test('повторный тап, стрелка, Esc, выбор и прокрутка закрывают список',async({page})=>{
 const field=page.locator('#district-trigger');
 await field.tap();await expect(field).toHaveAttribute('aria-expanded','true');
 await field.locator('.choice-arrow').tap();await expect(field).toHaveAttribute('aria-expanded','false');
 await field.tap();await field.press('End');await expect(field).toHaveAttribute('aria-activedescendant',/option-/);
 await field.press('Home');await field.press('ArrowDown');await field.press('Enter');await expect(field).toHaveAttribute('aria-expanded','false');
 await field.tap();await field.press('Escape');await expect(field).toBeFocused();
 await field.tap();await page.locator('.mobile-sheet-content').evaluate(el=>el.dispatchEvent(new Event('scroll')));await expect(field).toHaveAttribute('aria-expanded','false');
 await field.tap();await page.locator('.mobile-sheet-heading').tap({position:{x:12,y:12}});await expect(field).toHaveAttribute('aria-expanded','false');
});
test('type-ahead и Tab не применяют незавершённый выбор',async({page})=>{
 const field=page.locator('#business-trigger'),value=await page.locator('#business').inputValue();
 await field.tap();await field.dispatchEvent('keydown',{key:'а'});await expect(field).toHaveAttribute('aria-activedescendant',/business-option-/);
 await field.press('Tab');await expect(field).toHaveAttribute('aria-expanded','false');await expect(page.locator('#business')).toHaveValue(value);
 await field.tap();await field.dispatchEvent('keydown',{key:'а'});await field.press('Enter');await expect(page.locator('#business')).toHaveValue('pharmacy');
});

