import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const { exportCompetitorsCSV, printFieldChecklist } = await import('../../static/js/report.js');

class Element {
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
    { id: 'node:123', source: 'osm', lat: 52.602, lng: 39.5 },
    { id: 'manual-b', source: 'manual', lat: 52.601, lng: 39.5 }
  ]
};

test('CSV конкурентов разделяет источники OSM и вручную и сохраняет координаты', async () => {
  let url;
  const link = { click() { url = this.href; }, remove() {} };
  globalThis.document = { createElement: () => link, body: { append() {} } };
  exportCompetitorsCSV(analysis);
  const csv = await (await fetch(url)).text();
  assert.equal(csv, '"Широта";"Долгота";"Идентификатор";"Источник"\r\n"52.602";"39.5";"node:123";"OSM"\r\n"52.601";"39.5";"manual-b";"вручную"');
});

test('чек-лист печатает выбранное место, ближайших конкурентов, поправки и поля проверки', () => {
  const report = new Element(), printed = [];
  globalThis.document = { getElementById: () => report, createElement: () => new Element() };
  globalThis.window = { print: () => printed.push(report.textContent) };
  printFieldChecklist(analysis, analysis.recommendations[0]);
  assert.equal(printed.length, 1);
  assert.match(printed[0], /Чек-лист проверки на месте/);
  assert.match(printed[0], /Адрес: _+/);
  assert.match(printed[0], /88\s*из\s*100/);
  assert.match(printed[0], /111\s*м.*вручную.*222\s*м.*OSM/s);
  assert.match(printed[0], /добавлено вручную: 1, убрано: 2/);
  assert.match(printed[0], /Подтверждено.*Нет.*Заметки/);
});
