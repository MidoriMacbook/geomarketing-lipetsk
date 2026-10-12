import { state } from './state.js';
import { $, fmt, coords, distance, node, button, dateText, sourceText, dataDate } from './ui.js';
import { savePlace, updateSaveButtons } from './saved-places.js';
import { selectMarker } from './map.js';
import { updateReportAvailability } from './report.js';


export function selectPlace(rank, pan = true) {
  state.selectedRank = rank;
  document.querySelectorAll('[data-testid="recommendation-card"]').forEach(c => {
    const active = +c.dataset.rank === rank;
    c.classList.toggle('selected', active);
    c.querySelector('.place-select').setAttribute('aria-pressed', active);
  });
  selectMarker(rank, pan);
}

export function showResult(data) {
  $('recommendation-list').replaceChildren();
  $('result-empty').hidden = data.recommendations.length>0;
  $('result').hidden = !data.recommendations.length;
  if (!data.recommendations.length) {
    $('result-empty').querySelector('h3').textContent = 'Подходящих мест не найдено';
    $('result-empty').querySelector('p').textContent = 'В области не хватает спроса для рекомендации. Попробуйте другую область или увеличьте её радиус.';
  }
  data.recommendations.forEach((rec, index) => {
    const card = node('article', `recommendation${rec.rank===state.selectedRank?' selected':''}`);
    card.dataset.testid = 'recommendation-card';
    card.dataset.rank = rec.rank;
    const heading = node('div', 'place-title'), select = button(`Место ${rec.rank}`, 'place-select', () => selectPlace(rec.rank));
    select.setAttribute('aria-pressed', rec.rank === state.selectedRank);
    select.setAttribute('aria-label', `Показать место ${rec.rank} на карте`);
    heading.append(node('span', 'rank', rec.rank), select, node('span', 'score', `${Math.round(rec.score*100)}%`));
    const coordinate = node('p', 'coords', coords(rec));
    if (!index)coordinate.id = 'coords';
    const metrics = node('div', 'place-metrics'), people = node('div'), competition = node('div');
    people.append(node('strong', '', `≈ ${fmt(rec.residents_in_radius)}`), node('small', '', `жителей в ${fmt(rec.radius_m)} м`));
    competition.append(node('strong', '', fmt(rec.competitors_in_radius)), node('small', '', 'конкурентов в радиусе'));
    metrics.append(people, competition);
    const actions = node('div', 'place-actions'), save = button('Сохранить', 'button secondary save', () => savePlace(rec));
    save.dataset.testid = 'save-place';
    save.dataset.rank = rec.rank;
    const copy = button('Координаты', 'button secondary', async() => {
      try {
        await navigator.clipboard.writeText(`${rec.lat.toFixed(6)}, ${rec.lng.toFixed(6)}`);
        copy.textContent = 'Скопировано';
      }
      catch {
        copy.textContent = 'Не скопировано';
        copy.title = 'Координаты указаны на карточке — выделите и скопируйте их.';
      }
    });
    if (!index)copy.id = 'copy';
    const osm = node('a', '', '↗');
    osm.href = `https://www.openstreetmap.org/?mlat=${rec.lat}&mlon=${rec.lng}#map=18/${rec.lat}/${rec.lng}`;
    osm.target = '_blank';
    osm.rel = 'noopener';
    osm.setAttribute('aria-label', `Открыть место ${rec.rank} в OpenStreetMap`);
    if (!index)osm.id = 'osm-link';
    actions.append(save, copy, osm);
    card.append(heading, coordinate, metrics, node('p', 'nearest', `Ближайший конкурент: ${distance(rec.nearest_competitor_m)}`), actions);
    $('recommendation-list').append(card);
  });
  updateSaveButtons();
  $('kpi-residents').textContent = fmt(data.stats.residents);
  $('kpi-houses').textContent = fmt(data.stats.houses);
  $('kpi-competitors').textContent = fmt(data.stats.competitors);
  $('kpi-places').textContent = data.recommendations.length;
  $('kpi-business').textContent = data.business_name;
  $('map-context').textContent = `${data.district_name} · ${data.business_name}`;
  $('source').textContent = `Источник: ${sourceText(data.source)}. Дата самой ранней копии: ${dateText(dataDate(data))}. Население оценено по площади и этажности домов.`;
  const warning = [data.source === 'demo'?'Показаны демонстрационные данные: не используйте их для выбора места без проверки.': '', data.warning, data.notice].filter(Boolean).join(' ');
  $('data-warning').textContent = warning;
  $('data-warning').hidden = !warning;
  $('data-section').hidden = false;
  updateReportAvailability();
}
