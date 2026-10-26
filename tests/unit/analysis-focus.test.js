import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFocus, focusDescription, analysisContext } from '../../static/js/analysis-focus.js';

test('one focus, repeated key clears it and invalid/unavailable inputs never select',()=>{
 assert.equal(nextFocus(null,'residents',true),'residents');
 assert.equal(nextFocus('residents','houses',true),'houses');
 assert.equal(nextFocus('houses','houses',true),null);
 assert.equal(nextFocus('houses','unknown',true),null);
 assert.equal(nextFocus(null,'places',false),null);
});
test('focus explains the source/category, not a new analysis',()=>{
 assert.deepEqual(focusDescription('residents',{business_name:'Аптека'}).layers,['houses','zones']);
 assert.match(focusDescription('houses',{}).text,/OpenStreetMap/);
 assert.match(focusDescription('competitors',{business_name:'Аптека'}).text,/Аптека/);
 assert.deepEqual(focusDescription('places',{}).layers,['recommendations']);
});
test('empty competitors and recommendations explain absence without promising points',()=>{
 assert.match(focusDescription('competitors',{business_name:'Аптека',stats:{competitors:0}}).text,/не отмечены/);
 assert.match(focusDescription('places',{recommendations:[]}).text,/не предложил/);
});
test('context uses source dates and honest missing/demo/pending states',()=>{
 const data={district_name:'мкр. Елецкий',business_name:'Кофейня',source:'cache',data_meta:{houses:{fetched_at:1760000000},competitors:{fetched_at:1760086400}}};
 assert.match(analysisContext(data,'success'),/Елецкий.*Кофейня.*09.10.2025/);
 assert.match(analysisContext(data,'refreshing'),/предыдущий/);
 assert.match(analysisContext(null,'initial'),/не выполнен/);
 assert.match(analysisContext({...data,data_meta:{}},'success'),/дата не указана/);
 assert.match(analysisContext({...data,source:'demo'},'success'),/демонстрационные/);
});
