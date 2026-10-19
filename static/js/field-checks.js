import { node, initDisclosure, animateUI, cancelUI } from './ui.js';
import { FIELD_CHECK_KEY, readFieldChecks, setFieldCheck, deleteFieldChecks, resetFieldChecks, fieldChecksWritable } from './field-check-storage.js';

const labels = [
  'Есть свободное помещение',
  'Видимый вход',
  'Есть парковка или удобная остановка',
  'Есть поток людей',
  'Конкуренты проверены вручную',
  'Аренда укладывается в бюджет',
  'Фото и заметки добавлены отдельно'
];
const widgets = new WeakMap();
let listening = false;
const messages = {
  invalid:'Данные проверки повреждены. Отметки не изменены.',
  unsupported:'Проверка сохранена более новой версией приложения. Изменения недоступны.',
  no_locks:'В этом браузере проверка доступна только для чтения.',
  unavailable:'Хранилище браузера недоступно. Отметка не сохранена.',
  membership:'Сохранённые места недоступны. Отметка не сохранена.',
  missing:'Место уже удалено. Отметка не сохранена.',
  limit:'Достигнут предел записей проверки. Отметка не сохранена.',
  conflict:'Запись уже изменилась. Сброс отменён.'
};
export function refreshFieldChecks() {
  document.querySelectorAll('[data-testid="field-checks"]').forEach(element => widgets.get(element)?.refresh());
}
export function fieldChecksBlock(placeId, options = {}) {
  const details = node('details', 'field-checks');
  details.dataset.testid = 'field-checks';
  const summary = node('summary'), title = node('span', '', 'Проверить на месте'), progress = node('span', 'field-check-progress', '0 / 7');
  summary.append(title, progress);
  const content = node('div', 'field-check-content'), hint = node('p', 'field-check-hint', 'Проверка пользователя'), status = node('p', 'field-check-status');
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const inputs = labels.map((text,index) => {
    const label = node('label', 'field-check-item'), input = node('input'); input.type = 'checkbox';
    input.dataset.testid = 'field-check'; input.dataset.checkIndex = index;
    label.append(input, node('span','',text)); content.append(label);
    input.addEventListener('change', async () => {
      const checked = input.checked;
      cancelUI(input);
      details.setAttribute('aria-busy','true');
      let message, persisted = false;
      try { await setFieldCheck(placeId,index,checked,options); persisted = true; message = 'Отметка сохранена в этом браузере.'; }
      catch (error) { message = messages[error.code] || messages.unavailable; }
      // A deleted widget must never receive stale async feedback or be reinserted.
      if (!details.isConnected) return;
      details.removeAttribute('aria-busy');
      refreshFieldChecks(); status.textContent = message;
      if (persisted) animateUI(input, [
        { transform:'scale(1)' },
        { transform:'scale(var(--motion-pulse-scale))', offset:.45 },
        { transform:'scale(1)' }
      ], 'field-check-saved', { duration:'fast' });
    });
    return input;
  });
  const reset = node('button', 'field-check-reset', 'Сбросить повреждённую проверку'); reset.type = 'button'; reset.hidden = true;
  let damagedRaw = null;
  reset.addEventListener('click', async () => {
    const expectedRaw = damagedRaw;
    if (!window.confirm('Сбросить все повреждённые отметки проверки в этом браузере? Сохранённые места останутся.')) return;
    let message;
    try { await resetFieldChecks(expectedRaw, options); message = 'Повреждённая проверка сброшена.'; }
    catch(error) { message = messages[error.code] || messages.unavailable; }
    if (!details.isConnected) return;
    refreshFieldChecks(); status.textContent = message;
  });
  content.prepend(hint); content.append(node('p','field-check-hint','Фото и заметки храните отдельно. Проверка не изменяет оценку места.'),status,reset);
  details.append(summary,content);
  const refresh = () => {
    damagedRaw = null; reset.hidden = true;
    let checks = Array(7).fill(false), writable = fieldChecksWritable(options), message = '';
    if (typeof placeId !== 'string' || placeId.length > 160 || !placeId.length) { writable = false; message = 'Проверка недоступна для этого идентификатора места.'; }
    else {
      try { checks = readFieldChecks(options).find(record => record.place_id === placeId)?.checks || checks; }
      catch(error) {
        writable = false; message = messages[error.code] || messages.unavailable;
        if (error.code === 'invalid') { damagedRaw = error.raw; reset.hidden = !fieldChecksWritable(options); }
      }
      if (!writable && !message) message = messages.no_locks;
    }
    inputs.forEach((input,index) => { input.checked = checks[index]; input.disabled = !writable; });
    progress.textContent = `${checks.filter(Boolean).length} / 7`;
    progress.setAttribute('aria-label',`Проверено ${checks.filter(Boolean).length} из 7`);
    status.textContent = message;
  };
  widgets.set(details,{refresh}); refresh(); initDisclosure(details);
  if (!listening) {
    window.addEventListener('storage',event => { if (event.key === FIELD_CHECK_KEY || event.key === null) refreshFieldChecks(); });
    listening = true;
  }
  return details;
}
export function removeFieldChecks(placeId, options = {}) { return deleteFieldChecks(placeId,options); }
