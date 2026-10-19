import { state } from './state.js';
import { $, fmt, coords, distance, STORAGE_KEY, node, button, dateText, sourceText, storageStatus, dataDate, reveal, animateUI, exitSnapshot, setRevealed } from './ui.js';
import { checkedQuality, checkedExplanation } from './data-quality.js';
import { fieldChecksBlock, removeFieldChecks, refreshFieldChecks } from './field-checks.js';

let updateReportAvailability = () => {};

export function configureSaved(callbacks) {
  updateReportAvailability = callbacks.updateReportAvailability;
}

export function validSaved(item) {
  const r = item && item.recommendation;
  return item && typeof item.id === 'string' && typeof item.analysis_id === 'string' && item.analysis_id.length > 0 && typeof item.business_name === 'string' && typeof item.district_name === 'string' && typeof item.saved_at === 'string' && Number.isFinite(Date.parse(item.saved_at)) && ['osm', 'cache', 'demo'].includes(item.source) && (item.data_date === null || (typeof item.data_date === 'string' && Number.isFinite(Date.parse(item.data_date)))) && typeof item.warning === 'string' && item.parameters && Number.isFinite(item.parameters.radius_m) && item.parameters.radius_m > 0 && Number.isFinite(item.parameters.alpha) && item.parameters.alpha > 0 && r && [r.rank, r.lat, r.lng, r.score, r.residents_in_radius, r.radius_m, r.competitors_in_radius].every(Number.isFinite) && Number.isInteger(r.rank) && r.rank >= 1 && r.rank <= 3 && r.score >= 0 && r.score <= 1 && r.lat >= -90 && r.lat <= 90 && r.lng >= -180 && r.lng <= 180 && r.radius_m === item.parameters.radius_m && Number.isInteger(r.competitors_in_radius) && r.competitors_in_radius >= 0 && r.residents_in_radius >= 0 && (r.nearest_competitor_m === null || (Number.isFinite(r.nearest_competitor_m) && r.nearest_competitor_m >= 0)) && item.id === `${item.analysis_id}:${r.rank}`;
}

export function readSaved() {
  // Access errors must propagate; treating unreadable storage as an empty list loses data.
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const values = JSON.parse(raw);
    if (!Array.isArray(values) || values.length > 12 || !values.every(validSaved) || new Set(values.map(i => i.id)).size !== values.length) throw new Error('invalid');
    return values.map(item=>{
      const clean={...item,recommendation:{...item.recommendation}};
      if ('data_quality' in clean&&!checkedQuality(clean.data_quality))delete clean.data_quality;
      if ('explanation' in clean.recommendation&&!checkedExplanation(clean.recommendation.explanation))delete clean.recommendation.explanation;
      return clean;
    });
  }
  catch {
    const error = new Error('invalid');
    error.raw = raw;
    throw error;
  }
}

export function loadSaved() {
  try {
    state.saved = readSaved();
    state.repairStorageRaw = null;
    return true;
  }
  catch (error) {
    state.saved = [];
    state.repairStorageRaw = error.message === 'invalid' ? error.raw : null;
    storageStatus(error.message === 'invalid' ? 'Сохранённые данные повреждены. Список не восстановлен. Новое сохранение заменит повреждённую запись.' : 'Хранилище браузера недоступно. Расчёт работает, но места не удастся сохранить.');
    return false;
  }
}

export async function mutateSaved(mutate, allowRepair = false, removedId = null) {
  // Web Locks serialize read-modify-write transactions across tabs on this origin.
  let persisted = false;
  try {
    if (!navigator.locks?.request) {
      storageStatus('В этом браузере согласованное сохранение недоступно. Изменения не сохранены. Используйте актуальный браузер и защищённое соединение.');
      return { success:false, persisted:false };
    }
    return await navigator.locks.request(`${STORAGE_KEY}.write`, async () => {
      let latest;
      try {
        latest = readSaved();
      }
      catch (error) {
        // Only replace the exact damaged record already explained to this tab's user.
        if (allowRepair && error.message === 'invalid' && error.raw === state.repairStorageRaw) latest = [];
        else throw error;
      }
      const result = mutate(latest);
      if (result.next) { localStorage.setItem(STORAGE_KEY, JSON.stringify(result.next)); persisted = true; }
      let cleanupFailed = false;
      if (persisted && removedId !== null && !result.next.some(item => item.id === removedId)) {
        try { await removeFieldChecks(removedId, { readSaved, savedLockHeld:true }); }
        catch { cleanupFailed = true; }
      }
      state.saved = result.next || latest;
      state.repairStorageRaw = null;
      renderSaved();
      updateSaveButtons(!!result.next);
      storageStatus(cleanupFailed ? 'Место удалено. Не удалось очистить его проверку; данные проверки сохранены в браузере.' : result.message);
      return { success:true, persisted, cleanupFailed };
    });
  }
  catch (error) {
    storageStatus(persisted ? 'Изменения сохранены. Не удалось обновить отображение; обновите страницу.' : error.message === 'invalid' ? 'Сохранённые данные повреждены. Изменения не сохранены. Обновите страницу, чтобы проверить запись.' : 'Хранилище браузера недоступно. Изменения не сохранены. Попробуйте другой браузер или разрешите хранение данных сайта.');
    return { success:false, persisted };
  }
}

export async function savePlace(rec) {
  if (!state.current) return;
  // Capture the analysis before awaiting a lock: filters and responses can change while queued.
  const id = `${state.current.analysis_id}:${rec.rank}`;
  const item = {
    id,
    analysis_id: state.current.analysis_id,
    business: state.current.business,
    business_name: state.current.business_name,
    district: state.current.district,
    district_name: state.current.district_name,
    saved_at: new Date().toISOString(),
    source: state.current.source,
    data_date: dataDate(state.current),
    ...(state.current.data_quality?{data_quality:structuredClone(state.current.data_quality),data_meta:structuredClone(state.current.data_meta||{})}:{}),
    ...(state.current.calculated_at?{calculated_at:state.current.calculated_at}:{}),
    warning: [state.current.notice,
    state.current.warning].filter(Boolean).join(' '),
    parameters: {
      ...state.current.parameters
    },
    recommendation: {
      ...rec
    }
  };
  await mutateSaved(latest => {
    if (latest.some(p => p.id === id)) return {
      message: 'Это место из этого расчёта уже сохранено.'
    };
    if (latest.length >= 12) return {
      message: 'Можно сохранить до 12 мест. Удалите одно из списка, чтобы добавить новое.'
    };
    return {
      next: [...latest,
      item],
      message: 'Место сохранено в этом браузере.'
    };
  }, true);
}

export function updateSaveButtons(feedback = false) {
  document.querySelectorAll('[data-testid="save-place"]').forEach(b => {
    const exists = state.saved.some(p => p.id === `${state.current?.analysis_id}:${b.dataset.rank}`);
    const newlySaved = exists && !b.classList.contains('is-saved');
    b.classList.toggle('is-saved', exists);
    b.setAttribute('aria-pressed', String(exists));
    b.textContent = exists ? 'Сохранено ✓' : 'Сохранить';
    b.setAttribute('aria-label', exists ? `Место ${b.dataset.rank} сохранено` : `Сохранить место ${b.dataset.rank}`);
    if (feedback && newlySaved) reveal(b, 'save-feedback', { duration: 'fast' });
  });
}

export function renderSaved() {
  const previous = new Map([...$('saved-list').children].map(card => [card.dataset.savedId, { card, rect: card.getBoundingClientRect() }]));
  const nextIds = new Set(state.saved.map(item => item.id));
  for (const [id, { card }] of previous) if (!nextIds.has(id)) { exitSnapshot(card, 'saved-remove'); card.remove(); }
  state.comparison = new Set([...state.comparison].filter(id => state.saved.some(item => item.id === id)));
  $('saved-count').textContent = `${state.saved.length} / 12`;
  $('nav-saved-count').textContent = state.saved.length;
  setRevealed($('saved-empty'), !state.saved.length, 'empty');
  $('export-csv').disabled = !state.saved.length;
  state.saved.forEach(item => {
    // Saved snapshots are immutable for an ID. Retain surviving cards and their
    // native disclosure/input nodes across storage events, preserving focus.
    if (previous.has(item.id)) {
      const card = previous.get(item.id).card;
      card.querySelector('[data-testid="compare-place"]').checked = state.comparison.has(item.id);
      return;
    }
    const rec = item.recommendation, card = node('article', 'saved-card');
    card.dataset.testid = 'saved-card';
    card.dataset.savedId = item.id;
    card.append(node('h3', '', `${item.business_name} · место ${rec.rank}`), node('p', '', item.district_name), node('p', '', coords(rec)), node('p', 'saved-stats', `≈ ${fmt(rec.residents_in_radius)} жителей · ${fmt(rec.competitors_in_radius)} конкурентов · радиус ${fmt(rec.radius_m)} м`), node('p', '', `Данные: ${dateText(item.data_date)} · ${sourceText(item.source)}`), node('p', '', `Сохранено: ${dateText(item.saved_at)}`));
    if (item.warning) card.append(node('p', '', item.warning));
    const actions = node('div', 'saved-card-actions'), label = node('label'), checkbox = node('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.testid = 'compare-place';
    checkbox.checked = state.comparison.has(item.id);
    checkbox.setAttribute('aria-label', `Сравнить ${item.business_name}, ${item.district_name}, место ${rec.rank}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked && state.comparison.size >= 3) {
        checkbox.checked = false;
        storageStatus('Для сравнения можно выбрать до трёх мест.');
        return;
      }
      checkbox.checked ? state.comparison.add(item.id) : state.comparison.delete(item.id);
      renderComparison();
    });
    label.append(checkbox, node('span', '', 'Сравнить'));
    const remove = button('Удалить', '', () => mutateSaved(latest => ({
      next: latest.filter(p => p.id !== item.id),
      message: 'Место удалено из этого браузера.'
    }), false, item.id));
    remove.setAttribute('aria-label', `Удалить ${item.business_name}, место ${rec.rank}`);
    actions.append(label, remove);
    card.append(actions);
    card.append(fieldChecksBlock(item.id, { readSaved }));
    $('saved-list').append(card);
  });
  refreshFieldChecks();
  for (const card of $('saved-list').children) {
    const before = previous.get(card.dataset.savedId)?.rect;
    if (!before) reveal(card, 'saved-enter');
    else {
      const after = card.getBoundingClientRect(), x = before.left - after.left, y = before.top - after.top;
      if (x || y) animateUI(card, [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], 'saved-flip');
    }
  }
  renderComparison();
  updateReportAvailability();
}

export function comparisonRows() {
  return state.saved.filter(p => state.comparison.has(p.id));
}

export function fillTable(body, items) {
  body.replaceChildren();
  items.forEach(item => {
    const r = item.recommendation, tr = node('tr'), title = node('td', '', `${item.business_name} · место ${r.rank}`);
    title.append(node('small', '', item.district_name), node('small', '', coords(r)));
    tr.append(title, node('td', '', fmt(r.residents_in_radius)), node('td', '', `${fmt(r.radius_m)} м`), node('td', '', fmt(r.competitors_in_radius)), node('td', '', distance(r.nearest_competitor_m)), node('td', '', dateText(item.data_date)));
    body.append(tr);
  });
}

export function renderComparison() {
  const rows = comparisonRows();
  const comparison = $('comparison'), wasVisible = !comparison.hidden;
  setRevealed(comparison, !!rows.length, 'comparison');
  fillTable($('comparison').querySelector('tbody'), rows);
  if (wasVisible && rows.length) reveal(comparison.querySelector('table'), 'comparison-update', { duration: 'fast' });
  updateReportAvailability();
}
