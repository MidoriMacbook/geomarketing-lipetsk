import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });

const current = page => page.evaluate(async () => (await import('/static/js/state.js')).state.current);
const weight = page => page.locator('#network-weight');

test('сетевой вес сохраняется вместе с поправкой и не убирает метки', async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await expect(weight(page)).toBeHidden();
  await expect(page.locator('#network-note')).toContainText('нет сведений о брендах');
  await page.locator('#business').evaluate(el => {
    el.value = 'grocery';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#run').evaluate(button => button.click());
  await expect(weight(page)).toBeEnabled();
  await expect(weight(page)).toHaveValue('1');
  await expect(page.locator('#network-count')).toHaveText('Сетевых 1 из 2');
  const marker = page.locator('.competitor-marker.is-chain[data-competitor-id="node:123"]');
  await expect(marker).toHaveCount(1);
  const original = await current(page);
  for (const value of ['0.5', '0']) {
    await weight(page).selectOption(value);
    await expect.poll(async () => (await current(page)).network_competition?.weight).toBe(Number(value));
    await expect(weight(page)).toBeEnabled();
    await expect(marker).toHaveCount(1);
    expect((await current(page)).grid.scores).not.toEqual(original.grid.scores);
  }
  await page.locator('#corrections-toggle').tap();
  await expect(page.locator('#correction-add')).toBeEnabled();
  await page.route('**/api/calculate', route => route.fulfill({
    status: 503, json: { message: 'Нет ответа для пересчёта' },
  }), { times: 1 });
  await page.locator('#map').evaluate(el => scrollTo({
    top: scrollY + el.getBoundingClientRect().top - 96, behavior: 'instant',
  }));
  const map = page.locator('#map');
  const box = await map.boundingBox();
  await map.tap({ position: { x: box.width * .72, y: box.height * .51 } });
  await expect(weight(page)).toBeDisabled();
  await expect(page.locator('#correction-retry')).toBeVisible();
  await expect(weight(page)).toBeDisabled();
  await page.locator('#correction-retry').tap();
  await expect.poll(async () => (await current(page)).correction_context?.counts.added).toBe(1);
  expect((await current(page)).network_competition.weight).toBe(0);
  await expect(page.locator('#network-count')).toHaveText('Сетевых 1 из 3');
  await page.locator('#correction-done').tap();
  await weight(page).selectOption('0.5');
  await expect.poll(async () => (await current(page)).network_competition.weight).toBe(0.5);
  expect((await current(page)).correction_context.counts.added).toBe(1);
  await page.locator('#scenario-save').click();
  await page.locator('#scenario-name').fill('Половинный вес и поправка');
  await page.locator('#scenario-form button[type=submit]').click();
  await expect(page.locator('#scenario-dialog')).toBeHidden();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await page.locator('.mobile-secondary-details > summary').filter({ hasText: 'Архив исследований' }).click();
  await page.getByTestId('scenario-card').filter({ hasText: 'Половинный вес и поправка' }).getByTestId('scenario-open').click();
  await expect(weight(page)).toHaveValue('0.5');
  await expect(page.locator('#network-count')).toHaveText('Сетевых 1 из 3');
  expect((await current(page)).correction_context.counts.added).toBe(1);
  await expect(marker).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
