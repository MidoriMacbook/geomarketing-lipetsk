# План рабочего пространства

Goal: связать KPI, карту и выбор места в принятой visual-системе.
Spec: docs/specs/2026-10-26-workspace-guidance.md.
Architecture: transient presentation state вне state/storage; отдельные map panes;
события gm:analysis-rendered / gm:recommendation-selected связывают независимые UI-модули.
Stack: существующие native CSS/ES modules/Leaflet; без новых зависимостей.
Execution: subagent-driven-development, независимые CSS и recommendations в одной волне;
root владеет HTML, KPI/map/controller, интеграцией, тестами и документацией.

## Global constraints
Не менять API, серверную модель, данные, Leaflet/vendor, ежедневную загрузку,
localStorage, сценарии/исследования, saved-код, CSV/print, ids/testids/ARIA-контракты.
Цветовые литералы только tokens.css. Не перерисовывать тысячи объектов ради акцента.

## Interfaces / ownership
- Root: static/index.html; map.js; kpi-interactions.js; app.js; ui.js;
  новые analysis-focus.js / workspace-disclosure.js; tests/browser/workspace-guidance.js,
  Nodefocus-tests; docs. Событие gm:analysis-rendered detail{data} и
  gm:recommendation-selected detail{rank} принимает kpi controller.
- CSS worker: только tokens.css,hero.css,components.css,layout.css,states.css,
  responsive.css,map.css. Контракт: .kpis>div[data-kpi][data-active=true],
  .kpi-indicator,.kpi-progress; #map-card[data-kpi-focus=KEY];
  .map-stage>#map + #map-guide; details[data-workspace-disclosure][data-expanded=true],
  .workspace-disclosure-body>.workspace-disclosure-content; .map-legend>[data-layer]
  [data-active=true]; .recommendations[data-kpi-focus=places];
  .recommendation-brief>div>dt/dd; .save-confirmation; .recommendation.is-preview.
- Recommendation worker: только recommendations.js, новый recommendation-brief.js,
  tests/unit/recommendation-brief.test.js. Сводка читает существующие rec/explanation;
  selectPlace по умолчанию без pan; dispatch двух событий выше после актуального
  обновления. .nearest сохраняется, savePlace/storage неизменны. Прочитать brief/spec
  и исходники перед кодом. Не делать commit самостоятельно, не запускать сервер.

## Tasks
- [x] 1. Baseline и RED: browser KPI action без запросов/изменений state;
  Node чистый focus state/контекст, summary tests перед production.
- [x] 2. Root: canvas/panes, видимость/opacity/revisions, legends без pan/recalc.
- [x] 3. CSS worker: тон/иерархия/состояния/hero/доступная мобильная типографика.
- [x] 4. Recommendation worker: сводка, preview/select, подтверждение сохранения.
- [x] 5. Root: disclosure overlay/grid, KPIcontroller/keyboard/touch/lifecycle/context.
- [ ] 6. Integration QA: новые тесты, workspace/interactions/storage/CSV/print,
  API/ключиunchanged,матрица4ширины/200%/320hero/reduced/rapid.
- [ ] 7. Одно объединённое ревью на волну (spec+quality); исправить значимые замечания.
- [ ] 8. Документация, main/push, CI/Render live/public QA/asset hashes; чистое дерево.

Review Focus: отключённый слой при activeKPI; быстрый toggle в fade; reset/archive/error
контекст; noLeaflet;200%guide/hero; сохранение после смены анализа; noAPI при KPI.
Verification: python unittest discover; node --test tests/unit/*.test.js;
python scripts/validate_project.py; Playwright workspace-guidance + функциональные сценарии.

