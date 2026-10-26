import { state } from './state.js';
import { $, fmt, node, animateUI, cancelUI, setRevealed, motionReduced, reveal } from './ui.js';

let map = null, tiles = null, tileTimer = null, tileFailures = 0;
let pointsRenderer = null, zonesRenderer = null;
const dataRenderers = {}, preferences = {}, layerTimers = {}, layerRevisions = {};
let emphasized = new Set(), previewRank = null;
const layers = {}, markers = new Map();
const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const color = role => token(`--color-map-${role}`);
const size = role => parseFloat(token(`--size-${role}`));

function readPalette(roles) {
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(roles.map(role => [role, styles.getPropertyValue(`--color-map-${role}`).trim()]));
}
let resetSelection = () => {}, selectPlace = () => {};

export function configureMap(callbacks) {
  resetSelection = callbacks.resetSelection;
  selectPlace = callbacks.selectPlace;
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
  L.control.zoom({
    position: 'topright'
  }).addTo(map);
  tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
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
  map.createPane('points');
  map.getPane('points').style.zIndex = token('--z-points');
  ['houses','competitors','centroids'].forEach((key,index)=>{
    map.createPane(key);map.getPane(key).style.zIndex=String(parseInt(token('--z-points'),10)+index+1);
    dataRenderers[key]=L.canvas({pane:key,padding:.5});
  });
  ['houses','competitors','centroids','zones','recommendations'].forEach(key=>{
    const pane=map.getPane(key==='recommendations'?'markerPane':key);
    pane.dataset.focusPane=key;
    preferences[key]=key==='recommendations'||$('layer-'+key).checked;
  });
  // Leaflet keeps renderers on the map after paths are cleared; reuse these across redraws.
  pointsRenderer = L.canvas({
    pane: 'points',
    padding: .5
  });
  zonesRenderer = L.canvas({
    pane: 'zones'
  });
  ['zones', 'houses', 'competitors', 'centroids', 'recommendations', 'boundary', 'preview'].forEach(key => {
    layers[key] = L.layerGroup().addTo(map);
  });
  map.on('click', e => {
    if ($('district').value !== 'custom') return;
    resetSelection();
    state.customPoint = [e.latlng.lat, e.latlng.lng];
    $('custom-hint').textContent = `Центр выбран: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}. Нажмите «Найти места».`;
    reveal($('custom-hint'), 'notice');
    drawPreview();
  });
  let resizeFrame = null, lastWidth = 0, lastHeight = 0;
  const resizeMap = () => {
    if (resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      const { width, height } = map.getContainer().getBoundingClientRect();
      if (!width || !height || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width; lastHeight = height;
      // Size changes must preserve the user's center, zoom and selected marker.
      map.invalidateSize({ pan: true, animate: false, debounceMoveend: true });
    });
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeMap).observe(map.getContainer());
  window.addEventListener('resize', resizeMap);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
    if (event.matches) { map.stop(); syncMapLayers(false); }
  });
  animateUI($('map'), [{ opacity: 0 }, { opacity: 1 }], 'map-reveal', { duration: 'slow' });
}

export function updateCustomUI() {
  const custom = $('district').value === 'custom';
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

export function drawMap(data) {
  if (!map)return;
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
  data.houses.forEach(h => L.circleMarker([h.lat, h.lng], {
    renderer: dataRenderers.houses,
    radius: 2.5+Math.sqrt(h.residents)/6,
    color: palette.outline,
    weight: 1,
    fillColor: palette.house,
    fillOpacity: .78
  }).bindTooltip(`Жителей: ≈ ${fmt(h.residents)}`).addTo(layers.houses));
  data.competitors.forEach(c => L.circleMarker([c.lat, c.lng], {
    renderer: dataRenderers.competitors,
    radius: 6,
    color: palette['competitor-outline'],
    weight: 2,
    fillColor: palette.competitor,
    fillOpacity: 1
  }).bindTooltip('Конкурент').addTo(layers.competitors));
  data.centroids.forEach(c => L.circleMarker([c.lat, c.lng], {
    renderer: dataRenderers.centroids,
    radius: 9,
    color: palette.centroid,
    weight: 3,
    fill: false,
    dashArray: '3 2'
  }).bindTooltip(`Скопление: ≈ ${fmt(c.residents)} жителей`).addTo(layers.centroids));
  data.recommendations.forEach(r => {
    const marker = L.marker([r.lat, r.lng], {
      icon: iconFor(r.rank,
      r.rank === state.selectedRank),
      title: `Рекомендация ${r.rank}`,
      alt: `Место ${r.rank}`
    }).bindTooltip(`Место ${r.rank}`, {
      direction: 'top',
      offset: [0,
      -12]
    }).addTo(layers.recommendations);
    marker.on('click', () => selectPlace(r.rank, false));
    markers.set(r.rank, marker);
  });
  animateUI(map.getPane('points'), [{ opacity: .3 }, { opacity: 1 }], 'map-points');
  syncMapLayers(false);
}
const mix = (a, b, t) => '#'+[1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i+2), 16)+(parseInt(b.slice(i, i+2), 16)-parseInt(a.slice(i, i+2), 16))*t).toString(16).padStart(2, '0')).join('');

export function drawZones() {
  if (!map)return;
  layers.zones.clearLayers();
  if (!state.current||!state.current.grid)return;
  const g = state.current.grid, threshold = +$('thr').value/100, dLat = (g.lat_max-g.lat_min)/(g.n-1), dLng = (g.lng_max-g.lng_min)/(g.n-1), renderer = zonesRenderer;
  const palette = readPalette(['zone-low', 'zone-high']);
  g.scores.forEach((score, i) => {
    if (score<threshold)return;
    const t = Math.max(0, Math.min(1, (score-threshold)/(1-threshold))), lat = g.lat_min+Math.floor(i/g.n)*dLat, lng = g.lng_min+(i%g.n)*dLng;
    L.rectangle([[lat-dLat*.52, lng-dLng*.52], [lat+dLat*.52, lng+dLng*.52]], {
      renderer,
      stroke: false,
      interactive: false,
      fillColor: mix(palette['zone-low'], palette['zone-high'], t),
      fillOpacity: .18+.24*t
    }).addTo(layers.zones);
  });
  animateUI(map.getPane('zones'), [{ opacity: .25 }, { opacity: 1 }], 'map-zones');
  syncMapLayers(false);
}

export function fitArea(data) {
  if (!map)return;
  const [lat, lng] = data.center, dLat = data.half_m/111000, dLng = data.half_m/(111000*Math.cos(lat*Math.PI/180));
  map.fitBounds([[lat-dLat, lng-dLng], [lat+dLat, lng+dLng]], {
    padding: [25,
    25],
    animate: false
  });
}

export function clearAnalysisMap() {
  emphasized=new Set();previewRank=null;
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
    pin?.classList.toggle('is-selected', r === rank);
    pin?.classList.remove('is-preview');
    if (r !== rank) cancelUI(pin);
  });
  if (changed) {
    const pin = markers.get(rank)?.getElement()?.querySelector('.recommendation-pin');
    animateUI(pin, [{ transform: 'scale(1)' }, { transform: 'scale(var(--motion-pulse-scale))', offset: .45 }, { transform: 'scale(1)' }], 'marker-pulse', { duration: 420, easing: 'spring' });
  }
  const rec = state.current?.recommendations.find(r => r.rank === rank);
  if (map&&rec&&pan) map.panTo([rec.lat, rec.lng], {
    animate: !motionReduced()
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
  syncMapLayers();
}

// Only presentation groups change. Checkbox preferences, data and map view stay intact.
export function setMapEmphasis(keys=[],{animate=true}={}) {
  emphasized=new Set(keys);previewRank=null;syncMapLayers(animate);
}

function syncLegend() {
  const active=new Set([...emphasized].map(key=>({zones:'demand',centroids:'demand',recommendations:'places'})[key]||key));
  if(previewRank || (!active.size && state.current?.recommendations?.length))active.add('places');
  document.querySelectorAll('.map-legend>[data-layer]').forEach(item=>{
    const selected=active.has(item.dataset.layer);item.dataset.active=String(selected);
    if(selected)item.setAttribute('aria-current','true');else item.removeAttribute('aria-current');
  });
}

function syncMapLayers(animate=true) {
  syncLegend();if(!map)return;
  const duration=animate&&!motionReduced()?parseFloat(token('--motion-map-focus'))||400:0;
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
