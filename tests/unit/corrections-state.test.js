import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorrectionDraft } from '../../static/js/corrections-state.js';

test('отмена и сброс работают и для восстановленного исследования', () => {
  const point = { id: 'local', lat: 52.6, lng: 39.6 };
  const draft = createCorrectionDraft({ added: [point], removed: [] });
  assert.equal(draft.unsaved, false);
  draft.remove('node:12');
  assert.equal(draft.unsaved, true);
  draft.reset();
  assert.deepEqual(draft.value, { added: [], removed: [] });
  draft.undo();
  assert.deepEqual(draft.value, { added: [point], removed: ['node:12'] });
  draft.undo();
  assert.equal(draft.unsaved, false);
});

test('лимит применяется к сумме добавлений и удалений', () => {
  const draft = createCorrectionDraft();
  for (let i = 0; i < 49; i++) assert.equal(draft.remove(`node:${i + 1}`), true);
  assert.equal(draft.add({ id: 'a', lat: 52.6, lng: 39.6 }), true);
  assert.equal(draft.remove('way:1'), false);
  assert.equal(draft.value.removed.length, 49);
  draft.undo();
  assert.equal(draft.remove('way:1'), true);
});

test('применённый и сохранённый наборы учитываются независимо от порядка', () => {
  const draft = createCorrectionDraft();
  draft.remove('way:1');
  draft.remove('node:2');
  const accepted = { added: [], removed: ['node:2', 'way:1'] };
  assert.equal(draft.pending, true);
  draft.apply(accepted);
  assert.equal(draft.pending, false);
  assert.equal(draft.unsaved, true);
  draft.markSaved(accepted);
  assert.equal(draft.unsaved, false);
});

test('удаление ручного конкурента отменяет добавление без удалённого ID OpenStreetMap', () => {
  const point = { id: 'local', lat: 52.6, lng: 39.6 };
  const draft = createCorrectionDraft({ added: [point], removed: ['node:7'] });
  assert.equal(draft.removeAdded(point.id), true);
  assert.deepEqual(draft.value, { added: [], removed: ['node:7'] });
  draft.undo();
  assert.deepEqual(draft.value, { added: [point], removed: ['node:7'] });
});
