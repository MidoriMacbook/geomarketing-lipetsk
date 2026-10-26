import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFocus, focusDescription, analysisContext } from '../../static/js/analysis-focus.js';

const sample={houses:[{}],competitors:[{}],recommendations:[{}],stats:{competitors:1}};
test('Один активный показатель; повтор и недоступное действие снимают выделение',()=>{
 assert.equal(nextFocus(null,'residents',true),'residents');
 assert.equal(nextFocus('residents','houses',true),'houses');
 assert.equal(nextFocus('houses','houses',true),null);
 assert.equal(nextFocus('houses','unknown',true),null);
 assert.equal(nextFocus(null,'places',false),null);
});
test('Каждому показателю соответствуют слои и краткий статус',()=>{
 const expected={
 residents:[['houses','zones'],'Жители: на карте выделены дома и зоны спроса'],
 houses:[['houses'],'Дома: на карте выделены учтённые жилые объекты'],
 competitors:[['competitors'],'Конкуренты: на карте выделены объекты выбранной категории'],
 places:[['recommendations'],'Рекомендации: на карте выделены предложенные места']};
 for(const [key,[layers,text]] of Object.entries(expected))assert.deepEqual(focusDescription(key,sample),{layers,text});
 assert.equal(focusDescription(null,sample).text,'Расчёт готов · выберите место на карте');
});
test('Отсутствующие данные не описываются как выделенные объекты',()=>{
 assert.deepEqual(focusDescription('houses'),{layers:[],text:'Данные ещё не рассчитаны · выберите область'});
 assert.match(focusDescription('houses',{...sample,houses:[]}).text,/нет учтённых/);
 assert.match(focusDescription('residents',{...sample,houses:[]}).text,/недостаточно/);
 assert.match(focusDescription('competitors',{...sample,stats:{competitors:0}}).text,/не отмечены/);
 assert.match(focusDescription('places',{...sample,recommendations:[]}).text,/не предложены/);
});
test('Контекст сохраняет исходные даты и честно различает режимы',()=>{
 const data={district_name:'мкр. Елецкий',business_name:'Кофейня',source:'cache',data_meta:{houses:{fetched_at:1760000000},competitors:{fetched_at:1760086400}}};
 assert.match(analysisContext(data,'success'),/Елецкий.*Кофейня.*09.10.2025/);
 assert.match(analysisContext(data,'refreshing'),/предыдущий/);
 assert.match(analysisContext(null,'initial'),/не выполнен/);
 assert.match(analysisContext({...data,data_meta:{}},'success'),/дата не указана/);
 assert.match(analysisContext({...data,source:'demo'},'success'),/демонстрационные/);
});
