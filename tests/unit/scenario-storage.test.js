import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCENARIO_KEY, SCENARIO_LIMIT, validateScenario, readScenarios, mutateScenarios, clearDamagedScenarios, duplicateScenario } from '../../static/js/scenario-storage.js';

const clone = value => structuredClone(value);
const iso = '2026-10-18T10:00:00Z';
function fixture(number = 1) {
  const recommendation = { rank: 1, lat: 52.6, lng: 39.5, score: 1, residents_in_radius: 3000, radius_m: 500, competitors_in_radius: 0, nearest_competitor_m: null };
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`, name: 'Исследование', note: '', saved_at: iso, updated_at: iso,
    selection: { district: 'eleytsky', business: 'cafe', custom_point: null, area_radius_m: 1000 },
    view: { threshold: 70, selected_rank: 1, layers: { houses: true, competitors: true, centroids: false, zones: true } },
    analysis: { status: 'success', district: 'eleytsky', district_name: 'Елецкий', business: 'cafe', business_name: 'Кафе', analysis_id: 'calculation-1', source: 'cache', data_meta: { houses: { cached: true, fetched_at: 1792317600, stale: false, warning: null }, competitors: { cached: true, fetched_at: 1792317600, stale: false, warning: null } }, warning: null, notice: null, parameters: { radius_m: 500, alpha: 1.5 }, center: [52.6, 39.5], half_m: 1000, stats: { houses: 1, residents: 3000, competitors: 0 }, recommendations: [recommendation], best: clone(recommendation), houses: [{ lat: 52.6, lng: 39.5, residents: 3000 }], competitors: [], centroids: [{ lat: 52.6, lng: 39.5, residents: 3000 }], grid: { n: 60, lat_min: 52.59, lat_max: 52.61, lng_min: 39.49, lng_max: 39.51, scores: Array(3600).fill(0.5) } }
  };
}
function enriched() {
  const value = fixture();
  value.analysis.calculated_at = iso;
  value.analysis.analysis_context = { custom: false, requested_radius_m: 1000, center: [52.6, 39.5] };
  value.analysis.data_quality = { version: 1, assessed_at: iso, source: 'cache', freshness: { status: 'fresh', oldest_data_at: iso }, completeness: { status: 'needs_review', reasons: [{ code: 'no_competitors', text: 'В выборке не отмечены конкуренты' }] } };
  const explanation = { version: 1, demand_level: 'similar', competition_level: 'low', metrics: { houses_in_radius: 1, houses_per_km2: 1.27, nearest_demand_center_m: null, model_demand: 3000, competition_pressure: 0, competition_multiplier: 1 }, strengths: ['Спрос'], risks: ['OSM'], field_checks: ['Проверьте на месте'] };
  value.analysis.recommendations[0].explanation = clone(explanation);
  value.analysis.best.explanation = clone(explanation);
  return value;
}
let records;
function installLocks() {
  let queue = Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(name, callback) { assert.equal(name, `${SCENARIO_KEY}.write`); const run = queue.then(callback); queue = run.catch(() => {}); return run; } } } });
}
beforeEach(() => {
  records = new Map();
  globalThis.localStorage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
  installLocks();
});
const code = expected => error => error.code === expected;

test('roundtrip and latest-read edit/delete do not alter separate saved places', async () => {
  assert.equal(SCENARIO_KEY, 'geomarketing.scenarios.v1');
  assert.equal(SCENARIO_LIMIT, 6);
  records.set('geomarketing.saved.v1', 'keep');
  assert.deepEqual(readScenarios(), []);
  await mutateScenarios(latest => [...latest, fixture()]);
  assert.deepEqual(readScenarios(), [fixture()]);
  await mutateScenarios(latest => latest.map(item => ({ ...item, name: 'Новое', note: '<img src=x onerror=alert(1)>' })));
  assert.equal(readScenarios()[0].note, '<img src=x onerror=alert(1)>');
  await mutateScenarios(() => []);
  assert.deepEqual(readScenarios(), []);
  assert.equal(records.get('geomarketing.saved.v1'), 'keep');
});

test('duplicate receives new UUID, truncated suffix name and independent full snapshot', () => {
  const original = enriched(); original.name = 'А'.repeat(80);
  const result = duplicateScenario(original);
  assert.equal(validateScenario(result), true);
  assert.notEqual(result.id, original.id);
  assert.match(result.name, / — копия$/);
  assert.ok(result.name.length <= 80);
  assert.equal(result.analysis.calculated_at, iso);
  result.analysis.grid.scores[0] = 0;
  assert.equal(original.analysis.grid.scores[0], 0.5);
  assert.throws(() => duplicateScenario({}), code('invalid'));
});

test('valid old/new API snapshots and demo effective radius remain readable', () => {
  assert.equal(validateScenario(fixture()), true);
  assert.equal(validateScenario(enriched()), true);
  const demo = enriched(); demo.analysis.source = 'demo'; demo.analysis.half_m = 600;
  demo.analysis.data_quality.source = 'demo'; demo.analysis.data_quality.freshness.status = 'demo'; demo.analysis.data_quality.freshness.oldest_data_at = null;
  assert.equal(validateScenario(demo), true);
});

const invalidCases = {
  'missing UUID': item => { item.id = 'x'; },
  'overlong name': item => { item.name = 'x'.repeat(81); },
  'empty name': item => { item.name = ' '; },
  'overlong note': item => { item.note = 'x'.repeat(501); },
  'non ISO date': item => { item.saved_at = '10/18/2026'; },
  'impossible date': item => { item.saved_at = '2026-02-30T10:00:00Z'; },
  'object as source': item => { item.analysis.source = {}; },
  'unknown source': item => { item.analysis.source = 'verified'; },
  'NaN score': item => { item.analysis.recommendations[0].score = NaN; },
  'Infinity coordinate': item => { item.analysis.houses[0].lat = Infinity; },
  'latitude range': item => { item.analysis.center[0] = 91; },
  'longitude range': item => { item.analysis.competitors = [{ lat: 52, lng: 181 }]; },
  'negative residents': item => { item.analysis.houses[0].residents = -1; },
  'sparse array': item => { delete item.analysis.grid.scores[2]; },
  'oversized grid': item => { item.analysis.grid.scores = Array(3601).fill(0); },
  'wrong grid n': item => { item.analysis.grid.n = 61; },
  'out of range grid score': item => { item.analysis.grid.scores[10] = 1.01; },
  'inverted grid': item => { item.analysis.grid.lat_min = 53; },
  'non array houses': item => { item.analysis.houses = {}; },
  'invalid centroid': item => { item.analysis.centroids[0].residents = '3000'; },
  'too many centroids': item => { item.analysis.centroids = Array(4).fill(item.analysis.centroids[0]); },
  'too many recommendations': item => { item.analysis.recommendations = Array(4).fill(item.analysis.best); },
  'wrong rank': item => { item.view.selected_rank = 2; },
  'wrong business': item => { item.selection.business = 'other'; },
  'wrong district': item => { item.selection.district = 'other'; },
  'invalid category radius': item => { item.analysis.recommendations[0].radius_m = 600; },
  'inconsistent best': item => { item.analysis.best.lat = 51; },
  'non boolean layer': item => { item.view.layers.houses = 'true'; },
  'threshold range': item => { item.view.threshold = 100; },
  'wrong context radius': item => { item.analysis.analysis_context.requested_radius_m = 1200; },
  'wrong context center': item => { item.analysis.analysis_context.center[0] = 53; },
  'inconsistent stats': item => { item.analysis.stats.houses = 2; },
  'quality version': item => { item.analysis.data_quality.version = 2; },
  'quality source mismatch': item => { item.analysis.data_quality.source = 'osm'; },
  'quality status': item => { item.analysis.data_quality.freshness.status = 'perfect'; },
  'quality date': item => { item.analysis.data_quality.freshness.oldest_data_at = 4; },
  'quality reason type': item => { item.analysis.data_quality.completeness.reasons = ['text']; },
  'quality reason missing text': item => { item.analysis.data_quality.completeness.reasons = [{ code: 'x' }]; },
  'explanation level': item => { item.analysis.recommendations[0].explanation.demand_level = 'best'; },
  'explanation NaN': item => { item.analysis.recommendations[0].explanation.metrics.model_demand = NaN; },
  'explanation nullable wrong type': item => { item.analysis.recommendations[0].explanation.metrics.nearest_demand_center_m = '0'; },
  'explanation multiplier': item => { item.analysis.recommendations[0].explanation.metrics.competition_multiplier = 0; },
  'explanation string array': item => { item.analysis.recommendations[0].explanation.risks = [{}]; },
  'metadata invalid': item => { item.analysis.data_meta.houses.fetched_at = 'yesterday'; },
  'nested nonfinite unknown field': item => { item.analysis.extra = { nested: [Infinity] }; },
  'cycle': item => { item.analysis.extra = item; },
};
for (const [description, mutate] of Object.entries(invalidCases)) test(`deep validation rejects ${description}`, () => {
  const value = enriched(); mutate(value);
  assert.equal(validateScenario(value), false);
});

test('custom selection must agree with analysis center/context and supported bounds', () => {
  const value = enriched(); value.selection.district = value.analysis.district = 'custom'; value.selection.custom_point = [52.6, 39.5]; value.analysis.analysis_context.custom = true;
  assert.equal(validateScenario(value), true);
  value.selection.custom_point[0] = 53;
  assert.equal(validateScenario(value), false);
});

test('actual custom Flask serialization preserves encoded area key with normalized control selection', async () => {
  const value = fixture();
  value.analysis = JSON.parse(readFileSync(new URL('../fixtures/scenario-custom-api-v1.json', import.meta.url), 'utf8'));
  value.selection = { district: 'custom', business: value.analysis.business, custom_point: [...value.analysis.center], area_radius_m: value.analysis.analysis_context.requested_radius_m };
  value.view.selected_rank = 3;
  assert.equal(value.analysis.district, 'custom_52.6000_39.5000_1000');
  assert.deepEqual(value.selection.custom_point, [52.6, 39.5]);
  assert.equal(validateScenario(value), true);
  await mutateScenarios(() => [value]);
  assert.deepEqual(readScenarios(), [value]);
  const oldApi = clone(value); delete oldApi.analysis.analysis_context;
  assert.equal(validateScenario(oldApi), true);
  oldApi.analysis.district = 'custom';
  assert.equal(validateScenario(oldApi), true);
  for (const invalidKey of ['custom_52.6100_39.5000_1000', 'custom_52.6000_39.5000_500', 'custom_52.6000_39.5100_1000', 'custom_52.6000_39.5000_1000_extra']) {
    const invalid = clone(value); invalid.analysis.district = invalidKey;
    assert.equal(validateScenario(invalid), false, invalidKey);
  }
  const falseContext = clone(value); falseContext.analysis.analysis_context.custom = false;
  assert.equal(validateScenario(falseContext), false);
  const wrongSelection = clone(value); wrongSelection.selection.district = 'eleytsky'; wrongSelection.selection.custom_point = null;
  assert.equal(validateScenario(wrongSelection), false);
});

test('ISO timestamps retain Python microseconds and reject calendar/time rollovers', () => {
  const value = enriched(); value.analysis.calculated_at = '2026-10-18T10:00:00.123456+00:00';
  assert.equal(validateScenario(value), true);
  value.updated_at = '2026-10-18T24:00:00Z';
  assert.equal(validateScenario(value), false);
});

test('exact record size is accepted, next character and enlarged duplicate are rejected', async () => {
  const value = fixture(); value.analysis.padding = '';
  value.analysis.padding = 'x'.repeat(250000 - JSON.stringify(value).length);
  assert.equal(JSON.stringify(value).length, 250000);
  assert.equal(validateScenario(value), true);
  await mutateScenarios(() => [value]);
  assert.throws(() => duplicateScenario(value), code('size'));
  value.analysis.padding += 'x';
  assert.equal(validateScenario(value), false);
  await assert.rejects(mutateScenarios(() => [value]), code('size'));
  assert.equal(readScenarios()[0].analysis.padding.length, value.analysis.padding.length - 1);
});

test('deep nested and huge arrays are invalid before rendering, without changing storage', async () => {
  const value = fixture(); let current = value.analysis;
  for (let index = 0; index < 35; index++) { current.extra = {}; current = current.extra; }
  assert.equal(validateScenario(value), false);
  const huge = fixture(); huge.analysis.houses = Array(10001).fill({ lat: 52.6, lng: 39.5, residents: 1 });
  assert.equal(validateScenario(huge), false);
  await assert.rejects(mutateScenarios(() => [value]), code('invalid'));
  assert.equal(records.has(SCENARIO_KEY), false);
});

test('six record limit, duplicate IDs, record size and envelope size never overwrite', async () => {
  await mutateScenarios(() => Array.from({ length: 6 }, (_, i) => fixture(i + 1)));
  const previous = records.get(SCENARIO_KEY);
  await assert.rejects(mutateScenarios(latest => [...latest, fixture(7)]), code('limit'));
  await assert.rejects(mutateScenarios(() => [fixture(), fixture()]), code('invalid'));
  const huge = fixture(); huge.analysis.extra = 'x'.repeat(250000);
  await assert.rejects(mutateScenarios(() => [huge]), code('size'));
  assert.equal(records.get(SCENARIO_KEY), previous);
  const big = Array.from({ length: 6 }, (_, i) => { const value = fixture(i + 1); value.analysis.extra = 'x'.repeat(220000); return value; });
  await assert.rejects(mutateScenarios(() => big), code('size'));
  assert.equal(records.get(SCENARIO_KEY), previous);
});

test('quota and blocked reads preserve original raw value and report unavailable', async () => {
  await mutateScenarios(() => [fixture()]); const previous = records.get(SCENARIO_KEY);
  globalThis.localStorage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  await assert.rejects(mutateScenarios(latest => [...latest, fixture(2)]), code('unavailable'));
  assert.equal(records.get(SCENARIO_KEY), previous);
  globalThis.localStorage.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
  assert.throws(readScenarios, code('unavailable'));
});

test('corrupt JSON, bad envelope, version and oversize retain original raw and block writes', async () => {
  for (const [raw, expected] of [['{bad', 'invalid'], ['[]', 'invalid'], ['{"schema_version":2,"scenarios":[]}', 'unsupported'], [JSON.stringify({ schema_version: 1, scenarios: [fixture(), fixture()] }), 'invalid'], ['x'.repeat(1250001), 'invalid']]) {
    records.set(SCENARIO_KEY, raw);
    assert.throws(readScenarios, error => error.code === expected && error.raw === raw);
    await assert.rejects(mutateScenarios(() => []), code(expected));
    assert.equal(records.get(SCENARIO_KEY), raw);
  }
});

test('without locks reading works and writes/repair are disabled', async () => {
  await mutateScenarios(() => [fixture()]);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  assert.equal(readScenarios().length, 1);
  await assert.rejects(mutateScenarios(() => []), code('no_locks'));
  await assert.rejects(clearDamagedScenarios('bad'), code('no_locks'));
  assert.equal(readScenarios().length, 1);
});

test('two concurrent writers see most recent persisted records', async () => {
  await Promise.all([mutateScenarios(latest => [...latest, fixture(1)]), mutateScenarios(latest => [...latest, fixture(2)])]);
  assert.deepEqual(readScenarios().map(item => item.id), [fixture(1).id, fixture(2).id]);
});

test('repair only removes exact still damaged raw under lock and preserves good/changed data', async () => {
  records.set(SCENARIO_KEY, '{broken');
  await clearDamagedScenarios('{broken'); assert.equal(records.has(SCENARIO_KEY), false);
  await mutateScenarios(() => [fixture()]); const good = records.get(SCENARIO_KEY);
  await assert.rejects(clearDamagedScenarios(good), code('conflict'));
  assert.equal(records.get(SCENARIO_KEY), good);
  records.set(SCENARIO_KEY, '{new broken');
  await assert.rejects(clearDamagedScenarios('{old broken'), code('conflict'));
  assert.equal(records.get(SCENARIO_KEY), '{new broken');
  records.set(SCENARIO_KEY, '{"schema_version":2,"scenarios":[]}');
  await clearDamagedScenarios(records.get(SCENARIO_KEY)); assert.equal(records.has(SCENARIO_KEY), false);
});

test('repair queued behind a save cannot delete another writer’s valid replacement', async () => {
  records.set(SCENARIO_KEY, '{broken');
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  let call = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { async request(name, callback) { if (++call === 1) await barrier; return callback(); } } } });
  const repairing = clearDamagedScenarios('{broken');
  records.set(SCENARIO_KEY, JSON.stringify({ schema_version: 1, scenarios: [fixture()] }));
  release();
  await assert.rejects(repairing, code('conflict'));
  assert.equal(readScenarios().length, 1);
});

test('mutation rejects async/invalid callbacks and lock/removal failures preserve raw', async () => {
  await mutateScenarios(() => [fixture()]); const good = records.get(SCENARIO_KEY);
  await assert.rejects(mutateScenarios(async () => []), code('invalid'));
  assert.equal(records.get(SCENARIO_KEY), good);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request() { throw new DOMException('denied', 'SecurityError'); } } } });
  await assert.rejects(mutateScenarios(() => []), code('unavailable'));
  installLocks(); records.set(SCENARIO_KEY, '{broken');
  globalThis.localStorage.removeItem = () => { throw new DOMException('denied', 'SecurityError'); };
  await assert.rejects(clearDamagedScenarios('{broken'), code('unavailable'));
  assert.equal(records.get(SCENARIO_KEY), '{broken');
});
