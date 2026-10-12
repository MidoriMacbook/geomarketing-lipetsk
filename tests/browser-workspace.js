async page => {
  const base = new URL(page.url()).origin;
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/unpkg.com/**', route => route.abort());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  await page.locator('[data-testid="business-select"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForFunction(() => document.querySelector('#business').options.length === 5);
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  const initial = await page.evaluate(() => fetch('/api/calculate?district=eleytsky&type=cafe').then(r => r.json()));
  assert(initial.recommendations.length >= 1 && initial.recommendations.length <= 3, 'Recommendation count');
  assert(await page.locator('[data-testid="recommendation-marker"]').count() === initial.recommendations.length, 'Numbered markers');
  const reviewFailures = [];
  // Same-origin tabs must retain independent additions and synchronize external deletions.
  await page.evaluate(() => localStorage.removeItem('geomarketing.saved.v1'));
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  const otherTab = await page.context().newPage();
  try {
    await otherTab.goto(base);
    await otherTab.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
    await Promise.all([page.locator('[data-testid="save-place"]').first().click(), otherTab.locator('[data-testid="save-place"]').first().click()]);
    await page.waitForTimeout(300);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('geomarketing.saved.v1')));
    if (stored.length !== 2) reviewFailures.push('Two-tab additions lost a saved place');
    if (await page.locator('[data-testid="saved-card"]').count() !== 2 || await otherTab.locator('[data-testid="saved-card"]').count() !== 2) reviewFailures.push('Storage events did not synchronize saved lists');
    await page.locator('[data-testid="compare-place"]').first().check();
    await otherTab.locator('[data-testid="saved-card"]').first().getByRole('button', { name: /Удалить/ }).click();
    await page.waitForTimeout(300);
    if (await page.locator('#comparison tbody tr').count() !== 0) reviewFailures.push('External delete did not clear comparison');
    const deletedId = stored[0].id;
    await page.locator('[data-testid="save-place"]').nth(1).click();
    await page.waitForTimeout(300);
    if (await page.evaluate(id => JSON.parse(localStorage.getItem('geomarketing.saved.v1')).some(item => item.id === id), deletedId)) reviewFailures.push('Stale tab resurrected a deleted save');
  } finally { await otherTab.close(); }
  await page.evaluate(() => localStorage.removeItem('geomarketing.saved.v1'));
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  // A failed refresh retains the complete successful result and its actions.
  const previousCoords = await page.locator('#coords').innerText();
  const previousKPI = await page.locator('#kpi-residents').innerText();
  await page.route('**/api/calculate?**', async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.abort();
  });
  await page.locator('#refresh-data').click();
  assert(await page.locator('#coords').isVisible() && await page.locator('#coords').innerText() === previousCoords, 'Pending refresh hid the successful result');
  assert(await page.locator('#print-report').isEnabled() && await page.locator('[data-testid="save-place"]').first().isEnabled(), 'Pending refresh disabled saved-result actions');
  await page.locator('#error').waitFor({ state: 'visible' });
  if (!await page.locator('#result').isVisible() || !await page.locator('#coords').isVisible()) reviewFailures.push('Failed refresh discarded successful recommendations');
  else if (await page.locator('#coords').innerText() !== previousCoords || await page.locator('#kpi-residents').innerText() !== previousKPI) reviewFailures.push('Failed refresh changed the successful result');
  if (!await page.locator('#print-report').isEnabled() || !await page.locator('[data-testid="save-place"]').first().isVisible()) reviewFailures.push('Failed refresh disabled saved-result actions');
  await page.unroute('**/api/calculate?**');
  await page.evaluate(() => localStorage.setItem('geomarketing.saved.v1', '[{"analysis_id":"malformed"}]'));
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  assert(/повреждены/.test(await page.locator('#storage-status').innerText()), 'Malformed valid JSON not reported');
  await page.evaluate(() => { Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); }; });
  await page.locator('[data-testid="save-place"]').first().click();
  await page.waitForTimeout(200);
  if (await page.locator('[data-testid="saved-card"]').count() !== 0 || !/недоступно/.test(await page.locator('#storage-status').innerText())) reviewFailures.push('Blocked getItem falsely reported successful save');
  assert(reviewFailures.length === 0, reviewFailures.join('; '));
  await page.reload();
  await page.evaluate(() => localStorage.removeItem('geomarketing.saved.v1'));
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  // Saving queued behind a lock must retain the analysis captured before a filter change.
  await page.evaluate(() => {
    window.__releaseSavedLock = null;
    navigator.locks.request('geomarketing.saved.v1.write', () => new Promise(resolve => { window.__releaseSavedLock = resolve; }));
  });
  await page.waitForFunction(() => typeof window.__releaseSavedLock === 'function');
  await page.locator('[data-testid="save-place"]').first().click();
  await page.locator('#business').selectOption('pharmacy');
  await page.evaluate(() => window.__releaseSavedLock());
  await page.locator('[data-testid="saved-card"]').first().waitFor();
  assert(/Кофейня/.test(await page.locator('[data-testid="saved-card"]').first().innerText()), 'Queued save captured changed analysis');
  await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('geomarketing.saved.v1'));
    items[0].recommendation.score = -1;
    localStorage.setItem('geomarketing.saved.v1', JSON.stringify(items));
  });
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  assert(/повреждены/.test(await page.locator('#storage-status').innerText()), 'Malformed numeric saved record accepted');
  await page.evaluate(() => {
    localStorage.removeItem('geomarketing.saved.v1');
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
  });
  await page.locator('[data-testid="save-place"]').first().click();
  assert(await page.locator('[data-testid="saved-card"]').count() === 0 && /недоступно/.test(await page.locator('#storage-status').innerText()), 'Missing locks falsely reported save');
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  // Threshold changes and new analyses must reuse map renderers rather than accumulating canvases.
  const canvasCount = await page.locator('#map canvas').count();
  for (let index = 0; index < 15; index++) {
    await page.locator('#thr').fill(String(70 + index));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  assert(await page.locator('#map canvas').count() <= canvasCount + 1, 'Threshold updates leaked map canvases');
  for (let index = 0; index < 3; index++) {
    await page.locator('#run').click();
    await page.waitForFunction(() => !document.getElementById('run').disabled, null, { timeout: 70000 });
    await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  }
  assert(await page.locator('#map canvas').count() <= canvasCount + 1, 'Repeated analyses leaked map canvases');
  if (initial.recommendations.length > 1) {
    await page.locator('[data-testid="recommendation-card"]').nth(1).getByRole('button', { name: /Показать/ }).click();
    assert(await page.locator('[data-testid="recommendation-card"]').nth(1).getAttribute('class').then(value => value.includes('selected')), 'Card selection missing');
    assert(await page.locator('.recommendation-pin.is-selected').innerText() === '2', 'Card did not select marker');
    await page.locator('[data-testid="recommendation-marker"]').first().click();
    assert(await page.locator('[data-testid="recommendation-card"]').first().getAttribute('class').then(value => value.includes('selected')), 'Marker did not select card');
  }
  await page.evaluate(() => localStorage.removeItem('geomarketing.saved.v1'));
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  await page.locator('[data-testid="save-place"]').first().click();
  assert(await page.locator('[data-testid="saved-card"]').count() === 1, 'Save failed');
  await page.locator('[data-testid="save-place"]').first().click();
  assert(await page.locator('[data-testid="saved-card"]').count() === 1, 'Duplicate saved');
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  assert(await page.locator('[data-testid="saved-card"]').count() === 1, 'Saved place lost on reload');
  await page.locator('[data-testid="compare-place"]').first().check();
  assert(await page.locator('#comparison tbody tr').count() === 1, 'Comparison missing');
  assert(/нельзя сравнивать/.test(await page.locator('#comparison-notice').innerText()), 'Relative-score notice missing');
  const download = page.waitForEvent('download');
  await page.locator('#export-csv').click();
  assert((await download).suggestedFilename().endsWith('.csv'), 'CSV not downloaded');
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.locator('#print-report').click();
  assert(await page.evaluate(() => window.__printed && document.querySelector('#print-report-content').textContent.includes('OpenStreetMap')), 'Print report lacks source');
  await page.locator('#model-button').click();
  assert(await page.locator('#model-dialog').isVisible(), 'Model dialog missing');
  await page.keyboard.press('Escape');
  assert(!await page.locator('#model-dialog').isVisible(), 'Dialog Escape does not close');
  for (const layer of ['houses', 'competitors', 'centroids', 'zones']) {
    await page.locator('#layer-' + layer).uncheck();
    assert(await page.locator('[data-testid="recommendation-marker"]').count() >= 1, 'Recommendations hidden by layer');
    await page.locator('#layer-' + layer).check();
  }
  for (const business of ['pharmacy', 'grocery', 'bakery', 'beauty']) {
    await page.locator('#business').selectOption(business);
    await page.locator('#run').click();
    await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
    assert(await page.locator('#business').inputValue() === business, 'Business select');
  }
  let started;
  const pending = new Promise(resolve => { started = resolve; });
  await page.route('**/api/calculate?**', async route => {
    const response = await route.fetch(); started();
    await new Promise(resolve => setTimeout(resolve, 600));
    await route.fulfill({ response }).catch(() => {});
  });
  await page.locator('#run').click(); await pending;
  await page.locator('#district').selectOption('center');
  await page.waitForTimeout(850);
  assert(!await page.locator('#result').isVisible(), 'Obsolete response rendered');
  assert(await page.locator('#run').isEnabled(), 'Button stuck after cancellation');
  await page.unroute('**/api/calculate?**');
  await page.locator('#district').selectOption('custom');
  await page.locator('#radius').selectOption('1500');
  await page.locator('#run').click();
  assert(/центр/.test(await page.locator('#error').innerText()), 'Custom area validation');
  await page.locator('#map').scrollIntoViewIfNeeded();
  const map = await page.locator('#map').boundingBox();
  await page.mouse.click(map.x + map.width / 2, map.y + map.height / 2);
  assert(/выбран/.test(await page.locator('#custom-hint').innerText()), 'Custom map click missing');
  await page.locator('#district').selectOption('eleytsky');
  await page.route('**/api/calculate?**', route => route.abort());
  await page.locator('#run').click();
  await page.locator('#error').waitFor({ state: 'visible' });
  assert(!/python|F12/.test(await page.locator('#error').innerText()), 'Hosted error instructions');
  await page.unroute('**/api/calculate?**');
  await page.route('**/tile.openstreetmap.org/**', route => route.abort());
  await page.reload();
  await page.locator('#map-status').waitFor({ state: 'visible' });
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  await page.unroute('**/tile.openstreetmap.org/**');
  await page.locator('#retry-map').click();
  await page.evaluate(() => localStorage.setItem('geomarketing.saved.v1', '{broken'));
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  assert(/повреждены/.test(await page.locator('#storage-status').innerText()), 'Corrupt storage not reported');
  await page.locator('[data-testid="save-place"]').first().click();
  assert(await page.locator('[data-testid="saved-card"]').count() === 1, 'Recovery save failed');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); }; });
  await page.locator('[data-testid="save-place"]').nth(1).click();
  assert(/недоступно/.test(await page.locator('#storage-status').innerText()), 'Blocked storage false success');
  assert(await page.locator('[data-testid="saved-card"]').count() === 1, 'Failed persistence presented as saved');
  // Seed real saved records with distinct analyses to exercise list and comparison limits.
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  await page.evaluate(() => {
    const original = JSON.parse(localStorage.getItem('geomarketing.saved.v1'))[0];
    const items = Array.from({ length: 12 }, (_, index) => ({ ...original, analysis_id: 'fixture-' + index, id: 'fixture-' + index + ':' + original.recommendation.rank }));
    items[0].business_name = '=SUM(1;2)';
    items[0].district_name = 'Район "с кавычками";\nвторая строка';
    localStorage.setItem('geomarketing.saved.v1', JSON.stringify(items));
  });
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  assert(await page.locator('[data-testid="saved-card"]').count() === 12, '12 valid saves not restored');
  await page.locator('[data-testid="save-place"]').first().click();
  assert(await page.locator('[data-testid="saved-card"]').count() === 12, 'Save limit exceeded');
  for (let index = 0; index < 3; index++) await page.locator('[data-testid="compare-place"]').nth(index).check();
  await page.locator('[data-testid="compare-place"]').nth(3).click();
  assert(!await page.locator('[data-testid="compare-place"]').nth(3).isChecked(), 'Comparison limit exceeded');
  assert(await page.locator('#comparison tbody tr').count() === 3, 'Three-row comparison');
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { blob.text().then(text => { window.__csvText = text; }); return original(blob); };
  });
  const escapedDownload = page.waitForEvent('download');
  await page.locator('#export-csv').click(); await escapedDownload;
  await page.waitForFunction(() => typeof window.__csvText === 'string');
  const csv = await page.evaluate(() => window.__csvText);
  assert(csv.includes('"\'=SUM(1;2)"'), 'CSV formula injection');
  assert(csv.includes('Район ""с кавычками"";\nвторая строка'), 'CSV quotes/newline escaping');
  await page.locator('[data-testid="saved-card"]').first().getByRole('button', { name: /Удалить/ }).click();
  assert(await page.locator('[data-testid="saved-card"]').count() === 11, 'Delete failed');
  assert(await page.locator('#comparison tbody tr').count() === 2, 'Deleted comparison persists');
  await page.evaluate(() => localStorage.removeItem('geomarketing.saved.v1'));
  await page.route('**/api/catalog', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"status":"error"}' }));
  await page.reload();
  await page.locator('#retry-catalog').waitFor({ state: 'visible' });
  assert(await page.locator('#run').isDisabled(), 'Broken catalog enables calculate');
  await page.unroute('**/api/catalog');
  await page.locator('#retry-catalog').click();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390px overflow');
  const positions = await page.evaluate(() => ['settings', 'map-card', 'recommendations'].map(id => document.getElementById(id).getBoundingClientRect()));
  assert(positions[0].bottom <= positions[1].top && positions[1].bottom <= positions[2].top, 'Mobile blocks overlap');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tests/workspace-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tests/workspace-desktop.png', fullPage: true });
  assert(errors.length === 0, errors.join('\n'));
  return { passed: ['catalog/retry', 'recommendations', 'canvas reuse', 'two-tab save/delete/sync', 'queued save context', 'refresh retains result', 'save/dedupe/reload/delete/12-limit', 'compare/3-limit', 'CSV/escaping/formulas', 'print', 'modal', 'layers', '5 businesses', 'race', 'custom', 'API error', 'tile retry', 'corrupt/blocked storage/missing locks', 'mobile'], pageErrors: errors };
}
