import {test,expect} from '@playwright/test';
for(const width of [375,1440])test(`произвольная точка, сохранение и сравнение ${width}`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));await page.waitForTimeout(700);
 const map=page.locator('#map'),box=await map.boundingBox();
 await map.click({position:{x:box.width*.45,y:box.height*.55}});
 const popup=page.locator('.map-inspection');await expect(popup).toHaveAttribute('aria-label','Оценка этой точки');
 await expect(popup.locator('.map-inspection-score')).toHaveText(/\d+ из 100/);
 if(width===375)await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','peek');
 await popup.getByRole('button',{name:'Сохранить как своё место'}).click();await expect(popup.getByRole('status')).toHaveText('Сохранено и добавлено в сравнение');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('geomarketing.saved.v1')));
 expect(saved).toHaveLength(1);expect(saved[0].recommendation.origin).toBe('manual');
 const rec=saved[0].recommendation;
 const expected=await page.evaluate(async rec=>{const {state}=await import('/static/js/state.js');const {createMapAnalysis}=await import('/static/js/map-analysis.js');return createMapAnalysis(state.current).sample(rec).recommendation;},rec);
 expect(rec.score).toBeCloseTo(expected.score,10);expect(rec.residents_in_radius).toBe(expected.residents_in_radius);
 await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await expect(page.locator('[data-testid="saved-card"]')).toHaveCount(1);await expect(page.locator('[data-testid="saved-card"] h3')).toContainText('выбрано вручную');
 if(width===375)await page.locator('.mobile-secondary-details>summary').filter({hasText:'Сохранённые места'}).click();
 await page.locator('[data-testid="compare-place"]').check();await expect(page.locator('#comparison')).toContainText('выбрано вручную');
});
test('перетаскивание карты не проверяет случайную точку',async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#map').scrollIntoViewIfNeeded();const box=await page.locator('#map').boundingBox();
 await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+220,box.y+160,{steps:8});await page.mouse.up();
 await expect(page.locator('.map-inspection')).toHaveCount(0);
});
test('пин открывает выноску над полосой, только Подробнее раскрывает список',async({page,baseURL})=>{
 await page.setViewportSize({width:375,height:667});await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-110,behavior:'instant'}));await page.waitForTimeout(700);
 await page.locator('.recommendation-pin').first().click();const popup=page.locator('.map-inspection');
 await expect(popup).toHaveAttribute('aria-label','Место 1 · оценка');await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','peek');
 await expect.poll(async()=>{const box=await popup.boundingBox(),sheet=await page.locator('#recommendations').boundingBox();return box.y>=80&&box.y+box.height<sheet.y;}).toBe(true);
 await popup.getByRole('button',{name:'Подробнее'}).click();await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','expanded');await expect(popup).toHaveCount(0);
});
