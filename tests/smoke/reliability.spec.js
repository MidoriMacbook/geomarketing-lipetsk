import { test, expect } from '@playwright/test';

const fewObjects = {
  level: 'low',
  code: 'few_city_objects',
  reason: 'В OSM отмечено мало объектов.',
  metrics: null,
};
const fewObjectsText = 'Надёжность данных: низкая. В OSM отмечено мало объектов. Проверьте на месте или добавьте поправки';
const incomplete = {
  level: 'low',
  code: 'missing_both',
  reason: 'У 65\u00a0% объектов в области одновременно отсутствуют название и полный адрес.',
  metrics: null,
};

async function prepare(page, baseURL, reliability, { stale = false, deliveryVersions, movedPlace = false } = {}) {
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.route('**/static/vendor/leaflet/leaflet.js', async route => {
    const response = await route.fetch();
    const script = await response.text();
    await route.fulfill({ response, body: script + '\nL.Map.addInitHook(function () { window.testMap = this; });' });
  });
  await page.route(/\/api\/calculate(?:\?|$)/, async route => {
    const request = route.request();
    const optedIn = request.method() === 'POST' ? request.postDataJSON().data_reliability
      : new URL(request.url()).searchParams.get('data_reliability');
    const response = await route.fetch();
    const data = await response.json();
    if (optedIn === '1') data.data_reliability = reliability;
    if (deliveryVersions) {
      data.data_delivery = { mode: 'daily', version: deliveryVersions[request.method()] };
      if (request.method() === 'POST') data.data_reliability = incomplete;
    }
    if (movedPlace && request.method() === 'POST') data.recommendations[0].lat += .001;
    if (stale) {
      data.warning = 'Выгрузка OpenStreetMap старше 7 дней.';
      for (const entry of Object.values(data.data_meta)) entry.fetched_at -= 8 * 86400;
    }
    await route.fulfill({ response, json: data });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
}

async function showMap(page) {
  await page.locator('#map').evaluate(el => {
    const headerEnd = document.getElementById('site-header').getBoundingClientRect().bottom;
    scrollTo(0, scrollY + el.getBoundingClientRect().top - headerEnd - 12);
  });
  if (page.viewportSize().width <= 600) {
    await expect(page.locator('#recommendations')).toHaveAttribute('data-sheet-active', 'true');
  }
}

const view = page => page.evaluate(async () => {
  const { state } = await import('/static/js/state.js');
  const map = window.testMap;
  const { x, y } = map.project(map.getCenter());
  return {
    area: state.current.district,
    business: state.current.business,
    rank: state.selectedRank,
    center: [x, y],
    zoom: map.getZoom(),
  };
});

async function expectSameView(page, { center, ...selection }) {
  const { center: actual, ...current } = await view(page);
  expect(current).toEqual(selection);
  // Leaflet округляет положение карты при пересчёте размеров контейнера.
  expect(Math.hypot(actual[0] - center[0], actual[1] - center[1])).toBeLessThanOrEqual(1);
}

test.use({ hasTouch: true, reducedMotion: 'reduce' });

for (const [width, height] of [[320, 568], [375, 667], [390, 844], [1440, 1000]]) {
  test(`уровень в расчёте и выноске, переход к поправкам · ${width}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height });
    await prepare(page, baseURL, width === 320 ? incomplete : fewObjects, { stale: width === 1440 });
    await showMap(page);
    const sheet = page.locator('#recommendations');
    if (width <= 600) await sheet.locator('.sheet-handle').tap();
    const summary = sheet.locator('.data-reliability');
    const expected = width === 320 ? `Надёжность данных: низкая. ${incomplete.reason}` : fewObjectsText;
    await expect(summary).toHaveText(`${expected}Мои поправки`);
    if (width === 1440) await expect(page.locator('#data-warning')).toHaveText('Выгрузка OpenStreetMap старше 7 дней.');
    const summaryAction = summary.getByRole('button', { name: 'Мои поправки' });
    await expect(summaryAction).toBeEnabled();
    const summaryBox = await summaryAction.boundingBox();
    expect(summaryBox.height).toBeGreaterThanOrEqual(44);
    expect(summaryBox.width).toBeGreaterThanOrEqual(44);

    if (width <= 600) await sheet.getByRole('button', { name: 'Закрыть результаты' }).tap();
    const pin = page.locator('#map .leaflet-marker-icon[aria-label^="Место 2, оценка"]');
    await pin.tap();
    const popup = page.getByRole('region', { name: 'Место 2 · оценка' });
    await expect(popup.locator('.data-reliability > p')).toHaveText(expected);
    await expect.poll(() => popup.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (width <= 600) {
      await expect(sheet).toHaveAttribute('data-snap', 'peek');
      await expect.poll(async () => {
        const box = await popup.boundingBox();
        const bottom = (await sheet.boundingBox()).y;
        return box.y >= 0 && box.y + box.height <= bottom;
      }).toBe(true);
      if (width > 320) {
        await expect.poll(() => popup.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      }
    }
    let before;
    if (width === 390) {
      await popup.getByRole('button', { name: 'Закрыть выноску' }).tap();
      await expect(popup).toHaveCount(0);
      await expect(page.locator('#map')).toBeFocused();
      await page.evaluate(() => window.testMap.panBy([500, 0], { animate: false }));
      await sheet.locator('.sheet-handle').tap();
      before = await view(page);
      await summaryAction.tap();
    } else {
      if (width <= 600) await expect(page.locator('.map-inspection-docked')).toBeVisible();
      else await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const popupAction = popup.getByRole('button', { name: 'Мои поправки' });
      await popupAction.scrollIntoViewIfNeeded();
      before = await view(page);
      expect((await popupAction.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await popupAction.tap();
    }
    await expect(page.locator('#correction-add')).toBeEnabled();
    await expect(page.locator('#corrections-panel')).toBeFocused();
    await expect(popup).toHaveCount(0);
    if (width <= 600) await expect(sheet).toHaveAttribute('data-snap', 'peek');
    await expectSameView(page, before);
    await page.locator('#correction-done').tap();
    await expect(page.locator('#corrections-toggle')).toBeFocused();
    await expectSameView(page, before);
  });
}

test('средняя и высокая оценки и отсутствующие показатели различаются по тексту', async ({ page, baseURL }) => {
  const examples = [
    { level: 'medium', code: 'few_area_objects', reason: 'В круге поиска отмечено меньше 5 объектов этой категории.' },
    { level: 'high', code: 'sufficient_coverage', reason: 'Показатели разметки проходят предварительные пороги.' },
    { level: null, code: 'incomplete_metrics', reason: 'Не удалось оценить плотность продуктовых магазинов.' },
  ];
  await prepare(page, baseURL, examples[0]);
  const summary = page.locator('#calculation-reliability > p');
  await expect(summary).toHaveText(`Надёжность данных: средняя. ${examples[0].reason}`);
  for (const [index, label] of [[1, 'высокая'], [2, 'нет сведений']]) {
    await page.route(/\/api\/calculate(?:\?|$)/, async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.data_reliability = examples[index];
      await route.fulfill({ response, json: data });
    }, { times: 1 });
    await page.locator('#run').click();
    await expect(summary).toHaveText(`Надёжность данных: ${label}. ${examples[index].reason}`);
  }
});

test('поправка пересчитывает место, сохраняя оценку исходной разметки', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, baseURL, fewObjects);
  await showMap(page);
  await page.locator('.sheet-handle').tap();
  await page.locator('#recommendations .data-reliability button').tap();
  await expect(page.locator('#correction-add')).toBeEnabled();
  await showMap(page);
  const map = page.locator('#map');
  const box = await map.boundingBox();
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/calculate');
  await map.tap({ position: { x: box.width * .72, y: box.height * .51 } });
  const response = await responsePromise;
  expect(response.request().postDataJSON().data_reliability).toBe('1');
  expect((await response.json()).data_reliability).toEqual(fewObjects);
  await expect(page.locator('#correction-status')).toHaveText('Расчёт обновлён.');
  await page.locator('#correction-done').tap();
  await showMap(page);
  await page.locator('.sheet-handle').tap();
  await expect(page.locator('#recommendations .data-reliability > p')).toHaveText(fewObjectsText);
});

test('старое исследование открывается без сведений о полноте и сохраняет архив', async ({ page, baseURL }) => {
  await prepare(page, baseURL, fewObjects);
  await page.locator('#scenario-save').click();
  await page.locator('#scenario-name').fill('Старый архив');
  await page.locator('#scenario-submit').click();
  await expect(page.locator('#scenario-dialog')).toBeHidden();
  const archive = await page.evaluate(() => {
    const key = 'geomarketing.scenarios.v1';
    const saved = JSON.parse(localStorage.getItem(key));
    const snapshot = Object.values(saved).find(Array.isArray)[0];
    delete snapshot.analysis.data_reliability;
    const raw = JSON.stringify(saved);
    localStorage.setItem(key, raw);
    return raw;
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  const card = page.getByTestId('scenario-card').filter({ hasText: 'Старый архив' });
  await card.getByTestId('scenario-open').click();
  const notice = page.locator('#scenario-snapshot-notice');
  await expect(notice).toBeVisible();
  const openedNotice = await notice.textContent();
  const summary = page.locator('#recommendations .data-reliability');
  await expect(summary.locator('p')).toHaveText('Надёжность данных: нет сведений.');
  await summary.getByRole('button', { name: 'Мои поправки' }).click();
  await expect(page.locator('#correction-add')).toBeEnabled();
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(openedNotice);
  await expect(summary.locator('p')).toHaveText('Надёжность данных: нет сведений.');
  expect(await page.evaluate(() => localStorage.getItem('geomarketing.scenarios.v1'))).toBe(archive);
});

for (const [change, options] of [
  ['новая выгрузка', { deliveryVersions: { GET: 'original-version', POST: 'new-version' } }],
  ['изменившееся место без версии выгрузки', { movedPlace: true }],
]) {
  test(`${change} при подготовке поправок сохраняет открытый расчёт`, async ({ page, baseURL }) => {
    await prepare(page, baseURL, fewObjects, options);
    const current = () => page.evaluate(async () => {
      const { state } = await import('/static/js/state.js');
      return [
        state.current.analysis_id, state.current.data_delivery?.version ?? null,
        state.current.recommendations, state.current.data_reliability,
      ];
    });
    const original = await current();
    const before = await view(page);
    await page.locator('#calculation-reliability').getByRole('button', { name: 'Мои поправки' }).click();
    await expect(page.locator('#correction-status')).toContainText('Проверьте обновления данных');
    await expect(page.locator('#correction-retry')).toBeEnabled();
    expect(await current()).toEqual(original);
    await expectSameView(page, before);
    await expect(page.locator('#calculation-reliability > p')).toHaveText(fewObjectsText);
  });
}
