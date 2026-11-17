import {test,expect} from '@playwright/test';
test.beforeEach(async({page,baseURL})=>{await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());});
test('мобильный якорь раскрывает сохранённые места и сохраняет фокус',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#nav-toggle').click();await page.locator('#nav-menu a[href="#saved-section"]').click();
 await expect(page.locator('#saved-empty')).toBeVisible();
 await expect(page.locator('#saved-section')).toBeFocused();
 await expect(page.locator('#nav-menu a[href="#saved-section"]')).toHaveAttribute('aria-current','location');
});
