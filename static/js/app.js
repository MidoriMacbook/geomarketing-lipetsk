import { state } from './state.js';
import { $, fmt, STORAGE_KEY, showError, storageStatus } from './ui.js';
import { configureSaved, loadSaved, renderSaved, updateSaveButtons } from './saved-places.js';
import { exportCSV, printReport, updateReportAvailability } from './report.js';
import { configureMap, initMap, clearAnalysisMap, clearPreview, updateCustomUI, drawPreview, drawMap, drawZones, fitArea, toggleLayer } from './map.js';
import { selectPlace, showResult } from './recommendations.js';
import { cancelRequest, fetchCatalog, fetchCalculation, beginCatalogRequest, beginCalculationRequest, finishCatalogRequest, finishCalculationRequest } from './api.js';


function bootstrap() {
  function resetSelection() {
    cancelRequest();
    state.current = null;
    state.currentRequestKey = null;
    clearAnalysisMap();
    $('result').hidden = true;
    $('result-empty').hidden = false;
    $('data-section').hidden = true;
    $('error').hidden = true;
    $('loading-hint').hidden = true;
    $('result-empty').querySelector('h3').textContent = 'Готово к новому расчёту';
    $('result-empty').querySelector('p').textContent = 'Проверьте настройки и нажмите «Найти места». Сохранённые места доступны ниже.';
    if (state.catalog) $('map-context').textContent = `${$('district').selectedOptions[0].textContent} · ${$('business').selectedOptions[0].textContent}`;
    $('run').disabled = !state.catalog;
    $('refresh-data').disabled = false;
    $('run').textContent = 'Найти места →';
    ['residents', 'houses', 'competitors', 'places'].forEach(key => $('kpi-'+key).textContent = '—');
    updateReportAvailability();
  }
  function updateParams() {
    if (!state.catalog) return;
    const b = state.catalog.businesses.find(b => b.key === $('business').value);
    $('business-parameters').textContent = `Радиус доступности ${fmt(b.radius_m)} м · коэффициент конкуренции ${b.alpha}. Параметры модели.`;
    $('kpi-business').textContent = b.name;
  }
  async function loadCatalog() {
    const controller = beginCatalogRequest();
    $('retry-catalog').hidden = true;
    $('catalog-status').hidden = false;
    $('catalog-status').firstChild.textContent = 'Загружаем районы и категории… ';
    try {
      const data = await fetchCatalog(controller.signal);
      if (data.status !== 'success'||!Array.isArray(data.businesses)||!data.businesses.length||!Array.isArray(data.districts)||!data.districts.length) throw new Error('catalog');
      state.catalog = data;
      $('district').replaceChildren(...data.districts.map(d => new Option(d.name, d.key)), new Option('Своя область на карте', 'custom'));
      $('business').replaceChildren(...data.businesses.map(b => new Option(b.name, b.key)));
      $('district').disabled = false;
      $('business').disabled = false;
      $('run').disabled = false;
      $('catalog-status').hidden = true;
      updateParams();
      updateCustomUI();
      run(false);
    }
    catch {
      $('catalog-status').firstChild.textContent = 'Не удалось загрузить настройки. Проверьте соединение и повторите попытку. ';
      $('retry-catalog').hidden = false;
    }
    finally {
      finishCatalogRequest(controller);
    }
  }
  async function run(refresh = false) {
    if (!state.catalog) return;
    const district = $('district').value, business = $('business').value;
    if (district === 'custom'&&!state.customPoint) {
      showError('Сначала кликните по карте, чтобы выбрать центр области.');
      return;
    }
    const params = new URLSearchParams({
      district,
      type: business
    });
    if (district === 'custom') {
      params.set('lat', state.customPoint[0].toFixed(5));
      params.set('lng', state.customPoint[1].toFixed(5));
      params.set('radius', $('radius').value);
    }
    const requestKey = params.toString(), preserveResult = !!state.current && state.currentRequestKey === requestKey;
    if (refresh) params.set('refresh', '1');
    if (preserveResult) {
      cancelRequest();
      $('error').hidden = true;
    }
    else resetSelection();
    const version = state.requestVersion, request = beginCalculationRequest(), controller = request.controller;
    $('run').disabled = true;
    $('refresh-data').disabled = true;
    $('run').textContent = 'Рассчитываем…';
    $('loading-hint').hidden = false;
    $('loading-hint').textContent = preserveResult?'Обновляем расчёт. Пока показан предыдущий успешный результат.': 'Загрузка и расчёт могут занять до минуты.';
    if (!preserveResult) {
      $('result-empty').querySelector('h3').textContent = 'Ищем подходящие места';
      $('result-empty').querySelector('p').textContent = 'Сопоставляем жителей и конкурентов в выбранной области.';
    }
    try {
      const data = await fetchCalculation(params, controller.signal);
      if (version !== state.requestVersion) return;
      if (data.status !== 'success'||!Array.isArray(data.recommendations)||!data.analysis_id) throw new Error('Invalid calculation response');
      state.current = data;
      state.currentRequestKey = requestKey;
      state.selectedRank = data.recommendations[0]?.rank||1;
      clearPreview();
      drawMap(data);
      drawZones();
      showResult(data);
      fitArea(data);
    }
    catch (err) {
      if (version !== state.requestVersion)return;
      const message = request.timedOut?'Загрузка заняла слишком много времени. Повторите попытку или выберите готовый район.': err.user?err.message: err instanceof TypeError?'Нет связи с сервером. Проверьте интернет и повторите попытку.': 'Не удалось выполнить расчёт. Повторите попытку позже.';
      showError((preserveResult?'Обновить расчёт не удалось. Показан предыдущий успешный результат. ': '')+message);
      if (!preserveResult) {
        $('result-empty').querySelector('h3').textContent = 'Расчёт пока недоступен';
        $('result-empty').querySelector('p').textContent = 'Повторите попытку или измените область поиска. Сохранённые места доступны ниже.';
      }
    }
    finally {
      finishCalculationRequest(request);
      if (version === state.requestVersion) {
        state.activeRequest = null;
        $('run').disabled = false;
        $('refresh-data').disabled = false;
        $('run').textContent = 'Найти места →';
        $('loading-hint').hidden = true;
        updateReportAvailability();
      }
    }
  }
  $('run').addEventListener('click', () => run(false));
  $('retry-catalog').addEventListener('click', loadCatalog);
  $('district').addEventListener('change', () => {
    resetSelection();
    updateCustomUI();
    $('map-context').textContent = 'Область изменена — выполните расчёт';
  });
  $('business').addEventListener('change', () => {
    resetSelection();
    updateParams();
  });
  $('radius').addEventListener('change', () => {
    resetSelection();
    drawPreview();
  });
  $('refresh-data').addEventListener('click', () => run(true));
  ['houses', 'competitors', 'centroids', 'zones'].forEach(key => $('layer-'+key).addEventListener('change', e => toggleLayer(key, e.target.checked)));
  let raf = null;
  $('thr').addEventListener('input', e => {
    $('thr-out').textContent = `${e.target.value}%`;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(drawZones);
  });
  $('export-csv').addEventListener('click', exportCSV);
  $('print-report').addEventListener('click', printReport);
  $('model-button').addEventListener('click', () => $('model-dialog').showModal());
  $('close-model').addEventListener('click', () => $('model-dialog').close());
  $('model-dialog').addEventListener('click', e => {
    if (e.target === $('model-dialog')) {
      const box = e.target.getBoundingClientRect();
      if (e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)e.target.close();
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const valid = loadSaved();
    renderSaved();
    updateSaveButtons();
    if (valid) storageStatus('Список сохранённых мест обновлён в другой вкладке.');
  });
  configureSaved({
    updateReportAvailability
  });
  configureMap({
    resetSelection,
    selectPlace
  });
  loadSaved();
  renderSaved();
  initMap();
  loadCatalog();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, {
  once: true
});
else bootstrap();
