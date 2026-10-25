import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshMessage, deliverySummary } from '../../static/js/data-delivery.js';

test('daily refresh distinguishes a new version, unchanged and unavailable', () => {
  const data = status => ({data_delivery:{mode:'daily',status},warning:'Дата сохранена.'});
  assert.match(refreshMessage(data('updated')), /Новая версия/);
  assert.match(refreshMessage(data('unchanged')), /Новых данных пока нет/);
  assert.match(refreshMessage(data('unavailable')), /Не удалось проверить/);
  assert.match(refreshMessage(data('checking')), /уже выполняется/);
  assert.match(deliverySummary(data('current')), /раз в сутки/);
});

test('legacy successful and partial responses remain understandable', () => {
  assert.match(refreshMessage({source:'osm',data_meta:{houses:{cached:false},competitors:{cached:false}}}), /получены из OpenStreetMap/);
  assert.match(refreshMessage({source:'cache',warning:'Нет связи.'}), /Нет связи/);
  assert.equal(deliverySummary({}), '');
});
