import {test,expect} from '@playwright/test';
test('проверка точки читает оценку из полученной сетки',async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
 await page.route('**/api/calculate?**',async route=>{
  const response=await route.fetch(),data=await response.json();
  // Независимый эталон: все узлы равны 42, поэтому интерполяция тоже равна 42.
  data.grid.scores=data.grid.scores.map(()=>.42);
  await route.fulfill({response,json:data});
 });
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#map').scrollIntoViewIfNeeded();await page.waitForTimeout(700);
 const box=await page.locator('#map').boundingBox();await page.locator('#map').click({position:{x:box.width*.45,y:box.height*.55}});
 await expect(page.locator('.map-inspection')).toHaveAttribute('data-score','42');
});
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
 await expect.poll(async()=>{const a=await popup.boundingBox(),b=await page.locator('.leaflet-control-zoom').boundingBox();return a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y;}).toBe(true);
 await popup.getByRole('button',{name:'Подробнее'}).click();await expect(page.locator('#recommendations')).toHaveAttribute('data-snap','expanded');await expect(popup).toHaveCount(0);
});
test('объяснение отдельно от базовых домов и выключается без удаления круга',async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.locator('#map').scrollIntoViewIfNeeded();
 await page.locator('.leaflet-houses-pane canvas').evaluate(el=>{window.originalHouseCanvas=el;});
 await page.locator('.recommendation-pin').nth(1).click();await expect(page.locator('#map')).toHaveAttribute('data-explanation','true');
 expect(await page.locator('.leaflet-houses-pane canvas').evaluate(el=>el===window.originalHouseCanvas)).toBe(true);
 await page.getByRole('button',{name:'Закрыть выноску'}).click();await page.locator('#map-explain-toggle').click();
 await expect(page.locator('#map')).toHaveAttribute('data-explanation','false');await expect(page.locator('.leaflet-accessibility-pane path')).toHaveCount(1);
 await expect(page.locator('.map-distance:visible')).toHaveCount(0);
});
test('карточка и пин связаны наведением, Enter открывает выноску',async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const pin=page.getByRole('button',{name:/Место 2, оценка/}),card=page.locator('#recommendation-list article[data-rank="2"]');
 await pin.hover();await expect(card).toHaveClass(/is-preview/);await page.mouse.move(0,0);await expect(card).not.toHaveClass(/is-preview/);
 await card.hover();await expect(pin.locator('.recommendation-pin')).toHaveClass(/is-preview/);
 await pin.focus();await page.keyboard.press('Enter');await expect(page.locator('.map-inspection')).toHaveAttribute('aria-label','Место 2 · оценка');await expect(card).toHaveClass(/selected/);
 await page.keyboard.press('Escape');await expect(page.locator('.map-inspection')).toHaveCount(0);
});
test('два сохранённых места показывают общую аудиторию по домам',async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');const {savePlace}=await import('/static/js/saved-places.js');for(const rec of state.current.recommendations.slice(0,2))await savePlace(rec,{compare:true});});
 await page.locator('#compare-coverage').click();await expect(page.locator('.map-overlap')).toBeVisible();await expect(page.locator('.map-overlap')).toContainText('Общих жителей: 0 %');
 await page.getByRole('button',{name:'Закрыть сравнение на карте'}).click();await expect(page.locator('.map-overlap')).toBeHidden();
});
test('центр спроса открывает жителей кластера и связанную рекомендацию',async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 await page.getByRole('button',{name:'Центр спроса 1',exact:true}).click();await expect(page.locator('.map-inspection')).toContainText('жителей в кластере');
 const related=page.locator('.map-inspection').getByRole('button',{name:/Место \d ·/});await expect(related).toHaveCount(1);await related.click();await expect(page.locator('.map-inspection')).toHaveCount(1);await expect(page.locator('.map-inspection')).toHaveAttribute('aria-label',/Место \d · оценка/);
});
