export const $ = id => document.getElementById(id);
export const fmt = n => Math.round(n).toLocaleString('ru-RU');
export const coords = p => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
export const distance = n => n === null ? 'Не найдены в данных области' : `${fmt(n)} м`;
export const STORAGE_KEY = 'geomarketing.saved.v1';
export const LIMITATIONS = 'Население оценено по площади и этажности домов. Расстояния по прямой. Данные OpenStreetMap могут быть неполными или устаревшими. Модель не учитывает аренду, наличие помещений, пешеходные маршруты, доходы и поток посетителей. Относительную оценку нельзя сравнивать между разными расчётами.';
export const node = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
export const button = (text, className, action) => {
  const b = node('button', className, text);
  b.type = 'button';
  b.addEventListener('click', action);
  return b;
};
export const dateText = value => value ? new Date(value).toLocaleDateString('ru-RU') : 'Не указана';
export const sourceText = source => source === 'demo' ? 'Демонстрационные данные' : `OpenStreetMap${source === 'cache' ? ', сохранённая копия' : ''}`;

export function showError(message) {
  $('error').textContent = message;
  $('error').hidden = false;
}

export function storageStatus(message) {
  $('storage-status').textContent = message;
  $('storage-status').hidden = false;
}

export function dataDate(data) {
  const dates = Object.values(data.data_meta || {}).map(i => i.fetched_at).filter(Number.isFinite);
  return dates.length ? new Date(Math.min(...dates) * 1000).toISOString() : null;
}
