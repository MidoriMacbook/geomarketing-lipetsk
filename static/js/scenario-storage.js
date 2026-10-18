// This module has no UI dependencies: stored snapshots are untrusted domain input.
export const SCENARIO_KEY = 'geomarketing.scenarios.v1';
export const SCENARIO_LIMIT = 6;
const RECORD_SIZE = 250000;
const KEY_SIZE = 1250000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value, max = 2000) => typeof value === 'string' && value.length <= max;
const label = (value, max = 256) => text(value, max) && value.trim().length > 0;
const number = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isFinite(value) && value >= min && value <= max;
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const lat = value => number(value, -90, 90);
const lng = value => number(value, -180, 180);
const point = value => Array.isArray(value) && value.length === 2 && lat(value[0]) && lng(value[1]);
const location = value => object(value) && lat(value.lat) && lng(value.lng);
const nullableText = value => value === null || text(value, 10000);
const distance = value => value === null || number(value);
const source = value => ['osm', 'cache', 'demo'].includes(value);
const list = (value, max, predicate) => Array.isArray(value) && value.length <= max && Array.from(value).every(predicate);

function iso(value) {
  if (!text(value, 40) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate() && Number(value.slice(11, 13)) <= 23 && Number(value.slice(14, 16)) <= 59 && Number(value.slice(17, 19)) <= 59;
}

// JSON.stringify would silently turn NaN into null and omit undefined/functions.
// Check the original value too, with bounded traversal and no sparse arrays.
function jsonTree(value, depth = 0, budget = { remaining: 30000 }) {
  if (depth > 30 || --budget.remaining < 0) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 10000 && Array.from(value).every(entry => jsonTree(entry, depth + 1, budget));
  return object(value) && Object.keys(value).every(key => jsonTree(value[key], depth + 1, budget));
}

function equal(left, right) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => own(right, key) && equal(left[key], right[key]));
}

function validExplanation(value) {
  if (!object(value) || value.version !== 1 || !['higher', 'similar', 'lower', 'unknown'].includes(value.demand_level) || !['low', 'moderate', 'high'].includes(value.competition_level)) return false;
  const metrics = value.metrics;
  return object(metrics) && integer(metrics.houses_in_radius) && number(metrics.houses_per_km2) && distance(metrics.nearest_demand_center_m) && number(metrics.model_demand) && number(metrics.competition_pressure) && number(metrics.competition_multiplier, 1) && ['strengths', 'risks', 'field_checks'].every(key => list(value[key], 32, entry => label(entry, 2000)));
}

function validQuality(value, analysisSource) {
  if (!object(value) || value.version !== 1 || !iso(value.assessed_at) || value.source !== analysisSource || !source(value.source)) return false;
  const freshness = value.freshness, completeness = value.completeness;
  return object(freshness) && ['fresh', 'recent', 'stale', 'unknown', 'demo'].includes(freshness.status) && (freshness.oldest_data_at === null || iso(freshness.oldest_data_at)) && (analysisSource === 'demo' ? freshness.status === 'demo' : freshness.status !== 'demo') && object(completeness) && ['limited', 'needs_review', 'usable_for_model'].includes(completeness.status) && list(completeness.reasons, 64, reason => object(reason) && label(reason.code, 128) && label(reason.text, 2000));
}

function validMetadata(value) {
  return object(value) && Object.entries(value).every(([key, entry]) => ['houses', 'competitors'].includes(key) && object(entry) && typeof entry.cached === 'boolean' && number(entry.fetched_at) && typeof entry.stale === 'boolean' && nullableText(entry.warning));
}

function validRecommendation(value, radius, rank) {
  return location(value) && value.rank === rank && number(value.score, 0, 1) && integer(value.residents_in_radius) && value.radius_m === radius && integer(value.competitors_in_radius) && distance(value.nearest_competitor_m) && (!own(value, 'explanation') || validExplanation(value.explanation));
}

function validAnalysis(value, selection, view) {
  if (!object(value) || value.status !== 'success' || !label(value.analysis_id, 128) || !label(value.district, 128) || !label(value.district_name, 512) || !label(value.business, 128) || !label(value.business_name, 512) || value.business !== selection.business || !source(value.source) || !validMetadata(value.data_meta) || !nullableText(value.warning) || !nullableText(value.notice)) return false;
  if (!object(value.parameters) || !number(value.parameters.radius_m, 1, 100000) || !number(value.parameters.alpha, Number.MIN_VALUE, 100000) || !point(value.center) || !integer(value.half_m, 500, 1500)) return false;
  // The custom control is named "custom", while the API preserves its rounded
  // center and requested radius in an encoded area/cache key. Retain that key.
  if (selection.district === 'custom') {
    const encoded = `custom_${value.center[0].toFixed(4)}_${value.center[1].toFixed(4)}_${selection.area_radius_m}`;
    if (value.district !== 'custom' && (value.district !== encoded || !value.center.every(coordinate => coordinate === Number(coordinate.toFixed(4))))) return false;
  } else if (value.district !== selection.district) return false;
  if (!list(value.houses, 10000, house => location(house) && integer(house.residents)) || !list(value.competitors, 10000, location) || !list(value.centroids, 3, center => location(center) && integer(center.residents))) return false;
  if (!object(value.stats) || !integer(value.stats.houses) || value.stats.houses !== value.houses.length || !integer(value.stats.competitors) || value.stats.competitors !== value.competitors.length || !integer(value.stats.residents) || value.stats.residents !== value.houses.reduce((sum, house) => sum + house.residents, 0)) return false;
  if (!Array.isArray(value.recommendations) || value.recommendations.length < 1 || value.recommendations.length > 3 || !value.recommendations.every((entry, index) => validRecommendation(entry, value.parameters.radius_m, index + 1) && entry.competitors_in_radius <= value.stats.competitors && entry.residents_in_radius <= value.stats.residents && (value.stats.competitors > 0 || entry.nearest_competitor_m === null)) || !equal(value.best, value.recommendations[0]) || !value.recommendations.some(entry => entry.rank === view.selected_rank)) return false;
  const grid = value.grid;
  if (!object(grid) || grid.n !== 60 || !lat(grid.lat_min) || !lat(grid.lat_max) || grid.lat_min >= grid.lat_max || !lng(grid.lng_min) || !lng(grid.lng_max) || grid.lng_min >= grid.lng_max || !Array.isArray(grid.scores) || grid.scores.length !== 3600 || !grid.scores.every(score => number(score, 0, 1))) return false;
  if (value.center[0] < grid.lat_min || value.center[0] > grid.lat_max || value.center[1] < grid.lng_min || value.center[1] > grid.lng_max) return false;
  if (own(value, 'calculated_at') && !iso(value.calculated_at)) return false;
  if (own(value, 'data_quality') && !validQuality(value.data_quality, value.source)) return false;
  if (own(value, 'analysis_context')) {
    const context = value.analysis_context;
    if (!object(context) || typeof context.custom !== 'boolean' || context.custom !== (selection.district === 'custom') || context.requested_radius_m !== selection.area_radius_m || !equal(context.center, value.center)) return false;
  }
  if (value.source !== 'demo' && value.half_m !== selection.area_radius_m) return false;
  return selection.district !== 'custom' || equal(selection.custom_point, value.center);
}

function validRecord(item) {
  if (!object(item) || !text(item.id, 36) || !UUID.test(item.id) || !label(item.name, 80) || !text(item.note, 500) || !iso(item.saved_at) || !iso(item.updated_at)) return false;
  const selection = item.selection, view = item.view;
  if (!object(selection) || !label(selection.district, 128) || !label(selection.business, 128) || !integer(selection.area_radius_m, 500, 1500) || (selection.district === 'custom' ? !point(selection.custom_point) || selection.custom_point[0] < 52.50 || selection.custom_point[0] > 52.72 || selection.custom_point[1] < 39.35 || selection.custom_point[1] > 39.80 : selection.custom_point !== null)) return false;
  if (!object(view) || !integer(view.threshold, 70, 99) || !integer(view.selected_rank, 1, 3) || !object(view.layers) || !['houses', 'competitors', 'centroids', 'zones'].every(key => typeof view.layers[key] === 'boolean')) return false;
  return validAnalysis(item.analysis, selection, view);
}

export function validateScenario(item) {
  try {
    const raw = JSON.stringify(item);
    return typeof raw === 'string' && raw.length <= RECORD_SIZE && jsonTree(item) && validRecord(item);
  } catch { return false; }
}

function failure(code, raw) {
  const error = new Error(code);
  error.code = code;
  if (raw !== undefined || code === 'invalid' || code === 'unsupported') error.raw = raw ?? null;
  return error;
}

function storedRaw() {
  try { return globalThis.localStorage.getItem(SCENARIO_KEY); }
  catch { throw failure('unavailable'); }
}

function parseRecords(raw) {
  if (raw === null) return [];
  if (typeof raw !== 'string' || raw.length > KEY_SIZE) throw failure('invalid', raw);
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch { throw failure('invalid', raw); }
  if (!object(envelope) || !own(envelope, 'schema_version')) throw failure('invalid', raw);
  if (envelope.schema_version !== 1) throw failure('unsupported', raw);
  const records = envelope.scenarios;
  if (!Array.isArray(records) || records.length > SCENARIO_LIMIT || !records.every(validateScenario) || new Set(records.map(item => item.id)).size !== records.length) throw failure('invalid', raw);
  return records;
}

export function readScenarios() {
  return parseRecords(storedRaw());
}

async function withLock(callback) {
  if (typeof globalThis.navigator?.locks?.request !== 'function') throw failure('no_locks');
  try { return await globalThis.navigator.locks.request(`${SCENARIO_KEY}.write`, callback); }
  catch (error) {
    if (['invalid', 'unsupported', 'unavailable', 'no_locks', 'limit', 'size', 'conflict'].includes(error?.code)) throw error;
    throw failure('unavailable');
  }
}

export function mutateScenarios(mutate) {
  return withLock(() => {
    const latest = readScenarios();
    const next = mutate(latest);
    if (!Array.isArray(next)) throw failure('invalid');
    if (next.length > SCENARIO_LIMIT) throw failure('limit');
    let raw;
    try {
      for (const item of next) if (JSON.stringify(item)?.length > RECORD_SIZE) throw failure('size');
      raw = JSON.stringify({ schema_version: 1, scenarios: next });
    } catch (error) { throw error?.code === 'size' ? error : failure('invalid'); }
    if (raw.length > KEY_SIZE) throw failure('size');
    if (!next.every(validateScenario) || new Set(next.map(item => item.id)).size !== next.length) throw failure('invalid');
    try { globalThis.localStorage.setItem(SCENARIO_KEY, raw); }
    catch { throw failure('unavailable'); }
    // Return the persisted copy so callers cannot mutate the stored transaction value.
    return JSON.parse(raw).scenarios;
  });
}

export function clearDamagedScenarios(expectedRaw) {
  return withLock(() => {
    const currentRaw = storedRaw();
    if (typeof expectedRaw !== 'string' || currentRaw !== expectedRaw) throw failure('conflict');
    let damaged = false;
    try { parseRecords(currentRaw); }
    catch (error) {
      if (error.code !== 'invalid' && error.code !== 'unsupported') throw error;
      damaged = true;
    }
    if (!damaged) throw failure('conflict');
    try { globalThis.localStorage.removeItem(SCENARIO_KEY); }
    catch { throw failure('unavailable'); }
  });
}

export function duplicateScenario(item) {
  if (!validateScenario(item)) throw failure('invalid');
  const copy = JSON.parse(JSON.stringify(item)), suffix = ' — копия';
  copy.id = globalThis.crypto.randomUUID();
  copy.name = `${item.name.slice(0, 80 - suffix.length)}${suffix}`;
  copy.saved_at = copy.updated_at = new Date().toISOString();
  if (JSON.stringify(copy).length > RECORD_SIZE) throw failure('size');
  return copy;
}
