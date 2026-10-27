import test from 'node:test';
import assert from 'node:assert/strict';
import * as presentation from '../../static/js/recommendation-brief.js';
const { recommendationBrief, recommendationDecision }=presentation;

const explanation = overrides => ({
  version: 1,
  demand_level: 'higher',
  competition_level: 'low',
  metrics: { houses_in_radius: 35, houses_per_km2: 60, model_demand: 1200, competition_pressure: 0.2, competition_multiplier: 1.2, nearest_demand_center_m: 40 },
  strengths: ['Рядом жильё.'],
  risks: ['Нужна проверка данных.'],
  field_checks: ['Проверьте вход и пешеходный поток.', 'Уточните аренду.'],
  ...overrides
});
const recommendation = overrides => ({ residents_in_radius: 1200, competitors_in_radius: 2, radius_m: 300, nearest_competitor_m: 123.6, explanation: explanation(), ...overrides });

test('decision uses assessed relative demand and distinct houses/centre facts without promises',()=>{
 assert.equal(typeof recommendationDecision,'function','Нет краткого объяснения решения');
 const value=recommendationDecision(recommendation({competitors_in_radius:0}));
 assert.equal(value.headline,'Спрос выше · Без учтённых конкурентов');
 assert.deepEqual(value.reasons,['Учтено домов: 35','Центр спроса: 40 м']);
});
test('decision does not invent assessed demand for old or damaged enrichment',()=>{
 for(const value of [undefined,explanation({metrics:{houses_in_radius:-1}})]){
  const decision=recommendationDecision(recommendation({explanation:value,nearest_competitor_m:0}));
  assert.match(decision.headline,/Спрос не оценён/);assert.ok(decision.reasons.includes('Ближайший конкурент: 0 м'));
  assert.ok(!decision.reasons.some(text=>text.includes('центр')||text.includes('35')));
 }
 const empty=recommendationDecision({residents_in_radius:'1200',competitors_in_radius:-1,radius_m:null});
 assert.equal(empty.headline,'Спрос не оценён · Конкуренция не оценена');assert.deepEqual(empty.reasons,[]);
});

test('brief describes existing model levels, exact nearest distance and first field check', () => {
  assert.deepEqual(recommendationBrief(recommendation()), {
    demand: 'Выше среднего среди точек расчёта',
    competition: 'Небольшой штраф модели',
    nearest: '124 м',
    check: 'Проверьте вход и пешеходный поток.'
  });
});

test('brief covers all model level labels without inventing city-wide claims', () => {
  const demand = { similar: 'Близок к среднему среди точек расчёта', lower: 'Ниже среднего среди точек расчёта', unknown: 'Не оценен' };
  for (const [level, label] of Object.entries(demand)) assert.equal(recommendationBrief(recommendation({ explanation: explanation({ demand_level: level }) })).demand, label);
  for (const [level, label] of Object.entries({ moderate: 'Умеренный штраф модели', high: 'Высокий штраф модели' })) assert.equal(recommendationBrief(recommendation({ explanation: explanation({ competition_level: level }) })).competition, label);
});

test('old or damaged enrichment falls back honestly while preserving the base distance', () => {
  const damaged = [undefined, null, [], {}, explanation({ version: 2 }), explanation({ demand_level: 'excellent' }), explanation({ metrics: {} }), explanation({ field_checks: [3] }), explanation({ risks: 'broken' })];
  for (const value of damaged) {
    assert.deepEqual(recommendationBrief(recommendation({ explanation: value, nearest_competitor_m: null })), {
      demand: 'Не оценен',
      competition: 'Не оценена',
      nearest: 'Не найдены в данных области',
      check: 'Проверьте помещение, доступ и поток посетителей.'
    });
  }
});

test('absent field checks and invalid distances have useful neutral fallbacks', () => {
  const empty = recommendationBrief(recommendation({ explanation: explanation({ field_checks: ['', '  '] }), nearest_competitor_m: -1 }));
  assert.equal(empty.check, 'Проверьте помещение, доступ и поток посетителей.');
  assert.equal(empty.nearest, 'Не оценено');
  assert.equal(recommendationBrief(null).nearest, 'Не оценено');
  assert.equal(recommendationBrief(recommendation({ nearest_competitor_m: 0 })).nearest, '0 м');
  assert.equal(recommendationBrief(recommendation({ nearest_competitor_m: 1234 })).nearest, `${Math.round(1234).toLocaleString('ru-RU')} м`);
});

test('brief is deterministic and does not mutate a frozen recommendation or enrichment', () => {
  const rec = recommendation();
  for (const value of Object.values(rec.explanation)) if (value && typeof value === 'object') Object.freeze(value);
  Object.freeze(rec.explanation);
  Object.freeze(rec);
  const before = JSON.stringify(rec);
  assert.deepEqual(recommendationBrief(rec), recommendationBrief(rec));
  assert.equal(JSON.stringify(rec), before);
});
