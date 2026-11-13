export const SCORE_NOTE = 'Баллы сравнивают точки только внутри этого расчёта.';
export function placeDifference(rec) {
 const value=rec?.comparison_to_best;
 if(rec?.selection_method!=='cluster_maxima_v1'||!value||!Number.isFinite(value.distance_m)||!Number.isInteger(value.shared_houses))return '';
 const distance=Math.round(value.distance_m).toLocaleString('ru-RU');
 const fraction=value.shared_residents_fraction;
 const overlap=Number.isFinite(fraction)&&fraction>=0&&fraction<=1
  ?`${(fraction*100).toLocaleString('ru-RU',{maximumFractionDigits:1})}% жителей этого радиуса также входят в радиус лучшего места`
  :'доля общих жителей не оценена';
 return `От лучшего места — ${distance} м. Общих домов: ${value.shared_houses}; ${overlap}.`;
}
export const OSM_LIMITATION = 'OpenStreetMap может быть неполной или устаревшей. Оценка жителей не является переписью населения.';
export const scoreValue = value => Number.isFinite(value) && value >= 0 && value <= 1 ? Math.round(value * 100) : null;
export const scoreText = value => scoreValue(value) === null ? 'Не оценено' : `${scoreValue(value)} из 100`;
export function localTimestamp(value) {
 const date=value===null||value===undefined?null:new Date(value);
 return date&&Number.isFinite(date.getTime())?date.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'дата не указана';
}
export function qualityReasons(coded=[],extra=[],freshness) {
 const labels={osm_coverage:OSM_LIMITATION,mixed_fetch_dates:'Дома и конкуренты получены в разное время; даты указаны отдельно.',
  unknown_freshness:'Неизвестна дата домов или конкурентов; свежесть не оценена.',
  stale_data:'Самый ранний набор старше 7 дней; проверьте изменения на месте.'};
 const texts=[OSM_LIMITATION,...coded.map(item=>labels[item?.code]||item?.text),...extra];
 if(freshness==='stale')texts.push(labels.stale_data);
 if(freshness==='unknown')texts.push(labels.unknown_freshness);
 const seen=new Set();
 return texts.filter(text=>{
  if(typeof text!=='string'||!text.trim())return false;
  const key=text.toLocaleLowerCase('ru').replace(/\s+/gu,' ').replace(/[.!;\s]+$/u,'');
  if(seen.has(key))return false;seen.add(key);return true;
 });
}
