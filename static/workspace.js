'use strict';
(() => {
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const coords = p => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
const distance = n => n === null ? 'Не найдены в данных области' : `${fmt(n)} м`;
const STORAGE_KEY = 'geomarketing.saved.v1';
const LIMITATIONS = 'Население оценено по площади и этажности домов. Расстояния по прямой. Данные OpenStreetMap могут быть неполными или устаревшими. Модель не учитывает аренду, наличие помещений, пешеходные маршруты, доходы и поток посетителей. Относительную оценку нельзя сравнивать между разными расчётами.';
const node = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; };
const button = (text, className, action) => { const b = node('button', className, text); b.type = 'button'; b.addEventListener('click', action); return b; };
const dateText = value => value ? new Date(value).toLocaleDateString('ru-RU') : 'Не указана';
const sourceText = source => source === 'demo' ? 'Демонстрационные данные' : `OpenStreetMap${source === 'cache' ? ', сохранённая копия' : ''}`;
let catalog = null, current = null, customPoint = null, selectedRank = 1;
let activeRequest = null, requestVersion = 0, saved = [], comparison = new Set();
let repairStorageRaw = null, currentRequestKey = null;
let catalogRequest = null;
let map = null, tiles = null, tileTimer = null, tileFailures = 0;
let pointsRenderer = null, zonesRenderer = null;
const layers = {}, markers = new Map();
function showError(message) { $('error').textContent = message; $('error').hidden = false; }
function storageStatus(message) { $('storage-status').textContent = message; $('storage-status').hidden = false; }
function validSaved(item) {
  const r = item && item.recommendation;
  return item && typeof item.id === 'string' && typeof item.analysis_id === 'string' && item.analysis_id.length > 0 &&
    typeof item.business_name === 'string' && typeof item.district_name === 'string' &&
    typeof item.saved_at === 'string' && Number.isFinite(Date.parse(item.saved_at)) &&
    ['osm','cache','demo'].includes(item.source) &&
    (item.data_date === null || (typeof item.data_date === 'string' && Number.isFinite(Date.parse(item.data_date)))) &&
    typeof item.warning === 'string' && item.parameters &&
    Number.isFinite(item.parameters.radius_m) && item.parameters.radius_m > 0 &&
    Number.isFinite(item.parameters.alpha) && item.parameters.alpha > 0 && r &&
    [r.rank,r.lat,r.lng,r.score,r.residents_in_radius,r.radius_m,r.competitors_in_radius].every(Number.isFinite) &&
    Number.isInteger(r.rank) && r.rank >= 1 && r.rank <= 3 && r.score >= 0 && r.score <= 1 &&
    r.lat >= -90 && r.lat <= 90 && r.lng >= -180 && r.lng <= 180 &&
    r.radius_m === item.parameters.radius_m && Number.isInteger(r.competitors_in_radius) && r.competitors_in_radius >= 0 &&
    r.residents_in_radius >= 0 && (r.nearest_competitor_m === null || (Number.isFinite(r.nearest_competitor_m) && r.nearest_competitor_m >= 0)) &&
    item.id === `${item.analysis_id}:${r.rank}`;
}
function readSaved() {
  // Access errors must propagate; treating unreadable storage as an empty list loses data.
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const values = JSON.parse(raw);
    if (!Array.isArray(values) || values.length > 12 || !values.every(validSaved) || new Set(values.map(i => i.id)).size !== values.length) throw new Error('invalid');
    return values;
  } catch {
    const error = new Error('invalid'); error.raw = raw; throw error;
  }
}
function loadSaved() {
  try { saved = readSaved(); repairStorageRaw = null; return true; }
  catch (error) {
    saved = [];
    repairStorageRaw = error.message === 'invalid' ? error.raw : null;
    storageStatus(error.message === 'invalid' ? 'Сохранённые данные повреждены. Список не восстановлен. Новое сохранение заменит повреждённую запись.' : 'Хранилище браузера недоступно. Расчёт работает, но места не удастся сохранить.');
    return false;
  }
}
async function mutateSaved(mutate, allowRepair = false) {
  // Web Locks serialize read-modify-write transactions across tabs on this origin.
  if (!navigator.locks?.request) {
    storageStatus('В этом браузере согласованное сохранение недоступно. Изменения не сохранены. Используйте актуальный браузер и защищённое соединение.');
    return;
  }
  try {
    await navigator.locks.request(`${STORAGE_KEY}.write`, () => {
      let latest;
      try { latest = readSaved(); }
      catch (error) {
        // Only replace the exact damaged record already explained to this tab's user.
        if (allowRepair && error.message === 'invalid' && error.raw === repairStorageRaw) latest = [];
        else throw error;
      }
      const result = mutate(latest);
      if (result.next) localStorage.setItem(STORAGE_KEY, JSON.stringify(result.next));
      saved = result.next || latest;
      repairStorageRaw = null;
      renderSaved(); updateSaveButtons(); storageStatus(result.message);
    });
  } catch (error) {
    storageStatus(error.message === 'invalid' ? 'Сохранённые данные повреждены. Изменения не сохранены. Обновите страницу, чтобы проверить запись.' : 'Хранилище браузера недоступно. Изменения не сохранены. Попробуйте другой браузер или разрешите хранение данных сайта.');
  }
}
function dataDate(data) {
  const dates = Object.values(data.data_meta || {}).map(i => i.fetched_at).filter(Number.isFinite);
  return dates.length ? new Date(Math.min(...dates) * 1000).toISOString() : null;
}
async function savePlace(rec) {
  if (!current) return;
  // Capture the analysis before awaiting a lock: filters and responses can change while queued.
  const id = `${current.analysis_id}:${rec.rank}`;
  const item = { id, analysis_id: current.analysis_id, business: current.business, business_name: current.business_name, district: current.district, district_name: current.district_name, saved_at: new Date().toISOString(), source: current.source, data_date: dataDate(current), warning: [current.notice, current.warning].filter(Boolean).join(' '), parameters: { ...current.parameters }, recommendation: { ...rec } };
  await mutateSaved(latest => {
    if (latest.some(p => p.id === id)) return { message: 'Это место из этого расчёта уже сохранено.' };
    if (latest.length >= 12) return { message: 'Можно сохранить до 12 мест. Удалите одно из списка, чтобы добавить новое.' };
    return { next: [...latest, item], message: 'Место сохранено в этом браузере.' };
  }, true);
}
function updateSaveButtons() {
  document.querySelectorAll('[data-testid="save-place"]').forEach(b => { const exists = saved.some(p => p.id === `${current?.analysis_id}:${b.dataset.rank}`); b.textContent = exists ? 'Сохранено ✓' : 'Сохранить'; b.setAttribute('aria-label', exists ? `Место ${b.dataset.rank} сохранено` : `Сохранить место ${b.dataset.rank}`); });
}
function renderSaved() {
  comparison = new Set([...comparison].filter(id => saved.some(item => item.id === id)));
  $('saved-list').replaceChildren(); $('saved-count').textContent = `${saved.length} / 12`; $('nav-saved-count').textContent = saved.length;
  $('saved-empty').hidden = saved.length > 0; $('export-csv').disabled = !saved.length;
  saved.forEach(item => {
    const rec = item.recommendation, card = node('article', 'saved-card'); card.dataset.testid = 'saved-card';
    card.append(node('h3', '', `${item.business_name} · место ${rec.rank}`), node('p', '', item.district_name), node('p', '', coords(rec)), node('p', 'saved-stats', `≈ ${fmt(rec.residents_in_radius)} жителей · ${fmt(rec.competitors_in_radius)} конкурентов · радиус ${fmt(rec.radius_m)} м`), node('p', '', `Данные: ${dateText(item.data_date)} · ${sourceText(item.source)}`), node('p', '', `Сохранено: ${dateText(item.saved_at)}`));
    if (item.warning) card.append(node('p', '', item.warning));
    const actions = node('div', 'saved-card-actions'), label = node('label'), checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.dataset.testid = 'compare-place'; checkbox.checked = comparison.has(item.id); checkbox.setAttribute('aria-label', `Сравнить ${item.business_name}, ${item.district_name}, место ${rec.rank}`);
    checkbox.addEventListener('change', () => { if (checkbox.checked && comparison.size >= 3) { checkbox.checked = false; storageStatus('Для сравнения можно выбрать до трёх мест.'); return; } checkbox.checked ? comparison.add(item.id) : comparison.delete(item.id); renderComparison(); });
    label.append(checkbox, node('span', '', 'Сравнить'));
    const remove = button('Удалить', '', () => mutateSaved(latest => ({ next: latest.filter(p => p.id !== item.id), message: 'Место удалено из этого браузера.' }))); remove.setAttribute('aria-label', `Удалить ${item.business_name}, место ${rec.rank}`); actions.append(label, remove); card.append(actions); $('saved-list').append(card);
  }); renderComparison(); updateReportAvailability();
}
function comparisonRows() { return saved.filter(p => comparison.has(p.id)); }
function fillTable(body, items) {
  body.replaceChildren(); items.forEach(item => { const r = item.recommendation, tr = node('tr'), title = node('td', '', `${item.business_name} · место ${r.rank}`); title.append(node('small', '', item.district_name), node('small', '', coords(r))); tr.append(title, node('td', '', fmt(r.residents_in_radius)), node('td', '', `${fmt(r.radius_m)} м`), node('td', '', fmt(r.competitors_in_radius)), node('td', '', distance(r.nearest_competitor_m)), node('td', '', dateText(item.data_date))); body.append(tr); });
}
function renderComparison() { const rows = comparisonRows(); $('comparison').hidden = !rows.length; fillTable($('comparison').querySelector('tbody'), rows); updateReportAvailability(); }
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function exportCSV() {
  const rows = [['Категория','Район','Место','Широта','Долгота','Жителей (оценка)','Радиус, м','Конкурентов в радиусе','Ближайший конкурент, м','Относительная оценка (только внутри расчёта)','ID расчёта','Коэффициент конкуренции','Дата данных','Дата сохранения','Источник','Предупреждения','Ограничения модели'], ...saved.map(i => { const r = i.recommendation; return [i.business_name,i.district_name,r.rank,r.lat,r.lng,r.residents_in_radius,r.radius_m,r.competitors_in_radius,r.nearest_competitor_m,r.score,i.analysis_id,i.parameters.alpha,i.data_date || 'Не указана',i.saved_at,sourceText(i.source),i.warning,LIMITATIONS]; })];
  const blob = new Blob(['\uFEFF', rows.map(row => row.map(csvCell).join(';')).join('\r\n')], {type:'text/csv;charset=utf-8'}), url = URL.createObjectURL(blob), a = node('a'); a.href = url; a.download = `geomarketing-lipetsk-${new Date().toISOString().slice(0,10)}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function updateReportAvailability() { $('print-report').disabled = !current && !comparison.size; }
function reportPlace(rec, context) {
  const block = node('article', 'report-place'); block.append(node('h3', '', `${context.business_name} · место ${rec.rank} · ${context.district_name}`), node('p', '', `Координаты: ${coords(rec)}. Жителей в радиусе ${fmt(rec.radius_m)} м: ≈ ${fmt(rec.residents_in_radius)}. Конкурентов в радиусе: ${fmt(rec.competitors_in_radius)}. Ближайший конкурент: ${distance(rec.nearest_competitor_m)}.`), node('p', '', `Относительная оценка внутри расчёта: ${Math.round(rec.score * 100)}%. Радиус модели: ${context.parameters.radius_m} м; коэффициент конкуренции: ${context.parameters.alpha}. ID расчёта: ${context.analysis_id}.`), node('p', '', `Источник: ${sourceText(context.source)}. Дата данных: ${dateText(context.data_date)}${context.saved_at ? `. Сохранено: ${dateText(context.saved_at)}` : ''}.`));
  if (context.warning) block.append(node('p', '', `Предупреждение: ${context.warning}`)); return block;
}
function printReport() {
  const report = $('print-report-content'); report.replaceChildren(node('h1', '', 'ГеоМаркетинг · Липецк'), node('p', '', `Отчёт сформирован ${new Date().toLocaleString('ru-RU')}`));
  if (current) { report.append(node('h2', '', 'Рекомендации текущего расчёта')); const context = {...current, data_date: dataDate(current), warning: [current.warning,current.notice].filter(Boolean).join(' ')}; current.recommendations.forEach(r => report.append(reportPlace(r, context))); }
  const items = comparisonRows(); if (items.length) { report.append(node('h2', '', 'Сравнение сохранённых мест')); const table = $('comparison').querySelector('table').cloneNode(true); report.append(table); items.forEach(i => report.append(reportPlace(i.recommendation, i))); }
  report.append(node('h2', '', 'Ограничения и интерпретация'), node('p', '', LIMITATIONS), node('p', '', 'Перед открытием бизнеса проверьте место на местности. Карта в печатный отчёт не включена.')); window.print();
}
function mapWarning() { $('map-message').textContent = 'Подложка карты загрузилась не полностью. Анализ готовых районов доступен.'; $('map-status').hidden = false; }
function initMap() {
  if (typeof L === 'undefined') { $('map-message').textContent = 'Не удалось загрузить модуль карты. Обновите страницу. Расчёт готовых районов доступен.'; $('map-status').hidden = false; $('retry-map').textContent = 'Обновить страницу'; $('retry-map').addEventListener('click', () => location.reload()); return; }
  map = L.map('map', { zoomControl:false }).setView([52.6088,39.5992],12); L.control.zoom({position:'topright'}).addTo(map);
  tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',maxZoom:19 });
  tiles.on('loading', () => { tileFailures=0; clearTimeout(tileTimer); tileTimer=setTimeout(mapWarning,12000); }); tiles.on('tileerror', () => { tileFailures++; mapWarning(); }); tiles.on('load', () => { clearTimeout(tileTimer); if (!tileFailures) $('map-status').hidden=true; }); tiles.addTo(map);
  $('retry-map').addEventListener('click', () => { $('map-status').hidden=true; tiles.redraw(); });
  map.createPane('zones'); map.getPane('zones').style.zIndex=405; map.createPane('points'); map.getPane('points').style.zIndex=420;
  // Leaflet keeps renderers on the map after paths are cleared; reuse these across redraws.
  pointsRenderer=L.canvas({pane:'points',padding:.5}); zonesRenderer=L.canvas({pane:'zones'});
  ['zones','houses','competitors','centroids','recommendations','boundary','preview'].forEach(key => { layers[key]=L.layerGroup().addTo(map); });
  map.on('click', e => { if ($('district').value !== 'custom') return; resetSelection(); customPoint=[e.latlng.lat,e.latlng.lng]; $('custom-hint').textContent=`Центр выбран: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}. Нажмите «Найти места».`; drawPreview(); });
  window.addEventListener('resize', () => { map.invalidateSize(); if(current) fitArea(current); });
}
function cancelRequest() { requestVersion++; if(activeRequest) activeRequest.abort(); activeRequest=null; }
function resetSelection() {
  cancelRequest(); current=null; currentRequestKey=null; markers.clear();
  Object.entries(layers).forEach(([key,layer]) => { if(key !== 'preview') layer.clearLayers(); });
  $('result').hidden=true; $('result-empty').hidden=false; $('data-section').hidden=true; $('error').hidden=true; $('loading-hint').hidden=true;
  $('result-empty').querySelector('h3').textContent='Готово к новому расчёту'; $('result-empty').querySelector('p').textContent='Проверьте настройки и нажмите «Найти места». Сохранённые места доступны ниже.';
  if(catalog) $('map-context').textContent=`${$('district').selectedOptions[0].textContent} · ${$('business').selectedOptions[0].textContent}`;
  $('run').disabled=!catalog; $('refresh-data').disabled=false; $('run').textContent='Найти места →'; ['residents','houses','competitors','places'].forEach(key => $('kpi-'+key).textContent='—'); updateReportAvailability();
}
function updateParams() { if(!catalog) return; const b=catalog.businesses.find(b=>b.key===$('business').value); $('business-parameters').textContent=`Радиус доступности ${fmt(b.radius_m)} м · коэффициент конкуренции ${b.alpha}. Параметры модели.`; $('kpi-business').textContent=b.name; }
function updateCustomUI() { const custom=$('district').value==='custom'; $('custom-box').hidden=!custom; if(map) map.getContainer().style.cursor=custom?'crosshair':''; drawPreview(); }
function drawPreview() { if(!map) return; layers.preview.clearLayers(); if($('district').value!=='custom'||!customPoint) return; L.circle(customPoint,{radius:+$('radius').value,color:'#173f32',weight:1.5,dashArray:'5 6',fillOpacity:.05,interactive:false}).addTo(layers.preview); L.circleMarker(customPoint,{radius:5,color:'#fff',weight:2,fillColor:'#173f32',fillOpacity:1,interactive:false}).addTo(layers.preview); }
async function loadCatalog() {
  if(catalogRequest) catalogRequest.abort(); const controller=new AbortController(); catalogRequest=controller; const timeout=setTimeout(()=>controller.abort(),15000);
  $('retry-catalog').hidden=true; $('catalog-status').hidden=false; $('catalog-status').firstChild.textContent='Загружаем районы и категории… ';
  try { const response=await fetch('/api/catalog',{signal:controller.signal}); if(!response.ok) throw new Error('catalog'); const data=await response.json(); if(data.status!=='success'||!Array.isArray(data.businesses)||!data.businesses.length||!Array.isArray(data.districts)||!data.districts.length) throw new Error('catalog'); catalog=data;
    $('district').replaceChildren(...data.districts.map(d=>new Option(d.name,d.key)),new Option('Своя область на карте','custom')); $('business').replaceChildren(...data.businesses.map(b=>new Option(b.name,b.key))); $('district').disabled=false; $('business').disabled=false; $('run').disabled=false; $('catalog-status').hidden=true; updateParams(); updateCustomUI(); run(false);
  } catch { $('catalog-status').firstChild.textContent='Не удалось загрузить настройки. Проверьте соединение и повторите попытку. '; $('retry-catalog').hidden=false; }
  finally { clearTimeout(timeout); if(catalogRequest===controller) catalogRequest=null; }
}
async function run(refresh=false) {
  if(!catalog) return; const district=$('district').value, business=$('business').value;
  if(district==='custom'&&!customPoint) { showError('Сначала кликните по карте, чтобы выбрать центр области.'); return; }
  const params=new URLSearchParams({district,type:business}); if(district==='custom') { params.set('lat',customPoint[0].toFixed(5)); params.set('lng',customPoint[1].toFixed(5)); params.set('radius',$('radius').value); }
  const requestKey=params.toString(), preserveResult=!!current && currentRequestKey===requestKey;
  if(refresh) params.set('refresh','1');
  if(preserveResult) { cancelRequest(); $('error').hidden=true; } else resetSelection();
  const version=requestVersion, controller=new AbortController(); activeRequest=controller; let timedOut=false; const timeout=setTimeout(()=>{timedOut=true;controller.abort();},70000);
  $('run').disabled=true; $('refresh-data').disabled=true; $('run').textContent='Рассчитываем…'; $('loading-hint').hidden=false;
  $('loading-hint').textContent=preserveResult?'Обновляем расчёт. Пока показан предыдущий успешный результат.':'Загрузка и расчёт могут занять до минуты.';
  if(!preserveResult) { $('result-empty').querySelector('h3').textContent='Ищем подходящие места'; $('result-empty').querySelector('p').textContent='Сопоставляем жителей и конкурентов в выбранной области.'; }
  try { const response=await fetch(`/api/calculate?${params}`,{signal:controller.signal}); if(!response.ok) { let msg; try{msg=(await response.json()).message;}catch{} const e=new Error(msg||`Сервер ответил кодом ${response.status}`); e.user=[400,503].includes(response.status); throw e; }
    const data=await response.json(); if(version!==requestVersion) return; if(data.status!=='success'||!Array.isArray(data.recommendations)||!data.analysis_id) throw new Error('Invalid calculation response'); current=data; currentRequestKey=requestKey; selectedRank=data.recommendations[0]?.rank||1; if(map) layers.preview.clearLayers(); drawMap(data); drawZones(); showResult(data); fitArea(data);
  } catch(err) {
    if(version!==requestVersion)return;
    const message=timedOut?'Загрузка заняла слишком много времени. Повторите попытку или выберите готовый район.':err.user?err.message:err instanceof TypeError?'Нет связи с сервером. Проверьте интернет и повторите попытку.':'Не удалось выполнить расчёт. Повторите попытку позже.';
    showError((preserveResult?'Обновить расчёт не удалось. Показан предыдущий успешный результат. ':'')+message);
    if(!preserveResult) { $('result-empty').querySelector('h3').textContent='Расчёт пока недоступен'; $('result-empty').querySelector('p').textContent='Повторите попытку или измените область поиска. Сохранённые места доступны ниже.'; }
  } finally { clearTimeout(timeout); if(version===requestVersion) { activeRequest=null; $('run').disabled=false; $('refresh-data').disabled=false; $('run').textContent='Найти места →'; $('loading-hint').hidden=true; updateReportAvailability(); } }
}
function iconFor(rank, selected) { const pin=node('span',`recommendation-pin${selected?' is-selected':''}`,rank); pin.dataset.testid='recommendation-marker'; return L.divIcon({className:'',iconSize:[32,32],iconAnchor:[16,16],html:pin}); }
function selectPlace(rank, pan=true) {
  selectedRank=rank; document.querySelectorAll('[data-testid="recommendation-card"]').forEach(c=>{const active=+c.dataset.rank===rank;c.classList.toggle('selected',active);c.querySelector('.place-select').setAttribute('aria-pressed',active);});
  markers.forEach((marker,r)=>marker.setIcon(iconFor(r,r===rank))); const rec=current?.recommendations.find(r=>r.rank===rank); if(map&&rec&&pan) map.panTo([rec.lat,rec.lng],{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});
}
function drawMap(data) {
  if(!map)return; Object.entries(layers).forEach(([key,layer])=>{if(key!=='preview')layer.clearLayers();}); markers.clear();
  const renderer=pointsRenderer; L.circle(data.center,{radius:data.half_m,renderer,interactive:false,color:'#173f32',weight:1,opacity:.5,dashArray:'4 6',fill:false}).addTo(layers.boundary);
  data.houses.forEach(h=>L.circleMarker([h.lat,h.lng],{renderer,radius:2.5+Math.sqrt(h.residents)/6,color:'#fff',weight:1,fillColor:'#467c9b',fillOpacity:.85}).bindTooltip(`Жителей: ≈ ${fmt(h.residents)}`).addTo(layers.houses));
  data.competitors.forEach(c=>L.circleMarker([c.lat,c.lng],{renderer,radius:6,color:'#fff',weight:2,fillColor:'#cd6657',fillOpacity:1}).bindTooltip('Конкурент').addTo(layers.competitors));
  data.centroids.forEach(c=>L.circleMarker([c.lat,c.lng],{renderer,radius:6,color:'#173f32',weight:1.5,fillColor:'#ccab51',fillOpacity:1}).bindTooltip(`Скопление: ≈ ${fmt(c.residents)} жителей`).addTo(layers.centroids));
  data.recommendations.forEach(r=>{ const marker=L.marker([r.lat,r.lng],{icon:iconFor(r.rank,r.rank===selectedRank),title:`Рекомендация ${r.rank}`,alt:`Место ${r.rank}`}).bindTooltip(`Место ${r.rank}`,{direction:'top',offset:[0,-12]}).addTo(layers.recommendations);marker.on('click',()=>selectPlace(r.rank,false));markers.set(r.rank,marker); });
}
const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)+(parseInt(b.slice(i,i+2),16)-parseInt(a.slice(i,i+2),16))*t).toString(16).padStart(2,'0')).join('');
function drawZones() {
  if(!map)return; layers.zones.clearLayers(); if(!current||!current.grid)return; const g=current.grid, threshold=+$('thr').value/100, dLat=(g.lat_max-g.lat_min)/(g.n-1), dLng=(g.lng_max-g.lng_min)/(g.n-1), renderer=zonesRenderer;
  g.scores.forEach((score,i)=>{if(score<threshold)return; const t=Math.max(0,Math.min(1,(score-threshold)/(1-threshold))),lat=g.lat_min+Math.floor(i/g.n)*dLat,lng=g.lng_min+(i%g.n)*dLng; L.rectangle([[lat-dLat*.52,lng-dLng*.52],[lat+dLat*.52,lng+dLng*.52]],{renderer,stroke:false,interactive:false,fillColor:mix('#c5e89f','#25864b',t),fillOpacity:.5+.3*t}).addTo(layers.zones);});
}
function fitArea(data) { if(!map)return; const [lat,lng]=data.center,dLat=data.half_m/111000,dLng=data.half_m/(111000*Math.cos(lat*Math.PI/180)); map.fitBounds([[lat-dLat,lng-dLng],[lat+dLat,lng+dLng]],{padding:[25,25],animate:false}); }
function showResult(data) {
  $('recommendation-list').replaceChildren(); $('result-empty').hidden=data.recommendations.length>0; $('result').hidden=!data.recommendations.length;
  if(!data.recommendations.length){$('result-empty').querySelector('h3').textContent='Подходящих мест не найдено';$('result-empty').querySelector('p').textContent='В области не хватает спроса для рекомендации. Попробуйте другую область или увеличьте её радиус.';}
  data.recommendations.forEach((rec,index)=>{const card=node('article',`recommendation${rec.rank===selectedRank?' selected':''}`);card.dataset.testid='recommendation-card';card.dataset.rank=rec.rank;const heading=node('div','place-title'),select=button(`Место ${rec.rank}`,'place-select',()=>selectPlace(rec.rank));select.setAttribute('aria-pressed',rec.rank===selectedRank);select.setAttribute('aria-label',`Показать место ${rec.rank} на карте`);heading.append(node('span','rank',rec.rank),select,node('span','score',`${Math.round(rec.score*100)}%`));const coordinate=node('p','coords',coords(rec));if(!index)coordinate.id='coords';const metrics=node('div','place-metrics'),people=node('div'),competition=node('div');people.append(node('strong','',`≈ ${fmt(rec.residents_in_radius)}`),node('small','',`жителей в ${fmt(rec.radius_m)} м`));competition.append(node('strong','',fmt(rec.competitors_in_radius)),node('small','','конкурентов в радиусе'));metrics.append(people,competition);const actions=node('div','place-actions'),save=button('Сохранить','button secondary save',()=>savePlace(rec));save.dataset.testid='save-place';save.dataset.rank=rec.rank;const copy=button('Координаты','button secondary',async()=>{try{await navigator.clipboard.writeText(`${rec.lat.toFixed(6)}, ${rec.lng.toFixed(6)}`);copy.textContent='Скопировано';}catch{copy.textContent='Не скопировано';copy.title='Координаты указаны на карточке — выделите и скопируйте их.';}});if(!index)copy.id='copy';const osm=node('a','','↗');osm.href=`https://www.openstreetmap.org/?mlat=${rec.lat}&mlon=${rec.lng}#map=18/${rec.lat}/${rec.lng}`;osm.target='_blank';osm.rel='noopener';osm.setAttribute('aria-label',`Открыть место ${rec.rank} в OpenStreetMap`);if(!index)osm.id='osm-link';actions.append(save,copy,osm);card.append(heading,coordinate,metrics,node('p','nearest',`Ближайший конкурент: ${distance(rec.nearest_competitor_m)}`),actions);$('recommendation-list').append(card);}); updateSaveButtons();
  $('kpi-residents').textContent=fmt(data.stats.residents);$('kpi-houses').textContent=fmt(data.stats.houses);$('kpi-competitors').textContent=fmt(data.stats.competitors);$('kpi-places').textContent=data.recommendations.length;$('kpi-business').textContent=data.business_name;$('map-context').textContent=`${data.district_name} · ${data.business_name}`;
  $('source').textContent=`Источник: ${sourceText(data.source)}. Дата самой ранней копии: ${dateText(dataDate(data))}. Население оценено по площади и этажности домов.`;const warning=[data.source==='demo'?'Показаны демонстрационные данные: не используйте их для выбора места без проверки.':'',data.warning,data.notice].filter(Boolean).join(' ');$('data-warning').textContent=warning;$('data-warning').hidden=!warning;$('data-section').hidden=false;updateReportAvailability();
}
$('run').addEventListener('click',()=>run(false));$('retry-catalog').addEventListener('click',loadCatalog);$('district').addEventListener('change',()=>{resetSelection();updateCustomUI();$('map-context').textContent='Область изменена — выполните расчёт';});$('business').addEventListener('change',()=>{resetSelection();updateParams();});$('radius').addEventListener('change',()=>{resetSelection();drawPreview();});$('refresh-data').addEventListener('click',()=>run(true));
['houses','competitors','centroids','zones'].forEach(key=>$('layer-'+key).addEventListener('change',e=>{if(!map)return;e.target.checked?layers[key].addTo(map):map.removeLayer(layers[key]);}));
let raf=null;$('thr').addEventListener('input',e=>{$('thr-out').textContent=`${e.target.value}%`;cancelAnimationFrame(raf);raf=requestAnimationFrame(drawZones);});$('export-csv').addEventListener('click',exportCSV);$('print-report').addEventListener('click',printReport);$('model-button').addEventListener('click',()=>$('model-dialog').showModal());$('close-model').addEventListener('click',()=>$('model-dialog').close());$('model-dialog').addEventListener('click',e=>{if(e.target===$('model-dialog')){const box=e.target.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)e.target.close();}});
window.addEventListener('storage', event => {
  if(event.key!==STORAGE_KEY && event.key!==null) return;
  const valid=loadSaved(); renderSaved(); updateSaveButtons();
  if(valid) storageStatus('Список сохранённых мест обновлён в другой вкладке.');
});
loadSaved();renderSaved();initMap();loadCatalog();
})();
