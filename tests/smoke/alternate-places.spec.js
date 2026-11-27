import { test, expect } from '@playwright/test';

const current = page => page.evaluate(async () => {
  const { state } = await import('/static/js/state.js');
  const data = state.current;
  return data && { business: data.business, id: data.analysis_id, rank: state.selectedRank,
    places: data.recommendations.map(({ rank, role, lat, lng }) => ({ rank, role, lat, lng })) };
});

for (const [width, height] of [[375, 667], [1440, 900]]) {
  test(`запасное место в карте, сравнении и архиве · ${width}`, async ({ page, baseURL }) => {
    const mobile = width < 600;
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');

    async function calculate(business) {
      await page.locator('#business').evaluate((field, value) => {
        field.value = value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }, business);
      await page.locator('#run').evaluate(button => button.click());
      await expect.poll(async () => (await current(page))?.business).toBe(business);
    }
    await calculate('fitness');
    const original = await current(page);
    expect(original.places.map(place => place.role ?? 'primary')).toEqual(['primary', 'primary', 'alternative']);

    const map = page.locator('#map');
    const sheet = page.locator('#recommendations');
    const popup = page.locator('#map .map-inspection');
    const rankPin = rank => map.locator('[role="button"]').filter({
      has: page.locator('.recommendation-pin', { hasText: new RegExp(`^${rank}$`) }),
    });
    const backupPin = map.getByRole('button', { name: /Запасной вариант/ });
    const rankCard = rank => page.locator(`#recommendation-list article[data-rank="${rank}"]`);

    async function focusMap() {
      await page.locator('#map-card').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    }
    async function openPin(pin) {
      // Enter uses the same place action. It also avoids incidental proximity to the zoom controls.
      await pin.focus();
      await page.keyboard.press('Enter');
      await expect(popup).toBeVisible();
    }
    async function saveInPopup() {
      await popup.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await expect(popup.getByRole('status')).toContainText('Сохранено');
      await popup.getByRole('button', { name: 'Закрыть выноску' }).click();
      await expect(popup).toHaveCount(0);
    }
    async function openMobileSection(section) {
      if (!mobile) return;
      const folded = page.locator('.mobile-secondary-details').filter({ has: section });
      if (await folded.getAttribute('open') === null) await folded.locator(':scope > summary').click();
    }

    await focusMap();
    await openPin(rankPin(1));
    await saveInPopup();

    if (mobile) {
      await focusMap();
      await sheet.locator('.sheet-handle').click();
      await rankCard(3).locator('.mobile-rec-toggle').click();
      await rankCard(3).locator('.mobile-show-place').click();
    } else {
      await rankCard(3).locator('.place-select').click();
    }
    await expect(rankCard(3)).toHaveClass(/selected/);
    await expect.poll(async () => (await current(page)).rank).toBe(3);
    await focusMap();
    await openPin(backupPin);
    await expect(popup).toContainText('Запасной вариант');
    await saveInPopup();

    const comparison = page.locator('#comparison');
    const savedSection = page.locator('#saved-section');
    await openMobileSection(savedSection);
    await expect(comparison).toContainText('Запасной вариант');
    await expect(comparison).toContainText(/место 1/i);
    await page.locator('#comparison-map-link').click();
    await expect.poll(async () => (await current(page)).rank).toBe(3);

    await page.locator('#scenario-save').click();
    await page.locator('#scenario-name').fill('Проверка запасного места');
    await page.locator('#scenario-submit').click();
    await expect(page.locator('#scenario-dialog')).toBeHidden();
    await calculate('cafe');
    expect((await current(page)).places.every(place => place.role !== 'alternative')).toBe(true);

    await openMobileSection(savedSection);
    const saved = savedSection.getByTestId('saved-place-open');
    await expect(saved).toHaveCount(1);
    await saved.click();
    const savedPopup = map.getByRole('region', { name: 'Сохранённое место' });
    await expect(savedPopup).toContainText('Запасной вариант 3');
    await expect(map.locator('.leaflet-marker-icon[data-saved-place-id] .recommendation-pin.is-alternative')).toHaveCount(1);

    if (mobile) {
      const archive = page.locator('.mobile-secondary-details').filter({ hasText: 'Архив исследований' });
      if (await archive.getAttribute('open') === null) await archive.locator(':scope > summary').click();
    }
    const record = page.getByTestId('scenario-card').filter({ hasText: 'Проверка запасного места' });
    await expect(record).toContainText('Запасной вариант');
    await record.getByTestId('scenario-open').click();
    await expect(page.locator('#scenario-snapshot-notice')).toBeVisible();
    await expect.poll(async () => (await current(page)).id).toBe(original.id);
    const restored = await current(page);
    expect(restored.rank).toBe(3);
    expect(restored.places).toEqual(original.places);
    await expect(backupPin).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
