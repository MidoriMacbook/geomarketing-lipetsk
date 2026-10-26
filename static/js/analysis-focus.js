// Presentation descriptions only: never mutate a calculation or its view settings.
const descriptions = {
 residents: {layers:['houses','zones'], text:'Оценка основана на жилой застройке внутри выбранной области. Зоны показывают относительный спрос в этом расчёте.'},
 houses: {layers:['houses'], text:'Выделены жилые объекты OpenStreetMap внутри области. Это добровольная разметка домов, а не перепись населения.'},
 competitors: {layers:['competitors'], text:'Выделены конкуренты выбранной категории, включая окружение области.'},
 places: {layers:['recommendations'], text:'Номера на карте связаны с карточками рекомендаций. Это места для проверки помещения и окружения, а не готовый прогноз выручки.'}
};
export function nextFocus(current,key,available) {
 return available && Object.hasOwn(descriptions,key) && current!==key ? key : null;
}
export function focusDescription(key,data={}) {
 const item=descriptions[key];
 if(!item)return {layers:[],text:'Выберите показатель над картой: выделение поможет прочитать данные, не меняя расчёт.'};
 let text=item.text;
 if(key==='competitors')text=(data.stats?.competitors===0
   ? 'В этой выборке OpenStreetMap конкуренты не отмечены. Это не доказывает их отсутствия.'
   : item.text)+` Категория: ${data.business_name || 'выбранный тип бизнеса'}.`;
 if(key==='places'&&Array.isArray(data.recommendations)&&!data.recommendations.length)
   text='Этот расчёт не предложил мест для проверки. Попробуйте другую область или увеличьте её радиус.';
 return {layers:[...item.layers],text};
}
export function analysisContext(data,phase='success',selection={}) {
 if(!data) {
  const names=[selection.district_name,selection.business_name].filter(Boolean).join(' · ');
  return `${names ? names+' · ' : ''}расчёт не выполнен${phase==='error'?' · повторите попытку':''}`;
 }
 const names=[data.district_name,data.business_name].filter(Boolean).join(' · ');
 const dates=['houses','competitors'].map(key=>data.data_meta?.[key]?.fetched_at);
 const date=dates.every(value=>Number.isFinite(value)&&value>0&&value<=Date.now()/1000+300)
   ? new Date(Math.min(...dates)*1000).toLocaleDateString('ru-RU') : null;
 const source=data.source==='demo'?'демонстрационные данные':date?`данные от ${date}`:'дата не указана';
 const status=phase==='refreshing'?' · предыдущий расчёт, обновляем'
   :phase==='error'?' · предыдущий расчёт, обновление не удалось'
   :phase==='archive'?' · сохранённый расчёт':'';
 return `${names} · ${source}${status}`;
}
