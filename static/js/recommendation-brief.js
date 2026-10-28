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

export function recommendationDecision(rec) {
  const explanation=assessed(rec?.explanation)?rec.explanation:null;
  const count=rec?.competitors_in_radius;
  const facts=[],format=value=>Math.round(value).toLocaleString('ru-RU');
  const metrics=explanation?.metrics;
  if(Number.isSafeInteger(count)&&count>=0)facts.push(count===0
    ? explanation?.demand_level==='higher'?'Спрос выше среди точек расчёта; нет учтённых конкурентов':'Нет учтённых конкурентов в радиусе'
    :`Учтено конкурентов в радиусе: ${format(count)}`);
  if(Number.isFinite(rec?.residents_in_radius)&&rec.residents_in_radius>=0)facts.push(`≈ ${format(rec.residents_in_radius)} жителей в радиусе`);
  if(Number.isFinite(metrics?.nearest_demand_center_m)&&metrics.nearest_demand_center_m>=0)facts.push(`Центр спроса в ${format(metrics.nearest_demand_center_m)} м`);
  if(Number.isFinite(metrics?.houses_per_km2)&&metrics.houses_per_km2>=0)facts.push(`Плотность домов: ${format(metrics.houses_per_km2)} на км²`);
  return {headline:facts[0]||'Причина не определена по доступным данным',reasons:facts.slice(1,3)};
}
