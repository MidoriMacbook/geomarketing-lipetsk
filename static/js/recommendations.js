import { state } from './state.js';
import { deliverySummary } from './data-delivery.js';
import { $, fmt, coords, node, button, dateText, sourceText, dataDate, reveal, setRevealed, motionStagger, cancelRevealsWithin } from './ui.js';
import { savePlace, updateSaveButtons } from './saved-places.js';
import { selectMarker, hoverPlace } from './map.js';
import { updateReportAvailability } from './report.js';
import { countTo, counterValue, resetCounters } from './counters.js';
import { qualityBlock, qualitySummary, explanationBlock } from './data-quality.js';
import { recommendationBrief } from './recommendation-brief.js';

let renderedAnalysisId = null;
let previewCard = null;

function previewPlace(card, rank, active) {
  if (active) {
    previewCard?.classList.remove('is-preview');
    previewCard = card;
    card.classList.add('is-preview');
    hoverPlace(rank, true);
  } else if (previewCard === card) {
    card.classList.remove('is-preview');
    previewCard = null;
    hoverPlace(rank, false);
  }
}

function connectCardPreview(card, rank) {
  let hovered = false, focused = false, pressed = false;
  const update = () => previewPlace(card, rank, hovered || focused || pressed);
  card.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    hovered = true;
    update();
  });
  card.addEventListener('pointerleave', () => { hovered = false; pressed = false; update(); });
  card.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    pressed = true;
    update();
  });
  card.addEventListener('pointerup', () => { pressed = false; update(); });
  card.addEventListener('pointercancel', () => { hovered = false; pressed = false; update(); });
  card.addEventListener('focusin', () => { focused = true; update(); });
  card.addEventListener('focusout', event => {
    if (card.contains(event.relatedTarget)) return;
    focused = false;
    update();
  });
  card.addEventListener('click', event => {
    if (event.defaultPrevented || event.target.closest('button, a, input, select, textarea, label, details, [role="button"], [contenteditable]')) return;
    if (window.getSelection()?.isCollapsed === false) return;
    selectPlace(rank);
  });
}

export function selectPlace(rank, pan = false) {
  const changed = state.selectedRank !== rank;
  state.selectedRank = rank;
  previewCard?.classList.remove('is-preview');
  previewCard = null;
  document.querySelectorAll('[data-testid="recommendation-card"]').forEach(c => {
    const active = +c.dataset.rank === rank;
    c.classList.toggle('selected', active);
    c.querySelector('.place-select').setAttribute('aria-pressed', active);
  });
  document.dispatchEvent(new CustomEvent('gm:recommendation-selected', { detail: { rank } }));
  selectMarker(rank, pan, changed);
}

export function showResult(data) {
  const newAnalysis = renderedAnalysisId !== data.analysis_id;
  renderedAnalysisId = data.analysis_id;
  const previousValues = new Map([...$('recommendation-list').children].map(card => [
    card.dataset.counterKey, [...card.querySelectorAll('.score,.place-metrics strong')].map(counterValue)
  ]));
  cancelRevealsWithin($('recommendation-list'));
  resetCounters($('recommendation-list'));
  if (previewCard) previewPlace(previewCard, +previewCard.dataset.rank, false);
  $('recommendation-list').replaceChildren();
  setRevealed($('result-empty'), !data.recommendations.length, 'empty');
  $('result').hidden = !data.recommendations.length;
  if (!data.recommendations.length) {
    $('result-empty').querySelector('h3').textContent = 'Подходящих мест не найдено';
    $('result-empty').querySelector('p').textContent = 'В области не хватает спроса для рекомендации. Попробуйте другую область или увеличьте её радиус.';
  }
  data.recommendations.forEach((rec, index) => {
    const card = node('article', `recommendation${rec.rank===state.selectedRank?' selected':''}`);
    card.dataset.testid = 'recommendation-card';
    card.dataset.rank = rec.rank;
    card.dataset.counterKey = `${rec.lat}:${rec.lng}:${rec.radius_m}`;
    connectCardPreview(card, rec.rank);
    const previous = previousValues.get(card.dataset.counterKey) || [];
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
    const brief = node('dl', 'recommendation-brief'), summary = recommendationBrief(rec);
    for (const [key, label] of [['demand', 'Спрос'], ['competition', 'Конкуренция'], ['nearest', 'Ближайший конкурент'], ['check', 'Проверить на месте']]) {
      const row = node('div');
      row.append(node('dt', '', label), node('dd', key === 'nearest' ? 'nearest' : '', summary[key]));
      brief.append(row);
    }
    const confirmation = node('p', 'save-confirmation');
    confirmation.setAttribute('role', 'status');
    const actions = node('div', 'place-actions'), save = button('Сохранить', 'button secondary save', async () => {
      const analysisId = state.current?.analysis_id, savedId = `${analysisId}:${rec.rank}`;
      const alreadySaved = state.saved.some(item => item.id === savedId);
      confirmation.textContent = '';
      if (!analysisId || analysisId !== data.analysis_id) return;
      await savePlace(rec);
      if (!alreadySaved && state.current?.analysis_id === analysisId && renderedAnalysisId === analysisId && card.isConnected && state.saved.some(item => item.id === savedId)) {
        confirmation.textContent = 'Сохранено для сравнения';
      }
    });
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
    card.append(heading, coordinate, metrics, brief, actions, confirmation, explanationBlock(rec));
    $('recommendation-list').append(card);
    countTo(heading.querySelector('.score'), Math.round(rec.score * 100), { animate: newAnalysis, suffix: '%', from: previous[0] });
    countTo(people.querySelector('strong'), Math.round(rec.residents_in_radius), { animate: newAnalysis, prefix: '≈ ', from: previous[1] });
    countTo(competition.querySelector('strong'), rec.competitors_in_radius, { animate: newAnalysis, from: previous[2] });
    if (newAnalysis) reveal(card, 'recommendation', { delay: index * motionStagger(), duration: 'slow', easing: 'emphasized' });
  });
  updateSaveButtons();
  countTo($('kpi-residents'), Math.round(data.stats.residents), { animate: newAnalysis });
  countTo($('kpi-houses'), data.stats.houses, { animate: newAnalysis });
  countTo($('kpi-competitors'), data.stats.competitors, { animate: newAnalysis });
  countTo($('kpi-places'), data.recommendations.length, { animate: newAnalysis });
  $('kpi-business').textContent = data.business_name;
  if (newAnalysis) ['residents', 'houses', 'competitors', 'places'].forEach(key => reveal($('kpi-'+key), 'kpi'));
  $('map-context').textContent = `${data.district_name} · ${data.business_name}`;
  if ($('analysis-context')) $('analysis-context').textContent = `${data.district_name} · ${data.business_name}`;
  $('source').textContent = `Источник: ${sourceText(data.source)}. Дата самой ранней копии: ${dateText(dataDate(data))}. Население оценено по площади и этажности домов. ${deliverySummary(data)}`.trim();
  const warning = [data.source === 'demo'?'Показаны демонстрационные данные: не используйте их для выбора места без проверки.': '', data.warning, data.notice].filter(Boolean).join(' ');
  $('data-warning').textContent = warning;
  $('data-warning').hidden = !warning;
  if (warning && newAnalysis) reveal($('data-warning'), 'notice');
  $('data-section').hidden = false;
  $('data-quality')?.replaceChildren(qualityBlock(data));
  const quality = qualitySummary(data);
  const summary = `${state.openedScenarioId ? 'Сохранённый расчёт · ' : ''}${quality.source} · ${quality.freshness} · ${quality.completeness}`;
  if ($('trust-summary')) {
    $('trust-summary').dataset.resultSummary = summary;
    $('trust-summary').textContent = summary;
  }
  if ($('data-summary')) $('data-summary').textContent = 'Даты, источники и ограничения';
  updateReportAvailability();
  document.dispatchEvent(new CustomEvent('gm:analysis-rendered', { detail: { data } }));
}
