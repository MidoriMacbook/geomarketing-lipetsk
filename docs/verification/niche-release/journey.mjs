import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, webkit } from '@playwright/test';

const url = new URL(process.argv[2]).origin;
const selection = process.argv[3] || 'all';
const artifact = resolve('tests/artifacts/niche-release-browser');
const variantFile = resolve('tests/artifacts/niche-release-preview/active-variant.txt');
const daily = process.env.RELEASE_EXPECTED_VERSION;
const candidate = process.env.RELEASE_EXPECTED_HEAD || '6a51da3d34b55f75406a69e4fbea95046be3a80e';
const rollback = '48814bd5cad27a5362f7d674f11f8e7234ff1d77';
const initialNote = 'Проверить вход и вывеску рядом с запасной точкой.';
const revisedNote = 'Заметка отредактирована в версии для отката.';
const results = [];
const timeout = 38_000;
const alternative = place => place.role === 'alternative';
const raw = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), 'geomarketing.scenarios.v1');
const app = page => page.evaluate(async () => {
  const { state } = await import('/static/js/state.js');
  return { data: state.current, rank: state.selectedRank, opened: state.openedScenarioId };
});
const research = (page, title) => page.getByTestId('scenario-card').filter({ hasText: title });

function competitionPressure(data, place, weight) {
  const longitudeScale = 111000 * Math.cos(data.center[0] * Math.PI / 180);
  const radius = 0.8 * data.parameters.radius_m;
  const components = { networks: 0, other: 0 };
  for (const competitor of data.competitors) {
    const distance = Math.hypot((competitor.lat - place.lat) * 111000, (competitor.lng - place.lng) * longitudeScale);
    const contribution = Math.exp(-((distance / radius) ** 2));
    if (competitor.is_chain) components.networks += contribution * weight;
    else components.other += contribution;
  }
  return components;
}

async function receipt(page, sha, variant) {
  const result = await page.request.get(url + '/__release_probe', { timeout });
  assert.equal(result.status(), 200);
  const found = await result.json();
  assert.equal(found.code.sha, sha);
  assert.equal(found.variant, variant);
  if (daily) assert.equal(found.data.version, daily);
  return found;
}

async function documentReady(page) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  assert.equal(response.status(), 200);
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success', { timeout });
  await expect.poll(() => page.evaluate(() => Boolean(window.releaseLeafletMap)), { timeout }).toBe(true);
}

async function setup(page) {
  // Observe viewport and calculate a safe tap coordinate without altering served files or responses.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'L', { configurable: true, set(leaflet) {
      delete window.L;
      window.L = leaflet;
      queueMicrotask(() => {
        const original = leaflet.map;
        leaflet.map = function (...args) {
          const map = original.apply(this, args);
          if (map.getContainer().id === 'map') {
            window.releaseLeafletMap = map;
            map.on('click', ({ latlng, containerPoint }) => { window.releaseLastMapClick = { latlng, containerPoint }; });
          }
          return map;
        };
      });
    } });
  });
}

function keyPlace(place) {
  return [place.lat, place.lng, place.role || 'primary'];
}

async function field(page, name, value) {
  const select = page.locator(`#${name}`);
  if (await select.inputValue() === value) return;
  const trigger = page.locator(`#${name}-trigger`);
  await expect(trigger).toBeVisible();
  const label = await select.locator(`option[value="${value}"]`).textContent();
  await trigger.click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(select).toHaveValue(value);
}

async function calculate(page, mobile, district, business) {
  if (mobile) await page.locator('#mobile-settings-open').tap();
  await field(page, 'district', district);
  await field(page, 'business', business);
  const run = page.locator('#run');
  if (mobile) await run.tap();
  else await run.click();
  await expect.poll(async () => {
    const { data } = await app(page);
    return [data?.district, data?.business];
  }, { timeout }).toEqual([district, business]);
  return (await app(page)).data;
}

async function api(page, district, business, query = '') {
  const response = await page.request.get(`${url}/api/calculate?district=${district}&type=${business}${query}`, { timeout });
  assert.equal(response.status(), 200);
  return response.json();
}

async function openFoldFor(page, target) {
  const wrap = page.locator('.mobile-secondary-details').filter({ has: target });
  if (await wrap.count() && await wrap.getAttribute('open') === null) {
    await wrap.locator(':scope > summary').click();
  }
}

function verifiedPairs(data) {
  assert.ok(data.recommendations.some(alternative));
  const lngScale = 111000 * Math.cos(data.center[0] * Math.PI / 180);
  const distance = (a, b) => Math.hypot((a.lat - b.lat) * 111000, (a.lng - b.lng) * lngScale);
  assert.ok(data.houses?.length > 0);
  const pairs = [];
  const houses = data.houses.map(row => Array.isArray(row) ? { lat: row[0], lng: row[1], residents: row[2] } : row);
  for (const [j, second] of data.recommendations.entries()) {
    const secondHouses = houses.filter(house => distance(house, second) <= second.radius_m);
    const residentSum = rows => rows.reduce((sum, house) => sum + house.residents, 0);
    assert.equal(residentSum(secondHouses), second.residents_in_radius);
    if (!alternative(second)) continue;
    for (const first of data.recommendations.slice(0, j)) {
      const separation = distance(first, second);
      const denominator = Math.min(first.residents_in_radius, second.residents_in_radius);
      const sharedResidents = residentSum(secondHouses.filter(house => distance(house, first) <= first.radius_m));
      const overlap = denominator === 0 ? null : sharedResidents / denominator;
      assert.ok(separation >= 0.8 * second.radius_m);
      assert.ok(sharedResidents <= 0.6 * denominator);
      if (first.rank === second.alternative_comparison.rank) {
        assert.ok(Math.abs(second.alternative_comparison.distance_m - separation) < 0.0001);
        assert.equal(second.alternative_comparison.shared_residents_fraction, overlap);
      }
      pairs.push({ ranks: [first.rank, second.rank], distance_m: separation, sharedResidents, denominator, overlap });
    }
  }
  return pairs;
}

const map = page => page.locator('#map');
const popup = page => map(page).locator('.map-inspection');
const pin = (page, rank) => map(page).locator('[role="button"]').filter({
  has: page.locator('.recommendation-pin', { hasText: new RegExp(`^${rank}$`) }),
});
const mapCenter = page => page.evaluate(() => {
  const map = window.releaseLeafletMap;
  const { lat, lng } = map.getCenter();
  return [lat, lng, map.getZoom()];
});

async function focusMap(page) {
  await map(page).evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  if (await page.locator('#recommendations').getAttribute('data-moving') === 'true') {
    await expect(page.locator('#recommendations')).not.toHaveAttribute('data-moving', 'true');
  }
}

async function openPin(page, rank, mobile) {
  await focusMap(page);
  const control = pin(page, rank);
  if (mobile) await control.tap();
  else await control.click();
  await expect(popup(page)).toBeVisible();
  await expect.poll(async () => (await app(page)).rank).toBe(rank);
}

async function saveInPopup(page) {
  await popup(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(popup(page).getByRole('status')).toContainText('Сохранено');
  await popup(page).getByRole('button', { name: 'Закрыть выноску' }).click();
  await expect(popup(page)).toHaveCount(0);
}

async function unobstructedTap(page, place, data) {
  return map(page).evaluate((element, { lat, lng, center, half }) => {
    const map = window.releaseLeafletMap;
    const rect = element.getBoundingClientRect();
    const seen = {};
    for (const scale of [1, 2, 3, 4, 5]) {
      for (const [dy, dx] of [[.0011, .0019], [.0012, -.0019], [-.0012, .0017], [-.0014, -.0018], [.0024, 0], [-.0024, 0], [0, .003], [0, -.003]]) {
        const point = [lat + dy * scale, lng + dx * scale];
        const metres = Math.hypot((point[0] - center[0]) * 111000, (point[1] - center[1]) * 111000 * Math.cos(center[0] * Math.PI / 180));
        if (metres > half - 45) continue;
        const { x, y } = map.latLngToContainerPoint(point);
        const target = document.elementFromPoint(rect.left + x, rect.top + y);
        const name = target?.getAttribute('class') || 'sans classe';
        seen[name] = (seen[name] ?? 0) + 1;
        if (x > 18 && x < rect.width - 18 && y > 18 && y < rect.height - 18 && element.contains(target)
          && !target.closest('.leaflet-marker-icon,.leaflet-control,.leaflet-popup,.leaflet-interactive,.map-inspection')) {
          return { x: rect.left + x, y: rect.top + y, point: map.containerPointToLatLng([x, y]) };
        }
      }
    }
    throw new Error('Нет свободной точки возле места ' + JSON.stringify({ center, lat, lng, half, zoom: map.getZoom(), seen }));
  }, { lat: place.lat, lng: place.lng, center: data.center, half: data.half_m });
}

async function saveResearch(page, title, note) {
  await page.locator('#scenario-save').click();
  await page.locator('#scenario-name').fill(title);
  await page.locator('#scenario-note').fill(note);
  await page.locator('#scenario-submit').click();
  const record = research(page, title);
  await openFoldFor(page, record);
  await expect(record).toContainText(note);
  return (await raw(page)).scenarios.find(row => row.name === title);
}

async function reopen(page, title, note) {
  const record = research(page, title);
  await openFoldFor(page, record);
  await expect(record).toContainText(note);
  await record.getByTestId('scenario-open').click();
  await expect(page.locator('#scenario-snapshot-notice')).toBeVisible();
  return record;
}

async function optionalScreens(page, tag, stage) {
  if (tag === 'webkit-390' || tag === 'chromium-1440') {
    await page.screenshot({ path: resolve(artifact, `${tag}-${stage}.png`), animations: 'disabled' });
  }
}

async function journey(page, tag, mobile) {
  const checkpoints = [];
  const mark = name => { checkpoints.push(name); console.log(`${tag} ${name}`); };
  const observed = [];
  page.on('response', async response => {
    const where = new URL(response.url());
    if (where.pathname === '/api/calculate' && response.request().method() === 'POST') {
      observed.push({ status: response.status(), sent: response.request().postDataJSON() });
    }
  });
  const probe = await receipt(page, candidate, 'candidate');
  await documentReady(page);
  const district = 'center', business = 'grocery';
  const full = await calculate(page, mobile, district, business);
  assert.equal(full.data_delivery.version, probe.data.version);
  assert.equal(full.network_competition.weight, 1);
  assert.equal(full.network_competition.eligible, true);
  await expect(page.locator('#network-setting')).toBeVisible();
  const ordinary = await api(page, district, business);
  assert.deepEqual(full.grid, ordinary.grid);
  assert.deepEqual(full.recommendations.filter(place => !alternative(place)), ordinary.recommendations);
  assert.ok(!ordinary.network_competition && !ordinary.data_reliability);
  mark('полный вес и обычный API');
  const weights = [];
  const select = page.locator('#network-weight');
  for (const weight of [1, 0.5, 0]) {
    if (weight !== 1) await select.selectOption(String(weight));
    await expect.poll(async () => (await app(page)).data.network_competition.weight, { timeout }).toBe(weight);
    const { data } = await app(page);
    await expect(page.locator('.competitor-marker.is-chain').first()).toBeAttached();
    const pins = await page.locator('.competitor-marker.is-chain').count();
    assert.deepEqual(data.data_reliability, full.data_reliability);
    for (const place of data.recommendations) {
      const pressure = competitionPressure(data, place, weight);
      assert.ok(Math.abs(pressure.networks + pressure.other - place.explanation.metrics.competition_pressure) < 1e-9);
    }
    weights.push({ weight, pins, meta: data.network_competition, grid: data.grid, recommendations: data.recommendations,
      pressureAtFullWeightBest: competitionPressure(data, full.recommendations[0], weight) });
  }
  assert.equal(weights[0].pins, weights[1].pins);
  assert.equal(weights[1].pins, weights[2].pins);
  assert.notDeepEqual(weights[0].grid, weights[1].grid);
  assert.notDeepEqual(weights[1].grid, weights[2].grid);
  assert.equal(weights[1].pressureAtFullWeightBest.networks, weights[0].pressureAtFullWeightBest.networks / 2);
  assert.equal(weights[2].pressureAtFullWeightBest.networks, 0);
  assert.equal(weights[1].pressureAtFullWeightBest.other, weights[0].pressureAtFullWeightBest.other);
  assert.equal(weights[2].pressureAtFullWeightBest.other, weights[0].pressureAtFullWeightBest.other);
  mark('веса 1, 0,5 и 0 и сохранение маркеров');
  await select.selectOption('0.5');
  await expect.poll(async () => (await app(page)).data.network_competition.weight, { timeout }).toBe(0.5);
  let before = (await app(page)).data;
  let scenario = [district, business];
  if (!before.recommendations.some(alternative)) {
    before = await calculate(page, mobile, 'center', 'cafe');
    scenario = ['center', 'cafe'];
  }
  assert.ok(before.recommendations.some(alternative));
  const first = before.recommendations[0];
  await openPin(page, first.rank, mobile);
  await expect(popup(page)).toContainText('Надёжность данных');
  if (mobile) await expect(map(page).locator('.map-inspection-popup.map-inspection-docked')).toBeVisible();
  const center = await mapCenter(page);
  const intake = await app(page);
  const corrections = popup(page).getByRole('button', { name: 'Мои поправки' });
  if (mobile) await corrections.tap();
  else await corrections.click();
  await expect(popup(page)).toHaveCount(0);
  await expect(page.locator('#corrections-controls')).toBeVisible();
  await expect.poll(async () => (await app(page)).data.correction_context?.counts?.added, { timeout }).toBe(0);
  const inMode = await app(page);
  assert.deepEqual(await mapCenter(page), center);
  assert.deepEqual(keyPlace(inMode.data.recommendations.find(place => place.rank === inMode.rank)), keyPlace(intake.data.recommendations.find(place => place.rank === intake.rank)));
  assert.deepEqual([inMode.data.district, inMode.data.business], scenario);
  assert.deepEqual(inMode.data.data_reliability, before.data_reliability);
  mark('из выноски в поправки, выбранное место и положение карты сохранены');
  await focusMap(page);
  if (mobile) {
    // Frame the target circle after separately verifying that opening the mode preserved the original viewport.
    await page.evaluate(center => {
      const leaflet = window.releaseLeafletMap;
      leaflet.setView(center, 14, { animate: false });
    }, before.center);
  }
  const editedViewport = await mapCenter(page);
  const position = await unobstructedTap(page, first, before);
  if (mobile) await page.touchscreen.tap(position.x, position.y);
  else await page.mouse.click(position.x, position.y);
  if (await page.locator('#correction-status').textContent() === 'Добавьте конкурента внутри области расчёта.') {
    throw new Error('Тап вне круга: ' + JSON.stringify({ position, received: await page.evaluate(() => window.releaseLastMapClick), editedViewport }));
  }
  await expect(page.locator('#correction-status')).toHaveText('Расчёт обновлён.', { timeout });
  const corrected = (await app(page)).data;
  assert.deepEqual(corrected.data_reliability, before.data_reliability);
  assert.equal(corrected.network_competition.weight, before.network_competition.weight);
  assert.equal(corrected.correction_context.counts.added, 1);
  assert.notDeepEqual(corrected.grid, before.grid);
  assert.deepEqual(await mapCenter(page), editedViewport);
  const changed = observed.find(result => result.sent.corrections.added.length === 1);
  assert.equal(changed.status, 200);
  assert.equal(changed.sent.include_alternatives, '1');
  assert.equal(changed.sent.network_weight, String(before.network_competition.weight));
  assert.equal(changed.sent.data_reliability, '1');
  await page.locator('#correction-done').click();
  await expect(page.locator('#corrections-controls')).toBeHidden();
  assert.deepEqual(await mapCenter(page), editedViewport);
  mark('одна ручная поправка, пересчёт и выход');
  const backup = corrected.recommendations.find(alternative);
  const primary = corrected.recommendations[0];
  assert.ok(backup && corrected.recommendations.length <= 3);
  const pairs = verifiedPairs(corrected);
  await openPin(page, primary.rank, mobile);
  await saveInPopup(page);
  await openPin(page, backup.rank, mobile);
  await expect(pin(page, backup.rank).locator('.recommendation-pin')).toHaveClass(/is-alternative/);
  await expect(popup(page)).toHaveAttribute('data-place-role', 'alternative');
  await expect(popup(page)).toContainText('Запасной вариант');
  await expect(popup(page)).toContainText('Надёжность данных');
  await optionalScreens(page, tag, 'alternative');
  await saveInPopup(page);
  const saved = page.locator('#saved-section');
  await openFoldFor(page, saved);
  const checks = saved.getByTestId('compare-place');
  assert.equal(await checks.count(), 2);
  for (const control of await checks.all()) if (!await control.isChecked()) await control.locator('..').click();
  const comparison = page.locator('#comparison');
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText('Запасной вариант');
  await expect(comparison).toContainText(/место 1/i);
  await page.locator('#comparison-title').evaluate(title => {
    const header = document.getElementById('site-header').getBoundingClientRect();
    scrollBy({ top: title.getBoundingClientRect().top - header.bottom - 18, behavior: 'instant' });
  });
  await optionalScreens(page, tag, 'comparison');
  await page.locator('#comparison-map-link').scrollIntoViewIfNeeded();
  await page.locator('#comparison-map-link').click();
  await expect.poll(async () => (await app(page)).rank).toBe(backup.rank);
  await expect(pin(page, backup.rank).locator('.recommendation-pin')).toHaveClass(/is-selected/);
  mark('запасной пин, два сохранённых места, сравнение и возврат');
  const title = `Приёмка · ${tag}`;
  const archived = await saveResearch(page, title, initialNote);
  assert.deepEqual(archived.analysis, corrected);
  assert.equal(archived.view.selected_rank, backup.rank);
  await page.reload({ waitUntil: 'commit', timeout });
  await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success', { timeout });
  await reopen(page, title, initialNote);
  const restored = await app(page);
  assert.equal(restored.opened, archived.id);
  assert.equal(restored.rank, backup.rank);
  assert.deepEqual(restored.data, corrected);
  await expect(select).toHaveValue(String(corrected.network_competition.weight));
  await expect(pin(page, backup.rank).locator('.recommendation-pin')).toHaveClass(/is-alternative/);
  await expect(page.locator('#correction-count')).toContainText('Добавлено вручную: 1');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  mark('снимок, заметка и состояние восстановлены после перезагрузки');
  const states = weights.map(({ grid, recommendations, ...rest }) => ({ ...rest,
    changedCellsFromFull: grid.scores.filter((score, index) => weights[0].grid.scores[index] !== score).length,
    places: recommendations.map(({ rank, role, score, lat, lng }) => ({ rank, role: role || 'primary', score, lat, lng })) }));
  const entry = { tag, secureContext: await page.evaluate(() => isSecureContext), receipt: probe, checkpoints,
    networkScenario: [district, business], weights: states, correctionAndArchiveScenario: scenario,
    reliability: corrected.data_reliability, viewportBeforeCorrections: center, viewportAtCorrection: editedViewport,
    viewportPreparation: mobile ? 'после проверки входа подготовлен кадр круга на масштабе 14 через Leaflet, затем выполнен тап' : 'прокрутка страницы к карте',
    correction: corrected.correction_context.applied,
    places: corrected.recommendations, pairs, selectedRank: backup.rank, note: initialNote };
  return { entry, archived, title, backup };
}

async function rollbackCycle(page, { entry, archived, title, backup }, tag) {
  try {
    await writeFile(variantFile, 'rollback\n');
    const oldProbe = await receipt(page, rollback, 'rollback');
    await documentReady(page);
    assert.equal((await app(page)).data.data_delivery.version, entry.receipt.data.version);
    const oldTitle = `Старый архив · ${tag}`;
    await saveResearch(page, oldTitle, 'Заметка из версии для отката.');
    await reopen(page, oldTitle, 'Заметка из версии для отката.');
    const record = await reopen(page, title, initialNote);
    const oldView = await app(page);
    assert.deepEqual(oldView.data, archived.analysis);
    const original = (await raw(page)).scenarios.find(row => row.id === archived.id);
    assert.deepEqual(original, archived);
    const unsupported = {
      networkControls: await page.locator('#network-setting').count() === 0,
      reliabilityBadge: await page.locator('.data-reliability').count() === 0,
      alternativePinRole: await page.locator('.recommendation-pin.is-alternative').count() === 0,
      alternativeArchiveLabel: !(await record.textContent()).includes('Запасной вариант'),
    };
    await optionalScreens(page, tag, 'rollback');
    await record.getByTestId('scenario-edit').click();
    await page.locator('#scenario-note').fill(revisedNote);
    await page.locator('#scenario-submit').click();
    await expect(record).toContainText(revisedNote);
    const reedited = (await raw(page)).scenarios.find(row => row.id === archived.id);
    assert.deepEqual(reedited.analysis, archived.analysis);
    assert.deepEqual(reedited.view, archived.view);

    await writeFile(variantFile, 'candidate\n');
    await receipt(page, candidate, 'candidate');
    await documentReady(page);
    await reopen(page, oldTitle, 'Заметка из версии для отката.');
    const legacy = (await app(page)).data;
    assert.ok(!legacy.data_reliability);
    await expect(page.locator('.data-reliability').first()).toContainText('нет сведений');
    const currentAlt = await api(page, legacy.district, legacy.business, '&include_alternatives=1');
    assert.ok(currentAlt.recommendations.some(alternative));
    const legacyRequest = page.waitForResponse(response => new URL(response.url()).pathname === '/api/calculate'
      && response.request().method() === 'POST');
    await page.locator('#corrections-toggle').click();
    const request = await legacyRequest;
    assert.equal(request.status(), 200);
    assert.ok(!request.request().postDataJSON().include_alternatives);
    await expect.poll(async () => (await app(page)).data.correction_context?.counts?.added, { timeout }).toBe(0);
    const viewingLegacy = (await app(page)).data;
    assert.deepEqual(viewingLegacy.recommendations.map(keyPlace), legacy.recommendations.map(keyPlace));
    assert.ok(!viewingLegacy.data_reliability);
    await page.locator('#correction-done').click();
    await reopen(page, title, revisedNote);
    const reopened = await app(page);
    assert.deepEqual(reopened.data, archived.analysis);
    assert.equal(reopened.rank, backup.rank);
    await expect(page.locator('#network-weight')).toHaveValue(String(archived.analysis.network_competition.weight));
    await expect(pin(page, backup.rank).locator('.recommendation-pin')).toHaveClass(/is-alternative/);
    entry.rollback = { oldProbe, sameOrigin: new URL(page.url()).origin === url, unsupported, editedNote: revisedNote,
      oldResearchOpenedOnCandidate: true, oldResearchKeptPlacesEnteringCorrections: true,
      oldResearchLiveWouldHaveAlternatives: currentAlt.recommendations.filter(alternative).length, newResearchRestored: true };
    await optionalScreens(page, tag, 'after-rollback');
  } finally {
    await writeFile(variantFile, 'candidate\n');
  }
}

await mkdir(artifact, { recursive: true });
const matrix = [['chromium', 375, 812], ['chromium', 390, 844], ['webkit', 375, 812], ['webkit', 390, 844], ['chromium', 1440, 900]];
for (const [engine, width, height] of matrix) {
  const tag = `${engine}-${width}`;
  if (selection !== 'all' && !selection.split(',').includes(tag)) continue;
  const mobile = width < 600;
  const runner = engine === 'chromium' ? chromium : webkit;
  const browser = await runner.launch(engine === 'chromium' ? { channel: 'chrome' } : {});
  const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile,
    reducedMotion: 'reduce', serviceWorkers: 'block', ignoreHTTPSErrors: process.env.RELEASE_LOCAL_CERT === '1' });
  page.setDefaultTimeout(12_000);
  page.on('pageerror', error => console.error(`${tag} pageerror`, error));
  page.on('response', async response => {
    if (new URL(response.url()).origin === url && response.status() >= 500) {
      console.error(`${tag} HTTP ${response.status()} ${new URL(response.url()).pathname}`,
        (await response.text().catch(() => '')).slice(0, 280));
    }
  });
  try {
    await setup(page);
    const state = await journey(page, tag, mobile);
    if (process.env.RELEASE_RUN_ROLLBACK === '1' && ['chromium-1440', 'webkit-390'].includes(tag)) {
      await rollbackCycle(page, state, tag);
    }
    results.push(state.entry);
    await writeFile(resolve(artifact, `${tag}-result.json`), JSON.stringify(state.entry, null, 2) + '\n');
  } catch (error) {
    await page.screenshot({ path: resolve(artifact, `${tag}-failure.png`), animations: 'disabled', timeout: 3500 }).catch(() => {});
    console.error(`${tag} failure at ${page.url()}`);
    throw error;
  } finally {
    await browser.close();
  }
}
console.log(JSON.stringify(results.map(({ tag, secureContext, checkpoints, pairs, rollback }) => ({ tag, secureContext, checkpoints, pairs, rollback: Boolean(rollback) }))));
