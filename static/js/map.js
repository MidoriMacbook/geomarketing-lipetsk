import { state } from './state.js';
import {createMapInspector} from './map-inspector.js';
import {createSelectionLayer} from './map-selection.js';
import {createMapComparison} from './map-comparison.js';
import {createCompetitorPopup, describeCompetitor} from './competitor-card.js';
import { $, fmt, node, animateUI, cancelUI, setRevealed, motionReduced, reveal } from './ui.js';

let map = null, tiles = null, tileTimer = null, tileFailures = 0;
let pointsRenderer = null, zonesRenderer = null;
let accessPalette=null,focusDuration=400;
const dataRenderers = {}, preferences = {}, layerTimers = {}, layerRevisions = {};
let emphasized = new Set(), previewRank = null, houseData = [];
let viewportRank=null, viewportTimer=null,inspector=null,selection=null,comparison=null,choosingCenter=false;
let competitorPopup = null, competitorIcon = null, chainCompetitorIcon = null;
let manualViewport=false;
const layers = {}, markers = new Map();
let correctionView = { mode: null, draft: { added: [], removed: [] }, pending: false };
const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const color = role => token(`--color-map-${role}`);
const size = role => parseFloat(token(`--size-${role}`));

function readPalette(roles) {
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(roles.map(role => [role, styles.getPropertyValue(`--color-map-${role}`).trim()]));
}
let resetSelection = () => {}, selectPlace = () => {};
let correctionTap = () => false, removeCompetitor = () => {};

export function configureMap(callbacks) {
  resetSelection = callbacks.resetSelection;
  selectPlace = callbacks.selectPlace;
  correctionTap = callbacks.correctionTap;
  removeCompetitor = callbacks.removeCompetitor;
}

export function mapWarning() {
  const firstNotice = $('map-status').hidden;
  $('map-message').textContent = 'Подложка карты загрузилась не полностью. Анализ готовых районов доступен.';
  $('map-status').hidden = false;
  if (firstNotice) reveal($('map-status'), 'notice');
}

export function initMap() {
  if (typeof L === 'undefined') {
    $('map-message').textContent = 'Не удалось загрузить модуль карты. Обновите страницу. Расчёт готовых районов доступен.';
    $('map-status').hidden = false;
    reveal($('map-status'), 'notice');
    $('retry-map').textContent = 'Обновить страницу';
    $('retry-map').addEventListener('click', () => location.reload());
    return;
  }
  map = L.map('map', {
    zoomControl: false
  }).setView([52.6088, 39.5992], 12);
  accessPalette={line:token('--palette-rosewood-deep'),fill:token('--palette-pink')};focusDuration=parseFloat(token('--motion-map-focus'))||400;
  map.attributionControl.setPrefix(false);
  L.control.zoom({
    position: 'topright'
  }).addTo(map);
  tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">участники OpenStreetMap</a>',
    maxZoom: 19
  });
  tiles.on('loading', () => {
    tileFailures = 0;
    clearTimeout(tileTimer);
    tileTimer = setTimeout(mapWarning, 12000);
  });
  tiles.on('tileerror', () => {
    tileFailures++;
    mapWarning();
  });
  tiles.on('load', () => {
    clearTimeout(tileTimer);
    if (!tileFailures) $('map-status').hidden = true;
  });
  tiles.addTo(map);
  $('retry-map').addEventListener('click', () => {
    $('map-status').hidden = true;
    tiles.redraw();
  });
  map.createPane('zones');
  map.getPane('zones').style.zIndex = token('--z-zones');
  map.createPane('accessibility');
  map.getPane('accessibility').style.zIndex = '410';
  map.getPane('accessibility').style.pointerEvents = 'none';
  map.createPane('points');
  map.getPane('points').style.zIndex = token('--z-points');
  ['houses','competitors','centroids'].forEach((key,index)=>{
    map.createPane(key);map.getPane(key).style.zIndex=String(parseInt(token('--z-points'),10)+index+1);
  });
  dataRenderers.houses = L.canvas({ pane: 'houses', padding: .5 });
  competitorIcon = L.divIcon({ className: 'competitor-marker', iconSize: [24, 24] });
  chainCompetitorIcon = L.divIcon({ className: 'competitor-marker is-chain', iconSize: [24, 24] });
  map.createPane('corrections').style.zIndex = '620';
  ['houses','competitors','centroids','zones','recommendations'].forEach(key=>{
    const pane=map.getPane(key==='recommendations'?'markerPane':key);
    pane.dataset.focusPane=key;
    preferences[key]=key==='recommendations'||$('layer-'+key).checked;
  });
  // После удаления контуров Leaflet сохраняет средства отрисовки; используем их повторно.
  pointsRenderer = L.canvas({
    pane: 'points',
    padding: .5
  });
  zonesRenderer = L.canvas({
    pane: 'zones'
  });
  ['zones', 'houses', 'competitors', 'centroids', 'recommendations', 'boundary', 'preview', 'accessibility', 'corrections'].forEach(key => {
    layers[key] = L.layerGroup().addTo(map);
  });
  map.on('zoomend', drawHouses);
  document.addEventListener('gm:sheet-position',event=>{
    if(event.detail.active&&event.detail.snap==='peek'&&viewportRank===null)requestAnimationFrame(()=>{if(!manualViewport)fitMobilePlaces();});
  });
  document.addEventListener('gm:show-place',event=>{
    viewportRank=event.detail.rank;manualViewport=false;schedulePlaceFrame();
  });
  document.addEventListener('gm:pin-selected',event=>{
    viewportRank=event.detail.rank;
  });
  // После естественной прокрутки и остановки панели известна видимая часть карты.
  window.addEventListener('scroll',schedulePlaceFrame,{passive:true});
  document.addEventListener('gm:analysis-rendered',event=>{
    clearTimeout(viewportTimer);
    if (event.detail.preserveViewport) { manualViewport=true; return; }
    viewportRank=null;
    manualViewport=false;
  });
  map.getContainer().addEventListener('pointerdown',event=>{
    if(event.target.closest('.leaflet-popup,.leaflet-control-attribution'))return;
    // Жест на карте получает приоритет перед отложенным кадрированием листа.
    manualViewport=true;
    clearTimeout(viewportTimer);
  },{passive:true});
  const motionObserver=new IntersectionObserver(([entry])=>{map.getContainer().dataset.motionVisible=String(entry.isIntersecting);});
  motionObserver.observe(map.getContainer());
  document.querySelectorAll('[data-layer-key]').forEach(button=>button.addEventListener('click',()=>{
    const input=$('layer-'+button.dataset.layerKey);input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}));
  }));
  selection=createSelectionLayer(map);
  inspector=createMapInspector(map,{selectPoint:rec=>{if(comparison?.isOpen())comparison.clear();drawAccessCircle(rec);selection.select(rec);},selectRecommendation:rec=>selectPlace(rec.rank,false)});
  competitorPopup = createCompetitorPopup(map);
  comparison=createMapComparison(map,{onOpen:()=>{clearTimeout(viewportTimer);inspector.close();competitorPopup.close();selection.select(null);layers.accessibility.clearLayers();},onClose:()=>drawAccessRadius(state.selectedRank)});
  document.addEventListener('gm:choose-center',()=>{choosingCenter=true;});
  map.on('click', handleMapClick);
  let resizeFrame = null, lastWidth = 0, lastHeight = 0;
  const resizeMap = () => {
    if(document.documentElement.dataset.sheetGesture==='true')return;
    if (resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      const { width, height } = map.getContainer().getBoundingClientRect();
      if (!width || !height || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width; lastHeight = height;
      // Изменение размера сохраняет выбранные пользователем центр, масштаб и маркер.
      map.invalidateSize({ pan: true, animate: false, debounceMoveend: true });
    });
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeMap).observe(map.getContainer());
  window.addEventListener('resize', resizeMap);
  document.addEventListener('gm:sheet-settled',()=>{
    map.invalidateSize({pan:true,animate:false,debounceMoveend:true});
    schedulePlaceFrame();
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
    if (event.matches) { map.stop(); syncMapLayers(false); }
  });
  animateUI($('map'), [{ opacity: 0 }, { opacity: 1 }], 'map-reveal', { duration: 'slow' });
}

function choosingCustomCenter() {
  return $('district').value === 'custom' && (choosingCenter || !state.current);
}

function handleMapClick({ latlng }) {
  if (!choosingCustomCenter()) {
    if (!correctionTap(latlng)) inspector.inspect(latlng);
    return;
  }
  if (resetSelection() === false) { choosingCenter = false; return; }
  state.customPoint = [latlng.lat, latlng.lng];
  $('custom-hint').textContent = `Центр выбран: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}. Нажмите «Найти места».`;
  reveal($('custom-hint'), 'notice');
  drawPreview();
}

export function updateCustomUI({ chooseCenter = false } = {}) {
  const custom = $('district').value === 'custom';
  if (chooseCenter) choosingCenter = custom;
  setRevealed($('custom-box'), custom, 'custom');
  $('district').setAttribute('aria-controls', 'custom-box');
  $('district').setAttribute('aria-expanded', String(custom));
  if (map) map.getContainer().style.cursor = custom?'crosshair': '';
  drawPreview();
}

export function drawPreview() {
  if (!map) return;
  layers.preview.clearLayers();
  if ($('district').value !== 'custom'||!state.customPoint) return;
  L.circle(state.customPoint, {
    radius: +$('radius').value,
    color: color('primary'),
    weight: 1.5,
    dashArray: '5 6',
    fillOpacity: .05,
    interactive: false
  }).addTo(layers.preview);
  L.circleMarker(state.customPoint, {
    radius: 5,
    color: color('outline'),
    weight: 2,
    fillColor: color('primary'),
    fillOpacity: 1,
    interactive: false
  }).addTo(layers.preview);
}

export function iconFor(rank, selected) {
  const markerSize = size('marker');
  const pin = node('span', `recommendation-pin${selected?' is-selected':''}`, rank);
  pin.dataset.testid = 'recommendation-marker';
  return L.divIcon({
    className: '',
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize/2, markerSize/2],
    html: pin
  });
}

export function drawMap(data, { preserveViewport = false } = {}) {
  if (!map)return;
  if (preserveViewport) {
    manualViewport = true;
    viewportRank = null;
    clearTimeout(viewportTimer);
  }
  choosingCenter=false;inspector.setData(data);competitorPopup.close();selection.setData(data);comparison.setData(data);
  Object.entries(layers).forEach(([key, layer]) => {
    if (key !== 'preview')layer.clearLayers();
  });
  markers.clear();
  const renderer = pointsRenderer;
  const palette = readPalette(['primary', 'outline', 'house', 'competitor', 'competitor-outline', 'centroid']);
  L.circle(data.center, {
    radius: data.half_m,
    renderer,
    interactive: false,
    color: palette.primary,
    weight: 1,
    opacity: .5,
    dashArray: '4 6',
    fill: false
  }).addTo(layers.boundary);
  houseData=data.houses;drawHouses();
  drawCompetitors(data);
  data.centroids.forEach((c,index)=>{
    const marker=L.marker([c.lat,c.lng],{pane:'centroids',icon:L.divIcon({className:'demand-center',html:'<span aria-hidden="true"></span>',iconSize:[44,44],iconAnchor:[-18,22]}),alt:`Центр спроса ${index+1}`})
      .bindTooltip(`Центр спроса: ≈ ${fmt(c.residents)} жителей`).addTo(layers.centroids);
    const open=()=>inspector.openDemand(c,index);marker.on('click',open);
    const element=marker.getElement();element.setAttribute('role','button');element.setAttribute('aria-label',`Центр спроса ${index+1}`);
    element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();open();}});
  });
  data.recommendations.forEach(r => {
    const marker = L.marker([r.lat, r.lng], {
      icon: iconFor(r.rank,
      r.rank === state.selectedRank),
      zIndexOffset:r.rank===state.selectedRank?1000:0,
      title: `Рекомендация ${r.rank}`,
      alt: `Место ${r.rank}, оценка ${Math.round(r.score*100)} из 100`
    }).bindTooltip(`Место ${r.rank}`, {
      direction: 'top',
      offset: [0,
      -12]
    }).addTo(layers.recommendations);
    marker.on('click', () => {
      marker.closeTooltip();
      selectPlace(r.rank, false);
      document.dispatchEvent(new CustomEvent('gm:pin-selected',{detail:{rank:r.rank}}));
      inspector.openPlace(r);
    });
    markers.set(r.rank, marker);
    const element=marker.getElement();element.setAttribute('role','button');element.setAttribute('aria-label',`Место ${r.rank}, оценка ${Math.round(r.score*100)} из 100`);
    const preview=active=>{
      hoverPlace(r.rank,active);
      document.querySelector(`#recommendation-list [data-rank="${r.rank}"]`)?.classList.toggle('is-preview',active);
    };
    element.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')preview(true);});
    element.addEventListener('pointerleave',()=>preview(false));
    element.addEventListener('focus',()=>preview(true));element.addEventListener('blur',()=>preview(false));
    element.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();marker.fire('click');}});
  });
  drawAccessRadius(state.selectedRank);
  animateUI(map.getPane('points'), [{ opacity: .3 }, { opacity: 1 }], 'map-points');
  syncMapLayers(false);
}

export function updateCorrectionMap(view) {
  correctionView = view;
  if (!map) return;
  map.getContainer().dataset.correctionMode = view.mode || '';
  if (state.current) drawCompetitors(state.current);
}

export function beginMapCorrections() {
  inspector?.close();
  competitorPopup?.close();
  comparison?.clear();
  if (map && state.current && !map.getBounds().contains(state.current.center)) {
    fitCalculationArea(state.current);
  }
  manualViewport = true;
  clearTimeout(viewportTimer);
  document.dispatchEvent(new CustomEvent('gm:map-focus'));
}

function bindCompetitorMarker(marker, label, open, id, removable = false) {
  marker.on('click', open);
  marker.on('add', () => {
    const element = marker.getElement();
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', label);
    element.setAttribute(removable ? 'aria-haspopup' : 'aria-expanded', removable ? 'dialog' : 'false');
    if (id) element.dataset.competitorId = id;
    element.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      open();
    });
  });
}

function inspectCompetitor(marker, details, colocated, event) {
  if (choosingCustomCenter()) {
    handleMapClick(event ?? { latlng: marker.getLatLng() });
    return;
  }
  manualViewport = true;
  clearTimeout(viewportTimer);
  inspector.close();
  const related = colocated.filter(entry => entry.details !== details).map(entry => entry.details);
  competitorPopup.open(marker, details, related);
}

function correctionMarker(point, details, { removable = false, pending = false, colocated = [], related = [] } = {}) {
  const manual = point.source === 'manual';
  const icon = L.divIcon({
    className: `correction-marker${!manual ? ' is-removable' : ''}${pending ? ' is-pending' : ''}${point.is_chain || colocated.some(row => row.is_chain) ? ' is-chain' : ''}`,
    html: node('span', '', colocated.length > 1 ? colocated.length : removable ? '−' : '+'),
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
  const label = manual ? (removable ? 'Убрать конкурента · добавлен вручную' : 'Конкурент · добавлен вручную')
    : colocated.length > 1 ? `Выбрать конкурента OpenStreetMap · меток: ${colocated.length}` : 'Убрать конкурента OpenStreetMap';
  const marker = L.marker([point.lat, point.lng], { pane: 'corrections', icon, alt: label });
  const open = event => {
    if (removable) { competitorPopup.close(); removeCompetitor(point, colocated, marker.getElement()); }
    else inspectCompetitor(marker, details, related, event);
  };
  bindCompetitorMarker(marker, label, open, point.id, removable);
  marker.addTo(layers.corrections);
}

function drawCompetitors(data) {
  const { mode, draft, pending } = correctionView;
  competitorPopup.close();
  layers.competitors.clearLayers();
  layers.corrections.clearLayers();
  layers.corrections.addTo(map);
  const context = data.correction_context;
  const editPoints = Boolean(context && mode);
  const removed = new Set(editPoints ? draft.removed : []);
  const points = editPoints ? context.base_competitors : data.competitors;
  const candidates = new Map();
  const inspectable = new Map();
  const additions = editPoints ? draft.added : context?.applied.added || data.competitors.filter(point => point.source === 'manual');
  const appliedIds = new Set(context?.applied.added.map(point => point.id));
  const positionKey = point => `${point.lat}:${point.lng}`;
  for (const point of points) {
    if (point.source === 'manual' || removed.has(point.id)) continue;
    const details = describeCompetitor(point, data.source);
    if (mode === 'remove' && details.id) {
      const key = positionKey(point);
      const group = candidates.get(key) || [];
      group.push(point);
      candidates.set(key, group);
      continue;
    }
    const key = positionKey(point);
    const group = inspectable.get(key) || [];
    group.push({ point, details });
    inspectable.set(key, group);
  }
  if (mode !== 'remove') {
    for (const point of additions) {
      const manual = { ...point, source: 'manual' };
      const key = positionKey(point);
      const group = inspectable.get(key) || [];
      group.push({ point: manual, details: describeCompetitor(manual, data.source) });
      inspectable.set(key, group);
    }
  }
  for (const group of inspectable.values()) {
    for (const { point, details } of group) {
      if (point.source === 'manual') {
        correctionMarker(point, details, { pending: pending && !appliedIds.has(point.id), related: group });
        continue;
      }
      const marker = L.marker([point.lat, point.lng], {
        pane: 'competitors', icon: details.isChain ? chainCompetitorIcon : competitorIcon,
      });
      const label = [details.title, details.id || details.note,
        details.isChain ? 'Отмечен как сетевой' : null].filter(Boolean).join(', ');
      bindCompetitorMarker(marker, label, event => inspectCompetitor(marker, details, group, event), details.id);
      marker.addTo(layers.competitors);
    }
  }
  for (const group of candidates.values()) correctionMarker(group[0], null, { removable: true, colocated: group });
  if (mode === 'remove') {
    for (const point of additions) {
      correctionMarker({ ...point, source: 'manual' }, null, {
        removable: true,
        pending: pending && !appliedIds.has(point.id),
      });
    }
  }
  syncCorrectionLayer();
}

function syncCorrectionLayer() {
  const enabled = correctionView.mode || $('layer-competitors').checked;
  if (enabled) layers.corrections.addTo(map);
  else layers.corrections.remove();
}
// Экранная сетка — только представление суммы жителей, исходные дома не меняются.
function drawHouses() {
  if(!map)return;
  layers.houses.clearLayers();
  const zoom=map.getZoom(), palette=readPalette(['house']);
  const options={renderer:dataRenderers.houses,stroke:false,fillColor:palette.house,fillOpacity:.42};
  if(zoom<=13){
    const cells=new Map(),cellSize=24;
    for(const house of houseData){
      const point=map.project([house.lat,house.lng],zoom),x=Math.floor(point.x/cellSize),y=Math.floor(point.y/cellSize),key=x+':'+y;
      const cell=cells.get(key)||{x,y,residents:0,count:0};cell.residents+=house.residents;cell.count++;cells.set(key,cell);
    }
    const max=Math.max(1,...[...cells.values()].map(c=>c.residents));
    for(const cell of cells.values()){
      const a=map.unproject([cell.x*cellSize,cell.y*cellSize],zoom),b=map.unproject([(cell.x+1)*cellSize,(cell.y+1)*cellSize],zoom);
      L.rectangle([a,b],{...options,fillOpacity:.12+.28*Math.sqrt(cell.residents/max)})
        .bindTooltip(`Группа домов: ${fmt(cell.count)} · жителей ≈ ${fmt(cell.residents)}`).addTo(layers.houses);
    }
    map.getContainer().dataset.housesView='grid';
  }else{
    for(const house of houseData){
      const radius=Math.min(zoom<=14?3:5,2+Math.sqrt(house.residents)/80*Math.max(1,zoom-13));
      L.circleMarker([house.lat,house.lng],{...options,radius})
        .bindTooltip(`Жителей: ≈ ${fmt(house.residents)}`).addTo(layers.houses);
    }
    map.getContainer().dataset.housesView='points';
  }
}
function drawAccessRadius(rank){
  const rec=state.current?.recommendations.find(r=>r.rank===rank);
  drawAccessCircle(rec);selection?.select(rec);
}
function drawAccessCircle(rec){
  if(!map)return;
  layers.accessibility.clearLayers();
  if(!rec)return;
  L.circle([rec.lat,rec.lng],{pane:'accessibility',radius:rec.radius_m,interactive:false,
    color:accessPalette.line,weight:2,opacity:.7,fillColor:accessPalette.fill,fillOpacity:.1,dashArray:'6 5'}).addTo(layers.accessibility);
}

const mix = (a, b, t) => '#'+[1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i+2), 16)+(parseInt(b.slice(i, i+2), 16)-parseInt(a.slice(i, i+2), 16))*t).toString(16).padStart(2, '0')).join('');
let zoneSnapshot=null;

export function drawZones() {
  if (!map)return;
  // cancelUI синхронно вызывает cleanup; не обращаемся затем к сброшенной ссылке.
  const previous=zoneSnapshot;
  if(previous){zoneSnapshot=null;cancelUI(previous);previous.remove();}
  const oldCanvas=map.getPane('zones').querySelector('canvas');
  if(oldCanvas&&!motionReduced()&&state.current){
    const snapshot=oldCanvas.cloneNode();snapshot.getContext('2d').drawImage(oldCanvas,0,0);
    snapshot.style.pointerEvents='none';snapshot.setAttribute('aria-hidden','true');
    oldCanvas.after(snapshot);zoneSnapshot=snapshot;
    animateUI(snapshot,[{opacity:1},{opacity:0}],'zone-crossfade',{duration:'base',cleanup:()=>{snapshot.remove();if(zoneSnapshot===snapshot)zoneSnapshot=null;}});
  }
  layers.zones.clearLayers();
  if (!state.current||!state.current.grid)return;
  const g = state.current.grid, threshold = +$('thr').value/100, dLat = (g.lat_max-g.lat_min)/(g.n-1), dLng = (g.lng_max-g.lng_min)/(g.n-1), renderer = zonesRenderer;
  const palette = readPalette(['zone-low', 'zone-mid', 'zone-high']);
  g.scores.forEach((score, i) => {
    if (score<threshold)return;
    const t = Math.max(0, Math.min(1, (score-threshold)/(1-threshold))), lat = g.lat_min+Math.floor(i/g.n)*dLat, lng = g.lng_min+(i%g.n)*dLng;
    L.rectangle([[lat-dLat*.52, lng-dLng*.52], [lat+dLat*.52, lng+dLng*.52]], {
      renderer,
      stroke: false,
      interactive: false,
      fillColor: t<.5?mix(palette['zone-low'],palette['zone-mid'],t*2):mix(palette['zone-mid'],palette['zone-high'],(t-.5)*2),
      fillOpacity: .32+.28*t
    }).addTo(layers.zones);
  });
  syncMapLayers(false);
}

export function fitArea(data) {
  if (!map)return;
  if(matchMedia('(max-width:600px)').matches&&data.recommendations?.length){fitMobilePlaces(data);return;}
  fitCalculationArea(data);
}

function fitCalculationArea(data) {
  const [lat, lng] = data.center, dLat = data.half_m/111000, dLng = data.half_m/(111000*Math.cos(lat*Math.PI/180));
  map.fitBounds([[lat-dLat, lng-dLng], [lat+dLat, lng+dLng]], {
    padding: [25,
    25],
    animate: false
  });
}

function visiblePadding(){
  const rect=map.getContainer().getBoundingClientRect(),sheet=$('recommendations');
  const header=$('site-header').getBoundingClientRect().bottom;
  const sheetTop=sheet.dataset.sheetActive==='true'?innerHeight-parseFloat(sheet.style.getPropertyValue('--sheet-visible')||'0'):innerHeight;
  const top=Math.max(28,header-rect.top+24);
  const bottom=Math.max(28,rect.bottom-sheetTop+28);
  // При полностью раскрытом списке карту не перекадрируем.
  return {top,bottom,usable:rect.height-top-bottom};
}
function fitMobilePlaces(data=state.current){
  if(!map||!matchMedia('(max-width:600px)').matches||!data?.recommendations?.length)return;
  const {top,bottom,usable}=visiblePadding();
  if(usable<40)return;
  map.fitBounds(data.recommendations.map(r=>[r.lat,r.lng]),{paddingTopLeft:[36,top],paddingBottomRight:[68,bottom],maxZoom:16,animate:false});
}
function centerVisiblePlace(rank){
  if(!map)return;
  const rec=state.current?.recommendations.find(r=>r.rank===rank);if(!rec)return;
  const {top,bottom,usable}=visiblePadding();if(usable<100)return;
  const bounds=L.latLng(rec.lat,rec.lng).toBounds(rec.radius_m*2);
  map.flyToBounds(bounds,{paddingTopLeft:[28,top],paddingBottomRight:[62,bottom],maxZoom:16,animate:!motionReduced(),duration:.45});
}
function schedulePlaceFrame(){
  if(!matchMedia('(max-width:600px)').matches||manualViewport)return;
  clearTimeout(viewportTimer);viewportTimer=setTimeout(()=>{
    if(document.documentElement.dataset.sheetGesture==='true'||inspector?.isOpen()||comparison?.isOpen())return;
    if(viewportRank===null)fitMobilePlaces();else centerVisiblePlace(viewportRank);
  },160);
}

export function clearAnalysisMap() {
  inspector?.setData(null);
  competitorPopup?.close();
  selection?.setData(null);
  comparison?.setData(null);
  emphasized=new Set();previewRank=null;houseData=[];
  Object.keys(layerTimers).forEach(key=>{clearTimeout(layerTimers[key]);layerRevisions[key]=(layerRevisions[key]||0)+1;});
  markers.clear();
  Object.entries(layers).forEach(([key, layer]) => {
    if (key !== 'preview') layer.clearLayers();
  });
  syncMapLayers(false);
}

export function clearPreview() {
  if (map) layers.preview.clearLayers();
}

export function selectMarker(rank, pan, changed = false) {
  previewRank=null;
  markers.forEach((marker, r) => {
    const pin = marker.getElement()?.querySelector('.recommendation-pin');
    marker.setZIndexOffset(r===rank?1000:0);
    pin?.classList.toggle('is-selected', r === rank);
    pin?.classList.remove('is-preview');
    if (r !== rank) cancelUI(pin);
  });
  drawAccessRadius(rank);
  if (changed) {
    const pin = markers.get(rank)?.getElement()?.querySelector('.recommendation-pin');
    animateUI(pin, [{ transform: 'scale(1)' }, { transform: 'scale(var(--motion-pulse-scale))', offset: .45 }, { transform: 'scale(1)' }], 'marker-pulse', { duration: 420, easing: 'spring' });
  }
  const rec = state.current?.recommendations.find(r => r.rank === rank);
  if (map&&rec&&pan) map.panTo([rec.lat, rec.lng], {
    animate: !motionReduced(),duration:.5,easeLinearity:.25
  });
  syncMapLayers();
}

export function hoverPlace(rank, active) {
  previewRank=active?rank:null;
  markers.forEach((marker, currentRank) => {
    marker.getElement()?.querySelector('.recommendation-pin')?.classList.toggle('is-preview',
      active && currentRank === rank && currentRank !== state.selectedRank);
  });
  syncMapLayers();
}

export function toggleLayer(key, enabled) {
  preferences[key]=enabled;
  if (map && key === 'competitors') {
    if (!enabled) competitorPopup.close();
    syncCorrectionLayer();
  }
  syncMapLayers();
}

// Меняются только группы отображения. Флажки, данные и положение карты сохраняются.
export function setMapEmphasis(keys=[],{animate=true}={}) {
  emphasized=new Set(keys);previewRank=null;syncMapLayers(animate);
}

function syncLegend() {
  const active=new Set([...emphasized].map(key=>({zones:'demand',centroids:'demand',recommendations:'places'})[key]||key));
  if(previewRank || (!active.size && state.current?.recommendations?.length))active.add('places');
  document.querySelectorAll('.map-legend>[data-layer]').forEach(item=>{
    const selected=active.has(item.dataset.layer);item.dataset.active=String(selected);
    const key=item.dataset.layerKey, enabled=preferences[key]!==false||emphasized.has(key);
    item.setAttribute('aria-pressed',String(enabled));
    const label=item.querySelector('.layer-state');if(label)label.textContent=enabled?'вкл':'выкл';
    if(selected)item.setAttribute('aria-current','true');else item.removeAttribute('aria-current');
  });
}

function syncMapLayers(animate=true) {
  syncLegend();if(!map)return;
  const duration=animate&&!motionReduced()?focusDuration:0;
  ['houses','competitors','centroids','zones','recommendations'].forEach(key=>{
    const pane=map.getPane(key==='recommendations'?'markerPane':key),layer=layers[key];
    if(!layer)return;
    const wanted=preferences[key]!==false||emphasized.has(key);
    const revision=layerRevisions[key]=(layerRevisions[key]||0)+1;
    clearTimeout(layerTimers[key]);
    pane.style.transitionDuration=duration?'':'0ms';
    if(wanted&&!map.hasLayer(layer))layer.addTo(map);
    pane.style.opacity=String(!wanted?0:(!emphasized.size||emphasized.has(key)||(key==='recommendations'&&previewRank))?1:.28);
    if(!wanted&&map.hasLayer(layer)){
      const remove=()=>{if(layerRevisions[key]===revision && preferences[key]===false && !emphasized.has(key))map.removeLayer(layer);};
      if(duration)layerTimers[key]=setTimeout(remove,duration);else remove();
    }
  });
}
