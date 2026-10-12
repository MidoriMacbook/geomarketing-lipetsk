# Архитектура и редакционный редизайн: план

**Goal:** разделить существующий проект на понятные модули и выполнить согласованный
редизайн без изменения API, модели и сохранений.
**Architecture:** Flask routes→services→domain/utils; ES-модули браузера с единым
state и app-композицией. Тонкие корневые входы сохраняют совместимость.
**Tech Stack:** Python3.14, Flask, NumPy/SciPy/sklearn, Waitress, HTML/CSS/JS, Leaflet.
**Spec:** docs/design/redesign-spec.md; исходный подробный промт пользователя.
**Assumptions:** существующий API и снимки пригодны; произвольные области без
копии по-прежнему зависят от Overpass. Новый стек, база, auth не вводятся.

## Global Constraints

- Не менять маршруты и JSON `/api/catalog`, `/api/calculate`, healthz и ошибки.
- Не менять численные результаты, границы, сетку60×60, K-means и разделение250м.
- Сохранить geomarketing.saved.v1, Web Locks, storage events, CSV и print.
- Сохранить id/data-testid/aria, отмену запросов и результат при failed refresh.
- Не удалять исходный файл до переноса его содержимого и успешной проверки.
- Пользователь уже поручил всю реализацию; дополнительных согласований этапов нет.

## Review Focus

1. Путь CACHE_DIR/SNAPSHOT_DIR после переноса; запуск из другого cwd и Docker COPY src.
2. Вложенный unittest discovery не теряет проверки; моки обновлены без ослабления assertions.
3. Модули JS не образуют циклов, Leaflet fallback не ломает инициализацию API.
4. Прежние сохранения/две вкладки/очередь Web Lock/CSV injection сохраняют поведение.
5. 360px,1024px, zoom/reduced-motion, внутренний scroll сравнения, print и ошибки.

## Task 1: Исходная проверка и документация

Files: docs/architecture/{overview,backend,frontend,data-flow}.md,
docs/design/{ui-audit,redesign-spec,design-system}.md, CHANGELOG.md.
Interfaces: consumes existing source; produces модульную карту и спецификацию.
- [x] Прочитать реальные зависимости и зафиксировать37 unittest OK.
- [x] Запустить прежний browser-workspace и сохранить исходный результат:19 групп сценариев, pageErrors=[].
- [x] Создать требуемую документацию до изменения приложения.

## Task 2: Backend, данные и серверные тесты

Ownership: src/**, app.py, osm.py, businesses.py, serve.py, check.py,
scripts/check.py, scripts/import_osm_competitors.py, Dockerfile,
Python-тесты tests/unit/** и tests/integration/** и прежние test_*.py.
Interfaces: consumes unchanged snapshots/catalog; produces create_app/app,
blueprints `/healthz`, `/api/catalog`, `/api/calculate`, pure scoring и cache APIs.
Security flag: security — сохраняются существующие проверки, не меняются границы доступа.
- [x] Зафиксировать JSON keys каталога и расчёта в characterization tests на старом коде.
- [x] Поэтапно выделить config/domain/geo; запускать затронутые тесты после каждого шага.
- [x] Выделить cache/OSM/services/routes; не импортировать app/Flask из domain и services.
- [x] Оставить только тонкие совместимые osm.py/businesses.py; перенести диагностику.
- [x] Разделить тесты unit/integration; сохранить37 исходных assertions, исправить mock paths.
- [x] Исправить Docker COPY и CLI imports; полный unittest и py_compile должны проходить.

## Task 3: JS-модули, CSS и визуальная система

Ownership: static/** кроме неизменного vendor; tests/browser/**,
tests/browser-smoke.js, tests/browser-workspace.js.
Interfaces: consumes exact existing API/storage; produces ES entry app.js,
state.js и семь CSS-файлов; сохраняет DOM contracts.
- [x] Сначала перенести функции по ответственности, проверить прежний browser-workspace.
- [x] Удалить старые workspace.js/css после переноса и проверки загрузки новых файлов.
- [x] Редизайн по спецификации: tokens, surfaces, typography, map, compact cards, primary save.
- [x] Добавить favicon; не вводить npm/runtime dependencies, изменения схемы данных или модели.
- [x] Перенести smoke/workspace в tests/browser, расширить только адаптивность и модули.
- [x] node --check восьми файлов; browser matrix360/390/768/1024/1280/1440 и print flow.

## Task 4: Контроль структуры и документация итогов

Ownership: scripts/validate_project.py, README.md, PROJECT_ANALYSIS.md,
DEPLOYMENT.md, .gitignore, .github, data/README.md, data/fixtures,
docs/**, CHANGELOG.md, state.md. Не менять файлы параллельных исполнителей.
Interfaces: consumes завершённые пути backend/frontend; produces offline validator
структуры/статических ссылок/import DAG и инструкции запуска/проверки.
- [x] Валидатор сначала подтверждает отсутствующие целевые пути на старой структуре.
- [x] Заполнить актуальные архитектурные документы, design-system и журнал этапов.
- [x] Обновить устаревший аудит, сохранив исходную историю и происхождение данных.
- [x] Обновить README/CI/ignore для вложенных тестов и QA-артефактов.
- [x] Проверить запуск из произвольного cwd, все15 сочетаний и legacy saved fixture.

## Task 5: Ревью, публикация и передача результата

Interfaces: consumes весь diff с базой0ae232c; produces проверенную опубликованную версию.
- [x] Независимые backend/frontend reviews возвращают Spec и Quality verdicts.
- [x] Полный unittest, compile, node checks, validator, browser smoke/workspace, шесть ширин.
- [ ] Финальное ревью всего изменения; устранить существенные замечания.
- [ ] Коммит→main fast-forward→GitHub Actions→ручной Render deploy→публичные проверки.
- [ ] Подготовить дерево, перемещения/новые/изменённые файлы, обязанности и ограничения.
