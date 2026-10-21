import { state } from './state.js';
import { $, node, button, fmt, coords, distance, openDialog, closeDialog, initDialogMotion, reveal, cancelRevealsWithin } from './ui.js';
import { SCENARIO_KEY, SCENARIO_LIMIT, readScenarios, mutateScenarios, clearDamagedScenarios, duplicateScenario } from './scenario-storage.js';
import { qualityBlock, qualitySummary } from './data-quality.js';
import { exportScenariosCSV, printScenarios } from './scenario-report.js';

let callbacks = {}, pending = false, damagedRaw = null, storageProblem = false, editingId = null, draft = null, deletingId = null;
export function configureScenarios(config) { callbacks = config; }
const writable = () => !!navigator.locks?.request && !storageProblem;
const selected = () => state.scenarios.filter(item => state.scenarioComparison.has(item.id));
const status = text => { $('scenario-status').textContent = text; $('scenario-status').hidden = !text; };
const timestamp = value => value ? new Date(value).toLocaleString('ru-RU') : 'Не указана';
const recText = rec => rec ? `Место ${rec.rank}: ${coords(rec)}; ≈ ${fmt(rec.residents_in_radius)} жителей в ${fmt(rec.radius_m)} м; ${fmt(rec.competitors_in_radius)} конкурентов; ближайший: ${distance(rec.nearest_competitor_m)}` : 'Не оценено';

function explainError(error) {
  return ({ invalid: 'Сохранённые исследования повреждены. Исходные данные сохранены; скачайте JSON перед очисткой.', unsupported: 'Версия сохранённых исследований не поддерживается. Исходные данные сохранены; доступна выгрузка JSON.', unavailable: 'Хранилище браузера недоступно или переполнено. Предыдущие исследования сохранены. Освободите место либо скачайте CSV.', no_locks: 'Этот браузер не поддерживает безопасную запись исследований. Чтение и экспорт доступны; для изменений используйте браузер с Web Locks.', limit: `Можно сохранить до ${SCENARIO_LIMIT} исследований. Удалите ненужный или скачайте CSV.`, size: 'Снимок превышает допустимый размер. Сохраните нужные сведения в CSV или выберите меньшую область.', conflict: 'Исследования изменились в другой вкладке. Список обновлён; повторите действие.' })[error.code] || 'Не удалось сохранить изменение. Предыдущие исследования сохранены.';
}
function accept(items) {
  state.scenarios = items;
  state.scenarioComparison = new Set([...state.scenarioComparison].filter(id => items.some(item => item.id === id)));
}
function load() {
  try { accept(readScenarios()); storageProblem = false; damagedRaw = null; }
  catch (error) { storageProblem = true; damagedRaw = typeof error.raw === 'string' ? error.raw : null; status(explainError(error)); }
  render();
}
async function change(transform, success, after) {
  if (pending) return false;
  pending = true; updateScenarioAvailability();
  $('scenario-submit').disabled = true;
  $('scenario-submit').textContent = 'Сохраняем…';
  status('Сохраняем изменения…');
  let succeeded = false;
  try {
    accept(await mutateScenarios(transform));
    storageProblem = false; render(); status(success); succeeded = true;
  } catch (error) {
    if (error.code === 'conflict') load();
    status(explainError(error));
  } finally { pending = false; updateScenarioAvailability(); $('scenario-submit').disabled = false; $('scenario-submit').textContent = 'Сохранить'; }
  if (succeeded) after?.();
  return succeeded;
}

function focusAfterRemoval(index = 0) {
  const cards = $('scenario-list').children;
  const available = element => element?.isConnected && !element.disabled
    && !element.closest('[hidden],[inert]') && element.getClientRects().length
    && getComputedStyle(element).visibility !== 'hidden';
  const card = cards[Math.min(index, cards.length - 1)];
  if (available(card)) { card.focus(); return; }
  const save = $('scenario-save');
  if (available(save)) { save.focus(); return; }
  const heading = [$('map-title'), $('settings-title'), $('page-title')].find(available);
  if (heading) { heading.tabIndex = -1; heading.focus(); }
}

function editDialog(item = null) {
  if (!writable() || pending) return;
  editingId = item?.id || null;
  if (!item) {
    try { const current = callbacks.captureCurrent?.(); draft = current ? structuredClone(current) : null; }
    catch { draft = null; }
    if (!draft) { status('Сначала выполните расчёт для выбранной области.'); return; }
  }
  $('scenario-dialog-title').textContent = item ? 'Изменить исследование' : 'Сохранить исследование';
  const analysis = item?.analysis || draft.analysis;
  $('scenario-form-context').textContent = `${analysis.district_name} · ${analysis.business_name}. Снимок включает карту, рекомендации и настройки.`;
  $('scenario-name').value = item?.name || `${analysis.district_name} · ${analysis.business_name} · ${new Date().toLocaleDateString('ru-RU')}`.slice(0, 80);
  $('scenario-note').value = item?.note || '';
  $('scenario-form-error').hidden = true;
  openDialog($('scenario-dialog'));
  $('scenario-name').focus();
}
async function submit(event) {
  event.preventDefault();
  const name = $('scenario-name').value.trim(), note = $('scenario-note').value.trim();
  if (!name || name.length > 80 || note.length > 500) {
    $('scenario-form-error').textContent = 'Укажите название от 1 до 80 символов и заметку до 500 символов.';
    $('scenario-form-error').hidden = false; $('scenario-name').focus(); return;
  }
  const now = new Date().toISOString(), id = editingId;
  // The complete draft was captured before opening the modal, before any lock wait.
  const record = id ? null : { ...draft, id: crypto.randomUUID(), name, note, saved_at: now, updated_at: now };
  const ok = await change(latest => {
    if (!id) return [...latest, record];
    if (!latest.some(item => item.id === id)) throw Object.assign(new Error('Scenario was deleted'), { code: 'conflict' });
    return latest.map(item => item.id === id ? { ...item, name, note, updated_at: now } : item);
  }, id ? 'Исследование изменено.' : 'Исследование сохранено в этом браузере.');
  if (ok) closeDialog($('scenario-dialog'));
  else { $('scenario-form-error').textContent = $('scenario-status').textContent; $('scenario-form-error').hidden = false; }
}

function toggleCompare(item) {
  if (state.scenarioComparison.has(item.id)) state.scenarioComparison.delete(item.id);
  else if (state.scenarioComparison.size < 2) state.scenarioComparison.add(item.id);
  else { status('Для сравнения можно выбрать ровно два исследования. Снимите один из выбранных.'); return; }
  const control = document.querySelector(`[data-scenario-id="${item.id}"] [data-testid="scenario-compare"]`);
  control?.setAttribute('aria-pressed', String(state.scenarioComparison.has(item.id)));
  control?.closest('article')?.classList.toggle('is-compared', state.scenarioComparison.has(item.id));
  renderComparison(); updateScenarioAvailability();
}
function renderComparison() {
  const container = $('scenario-comparison'), items = selected();
  container.replaceChildren(); container.hidden = !items.length;
  if (!items.length) return;
  container.append(node('h3', '', 'Сравнение исследований'));
  if (items.length === 1) { container.append(node('p', 'notice', 'Выберите второе исследование для сравнения.')); return; }
  const [left, right] = items, a = left.analysis, b = right.analysis;
  const sameRadius = a.parameters.radius_m === b.parameters.radius_m;
  const comparable = sameRadius && left.selection.business === right.selection.business && left.selection.area_radius_m === right.selection.area_radius_m;
  container.append(node('p', 'notice', comparable ? 'Радиусы модели совпадают. Сопоставляйте абсолютные показатели с учётом охвата и дат; оба снимка зависят от полноты OSM.' : 'Категории, радиусы или охват различаются. Основания сравнения разные; большее население круга не означает лучшее место. Оба снимка зависят от полноты OSM.'));
  if (sameRadius) {
    const ar = a.recommendations[0], br = b.recommendations[0];
    if (ar && br) container.append(node('p', 'hint', `Разница населения в одинаковом радиусе лучших точек: ${fmt(Math.abs(ar.residents_in_radius - br.residents_in_radius))} жителей (оценка). Разница числа отмеченных конкурентов: ${fmt(Math.abs(ar.competitors_in_radius - br.competitors_in_radius))}. Это различия показателей, не рейтинг.`));
  }
  const scroll = node('div', 'table-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Таблица сравнения исследований, доступна горизонтальная прокрутка');
  const table = node('table'), head = node('thead'), tr = node('tr');
  ['Показатель', ...items.map(item => item.name)].forEach(text => { const th = node('th', '', text); th.scope = 'col'; tr.append(th); });
  head.append(tr); table.append(head);
  const body = node('tbody');
  const rows = [
    ['Область', item => item.analysis.district_name],
    ['Центр / радиус области', item => `${(item.selection.custom_point || item.analysis.analysis_context?.center || item.analysis.center).join(', ')} / ${fmt(item.selection.area_radius_m)} м`],
    ['Категория / радиус модели / коэффициент', item => `${item.analysis.business_name} / ${fmt(item.analysis.parameters.radius_m)} м / ${item.analysis.parameters.alpha}`],
    ['Порог зон', item => `${item.view.threshold}%`],
    ['Дата расчёта / сохранения', item => `${timestamp(item.analysis.calculated_at)} / ${timestamp(item.saved_at)}`],
    ['Источник / свежесть / полнота', item => { const q = qualitySummary(item.analysis); return `${q.source}. ${q.freshness}. ${q.completeness}`; }],
    ['Даты исходных данных', item => qualitySummary(item.analysis).dates.join('; ')],
    ['Население / дома в выборке', item => `≈ ${fmt(item.analysis.stats.residents)} / ${fmt(item.analysis.stats.houses)}`],
    ['Конкуренты в выборке, включая соседние территории', item => fmt(item.analysis.stats.competitors)],
    ['Число предложенных точек', item => item.analysis.recommendations.length],
    ['Лучшая точка внутри своего расчёта', item => recText(item.analysis.recommendations.find(rec => rec.rank === 1))],
    ['Выбранное место', item => recText(item.analysis.recommendations.find(rec => rec.rank === item.view.selected_rank))],
    ['Ограничения данных', item => qualitySummary(item.analysis).reasons.join(' ')],
    ['Заметка', item => item.note || 'Не указана']
  ];
  rows.forEach(([title, value]) => { const row = node('tr'), label = node('th', '', title); label.scope = 'row'; row.append(label); items.forEach(item => row.append(node('td', '', value(item)))); body.append(row); });
  table.append(body); scroll.append(table); container.append(scroll);
}

function render() {
  const visible = !!state.scenarios.length || storageProblem;
  $('scenarios-section').hidden = !visible;
  document.querySelectorAll('a[href="#scenarios-section"]').forEach(link => { link.hidden = !visible; });
  cancelRevealsWithin($('scenario-list'));
  $('scenario-list').replaceChildren();
  $('scenario-count').textContent = `${state.scenarios.length} / ${SCENARIO_LIMIT}`;
  $('scenario-empty').hidden = !!state.scenarios.length || storageProblem;
  $('scenario-repair').hidden = damagedRaw === null;
  state.scenarios.forEach(item => {
    const card = node('article', `scenario-card${state.scenarioComparison.has(item.id) ? ' is-compared' : ''}`), a = item.analysis;
    card.dataset.testid = 'scenario-card'; card.dataset.scenarioId = item.id;
    card.tabIndex = -1;
    card.append(node('h3', '', item.name), node('p', 'scenario-context', `${a.district_name} · ${a.business_name}`), node('p', '', `Расчёт: ${timestamp(a.calculated_at)} · Сохранён: ${timestamp(item.saved_at)}`), qualityBlock(a, true), node('p', '', `Выбрано ${recText(a.recommendations.find(rec => rec.rank === item.view.selected_rank))}`), node('p', 'scenario-note', item.note || 'Заметка не добавлена'));
    const actions = node('div', 'scenario-actions');
    const add = (label, testid, action, mutation = false) => {
      const control = button(label, 'button secondary', action); control.dataset.testid = testid;
      if (mutation) { control.dataset.scenarioMutation = ''; control.disabled = !writable() || pending; }
      actions.append(control); return control;
    };
    add('Открыть на карте', 'scenario-open', async () => {
      try { await callbacks.restoreScenario(item); status(`Открыто исследование «${item.name}». Снимок восстановлен без нового запроса геоданных.`); }
      catch { status('Этот район или категория недоступны в текущем каталоге. Снимок сохранён: его можно читать, сравнивать и экспортировать. Текущая карта не изменена.'); }
    });
    add('Изменить', 'scenario-edit', () => editDialog(item), true);
    add('Дублировать', 'scenario-duplicate', () => change(latest => {
      const original = latest.find(row => row.id === item.id);
      if (!original) throw Object.assign(new Error('Deleted'), { code: 'conflict' });
      return [...latest, duplicateScenario(original)];
    }, 'Копия исследования сохранена.'), true);
    const compare = add('Сравнить', 'scenario-compare', () => toggleCompare(item));
    compare.setAttribute('aria-pressed', String(state.scenarioComparison.has(item.id)));
    add('Удалить', 'scenario-delete', () => { deletingId = item.id; $('scenario-delete-name').textContent = item.name; openDialog($('scenario-delete-dialog')); $('scenario-delete-cancel').focus(); }, true);
    card.append(actions); $('scenario-list').append(card); reveal(card, 'scenario');
  });
  renderComparison(); updateScenarioAvailability();
}

export function updateScenarioAvailability() {
  if (!$('scenario-save')) return;
  $('scenario-save').disabled = pending || !writable() || !state.current;
  $('scenario-save').title = !navigator.locks?.request ? 'Для записи исследований требуется браузер с Web Locks.' : '';
  document.querySelectorAll('[data-scenario-mutation]').forEach(control => { control.disabled = pending || !writable(); });
  $('scenario-export').disabled = !state.scenarios.length;
  $('scenario-export').textContent = selected().length === 2 ? 'Скачать CSV двух исследований' : 'Скачать CSV всех исследований';
  $('scenario-print').disabled = selected().length !== 2;
  $('scenario-reset').disabled = pending || !navigator.locks?.request;
  $('scenario-reset-confirm').disabled = pending || !navigator.locks?.request;
  const archived = !!state.openedScenarioId && !!state.current;
  $('scenario-snapshot-notice').hidden = !archived;
  $('scenario-snapshot-notice').textContent = archived ? `Сохранённый расчёт от ${timestamp(state.current.calculated_at)}. Снимок открыт без обновления геоданных. Нажмите «Найти места», чтобы пересчитать; сохранённое исследование останется прежним.` : '';
}

export function initScenarios() {
  state.scenarios ||= []; state.scenarioComparison ||= new Set();
  ['scenario-dialog', 'scenario-delete-dialog', 'scenario-reset-dialog'].forEach(id => initDialogMotion($(id)));
  $('scenario-save').addEventListener('click', () => editDialog());
  $('scenario-form').addEventListener('submit', submit);
  $('scenario-cancel').addEventListener('click', () => closeDialog($('scenario-dialog')));
  $('scenario-delete-cancel').addEventListener('click', () => closeDialog($('scenario-delete-dialog')));
  $('scenario-delete-confirm').addEventListener('click', async () => {
    const id = deletingId, index = state.scenarios.findIndex(item => item.id === id);
    await change(latest => latest.filter(item => item.id !== id), 'Исследование удалено.', () => {
      closeDialog($('scenario-delete-dialog'));
      focusAfterRemoval(index);
    });
  });
  $('scenario-export').addEventListener('click', () => exportScenariosCSV(selected().length === 2 ? selected() : state.scenarios));
  $('scenario-print').addEventListener('click', () => printScenarios(selected()));
  $('scenario-download-raw').addEventListener('click', () => {
    if (damagedRaw === null) return;
    const url = URL.createObjectURL(new Blob([damagedRaw], { type: 'application/json;charset=utf-8' })), link = node('a');
    link.href = url; link.download = 'geomarketing-scenarios-original.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('scenario-reset').addEventListener('click', () => { openDialog($('scenario-reset-dialog')); $('scenario-reset-cancel').focus(); });
  $('scenario-reset-cancel').addEventListener('click', () => closeDialog($('scenario-reset-dialog')));
  $('scenario-reset-confirm').addEventListener('click', async () => {
    if (pending) return;
    pending = true; updateScenarioAvailability();
    try { await clearDamagedScenarios(damagedRaw); closeDialog($('scenario-reset-dialog')); status('Повреждённый список исследований очищен.'); load(); }
    catch (error) { closeDialog($('scenario-reset-dialog')); load(); status(explainError(error)); }
    finally { pending = false; updateScenarioAvailability(); }
    if (storageProblem && !$('scenario-repair').hidden) $('scenario-reset').focus();
    else focusAfterRemoval();
  });
  window.addEventListener('storage', event => { if (event.key === SCENARIO_KEY || event.key === null) { load(); if (!storageProblem) status('Список исследований обновлён из другой вкладки.'); } });
  load();
  if (!navigator.locks?.request && !storageProblem) status(explainError({ code: 'no_locks' }));
}
