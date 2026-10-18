import { $, node, fmt, LIMITATIONS, dataDate } from './ui.js';
import { csvCell, reportPlace } from './report.js';
import { qualitySummary, qualityBlock } from './data-quality.js';

const missing = value => value ?? 'Не оценено';
export function exportScenariosCSV(records) {
  if (!records.length) return;
  const rows = [['scenario_id', 'Название', 'Заметка', 'Дата сохранения', 'Дата изменения', 'ID расчёта', 'Дата расчёта', 'Область', 'Категория', 'Центр области', 'Радиус области, м', 'Радиус модели, м', 'Коэффициент конкуренции', 'Порог зон, %', 'Выбранное место', 'Место', 'Широта', 'Долгота', 'Жителей в радиусе (оценка)', 'Конкурентов в радиусе', 'Ближайший конкурент, м', 'Жителей в выборке (оценка)', 'Домов в выборке', 'Конкурентов в выборке, включая соседние территории', 'Источник', 'Свежесть', 'Полнота', 'Дата домов', 'Дата конкурентов', 'Ограничения данных', 'Объяснение', 'Проверить на месте', 'Ограничения модели']];
  records.forEach(item => {
    const a = item.analysis, q = qualitySummary(a);
    a.recommendations.forEach(r => rows.push([item.id, item.name, item.note, item.saved_at, item.updated_at, a.analysis_id, missing(a.calculated_at), a.district_name, a.business_name, (item.selection.custom_point || a.analysis_context?.center || a.center).join(', '), item.selection.area_radius_m, a.parameters.radius_m, a.parameters.alpha, item.view.threshold, item.view.selected_rank, r.rank, r.lat, r.lng, r.residents_in_radius, r.competitors_in_radius, r.nearest_competitor_m, a.stats.residents, a.stats.houses, a.stats.competitors, q.source, q.freshness, q.completeness, q.dates[0], q.dates[1], q.reasons.join(' '), r.explanation ? [...r.explanation.strengths, ...r.explanation.risks].join(' ') : 'Не оценено', r.explanation?.field_checks.join(' ') || 'Не оценено', LIMITATIONS]));
  });
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map(row => row.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })), link = node('a');
  link.href = url;
  link.download = `geomarketing-scenarios-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printScenarios(records) {
  if (records.length !== 2) return;
  const report = $('print-report-content');
  report.replaceChildren(node('h1', '', 'ГеоМаркетинг · Сравнение сценариев'), node('p', '', `Отчёт сформирован ${new Date().toLocaleString('ru-RU')}`), node('p', '', 'Сопоставляйте абсолютные показатели с учётом категории, радиуса и дат. Общего рейтинга сценариев нет. Конкуренты в выборке включают соседние территории.'));
  records.forEach(item => {
    const a = item.analysis, section = node('section', 'scenario-print-context');
    section.append(node('h2', '', item.name), node('p', '', `${a.district_name} · ${a.business_name}. Центр: ${(item.selection.custom_point || a.analysis_context?.center || a.center).join(', ')}. Радиус области: ${fmt(item.selection.area_radius_m)} м. Радиус модели: ${fmt(a.parameters.radius_m)} м; коэффициент: ${a.parameters.alpha}. Порог зон: ${item.view.threshold}%.`), node('p', '', `Расчёт: ${a.calculated_at || 'дата не указана'}. Сохранено: ${item.saved_at}. Выбрано место ${item.view.selected_rank}.`), node('p', '', `В выборке: ≈ ${fmt(a.stats.residents)} жителей, ${fmt(a.stats.houses)} домов, ${fmt(a.stats.competitors)} конкурентов, включая соседние территории.`), node('p', '', `Заметка: ${item.note || 'Не указана'}`), qualityBlock(a));
    a.recommendations.forEach(rec => {
      const place = reportPlace(rec, { ...a, data_date: dataDate(a), saved_at: item.saved_at });
      section.append(place);
    });
    report.append(section);
  });
  report.append(node('h2', '', 'Ограничения модели'), node('p', '', LIMITATIONS), node('p', '', 'Карта в печатный отчёт не включена. Перед арендой проверьте место на местности.'));
  window.print();
}
