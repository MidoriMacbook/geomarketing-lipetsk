import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
});

test('Мобильная форма отличает применённый расчёт от новых параметров', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await expect(page.locator('#mobile-settings-state')).toHaveText('Расчёт готов');
  const before = await page.evaluate(async () => (await import('/static/js/state.js')).state.current.analysis_id);
  await page.locator('#mobile-settings-open').click();
  await page.locator('#business-trigger').click();
  await page.getByRole('option', { name: 'Аптека', exact: true }).click();
  await expect(page.locator('#mobile-settings-selection')).toContainText('Аптека');
  await expect(page.locator('#mobile-settings-state')).toHaveText('Выполните расчёт — параметры изменены');
  expect(await page.evaluate(async () => (await import('/static/js/state.js')).state.current.business)).toBe('cafe');
  await page.route('**/api/calculate?**', route => route.abort());
  await page.locator('#run').click();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'error');
  await expect(page.locator('#mobile-settings-state')).toContainText('повторите расчёт');
  expect(await page.evaluate(async () => (await import('/static/js/state.js')).state.current.analysis_id)).toBe(before);
  await expect(page.locator('#mobile-settings-dialog')).toBeVisible();
  await page.unroute('**/api/calculate?**');
  await page.locator('#run').click();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await expect(page.locator('#mobile-settings-dialog')).not.toBeVisible();
  await expect(page.locator('#mobile-settings-state')).toHaveText('Расчёт готов');
  await expect(page.locator('#mobile-settings-open')).toBeFocused();
  expect(await page.evaluate(async () => (await import('/static/js/state.js')).state.current.business)).toBe('pharmacy');
  await page.locator('#scenario-save').click();
  await page.locator('#scenario-submit').click();
  await expect(page.getByTestId('scenario-card')).toHaveCount(1);
  await page.getByTestId('scenario-open').evaluate(element => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
  });
  await page.getByTestId('scenario-open').click();
  await expect(page.locator('#mobile-settings-state')).toHaveText('Сохранённый расчёт');
  expect(errors).toEqual([]);
});

test('Настройки перед картой сохраняют фокус при быстрых действиях и смене ширины', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  for (const width of [360, 390, 430, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => {
      const bar = document.getElementById('mobile-settings-bar'), map = document.getElementById('map-card');
      return !!(bar.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING)
        && bar.getBoundingClientRect().bottom <= map.getBoundingClientRect().top;
    })).toBeTruthy();
  }
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion });
    await page.locator('#mobile-settings-open').click();
    await expect(page.locator('#mobile-settings-dialog')).toBeVisible();
    // Нажатия приходят до завершения открытия; закрытие не должно потерять управление.
    await page.locator('#mobile-settings-close').evaluate(button => button.click());
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-settings-dialog')).not.toBeVisible();
    await expect(page.locator('#mobile-settings-open')).toBeFocused();
    await page.locator('#mobile-settings-open').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-settings-dialog')).not.toBeVisible();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#settings')).toBeVisible();
  await expect(page.locator('#mobile-settings-bar')).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.querySelectorAll('#mobile-settings-open').length)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('Своя область различает применённый радиус и новый центр', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await page.locator('#mobile-settings-open').click();
  await page.locator('#district-trigger').click();
  await page.getByRole('option', { name: /Своя область/ }).click();
  await expect(page.locator('#mobile-settings-state')).toHaveText('Выберите центр на карте');
  await page.locator('#mobile-custom-map').click();
  await page.locator('#map').click({ position: { x: 40, y: 250 } });
  await expect.poll(async () => page.evaluate(async () => (await import('/static/js/state.js')).state.customPoint)).not.toBeNull();
  await page.locator('#mobile-settings-open').click();
  await page.locator('#radius-trigger').click();
  await page.getByRole('option', { name: /^1\s?500 м$/ }).click();
  await page.locator('#run').click();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await expect(page.locator('#mobile-settings-state')).toHaveText('Расчёт готов');
  await page.locator('#mobile-settings-open').click();
  await page.locator('#radius-trigger').click();
  await page.getByRole('option', { name: /^700 м$/ }).click();
  await expect(page.locator('#mobile-settings-state')).toHaveText('Выполните расчёт — параметры изменены');
  await page.locator('#radius-trigger').click();
  await page.getByRole('option', { name: /^1\s?500 м$/ }).click();
  await expect(page.locator('#mobile-settings-state')).toHaveText('Расчёт готов');
  await page.locator('#mobile-custom-map').click();
  // После fitBounds прежние экранные координаты могут попасть в номерной пин.
  // Выбор нового центра выполняем по свободной поверхности карты.
  await page.locator('#map').click({position:{x:40,y:270},trial:true});
  const freePosition=await page.locator('#map').evaluate(map=>{
    const r=map.getBoundingClientRect();
    for(const [x,y] of [[40,200],[300,180],[170,140]]){
      const hit=document.elementFromPoint(r.x+x,r.y+y);
      if(hit&&map.contains(hit)&&!hit.closest('.leaflet-marker-icon,.leaflet-control'))return {x,y};
    }
    throw new Error('Нет свободной поверхности карты для выбора центра');
  });
  await page.locator('#map').click({position:freePosition});
  await expect(page.locator('#mobile-settings-state')).toHaveText('Выполните расчёт — параметры изменены');
});
