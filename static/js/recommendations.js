import { scoreText, SCORE_NOTE, placeDifference } from './result-format.js';
import { state } from './state.js';
import { isAlternative, recommendationLabel, alternativeExplanation } from './place-role.js';
import { deliverySummary } from './data-delivery.js';
import { $, fmt, coords, node, button, reveal, setRevealed, motionStagger, cancelRevealsWithin, animateUI, cancelUI, motionReduced, dataDate } from './ui.js';
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
  metrics.children[1].querySelector('small').textContent='конкурентов в радиусе';
  if (mobileRecommendations.matches) {
    placeContent.append(coordinate, entry.linkActions);
    entry.linkActions.append(copy, osm);
    brief.hidden = false;
    briefDetails.append(brief,placeDetails,explanation);
    secondaryActions.prepend(showOnMap);
    content.append(heading,entry.correctionDelta,metrics,reasons,entry.difference,actions,confirmation,secondaryActions,briefDetails);
    placeDetails.open = false;
    briefDetails.open = false;
  } else {
    brief.hidden = false;
    actions.append(save, copy, osm);
    content.append(heading, coordinate, entry.correctionDelta, metrics, reasons, entry.difference, brief, actions, confirmation, explanation, showOnMap, placeDetails, briefDetails,secondaryActions);
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
  const place = state.current?.recommendations.find(rec => rec.rank === rank);
  if (place) {
    const selected = isAlternative(place) ? `Выбран запасной вариант ${rank}` : `Выбрано место ${rank}`;
    $('analysis-status').textContent = `${selected} · ${typeof L === 'undefined' ? 'карта недоступна' : 'выделено на карте'}`;
  }
  selectMarker(rank, pan, changed || feedback);
}

export function showResult(data, { freshCalculation=false, preserveViewport=false } = {}) {
  const newAnalysis = freshCalculation || renderedAnalysisId !== data.analysis_id;
  renderedAnalysisId = data.analysis_id;
  const previousExpanded = new Map([...mobileCards.values()].map(({ card }) => [card.dataset.counterKey, card.dataset.mobileExpanded === 'true']));
  const list = $('recommendation-list');
  const previousValues = new Map([...list.querySelectorAll('.recommendation')].map(card => [
    card.dataset.counterKey, [...card.querySelectorAll('.score,.place-metrics strong')].map(counterValue)
  ]));
  cancelRevealsWithin(list);
  resetCounters(list);
  if (previewCard) previewPlace(previewCard, +previewCard.dataset.rank, false);
  mobileCards.clear();
  list.replaceChildren();
  const mainCount = data.recommendations.filter(rec => !isAlternative(rec)).length;
  const alternativeCount = data.recommendations.length - mainCount;
  const legacySnapshot = state.openedScenarioId && data.alternatives_requested !== true && !alternativeCount;
  const summaryText = `Основных мест: ${mainCount}. Запасных вариантов: ${alternativeCount}.`;
  const countSummary = $('place-count-summary') || node('p', 'place-count-summary');
  countSummary.id = 'place-count-summary';
  countSummary.hidden = Boolean(legacySnapshot);
  countSummary.textContent = summaryText;
  if (!countSummary.isConnected) list.before(countSummary);
  let selectionNote=$('selection-note');
  if(!selectionNote){selectionNote=node('p','hint');selectionNote.id='selection-note';list.before(selectionNote);}
  const independent=legacySnapshot&&data.recommendations[0]?.selection_method==='cluster_maxima_v1'&&data.recommendations.length<3;
  selectionNote.hidden=!independent;
  selectionNote.replaceChildren();
  if(independent){
    const icon=node('span','note-icon','i');icon.setAttribute('aria-hidden','true');
    const count=data.recommendations.length;
    selectionNote.append(icon,node('span','',count===2?'В этой области найдено мест: 2. Третье не показано: оно пересекалось бы по жителям с уже выбранными.':'В этой области найдено мест: 1. Другие варианты не образуют независимые зоны спроса.'));
  }
  $('recommendations-context').textContent = `${data.district_name} · ${data.business_name}`;
  $('recommendations-context').setAttribute('aria-label',`Параметры расчёта: ${data.district_name}, ${data.business_name}. Изменить параметры`);
  $('recommendations-context').append(node('span','context-action','Изменить параметры'));
  setRevealed($('result-empty'), !data.recommendations.length, 'empty');
  $('result').hidden = !data.recommendations.length;
  if (!data.recommendations.length) {
    $('result-empty').querySelector('h3').textContent = 'Подходящих мест не найдено';
    $('result-empty').querySelector('p').textContent = `${summaryText} В области не хватает спроса для рекомендации. Попробуйте другую область или увеличьте её радиус.`;
  }
  countTo($('kpi-residents'), Math.round(data.stats.residents), { animate: newAnalysis, prefix: '≈\u00a0' });
  countTo($('kpi-houses'), data.stats.houses, { animate: newAnalysis });
  countTo($('kpi-competitors'), data.stats.competitors, { animate: newAnalysis });
  countTo($('kpi-places'), data.recommendations.length, { animate: newAnalysis });
  if (newAnalysis) ['residents', 'houses', 'competitors', 'places'].forEach(key => animateUI($('kpi-'+key),[{opacity:.45},{opacity:1}],'calculation-kpi',{duration:'fast'}));
  data.recommendations.forEach((rec, index) => {
    const alternative = isAlternative(rec), label = recommendationLabel(rec);
    if (alternative && index === mainCount) list.append(node('h3', 'alternative-results-heading', 'Запасные варианты'));
    const card = node('article', `recommendation${rec.rank===state.selectedRank?' selected':''}`);
    card.dataset.testid = 'recommendation-card';
    card.dataset.rank = rec.rank;
    if (alternative) card.dataset.placeRole = 'alternative';
    card.dataset.counterKey = `${rec.lat}:${rec.lng}:${rec.radius_m}`;
    card.dataset.mobileExpanded = String((!newAnalysis || preserveViewport) && previousExpanded.has(card.dataset.counterKey)
      ? previousExpanded.get(card.dataset.counterKey) : index === 0);
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
    const decision=recommendationDecision(rec),score=node('span','mobile-rec-score',scoreText(rec.score));
    score.setAttribute('aria-label',`${scoreText(rec.score)} — ${SCORE_NOTE}`);
    const rankLabel = node('span', 'rank', rec.rank);
    if (alternative) rankLabel.setAttribute('aria-hidden', 'true');
    toggle.append(rankLabel, node('span', 'mobile-rec-name', !alternative && index === 0 ? 'Лучшее место' : label),score,node('span','mobile-rec-difference',`≈ ${fmt(rec.residents_in_radius)} жителей · ${fmt(rec.competitors_in_radius)} конкурентов`));
    const weaker=!alternative&&Number.isFinite(rec.score)&&rec.score>=0&&Math.round(rec.score*100)<40;
    if(weaker)toggle.append(node('span','place-strength','слабее лучшего'));
    const reasons=node('section','mobile-reasons decision-reasons'),reasonList=node('ul');
    reasons.append(node('h3','','Почему это место'),node('p','decision-headline',weaker?'Заметно слабее лучшего места':recommendationBrief(rec).demand),reasonList);
    // Население уже показано крупно в метриках: это та же фактическая причина,
    // а не второй экземпляр числа в списке. Остальные причины — максимум две.
    decision.reasons.filter(text=>!text.startsWith('≈ ')).forEach(text=>reasonList.append(node('li','',text)));
    const previous = previousValues.get(card.dataset.counterKey) || [];
    const heading = node('div', 'place-title'), select = button(label, 'place-select', () => selectPlace(rec.rank));
    select.setAttribute('aria-pressed', rec.rank === state.selectedRank);
    select.setAttribute('aria-label', `Показать ${label.toLocaleLowerCase('ru-RU')} на карте`);
    const scoreGroup=node('span','score-group'),scoreInfo=node('span','score-info','i');
    scoreInfo.tabIndex=0;scoreInfo.setAttribute('role','note');scoreInfo.setAttribute('aria-label',`Относительная оценка внутри расчёта. ${SCORE_NOTE}`);scoreInfo.title=SCORE_NOTE;
    scoreGroup.append(node('span','score',scoreText(rec.score)),scoreInfo);
    heading.append(rankLabel.cloneNode(true), select, scoreGroup);
    if(weaker)heading.append(node('span','place-strength','слабее лучшего'));
    heading.querySelector('.score').title=SCORE_NOTE;
    const coordinate = node('p', 'coords', coords(rec));
    if (!index)coordinate.id = 'coords';
    const metrics = node('div', 'place-metrics'), people = node('div'), competition = node('div');
    people.append(node('strong', '', `≈ ${fmt(rec.residents_in_radius)}`), node('small', '', `жителей в ${fmt(rec.radius_m)} м`));
    competition.append(node('strong', '', fmt(rec.competitors_in_radius)), node('small', '', 'конкурентов в радиусе'));
    metrics.append(people, competition);
    const showOnMap = button('Показать на карте', 'button secondary mobile-show-place', () => {
      selectPlace(rec.rank, false);
      document.dispatchEvent(new CustomEvent('gm:show-place',{detail:{rank:rec.rank}}));
      const map = $('map');
      if (map) { if(!map.hasAttribute('tabindex'))map.tabIndex=-1;map.focus({ preventScroll: true });$('map-card').scrollIntoView({ behavior: motionReduced() ? 'instant' : 'smooth', block: 'start' }); }
    });
    const brief = node('dl', 'recommendation-brief'), summary = recommendationBrief(rec);
    for (const [key, label] of [['competition', 'Влияние конкурентов'], ['nearest', 'Ближайший конкурент'], ['check', 'Проверить на месте']]) {
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
    const copy = button('Копировать координаты', 'button secondary', async() => {
      try {
        await navigator.clipboard.writeText(`${rec.lat.toFixed(6)}, ${rec.lng.toFixed(6)}`);
        copy.textContent = 'Скопировано';
      }
      catch {
        copy.textContent = 'Не скопировано';
        copy.title = 'Координаты указаны на карточке — выделите и скопируйте их.';
      }
    });
    copy.title='Скопировать широту и долготу';copy.setAttribute('aria-label',`Копировать координаты ${alternative?'запасного варианта':'места'} ${rec.rank}`);
    if (!index)copy.id = 'copy';
    const osm = node('a'),externalIcon=node('span','directional-icon icon-external');externalIcon.setAttribute('aria-hidden','true');osm.append(document.createTextNode('Открыть на карте'),externalIcon);osm.title='Открыть в OpenStreetMap в новой вкладке';
    osm.href = `https://www.openstreetmap.org/?mlat=${rec.lat}&mlon=${rec.lng}#map=18/${rec.lat}/${rec.lng}`;
    osm.target = '_blank';
    osm.rel = 'noopener';
    osm.setAttribute('aria-label', `Открыть ${label.toLocaleLowerCase('ru-RU')} в OpenStreetMap`);
    if (!index)osm.id = 'osm-link';
    actions.append(save, copy, osm);
    const placeDetails = node('details', 'mobile-place-details'), placeContent = node('div', 'mobile-place-content'), linkActions = node('div', 'place-actions');
    placeDetails.append(node('summary', '', 'Координаты и ссылки'), placeContent);
    const briefDetails = node('details', 'mobile-rec-details');
    briefDetails.append(node('summary', '', 'Подробнее о месте'));
    const explanation = explanationBlock(rec,{compact:true});
    const check = node('p','mobile-field-check',recommendationBrief(rec).check);
    briefDetails.append(node('h3','','Проверить на месте'),check);
    const secondaryActions=node('div','mobile-save-secondary'),compare=button('Сравнить','compare-saved-link',openSavedComparison);compare.hidden=true;secondaryActions.append(compare);
    const savedId=`${data.analysis_id}:${rec.rank}`;if(state.saved.some(item=>item.id===savedId))card.dataset.savedFeedbackId=savedId;
    card.append(toggle, body);
    const comparisonText = alternative ? alternativeExplanation(rec, data.recommendations) : placeDifference(rec);
    const difference = node('p', 'place-difference', comparisonText);
    difference.hidden = !comparisonText;
    if (!alternative) difference.title='Доля общих жителей рассчитана от жителей в радиусе этого места.';
    const correctionDelta = node('p', 'correction-delta');
    const delta = rec.correction_delta;
    const hasCorrections = data.correction_context?.counts.added || data.correction_context?.counts.removed;
    correctionDelta.hidden = !delta || !hasCorrections;
    if (delta && hasCorrections) {
      const points = Math.round(rec.score * 100) - Math.round(delta.baseline_score * 100);
      const magnitude = Math.abs(points);
      const unit = new Intl.PluralRules('ru').select(magnitude);
      const scoreChange = points
        ? `Изменилось из-за поправок · ${points > 0 ? '+' : '−'}${fmt(magnitude)} ${{one:'балл',few:'балла',many:'баллов'}[unit]}`
        : 'Баллы в этой точке не изменились';
      correctionDelta.textContent = delta.is_new_location ? `Новое место · ${scoreChange.toLocaleLowerCase('ru-RU')}` : scoreChange;
      correctionDelta.title = 'Разница для тех же координат. Поправки могут изменить относительную шкалу оценки.';
      explanation.append(node('p', 'hint', correctionDelta.title));
    }
    const entry = { card, body, content, toggle, heading, coordinate, metrics, brief,reasons,difference,correctionDelta,secondaryActions, actions, save, copy, osm, confirmation, explanation, showOnMap, placeDetails, placeContent, linkActions, briefDetails };
    mobileCards.set(rec.rank, entry);
    arrangeMobileCard(entry);
    list.append(card);
    countTo(heading.querySelector('.score'), Math.round(rec.score * 100), { animate: newAnalysis, suffix: ' из 100', from: previous[0] });
    countTo(people.querySelector('strong'), Math.round(rec.residents_in_radius), { animate: newAnalysis, prefix: '≈ ', from: previous[1] });
    countTo(competition.querySelector('strong'), rec.competitors_in_radius, { animate: newAnalysis, from: previous[2] });
    if (newAnalysis) animateUI(card,[{opacity:0,transform:'translateY(var(--motion-distance-small))'},{opacity:1,transform:'translateY(0)'}],'calculation-result',{delay:motionStagger()*(3+index*2/3),duration:'workspace',easing:'emphasized'});
  });
  updateSaveButtons();
  $('kpi-business').textContent = data.business_name;
  $('map-context').textContent = `${data.district_name} · ${data.business_name}`;
  if ($('analysis-context')) $('analysis-context').textContent = `${data.district_name} · ${data.business_name}`;
  const warning = [data.source === 'demo'?'Показаны демонстрационные данные: не используйте их для выбора места без проверки.': '', data.warning, data.notice].filter(Boolean).join(' ');
  $('data-warning').textContent = warning;
  $('data-warning').hidden = !warning;
  if (warning && newAnalysis) reveal($('data-warning'), 'notice');
  $('data-section').hidden = false;
  const details=qualityBlock(data,false,true);
  details.querySelector('.quality-summary').remove();
  details.querySelector('.quality-limitation').remove();
  const delivery=deliverySummary(data);
  if(delivery)details.append(node('p','',delivery));
  $('data-quality')?.replaceChildren(details);
  const quality = qualitySummary(data);
  $('source').textContent = `${quality.source} · ${quality.freshness} · ${quality.completeness}`;
  const summary = `${state.openedScenarioId ? 'Сохранённый расчёт · ' : ''}${quality.source} · ${quality.freshness} · ${quality.completeness}`;
  if ($('trust-summary')) {
    $('trust-summary').dataset.resultSummary = summary;
    const date=dataDate(data);
    const compact=data.source==='demo'?'Демонстрационные данные':`OpenStreetMap · ${date?'обновлено '+new Date(date).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}):'дата неизвестна'}`;
    $('trust-summary').dataset.compactSummary=compact;
    $('trust-summary').textContent = compact;
    $('trust-summary').title=summary;
  }
  if ($('data-summary')) $('data-summary').textContent = 'Даты и качество данных';
  updateReportAvailability();
  document.dispatchEvent(new CustomEvent('gm:analysis-rendered', { detail: { data, preserveViewport } }));
}
