export const isAlternative = rec => rec?.role === 'alternative';

export function recommendationLabel(rec) {
  return isAlternative(rec) ? `Запасной вариант ${rec.rank}` : `Место ${rec.rank}`;
}

export function validPlaceRole(rec) {
  if (!Object.hasOwn(rec, 'role')) return !Object.hasOwn(rec, 'alternative_comparison');
  const comparison = rec.alternative_comparison;
  if (!isAlternative(rec) || rec.origin === 'manual' || !comparison || typeof comparison !== 'object' || Array.isArray(comparison)) return false;
  const { rank, distance_m, shared_residents_fraction } = comparison;
  return Number.isInteger(rank) && rank >= 1 && rank < rec.rank
    && Number.isFinite(distance_m) && distance_m >= 0
    && (shared_residents_fraction === null || (Number.isFinite(shared_residents_fraction)
      && shared_residents_fraction >= 0 && shared_residents_fraction <= 1));
}

export function alternativeExplanation(rec, recommendations) {
  const comparison = rec.alternative_comparison;
  if (!isAlternative(rec) || !comparison || !Number.isFinite(comparison.distance_m)) return '';
  const reference = recommendations.find(place => place.rank === comparison.rank);
  if (!reference) return '';
  const target = isAlternative(reference) ? 'запасного варианта' : 'места';
  const distance = Math.round(comparison.distance_m).toLocaleString('ru-RU');
  const overlap = comparison.shared_residents_fraction;
  const residents = Number.isFinite(overlap)
    ? `Общих жителей — ${(overlap * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} % от меньшего охвата.`
    : 'Доля общих жителей не оценена.';
  return `До ${target} ${reference.rank} — ${distance} м. ${residents}`;
}
