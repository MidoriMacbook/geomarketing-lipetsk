const demand = { higher: 'Выше среднего среди точек расчёта', similar: 'Близок к среднему среди точек расчёта', lower: 'Ниже среднего среди точек расчёта', unknown: 'Не оценен' };
const competition = { low: 'Небольшой штраф модели', moderate: 'Умеренный штраф модели', high: 'Высокий штраф модели' };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.length <= 64 && value.every(text => typeof text === 'string' && text.length <= 2000);

// Same conservative v1 contract as the detailed explanation; kept DOM-free so
// the brief remains a pure presentation helper for legacy snapshots as well.
function assessed(value) {
  const metrics = value?.metrics;
  return object(value) && value.version === 1 && Object.hasOwn(demand, value.demand_level)
    && Object.hasOwn(competition, value.competition_level) && object(metrics)
    && ['houses_in_radius', 'houses_per_km2', 'model_demand', 'competition_pressure', 'competition_multiplier'].every(key => Number.isFinite(metrics[key]) && metrics[key] >= 0)
    && (metrics.nearest_demand_center_m === null || Number.isFinite(metrics.nearest_demand_center_m) && metrics.nearest_demand_center_m >= 0)
    && ['strengths', 'risks', 'field_checks'].every(key => strings(value[key]));
}

export function recommendationBrief(rec) {
  const explanation = assessed(rec?.explanation) ? rec.explanation : null;
  const nearest = rec?.nearest_competitor_m;
  return {
    demand: explanation ? demand[explanation.demand_level] : 'Не оценен',
    competition: explanation ? competition[explanation.competition_level] : 'Не оценена',
    nearest: nearest === null ? 'Не найдены в данных области' : Number.isFinite(nearest) && nearest >= 0 ? `${Math.round(nearest).toLocaleString('ru-RU')} м` : 'Не оценено',
    check: explanation?.field_checks.find(text => text.trim()) || 'Проверьте помещение, доступ и поток посетителей.'
  };
}
