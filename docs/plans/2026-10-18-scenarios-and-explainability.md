# Сценарии и объяснимость — TDD-план

**Goal:** полный локальный сценарий → объяснение/качество → сравнение двух исследований.
**Spec:** docs/specs/2026-10-18-scenarios-and-explainability.md, согласована пользователем18октября.
**Architecture:** Flask domain enrichment без изменения scoring; отдельные ES-модули
storage/UI/quality/report; callbacks из app.js связывают snapshot с картой.
**Stack:** существующие Python/Flask/NumPy и vanilla JS/CSS/Leaflet, без новых пакетов.
**Execution:** subagent-driven-development; root интегрирует и проверяет весь пакет.
Пользователь явно согласовал переход к плану и реализации — повторного gate нет.

## Global Constraints
- Сохранить API/численные результаты/старые id/testid/ARIA/saved.v1/CSV17колонок/print.
-6сценариев,250000JSONсимволов на запись,1250000на ключ; schema_version1.
- Только новые additive API поля; score разных расчётов не ранжировать.
- Палитра/motion/reduced-motion/44px/200%/Leaflet прежние; новые зависимости не нужны.

## Review Focus
- Late API/catalog response после восстановления не заменяет архив.
- Quota/invalid/version/две вкладки не уничтожают ранее сохранённые записи.
- Demo/unknown/mixed/aged archive/halo не превращаются в ложную достоверность.
- CSV formula escaping, пользовательский текст, глубокая проверка snapshot.
- Мобильная таблица/фокус/print/no-lock и прежние сохранённые места.

## Interfaces (общие для исполнителей)
Backend: top-level calculated_at ISO, analysis_context{custom,requested_radius_m,center},
data_quality по spec; recommendation.explanation по spec. Прежние поля неизменны.
Storage exports SCENARIO_KEY, SCENARIO_LIMIT, validateScenario(item):boolean,
readScenarios():array, mutateScenarios(fn(latest)=>nextArray):Promise<array>,
clearDamagedScenarios(expectedRaw):Promise<void>, duplicateScenario(item):record.
Ошибки .code invalid/unsupported/unavailable/no_locks/limit/size/conflict; invalid/unsupported имеют .raw.
UI exports configureScenarios({captureCurrent,restoreScenario}), initScenarios(),
updateScenarioAvailability(). captureCurrent()=>{selection,view,analysis}|null;
restoreScenario(record)=>void|Promise<void>, throws при неприменимом каталоге.
state root добавляет scenarios:[],scenarioComparison:Set(),openedScenarioId:null.
Quality exports qualitySummary(data,now=Date.now())=>{source,freshness,completeness,reasons:string[],dates:string[]},
qualityBlock(data,compact=false):HTMLElement, explanationBlock(rec):HTMLElement.
Scenario report exports exportScenariosCSV(records),printScenarios(records).

### Task 1: Серверные объяснения и качество
**Ownership:** src/domain/explanations.py, data_quality.py; services/analysis_service.py;
utils/formatting.py; tests/unit/test_explanations.py,test_data_quality.py;
tests/integration/test_contracts.py,test_explainability.py. Не трогать scoring.py.
**Security:** none; функции получают уже проверенные данные.
- [x] RED unit/API: формулы/пороги/граница/zero/unknown/demo/mixed/time и old numeric fixtures.
- [x] Наблюдать ожидаемый FAIL; реализовать pure domain functions и additive enrichment.
- [x] GREEN focused suites и все unittest; сохранить evidence в ignored task report.
Команда: `.venv/Scripts/python.exe -m unittest discover -s tests -v`.

### Task 2: Изолированное хранилище сценариев
**Ownership:** static/js/scenario-storage.js; tests/unit/scenario-storage.test.js.
**Consumes:** snapshot shape spec; никаких DOM/state/Flask imports.
**Produces:** Storage interfaces выше; Web Locks latest-read, deep validation, explicit repair.
**Security:** security — localStorage недоверенный, validate before render/restore;
лимиты до parse/глубокого обхода, text не исполняется, failed write не меняет список.
**Preflight root:** проверены пути XSS/нечисла/гигантские массивы/version/quota/races;
тесты должны покрыть каждый, repair только exact damaged raw под lock.
- [x] RED Node native test runner: roundtrip/duplicate/limit/deep invalid/quota/corrupt/no-lock/two writers/repair conflict.
- [x] Реализовать функции; никакой автоочистки/перезаписи invalid и unknown version.
- [x] GREEN `node --test tests/unit/scenario-storage.test.js`.
**Does NOT cover:** аккаунты/межустройственное хранение/импорт чужих файлов.

### Task 3: UI сценариев, quality и отчёты
**Ownership:** static/js/scenarios.js,data-quality.js,scenario-report.js;
static/css/scenarios.css; static/index.html; tests/browser/scenarios-ui.js.
**Consumes:** Storage/Quality/API interfaces выше, state additions от root.
**Produces:** UI/Quality/report interfaces выше; #scenario-save, #scenario-status,
#scenarios-section,#scenario-list,#scenario-comparison,#data-quality,#scenario-snapshot-notice.
**Security:** security — textContent/csvCell, modal confirmation, no raw HTML from records.
- [x] RED isolated browser: new section/form/save/reload/duplicate/delete/edit/compare/export/print/mobile/reduce.
- [x] UI callbacks only, без прямых map/app imports; capture до lock, pending/save status;
  invalid raw download и exact reset confirmation; no-lock read-only explanation.
- [x] Quality age relative now, dates both datasets, legacy unknown; structured details.
- [x] Отдельные scenario CSV/print, use existing csvCell/reportPlace, no circular imports.
- [x] GREEN focused browser после интеграции root; screenshots.
**Does NOT cover:** новые районы/категории/финансы и редизайн принятой палитры.

### Task 4: Интеграция текущего анализа и восстановления (root)
**Ownership:** app.js,state.js,recommendations.js,report.js,saved-places.js;
scripts/validate_project.py; tests/browser/scenarios.js.
- [x] RED save/capture/restore selected rank/threshold/layers, no-network custom restore,
  late API/catalog race, new filter resets archive, selected missing category keeps current.
- [x] capture immutable analysis; restore validated record/catalog then cancel/version/reset;
  canonical request key; sync native controls without triggering reset after result.
- [x] Current result quality/details; quality in old CSV appended after17columns/print;
  optional metadata in new saved places, old records still valid.
- [x] GREEN new browser + workspace/choices/redesign relevant regressions; validator/syntax.

### Task 5: Приёмка, документация и review
- [x] Все unit/Node tests, complete scenarios browser incl storage/two-tab/CSV/print.
- [x] Actual touch,360/390/768/1440/200%,keyboard,reduced,legacy/API/Leaflet fallback.
- [x] README/CHANGELOG/backend/frontend/data-flow/spec/state/session-log обновлены.
- [x] Независимый review batch и whole branch, устранить confirmed findings.

### Task 6: Выпуск
- [x] Explicit stage/source commit/push feature; CI success; ff main; один auto Render deploy.
- [x] Live API fields/UI scenarios/real map/CSV/print public QA, hashes match runtime.
- [x] Audit docs [skip render], own QA cleanup, clean main и итог пользователю.

## Waves / ownership
Первая волна Tasks1/2/3: непересекающиеся файлы; root пишет Task4 tests и интеграцию.
Storage/UI используют точные interfaces, UI Task3 GREEN после root integration.
Root единственный делает Git commits и управляет сервером/QA браузерами/публикацией.
Затем объединённое review Tasks1–4; Task5/6 последовательно.
