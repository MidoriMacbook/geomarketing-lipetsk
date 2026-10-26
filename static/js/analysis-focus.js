// Подсветка и подписи не меняют расчёт или настройки пользователя.
const descriptions = {
 residents: {layers:['houses','zones'], text:'Жители: на карте выделены дома и зоны спроса'},
 houses: {layers:['houses'], text:'Дома: на карте выделены учтённые жилые объекты'},
 competitors: {layers:['competitors'], text:'Конкуренты: на карте выделены объекты выбранной категории'},
 places: {layers:['recommendations'], text:'Рекомендации: на карте выделены предложенные места'}
};
export function nextFocus(current,key,available) {
 return available && Object.hasOwn(descriptions,key) && current!==key ? key : null;
}
export function focusDescription(key,data) {
 if(!data)return {layers:[],text:'Данные ещё не рассчитаны · выберите область'};
 const item=descriptions[key];
 if(!item)return {layers:[],text:'Расчёт готов · выберите место на карте'};
 if((key==='houses'||key==='residents')&&!data.houses?.length)
  return {layers:[],text:key==='houses'?'Дома: в области нет учтённых жилых объектов':'Жители: недостаточно данных о жилых домах'};
 let text=item.text;
 if(key==='competitors'&&data.stats?.competitors===0)
  text='Конкуренты: в области не отмечены; проверьте окружение';
 if(key==='places'&&!data.recommendations?.length)
  text='Рекомендации: места для проверки не предложены';
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
