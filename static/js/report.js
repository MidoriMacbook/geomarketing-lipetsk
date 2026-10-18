import { state } from './state.js';
import { $, fmt, coords, distance, LIMITATIONS, node, dateText, sourceText, dataDate } from './ui.js';
import { comparisonRows } from './saved-places.js';
import { qualitySummary, qualityBlock, explanationBlock } from './data-quality.js';


export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportCSV() {
  const rows = [['Категория', 'Район', 'Место', 'Широта', 'Долгота', 'Жителей (оценка)', 'Радиус, м', 'Конкурентов в радиусе', 'Ближайший конкурент, м', 'Относительная оценка (только внутри расчёта)', 'ID расчёта', 'Коэффициент конкуренции', 'Дата данных', 'Дата сохранения', 'Источник', 'Предупреждения', 'Ограничения модели', 'Свежесть данных', 'Пригодность данных', 'Причины ограничений'], ...state.saved.map(i => {
    const r = i.recommendation;
    const quality=qualitySummary(i);
    return [i.business_name, i.district_name, r.rank, r.lat, r.lng, r.residents_in_radius, r.radius_m, r.competitors_in_radius, r.nearest_competitor_m, r.score, i.analysis_id, i.parameters.alpha, i.data_date || 'Не указана', i.saved_at, sourceText(i.source), i.warning, LIMITATIONS,quality.freshness,quality.completeness,quality.reasons.join(' | ')];
  })];
  const blob = new Blob(['\uFEFF', rows.map(row => row.map(csvCell).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8'
  }), url = URL.createObjectURL(blob), a = node('a');
  a.href = url;
  a.download = `geomarketing-lipetsk-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function updateReportAvailability() {
  $('print-report').disabled = !state.current && !state.comparison.size;
}

export function reportPlace(rec, context) {
  const block = node('article', 'report-place');
  block.append(
    node('h3', '', `${context.business_name} · место ${rec.rank} · ${context.district_name}`),
    node('p', '', `Координаты: ${coords(rec)}. Жителей в радиусе ${fmt(rec.radius_m)} м: ≈ ${fmt(rec.residents_in_radius)}. Конкурентов в радиусе: ${fmt(rec.competitors_in_radius)}. Ближайший конкурент: ${distance(rec.nearest_competitor_m)}.`),
    node('p', '', `Относительная оценка внутри расчёта: ${Math.round(rec.score * 100)}%. Радиус модели: ${context.parameters.radius_m} м; коэффициент конкуренции: ${context.parameters.alpha}. ID расчёта: ${context.analysis_id}.`),
    node('p', '', `Источник: ${sourceText(context.source)}. Дата данных: ${dateText(context.data_date)}${context.saved_at ? `. Сохранено: ${dateText(context.saved_at)}` : ''}.`)
  );
  if (context.warning) block.append(node('p', '', `Предупреждение: ${context.warning}`));
  block.append(qualityBlock(context),explanationBlock(rec));
  return block;
}

export function printReport() {
  const report = $('print-report-content');
  report.replaceChildren(node('h1', '', 'ГеоМаркетинг · Липецк'), node('p', '', `Отчёт сформирован ${new Date().toLocaleString('ru-RU')}`));
  if (state.current) {
    report.append(node('h2', '', 'Рекомендации текущего расчёта'));
    const context = {
      ...state.current,
      data_date: dataDate(state.current),
      warning: [state.current.warning, state.current.notice].filter(Boolean).join(' ')
    };
    state.current.recommendations.forEach(r => report.append(reportPlace(r, context)));
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
