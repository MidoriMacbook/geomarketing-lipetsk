import { state } from './state.js';
import { deliverySummary } from './data-delivery.js';
import { $, fmt, coords, node, button, dateText, sourceText, dataDate, reveal, setRevealed, motionStagger, cancelRevealsWithin, animateUI, cancelUI, motionReduced } from './ui.js';
import { savePlace, updateSaveButtons } from './saved-places.js';
import { selectMarker, hoverPlace } from './map.js';
import { updateReportAvailability } from './report.js';
import { countTo, counterValue, resetCounters } from './counters.js';
import { qualityBlock, qualitySummary, explanationBlock } from './data-quality.js';
import { recommendationBrief, recommendationDecision } from './recommendation-brief.js';
import { offerSavedComparison, openSavedComparison } from './comparison-guide.js';

let renderedAnalysisId = null;
let previewCard = null;
const mobileRecommendations = matchMedia('(max-width:600px), (max-width:950px) and (max-height:500px) and (pointer:coarse)');
const mobileCards = new Map();

function expandMobileCard(entry, expanded, animate = false) {
  const { card, body, toggle } = entry;
  if (!expanded && body.contains(document.activeElement)) toggle.focus({ preventScroll: true });
  cancelUI(body);
  card.dataset.mobileExpanded = String(expanded);
  toggle.setAttribute('aria-expanded', String(expanded));
  body.inert = mobileRecommendations.matches && !expanded;
  body.classList.toggle('is-transitioning', animate && mobileRecommendations.matches);
  if (mobileRecommendations.matches) body.setAttribute('aria-hidden', String(!expanded));
  else body.removeAttribute('aria-hidden');
}

function arrangeMobileCard(entry) {
  const { body, content, heading, coordinate, metrics, brief, reasons, secondaryActions, actions, save, copy, osm, confirmation, explanation, showOnMap, placeDetails, placeContent, briefDetails } = entry;
  cancelUI(body);
  if (mobileRecommendations.matches) {
    placeContent.append(coordinate, entry.linkActions);
    entry.linkActions.append(copy, osm);
    briefDetails.append(brief,placeDetails,explanation);
    secondaryActions.prepend(showOnMap);
    content.append(heading,metrics,reasons,actions,confirmation,secondaryActions,briefDetails);
    placeDetails.open = false;
    briefDetails.open = false;
  } else {
    actions.append(save, copy, osm);
    content.append(heading, coordinate, metrics, reasons, brief, actions, confirmation, explanation, showOnMap, placeDetails, briefDetails,secondaryActions);
    placeDetails.open = true;
    briefDetails.open = true;
  }
  showOnMap.hidden = !mobileRecommendations.matches;
  save.classList.toggle('primary',mobileRecommendations.matches);save.classList.toggle('secondary',!mobileRecommendations.matches);
  briefDetails.querySelector('summary').textContent=mobileRecommendations.matches?'Подробности места':'Подробнее о месте';
  placeDetails.hidden = !mobileRecommendations.matches;
  briefDetails.hidden = !mobileRecommendations.matches;
  expandMobileCard(entry, entry.card.dataset.mobileExpanded === 'true');
}

// Один обработчик использует только текущие карточки, включая повторный расчёт.
mobileRecommendations.addEventListener('change', () => mobileCards.forEach(arrangeMobileCard));
const settleMobileTransitions=()=>mobileCards.forEach(({body})=>body.classList.remove('is-transitioning'));
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',event=>{if(event.matches)settleMobileTransitions();});
window.addEventListener('beforeprint',settleMobileTransitions);
document.addEventListener('visibilitychange',()=>{if(document.hidden)settleMobileTransitions();});

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

export function selectPlace(rank, pan = false, feedback = false) {
  const changed = state.selectedRank !== rank;
  state.selectedRank = rank;
  previewCard?.classList.remove('is-preview');
  previewCard = null;
  document.querySelectorAll('[data-testid="recommendation-card"]').forEach(c => {
    const active = +c.dataset.rank === rank;
    c.classList.toggle('selected', active);
    c.querySelector('.place-select').setAttribute('aria-pressed', active);
  });
  if (changed && mobileRecommendations.matches) {
    const entry = mobileCards.get(rank);
    if (entry && entry.card.dataset.mobileExpanded !== 'true') expandMobileCard(entry, true, true);
  }
  document.dispatchEvent(new CustomEvent('gm:recommendation-selected', { detail: { rank } }));
  if(state.current?.recommendations.some(rec=>rec.rank===rank))$('analysis-status').textContent=typeof L==='undefined'?`Выбрано место ${rank} · карта недоступна`:`Выбрано место ${rank} · выделено на карте`;
  selectMarker(rank, pan, changed || feedback);
}

export function showResult(data, { freshCalculation=false } = {}) {
  const newAnalysis = freshCalculation || renderedAnalysisId !== data.analysis_id;
  renderedAnalysisId = data.analysis_id;
  const previousExpanded = new Map([...mobileCards.values()].map(({ card }) => [card.dataset.counterKey, card.dataset.mobileExpanded === 'true']));
  const previousValues = new Map([...$('recommendation-list').children].map(card => [
    card.dataset.counterKey, [...card.querySelectorAll('.score,.place-metrics strong')].map(counterValue)
  ]));
  cancelRevealsWithin($('recommendation-list'));
  resetCounters($('recommendation-list'));
  if (previewCard) previewPlace(previewCard, +previewCard.dataset.rank, false);
  mobileCards.clear();
  $('recommendation-list').replaceChildren();
  setRevealed($('result-empty'), !data.recommendations.length, 'empty');
  $('result').hidden = !data.recommendations.length;
  if (!data.recommendations.length) {
    $('result-empty').querySelector('h3').textContent = 'Подходящих мест не найдено';
    $('result-empty').querySelector('p').textContent = 'В области не хватает спроса для рекомендации. Попробуйте другую область или увеличьте её радиус.';
  }
  countTo($('kpi-residents'), Math.round(data.stats.residents), { animate: newAnalysis });
  countTo($('kpi-houses'), data.stats.houses, { animate: newAnalysis });
  countTo($('kpi-competitors'), data.stats.competitors, { animate: newAnalysis });
  countTo($('kpi-places'), data.recommendations.length, { animate: newAnalysis });
  if (newAnalysis) ['residents', 'houses', 'competitors', 'places'].forEach(key => animateUI($('kpi-'+key),[{opacity:.45},{opacity:1}],'calculation-kpi',{duration:'fast'}));
  data.recommendations.forEach((rec, index) => {
    const card = node('article', `recommendation${rec.rank===state.selectedRank?' selected':''}`);
    card.dataset.testid = 'recommendation-card';
    card.dataset.rank = rec.rank;
    card.dataset.counterKey = `${rec.lat}:${rec.lng}:${rec.radius_m}`;
    card.dataset.mobileExpanded = String(!newAnalysis && previousExpanded.has(card.dataset.counterKey) ? previousExpanded.get(card.dataset.counterKey) : index === 0);
    connectCardPreview(card, rec.rank);
    const body = node('div', 'recommendation-body');
    const clip = node('div', 'recommendation-clip'), content = node('div', 'recommendation-content');
    clip.append(content);body.append(clip);
    body.id = `recommendation-body-${rec.rank}`;
    const toggle = button('', 'mobile-rec-toggle', () => {
      if (!mobileRecommendations.matches) return;
      const entry = mobileCards.get(rec.rank);
      const expanded = card.dataset.mobileExpanded !== 'true';
      selectPlace(rec.rank, false, expanded);
      expandMobileCard(entry, expanded, true);
    });
    toggle.setAttribute('aria-controls', body.id);
    const decision=recommendationDecision(rec),score=node('span','mobile-rec-score',`${Math.round(rec.score*100)}%`);
    score.setAttribute('aria-label',`${Math.round(rec.score*100)}% — относительная оценка внутри этого расчёта`);
    toggle.append(node('span', 'rank', rec.rank), node('span', 'mobile-rec-name', index === 0 ? 'Лучшее место' : `Место ${rec.rank}`),score,node('span','mobile-rec-difference','Оценка внутри расчёта'));
    const reasons=node('section','mobile-reasons decision-reasons'),reasonList=node('ul');
    reasons.append(node('h4','','Почему это место'),node('p','decision-headline',decision.headline),reasonList);
    // Население уже показано крупно в метриках: это та же фактическая причина,
    // а не второй экземпляр числа в списке. Остальные причины — максимум две.
    decision.reasons.filter(text=>!text.startsWith('≈ ')).forEach(text=>reasonList.append(node('li','',text)));
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
    const showOnMap = button('Показать на карте', 'button secondary mobile-show-place', () => {
      selectPlace(rec.rank, true);
      const map = $('map');
      if (map) { if(!map.hasAttribute('tabindex'))map.tabIndex=-1;map.focus({ preventScroll: true });map.scrollIntoView({ behavior: motionReduced() ? 'instant' : 'smooth', block: 'center' }); }
    });
    const brief = node('dl', 'recommendation-brief'), summary = recommendationBrief(rec);
    for (const [key, label] of [['demand', 'Спрос'], ['competition', 'Конкуренция'], ['nearest', 'Ближайший конкурент'], ['check', 'Проверить на месте']]) {
      const row = node('div');
      row.append(node('dt', '', label), node('dd', key === 'nearest' ? 'nearest' : '', summary[key]));
      brief.append(row);
    }
    const confirmation = node('p', 'save-confirmation');
    confirmation.setAttribute('role', 'status');
    const confirmationSpace=node('span','confirmation-space');confirmationSpace.dataset.text='Сохранено · добавьте ещё одно для сравнения';confirmationSpace.setAttribute('aria-hidden','true');
    const confirmationLabel=node('span','confirmation-label');confirmation.append(confirmationSpace,confirmationLabel);
    const actions = node('div', 'place-actions'), save = button('Сохранить', 'button secondary save', async () => {
      const analysisId = state.current?.analysis_id, savedId = `${analysisId}:${rec.rank}`;
      const alreadySaved = state.saved.some(item => item.id === savedId);
      confirmationLabel.textContent = '';
      if (!analysisId || analysisId !== data.analysis_id) return;
      await savePlace(rec);
      if(mobileRecommendations.matches&&state.current?.analysis_id===analysisId&&card.isConnected&&state.saved.some(item=>item.id===savedId))offerSavedComparison(card,savedId);
      if (!alreadySaved && state.current?.analysis_id === analysisId && renderedAnalysisId === analysisId && card.isConnected && state.saved.some(item => item.id === savedId)) {
        if(!mobileRecommendations.matches){card.dataset.savedFeedbackId=savedId;document.dispatchEvent(new CustomEvent('gm:comparison-changed'));}
        animateUI(confirmation,[{opacity:0},{opacity:1}],'save-confirmation',{duration:'fast'});
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
    const placeDetails = node('details', 'mobile-place-details'), placeContent = node('div', 'mobile-place-content'), linkActions = node('div', 'place-actions');
    placeDetails.append(node('summary', '', 'Координаты и ссылки'), placeContent);
    const briefDetails = node('details', 'mobile-rec-details');
    briefDetails.append(node('summary', '', 'Подробнее о месте'));
    const explanation = explanationBlock(rec);
    const secondaryActions=node('div','mobile-save-secondary'),compare=button('Сравнить','compare-saved-link',openSavedComparison);compare.hidden=true;secondaryActions.append(compare);
    const savedId=`${data.analysis_id}:${rec.rank}`;if(state.saved.some(item=>item.id===savedId))card.dataset.savedFeedbackId=savedId;
    card.append(toggle, body);
    const entry = { card, body, content, toggle, heading, coordinate, metrics, brief,reasons,secondaryActions, actions, save, copy, osm, confirmation, explanation, showOnMap, placeDetails, placeContent, linkActions, briefDetails };
    mobileCards.set(rec.rank, entry);
    arrangeMobileCard(entry);
    $('recommendation-list').append(card);
    countTo(heading.querySelector('.score'), Math.round(rec.score * 100), { animate: newAnalysis, suffix: '%', from: previous[0] });
    countTo(people.querySelector('strong'), Math.round(rec.residents_in_radius), { animate: newAnalysis, prefix: '≈ ', from: previous[1] });
    countTo(competition.querySelector('strong'), rec.competitors_in_radius, { animate: newAnalysis, from: previous[2] });
    if (newAnalysis) animateUI(card,[{opacity:0,transform:'translateY(var(--motion-distance-small))'},{opacity:1,transform:'translateY(0)'}],'calculation-result',{delay:motionStagger()*(3+index*2/3),duration:'workspace',easing:'emphasized'});
  });
  updateSaveButtons();
  $('kpi-business').textContent = data.business_name;
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
