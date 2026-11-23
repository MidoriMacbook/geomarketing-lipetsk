import { placeLabel, projectPoint } from './map-analysis.js';
import { scoreText, scoreValue } from './result-format.js';
import { state } from './state.js';
import { $, fmt, coords, distance, LIMITATIONS, node, dateText, sourceText, dataDate } from './ui.js';
import { comparisonRows } from './saved-places.js';
import { qualitySummary, qualityBlock, explanationBlock } from './data-quality.js';


export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCSV(rows, filePrefix) {
  const blob = new Blob(['\uFEFF', rows.map(row => row.map(csvCell).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8'
  });
  const url = URL.createObjectURL(blob), link = node('a');
  link.href = url;
  link.download = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function competitorSource(competitor, analysis) {
  if (competitor.source === 'manual') return 'вручную';
  return analysis.source === 'demo' ? 'демо' : 'OSM';
}

export function exportCompetitorsCSV(analysis) {
  if (!analysis?.competitors.length) return;
  downloadCSV([
    ['Широта', 'Долгота', 'Идентификатор', 'Источник'],
    ...analysis.competitors.map(row => [row.lat, row.lng, row.id, competitorSource(row, analysis)])
  ], 'geomarketing-competitors');
}

export function correctionSummary(analysis) {
  const counts = analysis?.correction_context?.counts;
  return counts ? `Поправки: добавлено вручную: ${fmt(counts.added)}, убрано: ${fmt(counts.removed)}.` : '';
}

export function exportCSV() {
  const rows = [['Категория', 'Район', 'Место', 'Широта', 'Долгота', 'Жителей (оценка)', 'Радиус, м', 'Конкурентов в радиусе', 'Ближайший конкурент, м', 'Относительная оценка (только внутри расчёта) — из 100', 'ID расчёта', 'Коэффициент конкуренции', 'Дата данных', 'Дата сохранения', 'Источник', 'Предупреждения', 'Ограничения модели', 'Свежесть данных', 'Пригодность данных', 'Причины ограничений'], ...state.saved.map(i => {
    const r = i.recommendation;
    const quality=qualitySummary(i);
    return [i.business_name, i.district_name, r.origin==='manual'?'выбрано вручную':r.rank, r.lat, r.lng, r.residents_in_radius, r.radius_m, r.competitors_in_radius, r.nearest_competitor_m, scoreValue(r.score), i.analysis_id, i.parameters.alpha, i.data_date || 'Не указана', i.saved_at, sourceText(i.source), i.warning, LIMITATIONS,quality.freshness,quality.completeness,quality.reasons.join(' | ')];
  })];
  downloadCSV(rows, 'geomarketing-lipetsk');
}

function selectedPlace() {
  return state.current?.recommendations.find(place => place.rank === state.selectedRank);
}

export function initCorrectionReportActions() {
  $('competitors-export')?.addEventListener('click', () => exportCompetitorsCSV(state.current));
  $('print-field-checklist')?.addEventListener('click', () => printFieldChecklist(state.current, selectedPlace()));
}

export function updateReportAvailability() {
  $('print-report').disabled = !state.current && !state.comparison.size;
  const exportButton = $('competitors-export'), checklistButton = $('print-field-checklist');
  if (exportButton) exportButton.disabled = !state.current?.competitors.length;
  if (checklistButton) checklistButton.disabled = !selectedPlace();
}

export function printFieldChecklist(analysis, place) {
  if (!analysis || !place) return;
  const [x, y] = projectPoint(place, analysis.center);
  const closest = analysis.competitors.map(competitor => {
    const [cx, cy] = projectPoint(competitor, analysis.center);
    return { competitor, meters: Math.hypot(cx - x, cy - y) };
  }).sort((a, b) => a.meters - b.meters).slice(0, 3);
  const report = $('print-report-content');
  const address = typeof place.address === 'string' && place.address.trim() ? place.address : '________________________';
  report.replaceChildren(
    node('h1', '', 'Чек-лист проверки на месте'),
    node('p', '', `${analysis.district_name} · ${analysis.business_name} · ${placeLabel(place)}`),
    node('p', '', `Адрес: ${address}`),
    node('p', '', `Координаты: ${coords(place)}. Относительная оценка внутри расчёта: ${scoreText(place.score)}.`)
  );
  const corrections = correctionSummary(analysis);
  if (corrections) report.append(node('p', '', corrections));
  report.append(node('h2', '', 'Ближайшие конкуренты по прямой'));
  if (closest.length) {
    const list = node('ol');
    for (const { competitor, meters } of closest) {
      list.append(node('li', '', `${distance(meters)} · ${coords(competitor)} · ${competitorSource(competitor, analysis)}`));
    }
    report.append(list);
  } else {
    report.append(node('p', '', 'В данных расчёта конкуренты не найдены.'));
  }
  report.append(
    node('p', '', `Источник: ${sourceText(analysis.source)}.`),
    node('p', '', 'Проверено: ☐ Подтверждено    ☐ Нет'),
    node('h2', '', 'Заметки'),
    node('p', '', '________________________________________________'),
    node('p', '', '________________________________________________'),
    node('p', '', '________________________________________________')
  );
  window.print();
}

export function reportPlace(rec, context, { includeContext = true } = {}) {
  const block = node('article', 'report-place');
  block.append(
    node('h3', '', includeContext ? `${context.business_name} · ${placeLabel(rec)} · ${context.district_name}` : placeLabel(rec)),
    node('p', '', `Координаты: ${coords(rec)}. Жителей в радиусе ${fmt(rec.radius_m)} м: ≈ ${fmt(rec.residents_in_radius)}. Конкурентов в радиусе: ${fmt(rec.competitors_in_radius)}. Ближайший конкурент: ${distance(rec.nearest_competitor_m)}.`),
    node('p', '', `Относительная оценка внутри расчёта: ${scoreText(rec.score)}.${includeContext ? ` Радиус модели: ${context.parameters.radius_m} м; коэффициент конкуренции: ${context.parameters.alpha.toLocaleString('ru-RU')}. ID расчёта: ${context.analysis_id}.` : ''}`)
  );
  if (includeContext) {
    block.append(node('p', '', `Источник: ${sourceText(context.source)}. Дата данных: ${dateText(context.data_date)}${context.saved_at ? `. Сохранено: ${dateText(context.saved_at)}` : ''}.`));
    if (context.warning) block.append(node('p', '', `Предупреждение: ${context.warning}`));
    block.append(qualityBlock(context));
  }
  block.append(explanationBlock(rec, { expanded: true }));
  return block;
}

function reportAnalysis(context) {
  const block = node('section', 'report-analysis-context');
  const center = context.analysis_context?.center || context.center;
  const areaRadius = context.analysis_context?.requested_radius_m || context.half_m;
  block.append(
    node('h2', '', 'Текущий расчёт'),
    node('h3', '', `${context.district_name} · ${context.business_name}`),
    node('p', '', `Центр области: ${center.map(value => value.toFixed(5)).join(', ')}. Радиус области: ${fmt(areaRadius)} м. Радиус модели: ${fmt(context.parameters.radius_m)} м; коэффициент конкуренции: ${context.parameters.alpha.toLocaleString('ru-RU')}.`),
    node('p', '', `Дата расчёта: ${context.calculated_at ? new Date(context.calculated_at).toLocaleString('ru-RU') : 'Не указана'}. ID расчёта: ${context.analysis_id}.`),
    node('p', '', `В выборке: ≈ ${fmt(context.stats.residents)} жителей, ${fmt(context.stats.houses)} домов, ${fmt(context.stats.competitors)} конкурентов, включая соседние территории.`),
    qualityBlock(context)
  );
  const corrections = correctionSummary(context);
  if (corrections) block.append(node('p', '', corrections));
  return block;
}

export function printReport() {
  const report = $('print-report-content');
  report.replaceChildren(node('h1', '', 'ГеоМаркетинг · Липецк'), node('p', '', `Отчёт сформирован ${new Date().toLocaleString('ru-RU')}`));
  if (state.current) {
    const context = {
      ...state.current,
      data_date: dataDate(state.current)
    };
    report.append(reportAnalysis(context), node('h2', '', 'Рекомендации текущего расчёта'));
    if (!state.current.recommendations.length) report.append(node('p', 'report-empty', 'Подходящих мест не найдено. Расчёт не предложил точек; измените область или её радиус и выполните новый расчёт.'));
    state.current.recommendations.forEach(r => report.append(reportPlace(r, context, { includeContext: false })));
  }
  const items = comparisonRows();
  if (items.length) {
    report.append(node('h2', '', 'Сравнение сохранённых мест'));
    const table = $('comparison').querySelector('table').cloneNode(true);
    report.append(table);
    items.forEach(i => report.append(reportPlace(i.recommendation, i)));
  }
  report.append(node('h2', '', 'Ограничения и интерпретация'), node('p', '', LIMITATIONS), node('p', '', 'Перед открытием бизнеса проверьте место на местности. Карта в печатный отчёт не включена.'));
  window.print();
}
