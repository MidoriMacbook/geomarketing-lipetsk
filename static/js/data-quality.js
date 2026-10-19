import { node, sourceText, initDisclosure, fmt, distance, LIMITATIONS } from './ui.js';

const freshnessLabels = { fresh: 'За последние 24 часа', recent: 'От 24 часов до 7 дней', stale: 'Старше 7 дней', unknown: 'Свежесть неизвестна', demo: 'Демонстрационные данные' };
const completenessLabels = { limited: 'Ограниченные данные', needs_review: 'Нужна проверка данных', usable_for_model: 'Данных достаточно для модели' };
const osmLimitation = 'Разметка OpenStreetMap добровольная: полнота и актуальность объектов не гарантированы.';
const dateLabel = value => new Date(value).toLocaleString('ru-RU');

// Optional enrichment may come from older or damaged saved-place records.
// Keep their usable base facts, but never interpret malformed details as assessed.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.length <= 64 && value.every(text => typeof text === 'string' && text.length <= 2000);
export function checkedQuality(value) {
  return object(value) && value.version === 1 && object(value.completeness)
    && typeof value.completeness.status==='string' && Object.hasOwn(completenessLabels,value.completeness.status)
    && Array.isArray(value.completeness.reasons) && value.completeness.reasons.length <= 64
    && value.completeness.reasons.every(reason=>object(reason)&&typeof reason.code==='string'&&typeof reason.text==='string'&&reason.text.length<=2000) ? value : null;
}
export function checkedExplanation(value) {
  const metrics=value?.metrics;
  return object(value) && value.version===1 && ['higher','similar','lower','unknown'].includes(value.demand_level)
    && ['low','moderate','high'].includes(value.competition_level) && object(metrics)
    && ['houses_in_radius','houses_per_km2','model_demand','competition_pressure','competition_multiplier'].every(key=>Number.isFinite(metrics[key])&&metrics[key]>=0)
    && (metrics.nearest_demand_center_m===null||Number.isFinite(metrics.nearest_demand_center_m)&&metrics.nearest_demand_center_m>=0)
    && ['strengths','risks','field_checks'].every(key=>strings(value[key])) ? value : null;
}

export function qualitySummary(data, now = Date.now()) {
  const quality = checkedQuality(data?.data_quality);
  const metadata = data?.data_meta || {};
  const timestamps = ['houses', 'competitors'].map(key => metadata[key]?.fetched_at);
  const valid = timestamps.every(value => Number.isFinite(value) && value > 0 && value * 1000 <= now + 300000);
  const age = valid ? now - Math.min(...timestamps) * 1000 : null;
  const freshness = !quality ? 'Не оценено' : freshnessLabels[data.source === 'demo' ? 'demo' : !valid ? 'unknown' : age <= 86400000 ? 'fresh' : age <= 604800000 ? 'recent' : 'stale'];
  const reasons = (quality?.completeness?.reasons || []).map(item => typeof item === 'string' ? item : item.text).filter(Boolean);
  if (quality && data.source !== 'demo' && !valid) reasons.push('Неизвестна дата хотя бы одного набора геоданных.');
  if (quality && valid && age > 604800000 && data.source !== 'demo') reasons.push('Снимок геоданных старше 7 дней; проверьте изменения на местности.');
  for (const message of [data?.warning, data?.notice, osmLimitation]) if (message) reasons.push(message);
  return {
    source: ['osm', 'cache', 'demo'].includes(data?.source) ? sourceText(data.source) : 'Источник не указан',
    freshness,
    completeness: quality ? completenessLabels[quality.completeness?.status] || 'Не оценено' : 'Не оценено',
    reasons: [...new Set(reasons)],
    dates: ['houses', 'competitors'].map((key, index) => `${key === 'houses' ? 'Дома' : 'Конкуренты'}: ${Number.isFinite(timestamps[index]) && timestamps[index] > 0 ? dateLabel(timestamps[index] * 1000) : 'дата не указана'}`)
  };
}

export function qualityBlock(data, compact = false) {
  const summary = qualitySummary(data), block = node('section', 'quality-block');
  block.dataset.testid = 'data-quality-block';
  block.setAttribute('aria-label', 'Качество исходных данных');
  block.append(node('p', 'quality-summary', `${summary.source} · ${summary.freshness} · ${summary.completeness}`));
  const details = node(compact ? 'details' : 'div', 'quality-details');
  if (compact) details.append(node('summary', '', 'Даты и ограничения данных'));
  summary.dates.forEach(date => details.append(node('p', '', date)));
  const list = node('ul');
  summary.reasons.forEach(reason => list.append(node('li', '', reason)));
  details.append(list);
  block.append(details);
  if (compact) initDisclosure(details);
  return block;
}

export function explanationBlock(rec, { expanded = false } = {}) {
  const block = node('div', 'explanation-block'), explanation = checkedExplanation(rec?.explanation);
  block.dataset.testid = 'explanation-block';
  if (!explanation) { block.append(node('p', 'hint', 'Объяснение для этого сохранённого расчёта не оценено.')); return block; }
  if (explanation.strengths?.length) block.append(node('p', 'explanation-strength', explanation.strengths[0]));
  const details = node('details'), metrics = explanation.metrics || {};
  details.append(node('summary', '', 'Почему это место'));
  details.open = expanded;
  details.append(node('p', '', `В радиусе ${fmt(rec.radius_m)} м: ≈ ${fmt(rec.residents_in_radius)} жителей, ${fmt(rec.competitors_in_radius)} конкурентов. Ближайший конкурент: ${distance(rec.nearest_competitor_m)}.`));
  const demand = { higher: 'Выше среднего среди точек этого расчёта', similar: 'Близок к среднему среди точек этого расчёта', lower: 'Ниже среднего среди точек этого расчёта', unknown: 'Не оценен' };
  const competition = { low: 'Небольшой штраф модели', moderate: 'Умеренный штраф модели', high: 'Высокий штраф модели' };
  const number = (value, suffix = '', digits = 2) => Number.isFinite(value) ? `${value.toLocaleString('ru-RU', { maximumFractionDigits: digits })}${suffix}` : 'не оценено';
  details.append(node('h4', '', 'Спрос'), node('p', '', `${demand[explanation.demand_level] || 'Не оценен'}. Это сравнение предложенных точек, а не норма города.`), node('p', '', `Учтено домов в радиусе: ${number(metrics.houses_in_radius)}; плотность учтённых домов: ${number(metrics.houses_per_km2, ' на км²', 1)}; ближайший центр спроса: ${number(metrics.nearest_demand_center_m, ' м')}. Взвешенный спрос модели: ${number(metrics.model_demand)}.`));
  const pressure = metrics.competition_pressure > 0 && metrics.competition_pressure < .005 ? '<0,01' : number(metrics.competition_pressure);
  details.append(node('h4', '', 'Конкуренция'), node('p', '', `${competition[explanation.competition_level] || 'Не оценена'}. Давление: ${pressure}; делитель спроса: ${Number.isFinite(metrics.competition_multiplier) ? metrics.competition_multiplier.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : 'не оценено'}. Это параметр модели, а не вероятность убытка.`));
  if (rec.competitors_in_radius === 0) details.append(node('p', '', 'В радиусе этой точки в данных OSM конкуренты не отмечены; это не означает их отсутствия. За пределами радиуса могут быть учтённые конкуренты.'));
  for (const [key, title] of [['strengths', 'Сильные стороны'], ['risks', 'Риски'], ['field_checks', 'Проверить на месте']]) {
    details.append(node('h4', '', title));
    const list = node('ul');
    (explanation[key] || []).forEach(text => list.append(node('li', '', text)));
    details.append(list);
  }
  details.append(node('h4', '', 'Ограничение модели'), node('p', '', LIMITATIONS));
  block.append(details);
  if (!expanded) initDisclosure(details);
  return block;
}
