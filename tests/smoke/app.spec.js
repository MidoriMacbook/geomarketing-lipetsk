import { test as base, expect } from '@playwright/test';

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const errors = [], unexpectedRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === baseURL) return route.continue();
      if (!url.hostname.endsWith('tile.openstreetmap.org')) unexpectedRequests.push(url.href);
      return route.abort();
    });
    await use(page);
    await test.info().attach('Диагностика браузера', {
      body: Buffer.from(JSON.stringify({ errors, unexpectedRequests })),
      contentType: 'application/json',
    });
    expect(errors, 'Необработанные ошибки JavaScript').toEqual([]);
    expect(unexpectedRequests, 'Неожиданные внешние запросы').toEqual([]);
  },
});

async function waitForAnalysis(page) {
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await expect(page.getByTestId('recommendation-card')).toHaveCount(3);
}

test('Каталог, расчёт, выбор места и сохранение исследования', async ({ page }) => {
  const catalogResponse = page.waitForResponse(response => response.url().endsWith('/api/catalog'));
  const calculationResponse = page.waitForResponse(response => response.url().includes('/api/calculate?'));
  await page.goto('/');
  const catalog = await (await catalogResponse).json();
  expect(catalog.districts).toHaveLength(10);
  await expect(page.locator('#district option')).toHaveCount(11);
  const analysis = await (await calculationResponse).json();
  expect(analysis.status).toBe('success');
  expect(analysis.source).toBe('cache');
  expect(analysis.stats).toEqual({ houses: 6, competitors: 2, residents: 5100 });
  expect(analysis.recommendations.every(r=>r.selection_method==='cluster_maxima_v1')).toBe(true);
  expect(new Set(analysis.recommendations.map(r=>r.cluster_id)).size).toBe(3);
  await waitForAnalysis(page);
  await expect(page.locator('#coords')).toContainText(/52\.\d+/);
  await page.getByTestId('recommendation-card').nth(1).locator('.place-select').click();
  await expect(page.getByTestId('recommendation-card').nth(1)).toHaveClass(/selected/);
  await expect(page.getByTestId('recommendation-card').nth(1).locator('.place-difference')).toContainText('Общих домов');
  await expect(page.locator('.recommendation-pin.is-selected')).toHaveCount(1);

  await page.locator('#scenario-save').click();
  await page.locator('#scenario-name').fill('Проверка CI');
  await page.locator('#scenario-note').fill('Проверить вход');
  await page.locator('#scenario-submit').click();
  await expect(page.getByTestId('scenario-card')).toHaveCount(1);
  await page.reload();
  await waitForAnalysis(page);
  await page.getByTestId('scenario-open').click();
  await expect(page.locator('#scenario-snapshot-notice')).toBeVisible();
  await expect(page.getByTestId('recommendation-card').nth(1)).toHaveClass(/selected/);
  await page.getByTestId('scenario-edit').click();
  await page.locator('#scenario-name').fill('Проверка CI — изменено');
  await page.locator('#scenario-submit').click();
  await expect(page.getByTestId('scenario-card')).toContainText('Проверка CI — изменено');
  await page.reload();
  await expect(page.getByTestId('scenario-card')).toContainText('Проверка CI — изменено');
});

test('Мобильное меню, настройки и повторный расчёт', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForAnalysis(page);
  await page.locator('#nav-toggle').click();
  await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#nav-menu a[href="#workspace"]').click();
  await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#mobile-settings-open').click();
  await expect(page.locator('#mobile-settings-dialog')).toBeVisible();
  await page.locator('#business-trigger').click();
  await page.getByRole('option', { name: 'Аптека', exact: true }).click();
  await expect(page.locator('#business')).toHaveValue('pharmacy');
  const response = page.waitForResponse(response => response.url().includes('type=pharmacy'));
  await page.locator('#run').click();
  expect((await response).ok()).toBeTruthy();
  await waitForAnalysis(page);
  await expect(page.locator('#mobile-settings-dialog')).not.toBeVisible();
  await expect(page.locator('#mobile-settings-open')).toBeFocused();
  await page.locator('#map-card').scrollIntoViewIfNeeded();
  await page.locator('.sheet-handle').click();await page.getByRole('button',{name:'Все — развернуть результаты полностью'}).click();
  await page.getByTestId('recommendation-card').nth(1).locator('.mobile-rec-toggle').click();
  await expect(page.getByTestId('recommendation-card').nth(1)).toHaveAttribute('data-mobile-expanded', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('Отказ API сохраняет предыдущий расчёт при недоступных плитках', async ({ page }) => {
  await page.goto('/');
  await waitForAnalysis(page);
  await expect(page.locator('#map-status')).toBeVisible();
  const coordinates = await page.locator('#coords').textContent();
  await page.route('**/api/calculate?**', route => route.abort());
  await page.locator('#run').click();
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#coords')).toHaveText(coordinates);
  await expect(page.getByTestId('recommendation-card')).toHaveCount(3);
  await expect(page.locator('#run')).toBeEnabled();
});

test('Запоздавший ответ не подменяет результат после смены района', async ({ page }) => {
  await page.goto('/');
  await waitForAnalysis(page);
  // Ответ намеренно игнорирует AbortSignal: проверяется защита версии запроса.
  await page.evaluate(async () => {
    const { state } = await import('/static/js/state.js');
    const delayed = structuredClone(state.current), nativeFetch = window.fetch;
    delayed.analysis_id = 'late-smoke-response';
    window.fetch = (input, options) => {
      if (!String(input).startsWith('/api/calculate?')) return nativeFetch(input, options);
      window.fetch = nativeFetch;
      return new Promise(resolve => {
        window.__releaseSmokeResponse = () => resolve(new Response(JSON.stringify(delayed), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }));
      });
    };
  });
  await page.locator('#run').click();
  const response = page.waitForResponse(response => response.url().includes('district=center'));
  await page.locator('#district').selectOption('center', { force: true });
  expect((await (await response).json()).district).toBe('center');
  await waitForAnalysis(page);
  await page.evaluate(async () => {
    window.__releaseSmokeResponse();
    // Следующая задача выполняется после завершения цепочки await старого ответа.
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(await page.evaluate(async () => {
    const { state } = await import('/static/js/state.js');
    return { district: state.current.district, stale: state.current.analysis_id === 'late-smoke-response' };
  })).toEqual({ district: 'center', stale: false });
  await expect(page.locator('#analysis-context')).toContainText('Центр');
});
