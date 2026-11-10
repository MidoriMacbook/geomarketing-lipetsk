import { test, expect } from '@playwright/test';

test('Мобильные рекомендации объясняют различия и сохраняют путь к карте и сравнению', async ({page,baseURL})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await expect(page.locator('#recommendations-context')).toContainText('Кофейня');
 const cards=page.getByTestId('recommendation-card');
 await page.locator('#map-card').scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Развернуть результаты полностью'}).click();
 await expect(cards.nth(1).locator('.mobile-rec-difference')).toContainText('жителей');
 await expect(cards.nth(1).locator('.mobile-rec-difference')).toContainText('конкурент');
 await cards.nth(1).locator('.mobile-rec-toggle').click();
 await expect(cards.nth(1).locator('.mobile-rec-difference')).toBeHidden();
 await expect(cards.nth(1).locator('.recommendation-brief')).toBeHidden();
 await cards.nth(1).locator('.mobile-rec-details>summary').click();
 await expect(cards.nth(1).locator('.recommendation-brief .nearest')).toBeVisible();
 await expect(cards.nth(1).locator('.recommendation-brief .nearest')).toContainText(/м|Не найдены/);
 await cards.nth(1).locator('.mobile-show-place').click();
 await expect(page.locator('.recommendation-pin.is-selected')).toHaveText('2');
 await page.getByRole('button',{name:'Развернуть результаты полностью'}).click();
 await cards.nth(1).getByTestId('save-place').click();
 await expect(page.locator('#comparison-guide-count')).toContainText('1 из 3');
 await cards.first().getByTestId('save-place').click();await page.locator('#comparison-guide-open').click();
 await expect(page.locator('#comparison tbody tr')).toHaveCount(2);
 expect(errors).toEqual([]);
});

test('Рекомендации доступны на узком экране и при увеличенном тексте', async ({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 for(const width of [320,360,390,430,1440])for(const scale of [1,2]){
  await page.setViewportSize({width,height:900});await page.evaluate(n=>document.documentElement.style.fontSize=n+'px',16*scale);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Переполнение ${width}/${scale}`).toBe(true);
  if(width<=430){
   await page.locator('#map-card').scrollIntoViewIfNeeded();
   if(scale===1)await page.getByRole('button',{name:'Развернуть результаты полностью'}).click();
   const toggle=page.getByTestId('recommendation-card').nth(1).locator('.mobile-rec-toggle');
   await toggle.focus();await page.keyboard.press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','true');
   await page.keyboard.press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','false');
   expect((await toggle.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
 }
});
