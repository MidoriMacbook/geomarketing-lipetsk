import { test, expect } from '@playwright/test';

const longName = '=Кофейня «' + 'Оченьдлинноеназвание'.repeat(5) + '» <img src=x>';
const longAddress = 'улица ' + 'Длинноеулица'.repeat(9) + ', 16';

async function ready(page, baseURL, decorate) {
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.route('**/api/calculate?*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    decorate(data);
    await route.fulfill({ response, json: data });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await page.locator('#map').evaluate(el => scrollTo({ top: scrollY + el.getBoundingClientRect().top - 96, behavior: 'instant' }));
}

for (const width of [320, 375, 390, 1440]) {
  test.describe(`карточка на ширине ${width} px`, () => {
    test.use({ viewport: { width, height: width === 1440 ? 1000 : 844 }, hasTouch: width < 601, reducedMotion: 'reduce' });

    test('показывает длинное название, адрес и ссылку на исходный объект', async ({ page, baseURL }) => {
      await ready(page, baseURL, data => {
        Object.assign(data.competitors[0], { id: 'node:123', source: 'osm', name: longName, address: longAddress });
        Object.assign(data.competitors[1], { id: 'relation:123', source: 'osm', name: ' ' });
      });
      const marker = page.locator('[data-competitor-id="node:123"]');
      if (width < 601) {
        await marker.tap();
      } else {
        await marker.focus();
        await page.keyboard.press('Space');
      }
      const card = page.locator('.competitor-card');
      const link = card.getByRole('link', { name: 'Открыть в OSM', exact: true });
      const close = card.getByRole('button', { name: 'Закрыть карточку' });
      await expect(card.getByRole('heading')).toHaveText(longName);
      await expect(card.getByText(longAddress)).toBeVisible();
      await expect(card.getByText('OSM ID: node:123')).toBeVisible();
      await expect(link).toHaveAttribute('href', 'https://www.openstreetmap.org/node/123');
      await expect(card.locator('img')).toHaveCount(0);
      await expect(page.locator('.map-inspection')).toHaveCount(0);
      if (width < 601) await expect(page.locator('#recommendations')).toHaveAttribute('data-snap', 'peek');
      expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 1440) {
        await expect(close).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(link).toBeFocused();
        await page.keyboard.press('Escape');
      } else {
        await close.tap();
      }
      await expect(card).toBeHidden();
      await expect(marker).toBeFocused();

      await page.locator('[data-competitor-id="relation:123"]').focus();
      await page.keyboard.press('Enter');
      await expect(card.getByRole('heading')).toHaveText('Без названия (OSM relation 123)');
      await expect(card.getByText('Адрес не указан в OSM')).toBeVisible();
      await expect(link).toHaveAttribute('href', 'https://www.openstreetmap.org/relation/123');
    });
  });
}

test('демометка и запись со старой выгрузки показывают доступный источник', async ({ page, baseURL }) => {
  let sample = false;
  const decorate = data => {
    Object.assign(data.competitors[0], { id: null });
    if (sample) {
      data.source = 'demo';
      Object.assign(data.competitors[0], { id: 'node:123', name: longName, address: longAddress });
    }
  };
  await ready(page, baseURL, decorate);
  const marker = page.locator('.competitor-marker').first();
  await marker.focus();
  await page.keyboard.press('Enter');
  const card = page.locator('.competitor-card');
  await expect(card.getByRole('heading')).toHaveText('Конкурент OpenStreetMap');
  await expect(card.getByText('Адрес не указан в OSM')).toBeVisible();
  await expect(card.getByRole('link')).toHaveCount(0);
  sample = true;
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(card).toContainText('Демонстрационные данные');
  await expect(card).not.toContainText('OSM ID');
  await expect(card).not.toContainText(longAddress);
  await expect(card.getByRole('link')).toHaveCount(0);
});

test.describe('совпавшие конкуренты при просмотре', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });

  test('один тап показывает обе записи с разными адресами и ссылками', async ({ page, baseURL }) => {
    await ready(page, baseURL, data => {
      const [first, second] = data.competitors;
      Object.assign(first, { id: 'node:123', name: 'Кофейня «Весна»', address: 'ул. Ленина, 8' });
      Object.assign(second, {
        id: 'way:123', name: 'Кофейня «Лето»', address: 'ул. Ленина, 8А', lat: first.lat, lng: first.lng,
      });
    });
    await page.locator('[data-competitor-id="way:123"]').tap();
    const card = page.locator('.competitor-card');
    for (const [name, address, id, href] of [
      ['Кофейня «Весна»', 'ул. Ленина, 8', 'node:123', 'https://www.openstreetmap.org/node/123'],
      ['Кофейня «Лето»', 'ул. Ленина, 8А', 'way:123', 'https://www.openstreetmap.org/way/123'],
    ]) {
      const entry = card.locator('.competitor-card-entry').filter({ hasText: name });
      await expect(entry.getByText(address, { exact: true })).toBeVisible();
      await expect(entry.getByText(`OSM ID: ${id}`)).toBeVisible();
      await expect(entry.getByRole('link')).toHaveAttribute('href', href);
    }
    await expect(page.locator('.map-inspection')).toHaveCount(0);
    await expect(page.locator('#recommendations')).toHaveAttribute('data-snap', 'peek');
  });
});
