import {test,expect} from '@playwright/test';

test('переход радиуса декоративен и отключён на телефоне и при reduced-motion',async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.evaluate(()=>{const h=document.getElementById('hero'),w=document.getElementById('workspace');scrollTo({top:(h.offsetTop+h.offsetHeight*.4+w.offsetTop-innerHeight*.2)/2,behavior:'instant'});});
 await expect(page.locator('.hero-map-transition')).toBeVisible();
 expect(await page.locator('.hero-map-transition').evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.hero-map-transition')).toBeHidden();
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:375,height:812});await expect(page.locator('.hero-map-transition')).toBeHidden();
});
