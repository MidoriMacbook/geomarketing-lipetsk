async page => {
  const base = new URL(page.url()).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  // Blocking the old CDN must not break initialization or calculation.
  await page.route('**/unpkg.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof L !== 'undefined', null, { timeout: 5000 });
  await page.locator('#run').click();
  await page.locator('#result').waitFor({ state: 'visible' });
  assert(/\d+\.\d+/.test(await page.locator('#coords').innerText()), 'No coordinates');
  const original = await page.locator('#coords').innerText();

  // A response for a previous selection must never be shown for a new one.
  let arrived;
  const requestStarted = new Promise(resolve => { arrived = resolve; });
  await page.route('**/api/calculate?**', async route => {
    const response = await route.fetch();
    arrived();
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ response }).catch(() => {});
  });
  await page.locator('#run').click();
  await requestStarted;
  await page.locator('#district').selectOption('center');
  await page.waitForTimeout(700);
  assert(!await page.locator('#result').isVisible(), 'Old request rendered after selection changed');
  assert(await page.locator('#run').isEnabled(), 'Calculate button remains disabled');
  await page.unroute('**/api/calculate?**');
  await page.locator('#run').click();
  await page.locator('#result').waitFor({ state: 'visible' });
  assert(await page.locator('#coords').innerText() !== original, 'District change did not affect result');

  // Tile failure is visible and does not disable analysis.
  await page.route('**/tile.openstreetmap.org/**', route => route.abort());
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('map-status').hidden);
  await page.locator('#run').click();
  await page.locator('#result').waitFor({ state: 'visible' });
  assert(await page.locator('#map-status').isVisible(), 'Tile error not reported');
  await page.unroute('**/tile.openstreetmap.org/**');
  await page.locator('#retry-map').click();
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 0);

  // Hosted visitor sees an actionable network error, with no local Python instructions.
  await page.route('**/api/calculate?**', route => route.abort());
  await page.locator('#run').click();
  await page.locator('#error').waitFor({ state: 'visible' });
  assert(!/python|F12/.test(await page.locator('#error').innerText()), 'Local-only error instructions');
  await page.unroute('**/api/calculate?**');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#run').click();
  await page.locator('#result').waitFor({ state: 'visible' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tests/artifacts/mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tests/artifacts/desktop.png' });
  assert(errors.length === 0, errors.join('\n'));
  return { passed: ['local Leaflet', 'calculation', 'stale request', 'tile failure/retry', 'API error', 'mobile layout'], pageErrors: errors };
}
