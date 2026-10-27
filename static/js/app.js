import { state } from './state.js';
import { initMobileWorkspace } from './mobile-workspace.js';
import { initComparisonGuide } from './comparison-guide.js';
import { refreshMessage } from './data-delivery.js';
import { clearKpiFocus } from './kpi-interactions.js';
import { $, fmt, STORAGE_KEY, showError, storageStatus, initMotion, setAnalysisState, setRevealed, initDialogMotion, openDialog, closeDialog, cancelRevealsWithin, motionReduced } from './ui.js';
import { configureSaved, loadSaved, renderSaved, updateSaveButtons } from './saved-places.js';
import { exportCSV, printReport, updateReportAvailability } from './report.js';
import { configureMap, initMap, clearAnalysisMap, clearPreview, updateCustomUI, drawPreview, drawMap, drawZones, fitArea, toggleLayer } from './map.js';
import { selectPlace, showResult } from './recommendations.js';
import { resetCounters, finishCounters } from './counters.js';
import { configureScenarios, initScenarios, updateScenarioAvailability } from './scenarios.js';
import { validateScenario } from './scenario-storage.js';
import { cancelRequest, fetchCatalog, fetchCalculation, beginCatalogRequest, beginCalculationRequest, finishCatalogRequest, finishCalculationRequest } from './api.js';


function bootstrap() {
  initMotion();
  import('./choices.js').then(({initChoiceMenus})=>initChoiceMenus()).catch(()=>{});
  initDialogMotion($('model-dialog'));
  function refreshFeedback(message = '', busy = false) {
    $('refresh-status').textContent = message;
    $('refresh-status').hidden = !message;
    $('refresh-data').setAttribute('aria-busy', String(busy));
    $('refresh-label').textContent = busy ? 'Проверяем…' : 'Проверить обновления';
  }
  function resetSelection({preserveResult=false}={}) {
    clearKpiFocus({immediate:true});
    cancelRequest();
    refreshFeedback();
    if(preserveResult&&state.current){
      document.querySelectorAll('.kpis,.area-details-grid,#recommendation-list').forEach(container=>{finishCounters(container);cancelRevealsWithin(container);});
      $('error').hidden=true;$('loading-hint').hidden=true;
      $('run').disabled=!state.catalog;$('refresh-data').disabled=false;$('run').textContent='Найти места →';
      $('map-context').textContent=`Предыдущий расчёт · ${state.current.district_name} · ${state.current.business_name}`;
      setAnalysisState('initial','Параметры изменены · показан предыдущий расчёт');
      updateReportAvailability();updateScenarioAvailability();return;
    }
    state.current = null;
    state.currentRequestKey = null;
    state.openedScenarioId = null;
    clearAnalysisMap();
    cancelRevealsWithin($('result'));
    resetCounters($('recommendation-list'));
    document.querySelectorAll('.kpis,.area-details-grid').forEach(resetCounters);
    $('result').hidden = true;
    setRevealed($('result-empty'), true, 'empty');
    $('data-section').hidden = false;
    $('source').textContent = 'Данные выбранной области ещё не оценены. Источник и даты появятся после расчёта.';
    $('data-quality')?.replaceChildren();
    $('data-warning').hidden = true;
    if ($('trust-summary')) delete $('trust-summary').dataset.resultSummary;
    $('error').hidden = true;
    $('loading-hint').hidden = true;
    $('result-empty').querySelector('h3').textContent = 'Готово к новому расчёту';
    $('result-empty').querySelector('p').textContent = 'Проверьте настройки и нажмите «Найти места». Сохранённые места доступны ниже.';
    if (state.catalog) $('map-context').textContent = `${$('district').selectedOptions[0].textContent} · ${$('business').selectedOptions[0].textContent}`;
    $('run').disabled = !state.catalog;
    $('refresh-data').disabled = false;
    $('run').textContent = 'Найти места →';
    setAnalysisState('initial');
    if ($('analysis-context') && state.catalog) $('analysis-context').textContent = `${$('district').selectedOptions[0].textContent} · ${$('business').selectedOptions[0].textContent}`;
    ['residents', 'houses', 'competitors', 'places'].forEach(key => $('kpi-'+key).textContent = '—');
    updateReportAvailability();
    updateScenarioAvailability();
  }
  function captureCurrent() {
    if (!state.current || !state.catalog) return null;
    const data=state.current,custom=data.analysis_context?.custom===true||data.district.startsWith('custom_')||data.district==='custom';
    return structuredClone({
      selection:{district:custom?'custom':data.district,business:data.business,
        custom_point:custom?(data.analysis_context?.center||data.center):null,
        area_radius_m:data.analysis_context?.requested_radius_m || (custom?Number(new URLSearchParams(state.currentRequestKey||'').get('radius'))||data.half_m:state.catalog.districts.find(d=>d.key===data.district)?.radius_m||data.half_m)},
      view:{threshold:+$('thr').value,selected_rank:state.selectedRank,
        layers:Object.fromEntries(['houses','competitors','centroids','zones'].map(key=>[key,$('layer-'+key).checked]))},
      analysis:data
    });
  }
  function requestParams() {
    const params=new URLSearchParams({district:$('district').value,type:$('business').value});
    if ($('district').value==='custom') {
      params.set('lat',state.customPoint[0].toFixed(5));
      params.set('lng',state.customPoint[1].toFixed(5));
      params.set('radius',$('radius').value);
    }
    return params;
  }
  function restoreScenario(record) {
    if (!validateScenario(record)) throw new Error('Сценарий повреждён. Открытие отменено.');
    const selection=record.selection;
    if (!state.catalog || !state.catalog.businesses.some(b=>b.key===selection.business)
      || (selection.district!=='custom'&&!state.catalog.districts.some(d=>d.key===selection.district))
      || (selection.district==='custom'&&![...$('radius').options].some(o=>+o.value===selection.area_radius_m))) {
      throw new Error('Область или категория этого сценария недоступна в текущем каталоге. Снимок можно сравнить или выгрузить.');
    }
    const item=structuredClone(record);
    resetSelection();
    $('district').value=item.selection.district;
    $('business').value=item.selection.business;
    state.customPoint=item.selection.custom_point;
    if(item.selection.district==='custom')$('radius').value=String(item.selection.area_radius_m);
    for(const id of ['district','business','radius'])$(id).dispatchEvent(new Event('input',{bubbles:true}));
    $('thr').value=String(item.view.threshold);$('thr-out').textContent=`${item.view.threshold}%`;
    updateParams();updateCustomUI();clearPreview();
    state.current=item.analysis;state.selectedRank=item.view.selected_rank;
    state.currentRequestKey=requestParams().toString();state.openedScenarioId=item.id;
    drawMap(state.current);drawZones();
    for(const [key,enabled] of Object.entries(item.view.layers)){
      $('layer-'+key).checked=enabled;toggleLayer(key,enabled);
    }
    showResult(state.current);selectPlace(state.selectedRank,false);fitArea(state.current);
    setAnalysisState('success','Открыт сохранённый расчёт · обновите данные перед выбором помещения');
    updateReportAvailability();updateScenarioAvailability();
    $('map-title').tabIndex=-1;$('map-title').focus({preventScroll:true});
    $('map-card').scrollIntoView({behavior:motionReduced()?'instant':'smooth',block:'start'});
  }
  function updateParams() {
    if (!state.catalog) return;
    const b = state.catalog.businesses.find(b => b.key === $('business').value);
    $('business-parameters').textContent = `Радиус доступности ${fmt(b.radius_m)} м · коэффициент конкуренции ${b.alpha}. Стартовые эвристики модели, не прогноз выручки.`;
    $('kpi-business').textContent = state.current?.business_name || b.name;
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
      setAnalysisState('error', 'Настройки недоступны · повторите загрузку');
    }
    finally {
      finishCatalogRequest(controller);
    }
  }
  async function run(refresh = false) {
    if (!state.catalog) {
      if (refresh) refreshFeedback('Сначала дождитесь загрузки настроек. При ошибке повторите их загрузку в панели анализа.');
      return;
    }
    const district = $('district').value;
    if (district === 'custom'&&!state.customPoint) {
      showError('Сначала кликните по карте, чтобы выбрать центр области.');
      if (refresh) refreshFeedback('Выберите центр своей области на карте, затем повторите обновление.');
      return;
    }
    const params = requestParams();
    const requestKey = params.toString(), preserveResult = !!state.current;
    if (refresh) params.set('refresh', '1');
    if (preserveResult) {
      cancelRequest();
      $('error').hidden = true;
    }
    else resetSelection();
    const version = state.requestVersion, request = beginCalculationRequest(), controller = request.controller;
    $('run').disabled = true;
    $('refresh-data').disabled = true;
    refreshFeedback(refresh ? (state.current?.data_delivery?.mode === 'daily'
      ? 'Проверяем новую версию ежедневной выгрузки. Пока показан предыдущий расчёт.'
      : 'Запрашиваем свежие дома и конкурентов в OpenStreetMap. Это может занять до полутора минут.') : '', refresh);
    $('run').textContent = 'Ищем места…';
    $('loading-hint').hidden = false;
    $('loading-hint').textContent = preserveResult?'Обновляем расчёт. Пока показан предыдущий успешный результат.': 'Загрузка и расчёт могут занять до полутора минут.';
    setAnalysisState(preserveResult ? 'refreshing' : 'calculating');
    if (!preserveResult) {
      $('result-empty').querySelector('h3').textContent = 'Ищем подходящие места';
      $('result-empty').querySelector('p').textContent = 'Сопоставляем жителей и конкурентов в выбранной области.';
    }
    try {
      const data = await fetchCalculation(params, controller.signal);
      if (version !== state.requestVersion) return;
      if (data.status !== 'success'||!Array.isArray(data.recommendations)||!data.analysis_id) throw new Error('Invalid calculation response');
      state.current = data;
      state.openedScenarioId = null;
      state.currentRequestKey = requestKey;
      state.selectedRank = data.recommendations[0]?.rank||1;
      clearPreview();
      drawMap(data);
      drawZones();
      showResult(data,{freshCalculation:true});
      fitArea(data);
      setAnalysisState('success', data.recommendations.length ? 'Расчёт готов · выберите место на карте' : 'Расчёт готов · подходящих мест не найдено');
      if (refresh) {
        refreshFeedback(refreshMessage(data));
      }
    }
    catch (err) {
      if (version !== state.requestVersion)return;
      const message = request.timedOut?'Загрузка заняла слишком много времени. Повторите попытку или выберите готовый район.': err.user?err.message: err instanceof TypeError?'Нет связи с сервером. Проверьте интернет и повторите попытку.': 'Не удалось выполнить расчёт. Повторите попытку позже.';
      showError((preserveResult?'Обновить расчёт не удалось. Показан предыдущий успешный результат. ': '')+message);
      if (refresh) refreshFeedback(`${message}${preserveResult ? ' Предыдущий успешный расчёт сохранён.' : ''}`);
      setAnalysisState('error', preserveResult ? 'Обновление не удалось · показан предыдущий расчёт' : 'Расчёт недоступен · повторите попытку');
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
        updateScenarioAvailability();
      }
    }
  }
  $('run').addEventListener('click', () => run(false));
  $('retry-catalog').addEventListener('click', loadCatalog);
  $('district').addEventListener('change', () => {
    resetSelection({preserveResult:true});
    updateCustomUI();
    if ($('district').value !== 'custom') run(false);
    else $('map-context').textContent = 'Выберите центр своей области на карте';
  });
  $('business').addEventListener('change', () => {
    resetSelection({preserveResult:true});
    updateParams();
  });
  $('radius').addEventListener('change', () => {
    resetSelection({preserveResult:true});
    drawPreview();
  });
  $('refresh-data').addEventListener('click', () => run(true));
  ['houses', 'competitors', 'centroids', 'zones'].forEach(key => $('layer-'+key).addEventListener('change', e => {clearKpiFocus();toggleLayer(key, e.target.checked);}));
  let raf = null;
  $('thr').addEventListener('input', e => {
    clearKpiFocus();
    $('thr-out').textContent = `${e.target.value}%`;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(drawZones);
  });
  $('export-csv').addEventListener('click', exportCSV);
  $('print-report').addEventListener('click', printReport);
  $('model-button').addEventListener('click', () => openDialog($('model-dialog')));
  $('close-model').addEventListener('click', () => closeDialog($('model-dialog')));
  $('model-dialog').addEventListener('click', e => {
    if (e.target === $('model-dialog')) {
      const box = e.target.getBoundingClientRect();
      if (e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom) closeDialog(e.target);
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
  configureScenarios({captureCurrent,restoreScenario});
  initScenarios();
  configureMap({
    resetSelection:()=>resetSelection({preserveResult:true}),
    selectPlace
  });
  loadSaved();
  renderSaved();
  initMap();
  initMobileWorkspace();
  initComparisonGuide();
  loadCatalog();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, {
  once: true
});
else bootstrap();
