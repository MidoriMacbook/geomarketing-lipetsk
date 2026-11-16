import {test,expect} from '@playwright/test';
test('слабый вариант обозначен по показанному баллу, координаты не перекрыты',async({page,baseURL})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.route('**/api/calculate?**',async route=>{const response=await route.fetch(),data=await response.json();data.recommendations[1].score=.39;data.recommendations[2].score=.399;await route.fulfill({response,json:data});});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const second=page.getByTestId('recommendation-card').nth(1),third=page.getByTestId('recommendation-card').nth(2);
 await expect(second.locator('.place-title .place-strength')).toHaveText('слабее лучшего');await expect(third.locator('.place-strength')).toHaveCount(0);
 await expect(second.locator('.decision-headline')).toContainText('запасной вариант');
 const heading=await second.locator('.place-title').boundingBox(),coords=await second.locator('.coords').boundingBox();expect(coords.y).toBeGreaterThanOrEqual(heading.y+heading.height);
 await expect(second.locator('.score-info')).toHaveAttribute('aria-label',/Относительная оценка/);
 const first=page.getByTestId('recommendation-card').first();
 await first.locator('.place-select').click();
 await expect(first).toHaveCSS('border-top-color','rgb(180, 106, 114)');
 await expect(first).toHaveCSS('box-shadow',/inset/);
 expect(await second.locator('.place-actions').first().evaluate(el=>[...new Set([...el.querySelectorAll('button,a')].map(n=>getComputedStyle(n).fontWeight))])).toEqual(['600']);
});
for(const width of [375,768,1440,1920])test(`параметры доступны из рекомендаций ${width}`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:1000});await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 if(width===375){await page.locator('#map').scrollIntoViewIfNeeded();await page.locator('.sheet-handle').click();}
 await page.locator('#recommendations-context').click();
 if(width===375){await expect(page.locator('#mobile-settings-dialog')).toBeVisible();await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','peek');}
 else await expect.poll(async()=>{const r=await page.locator('#settings').boundingBox();return r.y>=0&&r.y<150;}).toBe(true);
});
