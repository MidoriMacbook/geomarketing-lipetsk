import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const { exportCompetitorsCSV, printFieldChecklist } = await import('../../static/js/report.js');
const { describeCompetitor } = await import('../../static/js/competitor-card.js');

class Element {
  constructor(tagName) { this.tagName = tagName; }
  children = [];
  text = '';

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  set textContent(text) { this.text = text; }
  get textContent() { return [this.text, ...this.children.map(child => child.textContent)].join(' '); }
}

const analysis = {
  source: 'cache', center: [52.6, 39.5], district_name: 'Елецкий', business_name: 'Кофейня',
  recommendations: [{ rank: 1, lat: 52.6, lng: 39.5, score: 0.88 }],
  correction_context: { counts: { added: 1, removed: 2 } },
  competitors: [
    { id: 'node:123', source: 'osm', lat: 52.602, lng: 39.5, name: 'Кофе "У сада"; зал', address: '=42' },
    { id: 'manual-b', source: 'manual', lat: 52.601, lng: 39.5 }
  ]
};

test('CSV конкурентов сохраняет порядок и экранирует названия и адреса OSM', async () => {
  let url;
  const link = { click() { url = this.href; }, remove() {} };
  globalThis.document = { createElement: () => link, body: { append() {} } };
  exportCompetitorsCSV(analysis);
  const csv = await (await fetch(url)).text();
  assert.equal(csv, [
    '"Широта";"Долгота";"Идентификатор";"Источник";"Название";"Адрес"',
    '"52.602";"39.5";"node:123";"OSM";"Кофе ""У сада""; зал";"\'=42"',
    '"52.601";"39.5";"manual-b";"вручную";"";""'
  ].join('\r\n'));
});

test('CSV оставляет необязательные поля демо и старого снимка пустыми', async () => {
  let url;
  const link = { click() { url = this.href; }, remove() {} };
  globalThis.document = { createElement: () => link, body: { append() {} } };
  const competitors = [{ lat: 52.6, lng: 39.5 }];
  for (const [source, expected] of [['demo', 'демо'], ['cache', 'OSM']]) {
    exportCompetitorsCSV({ source, competitors });
    const csv = await (await fetch(url)).text();
    assert.equal(csv.split('\r\n')[1], `"52.6";"39.5";"";"${expected}";"";""`);
  }
});

test('чек-лист печатает выбранное место, ближайших конкурентов, поправки и поля проверки', () => {
  const report = new Element(), printed = [];
  globalThis.document = { getElementById: () => report, createElement: tagName => new Element(tagName) };
  globalThis.window = { print: () => printed.push(report.textContent) };
  printFieldChecklist(analysis, analysis.recommendations[0]);
  assert.equal(printed.length, 1);
  assert.match(printed[0], /Чек-лист проверки на месте/);
  assert.match(printed[0], /Адрес: _+/);
  assert.match(printed[0], /88\s*из\s*100/);
  assert.match(printed[0], /111\s*м.*вручную.*222\s*м.*OSM/s);
  const competitors = report.children.find(child => child.tagName === 'ol');
  assert.match(competitors.children[1].textContent, /Кофе "У сада"; зал.*=42.*222\s*м.*52\.60200, 39\.50000.*OSM.*node:123/s);
  assert.match(printed[0], /добавлено вручную: 1, убрано: 2/);
  assert.match(printed[0], /Подтверждено.*Нет.*Заметки/);
});

test('чек-лист сохраняет адрес проверяемого места и подписывает объект OSM без названия', () => {
  const report = new Element();
  globalThis.document = { getElementById: () => report, createElement: tagName => new Element(tagName) };
  globalThis.window = { print() {} };
  const place = { ...analysis.recommendations[0], address: 'ул. Плеханова, 10' };
  const unnamed = { id: 'way:123', source: 'osm', lat: 52.602, lng: 39.5 };
  printFieldChecklist({ ...analysis, competitors: [unnamed] }, place);
  assert.equal(report.children[2].textContent, 'Адрес: ул. Плеханова, 10');
  const competitors = report.children.find(child => child.tagName === 'ol');
  assert.match(competitors.children[0].textContent, /Без названия \(OSM way 123\).*222\s*м.*52\.60200, 39\.50000.*OSM.*way:123/s);
  assert.ok(!competitors.textContent.includes(place.address));
  assert.ok(!competitors.textContent.includes('Адрес не указан'));
});

test('чек-лист печатает атрибуцию и полный URL лицензии только для источников OSM', () => {
  const report = new Element();
  globalThis.document = { getElementById: () => report, createElement: tagName => new Element(tagName) };
  globalThis.window = { print() {} };
  for (const source of ['osm', 'cache']) {
    printFieldChecklist({ ...analysis, source }, analysis.recommendations[0]);
    const footer = report.children.find(child => child.tagName === 'footer');
    assert.match(footer?.textContent ?? '', /© участники OpenStreetMap.*ODbL.*https:\/\/www\.openstreetmap\.org\/copyright/);
  }
  printFieldChecklist({ ...analysis, source: 'demo', competitors: [] }, analysis.recommendations[0]);
  assert.ok(!report.children.some(child => child.tagName === 'footer'));
});

test('карточка отличает типы объектов с одинаковым числовым ID и без названия', () => {
  for (const type of ['node', 'way', 'relation']) {
    const details = describeCompetitor({ id: `${type}:123`, name: '  ' }, 'cache');
    assert.equal(details.title, `Без названия (OSM ${type} 123)`);
    assert.equal(details.href, `https://www.openstreetmap.org/${type}/123`);
  }
  for (const id of [null, 'way:0', 'node:123\n', 'https://example.test']) {
    const details = describeCompetitor({ id }, 'osm');
    assert.equal(details.title, 'Конкурент OpenStreetMap');
    assert.equal(details.href, null);
  }
});
