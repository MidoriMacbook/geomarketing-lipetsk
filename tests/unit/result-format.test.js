import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreText, scoreValue, localTimestamp, qualityReasons, OSM_LIMITATION, SCORE_NOTE, placeDifference } from '../../static/js/result-format.js';

test('балл явно задан из ста без вероятности успеха',()=>{
 assert.equal(scoreText(1),'100 из 100');assert.equal(scoreText(.734),'73 из 100');
 assert.equal(scoreValue(0),0);assert.equal(scoreText(null),'Не оценено');
 assert.equal(scoreText(1.1),'Не оценено');assert.match(SCORE_NOTE,/внутри этого расчёта/);assert.doesNotMatch(SCORE_NOTE,/вероятность/);
});

test('сравнение с лучшим объясняет знаменатель доли и поддерживает старые архивы',()=>{
 assert.equal(placeDifference({rank:2}),'');
 const rec={selection_method:'cluster_maxima_v1',comparison_to_best:{distance_m:529,shared_houses:1,shared_residents_fraction:10/1010}};
 assert.match(placeDifference(rec),/529 м/);assert.match(placeDifference(rec),/Общих домов: 1/);assert.match(placeDifference(rec),/1% жителей этого радиуса/);
 rec.comparison_to_best.shared_residents_fraction=null;assert.match(placeDifference(rec),/не оценена/);
});
test('дата читаема локально, повреждённая дата не выдумывается',()=>{
 assert.match(localTimestamp('2026-11-01T10:00:00Z'),/01\.11\.2026/);
 assert.doesNotMatch(localTimestamp('2026-11-01T10:00:00Z'),/T10|Z/);
 assert.equal(localTimestamp('сломано'),'дата не указана');
 assert.equal(localTimestamp(null),'дата не указана');
});
test('ограничение OSM одно, техническая смешанная дата скрыта из основного текста',()=>{
 const reasons=qualityReasons([{code:'osm_coverage',text:'Добровольная разметка может быть неполной'},
 {code:'mixed_fetch_dates',text:'Дома 2026-10-29T10:00:00Z; конкуренты 2026-10-28T12:00:00Z'},
 {code:'load_warning',text:'Источник недоступен.'}],['Источник недоступен.'],'stale');
 assert.equal(reasons.filter(x=>x===OSM_LIMITATION).length,1);
 assert.equal(reasons.filter(x=>x==='Источник недоступен.').length,1);
 assert.equal(reasons.filter(x=>x.includes('старше 7 дней')).length,1);
 assert.doesNotMatch(reasons.join(' '),/\d{4}-\d{2}-\d{2}T/);
});
