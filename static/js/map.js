import { state } from './state.js';
import { $, fmt, node, animateUI, cancelUI, setRevealed, motionReduced, reveal } from './ui.js';

let map = null, tiles = null, tileTimer = null, tileFailures = 0;
let pointsRenderer = null, zonesRenderer = null;
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
  window.addEventListener('resize', () => {
    map.invalidateSize();
    if (state.current) fitArea(state.current);
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
    if (event.matches) map.stop();
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
  const palette = readPalette(['primary', 'outline', 'house', 'competitor', 'centroid']);
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
    renderer,
    radius: 2.5+Math.sqrt(h.residents)/6,
    color: palette.outline,
    weight: 1,
    fillColor: palette.house,
    fillOpacity: .85
  }).bindTooltip(`Жителей: ≈ ${fmt(h.residents)}`).addTo(layers.houses));
  data.competitors.forEach(c => L.circleMarker([c.lat, c.lng], {
    renderer,
    radius: 6,
    color: palette.outline,
    weight: 2,
    fillColor: palette.competitor,
    fillOpacity: 1
  }).bindTooltip('Конкурент').addTo(layers.competitors));
  data.centroids.forEach(c => L.circleMarker([c.lat, c.lng], {
    renderer,
    radius: 6,
    color: palette.primary,
    weight: 1.5,
    fillColor: palette.centroid,
    fillOpacity: 1
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
      fillOpacity: .5+.3*t
    }).addTo(layers.zones);
  });
  animateUI(map.getPane('zones'), [{ opacity: .25 }, { opacity: 1 }], 'map-zones');
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
  markers.clear();
  Object.entries(layers).forEach(([key, layer]) => {
    if (key !== 'preview') layer.clearLayers();
  });
}

export function clearPreview() {
  if (map) layers.preview.clearLayers();
}

export function selectMarker(rank, pan, changed = false) {
  markers.forEach((marker, r) => {
    const pin = marker.getElement()?.querySelector('.recommendation-pin');
    pin?.classList.toggle('is-selected', r === rank);
    if (r !== rank) cancelUI(pin);
  });
  if (changed) {
    const pin = markers.get(rank)?.getElement()?.querySelector('.recommendation-pin');
    animateUI(pin, [{ transform: 'scale(1)' }, { transform: 'scale(var(--motion-pulse-scale))', offset: .45 }, { transform: 'scale(1)' }], 'marker-pulse', { duration: 'slow', easing: 'spring' });
  }
  const rec = state.current?.recommendations.find(r => r.rank === rank);
  if (map&&rec&&pan) map.panTo([rec.lat, rec.lng], {
    animate: !motionReduced()
  });
}

export function toggleLayer(key, enabled) {
  if (!map) return;
  enabled ? layers[key].addTo(map) : map.removeLayer(layers[key]);
  if (enabled) {
    const pane = key === 'zones' ? 'zones' : key === 'recommendations' ? 'markerPane' : 'points';
    animateUI(map.getPane(pane), [{ opacity: .35 }, { opacity: 1 }], `map-${key === 'zones' ? 'zones' : 'points'}`);
  }
}
