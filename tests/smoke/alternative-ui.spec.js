import { test, expect } from '@playwright/test';

async function fixture(page, baseURL, mainCount, alternatives) {
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.route('**/api/calculate?**', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.recommendations = data.recommendations.slice(0, mainCount).concat(alternatives.map((comparison, index) => ({
      ...data.recommendations[mainCount + index],
      role: 'alternative',
      alternative_comparison: comparison,
    })));
    await route.fulfill({ response, json: data });
  });
  const request = page.waitForRequest(r => new URL(r.url()).pathname === '/api/calculate');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  return new URL((await request).url()).searchParams;
}

const comparisons = [
  { rank: 1, distance_m: 640, shared_residents_fraction: .25 },
  { rank: 2, distance_m: 710, shared_residents_fraction: null },
];

test('результат запрашивает запасные места и показывает отдельную группу после основных', async ({ page, baseURL }) => {
  const query = await fixture(page, baseURL, 1, comparisons);
  expect(query.get('include_alternatives')).toBe('1');
  const result = page.locator('#result');
  await expect(result).toContainText('Основных мест: 1. Запасных вариантов: 2.');
  await expect(result.getByRole('heading', { name: 'Запасные варианты', exact: true })).toBeVisible();
  const cards = result.getByTestId('recommendation-card');
  await expect(cards.locator('.place-select')).toHaveText(['Место 1', 'Запасной вариант 2', 'Запасной вариант 3']);
  await expect(cards.nth(1)).toContainText('25\u00a0%');
  await expect(cards.nth(1)).toContainText('640\u00a0м');
  await expect(cards.nth(2)).toContainText('Доля общих жителей не оценена');
  const pin = page.getByRole('button', { name: /^Запасной вариант 2, оценка/ });
  const mainPin = page.getByRole('button', { name: /^Место 1, оценка/ });
  expect(await pin.locator('.recommendation-pin').evaluate(el => getComputedStyle(el).borderRadius))
    .not.toBe(await mainPin.locator('.recommendation-pin').evaluate(el => getComputedStyle(el).borderRadius));
  await cards.nth(1).locator('.place-select').click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await pin.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-inspection')).toHaveAttribute('aria-label', 'Запасной вариант 2 · оценка');
  await expect(cards.nth(1)).toHaveClass(/selected/);
});

test('ноль запасных мест показан без пустой группы', async ({ page, baseURL }) => {
  await fixture(page, baseURL, 3, []);
  const result = page.locator('#result');
  await expect(result).toContainText('Основных мест: 3. Запасных вариантов: 0.');
  await expect(result.getByRole('heading', { name: 'Запасные варианты', exact: true })).toHaveCount(0);
  await page.locator('#scenario-save').click();
  await page.locator('#scenario-name').fill('Исследование без запасных');
  await page.locator('#scenario-submit').click();
  const saved = page.getByTestId('scenario-card').filter({ hasText: 'Исследование без запасных' });
  await saved.getByTestId('scenario-open').click();
  await expect(page.locator('#scenario-snapshot-notice')).toBeVisible();
  await expect(page.locator('#place-count-summary')).toBeVisible();
  await expect(page.locator('#place-count-summary')).toHaveText('Основных мест: 3. Запасных вариантов: 0.');
});

test('пересчёт с поправками запрашивает запасные места тем же флагом', async ({ page, baseURL }) => {
  await fixture(page, baseURL, 3, []);
  const request = page.waitForRequest(r => new URL(r.url()).pathname === '/api/calculate' && r.method() === 'POST');
  await page.evaluate(async () => {
    const { fetchCalculation } = await import('/static/js/api.js');
    const { state } = await import('/static/js/state.js');
    await fetchCalculation(new URLSearchParams(state.currentRequestKey), undefined, { added: [], removed: [] });
  });
  expect((await request).postDataJSON()).toMatchObject({
    include_alternatives: '1',
    corrections: { added: [], removed: [] },
  });
});

test.describe('мобильные карточки и карта', () => {
  test.use({ isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

  for (const [width, height] of [[320, 568], [375, 667], [390, 500]]) {
  test(`краткий список и запасной пин помещаются при размере ${width} × ${height}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height });
    await fixture(page, baseURL, 1, comparisons);
    await page.locator('#map').evaluate(el => scrollTo({ top: scrollY + el.getBoundingClientRect().top - 110, behavior: 'instant' }));
    const sheet = page.locator('#recommendations');
    await expect(sheet).toHaveAttribute('data-sheet-active', 'true');
    const rail = sheet.locator('.sheet-rail');
    const alternative = rail.getByRole('button', { name: /^Запасной вариант 2, оценка/ });
    await expect(alternative).toBeVisible();
    await expect.poll(async () => alternative.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    })).toBe(true);
    await alternative.tap();
    await expect(alternative).toHaveAttribute('aria-pressed', 'true');
    const pin = page.getByRole('button', { name: /^Запасной вариант 2, оценка/ }).filter({ has: page.locator('.recommendation-pin') });
    await expect(pin).toHaveAttribute('aria-pressed', 'true');
    await pin.tap();
    const popup = page.locator('.map-inspection');
    await expect(popup).toContainText('Запасной вариант 2');
    await expect.poll(async () => {
      const box = await popup.boundingBox(), railBox = await rail.boundingBox();
      return box.x >= 0 && box.x + box.width <= width && box.y + box.height <= railBox.y;
    }).toBe(true);
    await popup.getByRole('button', { name: 'Закрыть выноску' }).tap();
    await expect(popup).toHaveCount(0);
    expect(await sheet.evaluate(el => {
      const ids = [...el.querySelectorAll('[id]')].map(node => node.id);
      return document.documentElement.scrollWidth <= innerWidth && ids.length === new Set(ids).size;
    })).toBe(true);
  });
  }
});
