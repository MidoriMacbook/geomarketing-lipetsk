import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gestureDriver } from './gesture-driver.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });

const current = page => page.evaluate(async () => (await import('/static/js/state.js')).state.current);
const post = response => new URL(response.url()).pathname === '/api/calculate' && response.request().method() === 'POST';

async function ready(page, baseURL, beforeToggle = () => {}) {
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await beforeToggle();
  await page.locator('#corrections-toggle').tap();
  await expect(page.locator('#correction-add')).toBeEnabled();
}

async function mapBox(page) {
  await page.locator('#map').evaluate(el => scrollTo({ top: scrollY + el.getBoundingClientRect().top - 96, behavior: 'instant' }));
  return page.locator('#map').boundingBox();
}

async function add(page, x = .72, y = .51) {
  const box = await mapBox(page);
  await page.locator('#map').tap({ position: { x: box.width * x, y: box.height * y } });
}

test('поправки карты, отмена, архив и печатный чек-лист', async ({ page, baseURL }) => {
  const competitorName = 'Кофе «У сада» <em>зал</em>';
  const competitorAddress = `ул. ${'Длинноеназвание'.repeat(10)}, 15`;
  await ready(page, baseURL, () => page.route('**/api/calculate', async route => {
    const response = await route.fetch();
    const data = await response.json();
    for (const row of [...data.competitors, ...data.correction_context.base_competitors]) {
      if (row.id === 'node:123') Object.assign(row, { name: competitorName, address: competitorAddress });
    }
    await route.fulfill({ response, json: data });
  }));
  const original = await current(page);
  const accepted = page.waitForResponse(post);
  await add(page);
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 1');
  await accepted;
  await expect(page.locator('#correction-status')).toHaveText('Расчёт обновлён.');
  await expect(page.locator('.correction-marker[aria-label*="добавлен вручную"]')).toHaveCount(1);
  await page.locator('.correction-marker[aria-label*="добавлен вручную"]').tap();
  const manualCard = page.locator('.competitor-card');
  await expect(manualCard).toContainText('Добавлен вручную');
  await expect(manualCard.getByRole('link')).toHaveCount(0);
  await manualCard.getByRole('button', { name: 'Закрыть карточку' }).tap();
  await expect(page.locator('.map-inspection')).toHaveCount(0);
  await expect(page.locator('#recommendations')).toHaveAttribute('data-snap', 'peek');
  await expect(page.locator('.correction-delta').first()).toContainText(/поправок|не изменились/);
  expect((await current(page)).correction_context.counts).toEqual({ added: 1, removed: 0 });

  await page.locator('#correction-remove').tap();
  await page.locator('.correction-marker[aria-label*="добавлен вручную"]').tap();
  await page.locator('#correction-remove-confirm').tap();
  await expect.poll(async () => (await current(page)).correction_context.counts).toEqual({ added: 0, removed: 0 });
  await page.locator('#correction-undo').tap();
  await expect.poll(async () => (await current(page)).correction_context.counts.added).toBe(1);
  await page.locator('[data-competitor-id="node:123"]').tap();
  await expect(page.locator('#correction-remove-dialog')).toBeVisible();
  await page.locator('#correction-remove-cancel').tap();
  expect((await current(page)).correction_context.counts.removed).toBe(0);
  await page.locator('[data-competitor-id="node:123"]').tap();
  await page.locator('#correction-remove-confirm').tap();
  await expect.poll(async () => (await current(page)).correction_context.counts).toEqual({ added: 1, removed: 1 });
  await expect(page.locator('[data-competitor-id="node:123"]')).toHaveCount(0);
  await expect(page.locator('[data-competitor-id="way:123"]')).toHaveCount(1);
  await page.locator('#correction-undo').tap();
  await expect.poll(async () => (await current(page)).correction_context.counts.removed).toBe(0);
  await page.locator('#correction-reset').tap();
  await expect.poll(async () => (await current(page)).correction_context.counts.added).toBe(0);
  expect((await current(page)).grid.scores).toEqual(original.grid.scores);
  await page.locator('#correction-undo').tap();
  await expect.poll(async () => (await current(page)).correction_context.counts.added).toBe(1);
  await page.locator('#correction-done').tap();

  await page.locator('#scenario-save').click();
  await page.locator('#scenario-name').fill('Кофейня с поправкой');
  await page.locator('#scenario-form button[type=submit]').click();
  await expect(page.locator('#scenario-dialog')).toBeHidden();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await page.locator('.mobile-secondary-details > summary').filter({ hasText: 'Архив исследований' }).click();
  const card = page.getByTestId('scenario-card').filter({ hasText: 'Кофейня с поправкой' });
  await card.getByTestId('scenario-open').click();
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 1');
  await expect(page.locator('.correction-marker[aria-label*="добавлен вручную"]')).toHaveCount(1);
  const downloaded = page.waitForEvent('download');
  await card.getByTestId('scenario-competitors-export').click();
  const csv = await readFile(await (await downloaded).path(), 'utf8');
  expect(csv).toContain(`"node:123";"OSM";"${competitorName}";"${competitorAddress}"`);
  await page.evaluate(() => { window.print = () => { window.printInvoked = true; }; });
  await card.getByTestId('scenario-field-checklist').click();
  expect(await page.evaluate(() => window.printInvoked)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  const checklist = page.locator('#print-report-content');
  await expect(checklist).toContainText('Чек-лист проверки на месте');
  await expect(checklist).toContainText('Подтверждено');
  await expect(checklist.getByText(/^Адрес: _+/)).toBeVisible();
  const competitor = checklist.locator('li').filter({ hasText: competitorName });
  await expect(competitor).toContainText(competitorAddress);
  await expect(competitor).toContainText(/\d+\sм.*\d+\.\d{5}, \d+\.\d{5}.*OSM.*node:123/s);
  await expect(competitor.locator('em')).toHaveCount(0);
  expect(await competitor.evaluate(row => row.scrollWidth <= row.clientWidth)).toBe(true);
  await expect(checklist.locator('footer')).toContainText('https://www.openstreetmap.org/copyright');
});

test('тап по учтённому конкуренту в режиме добавления открывает карточку без поправки', async ({ page, baseURL }) => {
  await ready(page, baseURL);
  await page.locator('#layer-centroids').evaluate(input => {
    input.checked = false;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await mapBox(page);
  const marker = page.locator('[data-competitor-id="node:123"]');
  await marker.tap();
  const card = page.locator('.competitor-card');
  await expect(card.getByText('OSM ID: node:123')).toBeVisible();
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 0');
  await expect(page.locator('.map-inspection')).toHaveCount(0);
  await card.getByRole('button', { name: 'Закрыть карточку' }).tap();
  await expect(marker).toBeFocused();
});

test('печатное сравнение исследований содержит атрибуцию OSM один раз', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await page.locator('#scenario-save').click();
  await page.locator('#scenario-name').fill('Кофейня для сравнения');
  await page.locator('#scenario-submit').click();
  await page.getByTestId('scenario-duplicate').click();
  await expect(page.getByTestId('scenario-card')).toHaveCount(2);
  await page.getByTestId('scenario-compare').first().click();
  await page.getByTestId('scenario-compare').last().click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#scenario-print').click();
  await page.emulateMedia({ media: 'print' });
  const report = page.locator('#print-report-content');
  await expect(report.locator('.scenario-print-context')).toHaveCount(2);
  const attribution = report.locator('footer');
  await expect(attribution).toHaveCount(1);
  await expect(attribution).toContainText('© участники OpenStreetMap');
  await expect(attribution.getByRole('link')).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
});

test('панорамирование и щипок не добавляют конкурента', async ({ page, baseURL, browserName }) => {
  await ready(page, baseURL);
  const box = await mapBox(page);
  const driver = await gestureDriver(page);
  const send = (type, x, y) => driver.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  });
  await send('touchStart', box.x + box.width * .42, box.y + box.height * .35);
  for (let i = 1; i <= 8; i++) await send('touchMove', box.x + box.width * .42 + i * 6, box.y + box.height * .35 + i * 4);
  await send('touchEnd');
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 0');
  if (browserName === 'chromium') {
    const center = { x: box.x + box.width * .5, y: box.y + box.height * .5 };
    const pair = radius => [{ id: 1, x: center.x - radius, y: center.y }, { id: 2, x: center.x + radius, y: center.y }];
    await driver.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pair(25) });
    for (const radius of [35, 45, 55, 65]) await driver.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pair(radius) });
    await driver.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 0');
  }
  await expect(page.locator('.map-inspection')).toHaveCount(0);
});

test('быстрый сброс отменяет отложенный запрос', async ({ page, baseURL }) => {
  await ready(page, baseURL);
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/calculate') posts++; });
  await add(page);
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 1');
  // Keyboard activation avoids making this timing assertion depend on page scroll animation.
  await page.locator('#correction-reset').press('Enter');
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 0');
  await page.waitForTimeout(650);
  expect(posts).toBe(0);
});

test('поздний ответ не восстанавливает отменённую поправку', async ({ page, baseURL }) => {
  await ready(page, baseURL);
  const initial = (await current(page)).analysis_id;
  let notifyReceived, release;
  const received = new Promise(resolve => { notifyReceived = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  await page.route('**/api/calculate', async route => {
    const response = await route.fetch();
    notifyReceived();
    await blocked;
    await route.fulfill({ response }).catch(() => {});
  });
  await add(page);
  await received;
  await expect(page.locator('#correction-loading')).toBeVisible();
  await page.locator('#correction-undo').press('Enter');
  release();
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 0');
  await expect(page.locator('#correction-loading')).toBeHidden();
  expect((await current(page)).analysis_id).toBe(initial);
});

test('ошибка пересчёта сохраняет результат, а отмена смены параметров сохраняет поправки', async ({ page, baseURL }) => {
  await ready(page, baseURL);
  const initial = (await current(page)).analysis_id;
  await page.route('**/api/calculate', route => route.fulfill({ status: 503, json: { message: 'Источник недоступен.' } }));
  await add(page);
  await expect(page.locator('#correction-status')).toContainText('Поправки не применены');
  expect((await current(page)).analysis_id).toBe(initial);
  await page.unroute('**/api/calculate');
  await page.locator('#correction-retry').tap();
  await expect.poll(async () => (await current(page)).correction_context.counts.added).toBe(1);

  const business = await page.locator('#business').inputValue();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#business').evaluate(select => {
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#business')).toHaveValue(business);
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 1');
});

test('совпавшие координаты сохраняют выбор конкретного объекта OSM', async ({ page, baseURL }) => {
  await ready(page, baseURL, () => page.route('**/api/calculate', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const [first, second] = data.correction_context.base_competitors;
    Object.assign(first, { name: 'Кофейня «Точка»', address: 'ул. Плеханова, 10' });
    Object.assign(second, { lat: first.lat, lng: first.lng, address: 'пер. Литейный, 3' });
    await route.fulfill({ response, json: data });
  }));
  await page.locator('#correction-remove').tap();
  const marker = page.getByRole('button', { name: 'Выбрать конкурента OpenStreetMap · меток: 2' });
  await marker.tap();
  const dialog = page.locator('#correction-remove-dialog');
  const node = dialog.getByRole('radio', { name: /Кофейня «Точка».*ул. Плеханова, 10.*node:123/ });
  const way = dialog.getByRole('radio', { name: /Без названия \(OSM way 123\).*пер. Литейный, 3.*way:123/ });
  await expect(node).toBeChecked();
  await expect(way).toBeVisible();
  const link = dialog.getByRole('link', { name: 'Открыть в OSM', exact: true });
  await expect(link).toHaveAttribute('href', 'https://www.openstreetmap.org/node/123');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(marker).toBeFocused();
  await marker.tap();
  await way.check();
  await expect(link).toHaveAttribute('href', 'https://www.openstreetmap.org/way/123');
  const request = page.waitForRequest(request => request.method() === 'POST');
  await page.locator('#correction-remove-confirm').tap();
  expect((await request).postDataJSON().corrections.removed).toEqual(['way:123']);
});

test('снимок схемы 1 открывается без перезаписи архива', async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await page.locator('#scenario-save').click();
  await page.locator('#scenario-name').fill('Старое исследование');
  await page.locator('#scenario-note').fill('Заметка из прежней версии');
  await page.locator('#scenario-submit').click();
  await expect(page.locator('#scenario-dialog')).toBeHidden();
  const json = await page.evaluate(() => {
    const key = 'geomarketing.scenarios.v1';
    const envelope = JSON.parse(localStorage.getItem(key));
    envelope.schema_version = 1;
    const raw = JSON.stringify(envelope);
    localStorage.setItem(key, raw);
    return raw;
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await page.locator('.mobile-secondary-details > summary').filter({ hasText: 'Архив исследований' }).click();
  const card = page.getByTestId('scenario-card').filter({ hasText: 'Старое исследование' });
  await expect(card).toContainText('Заметка из прежней версии');
  await card.getByTestId('scenario-open').click();
  await expect(page.locator('#scenario-snapshot-notice')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('geomarketing.scenarios.v1'))).toBe(json);
});
