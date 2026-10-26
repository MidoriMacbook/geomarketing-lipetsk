# Карта изменений от 12 октября 2026

Стек и исходные геоданные сохранены. Перенос выполнен после фиксации API;
старые файлы удалены после проверки перенесённой реализации.

## Итоговая структура

```text
project-root/
├── app.py, serve.py, osm.py, businesses.py
├── requirements.txt, render.yaml, Dockerfile
├── README.md, PROJECT_ANALYSIS.md, DEPLOYMENT.md, CHANGELOG.md, state.md
├── .gitignore, .github/workflows/test.yml
├── src/
│   ├── __init__.py, config.py
│   ├── routes/{__init__,health,catalog,calculate}.py
│   ├── domain/{__init__,businesses,models,scoring}.py
│   ├── services/{__init__,analysis_service,catalog_service,cache_service,osm_service}.py
│   └── utils/{__init__,geo,validation,formatting}.py
├── static/
│   ├── index.html, assets/favicon.svg
│   ├── css/{tokens,base,layout,components,map,states,responsive}.css
│   ├── js/{app,api,state,map,recommendations,saved-places,report,ui}.js
│   └── vendor/leaflet/                 # без изменений
├── data/
│   ├── README.md, snapshots/           # снимки без изменений
│   └── fixtures/example-cache.json
├── tests/
│   ├── __init__.py
│   ├── unit/{__init__,test_cache,test_config,test_geometry,test_osm,test_scoring}.py
│   ├── integration/{__init__,test_api,test_contracts,test_import_paths,test_importer,test_workspace}.py
│   ├── browser/{smoke,workspace,responsive,catalog-matrix,palette}.js
│   └── fixtures/saved-places-v1.json
├── scripts/{check,import_osm_competitors,validate_project}.py
└── docs/
    ├── architecture/{overview,backend,frontend,data-flow,change-map}.md
    ├── design/{ui-audit,design-system,redesign-spec}.md
    ├── specs/                          # прежние спецификации
    └── plans/2026-10-12-architecture-redesign.md
```

QA-артефакты в tests/artifacts и временные проверка игнорируются Git.
Пустой assets/images не создавался, поскольку изображения не понадобились.

## Перемещённые и разделённые файлы

| Раньше | Теперь | Что произошло |
| --- | --- | --- |
| check.py | scripts/check.py | Диагностика с main-guard, импорт без сети |
| app.py | app.py + src/routes, services/analysis_service, domain/scoring, utils | В корне только сборка Flask; HTTP и модель разделены |
| businesses.py | src/domain/businesses.py | Корневой файл оставлен совместимым экспортом |
| osm.py | services/cache_service, osm_service; utils/geo; config; models | Корневой файл оставлен совместимым экспортом |
| static/workspace.js | Восемь static/js/*.js | Старый файл удалён после полного browser-workspace |
| static/workspace.css | Семь static/css/*.css | Порядок загрузки указан в index.html |
| tests/browser-smoke.js | tests/browser/smoke.js | Прежние assertions, новые пути артефактов |
| tests/browser-workspace.js | tests/browser/workspace.js | Прежние assertions, новые пути артефактов |
| tests/test_reliability.py | integration/test_api.py + unit/test_cache.py | Разделены HTTP и файловый кэш |
| tests/test_business_data.py | unit/test_osm.py + integration/test_importer.py | Разделены запросы OSM и CLI-импорт |
| tests/test_workspace.py | integration/test_workspace.py | Исправлены адреса mock, ожидаемые результаты сохранены |

## Новые файлы

- Все 19 Python-файлов src из дерева выше, включая пакетные __init__.py.
- Восемь JS, семь CSS и static/assets/favicon.svg.
- tests/__init__.py, unit/__init__.py и integration/__init__.py для discover.
- Новые проверки: test_contracts, test_import_paths, test_config,
  test_geometry, test_scoring; остальные тестовые файлы содержат перенесённые проверки.
- browser/responsive.js, catalog-matrix.js, palette.js.
- tests/fixtures/saved-places-v1.json, data/fixtures/example-cache.json.
- scripts/validate_project.py; scripts/check.py — перенос, а не новая функция.
- CHANGELOG.md; восемь документов architecture/design и текущий план.
- PROJECT_ANALYSIS.md добавлен в Git: обновлён текущий раздел, прежний аудит сохранён.

## Изменённые существующие файлы

app.py, serve.py, osm.py, businesses.py, static/index.html,
scripts/import_osm_competitors.py, Dockerfile, .gitignore,
.github/workflows/test.yml, README.md, DEPLOYMENT.md, data/README.md и state.md.
requirements.txt, render.yaml, vendor Leaflet и исходные снимки не менялись.

Точный машинный список для этой итерации:
`git diff --name-status --find-renames 0ae232c <итоговый-коммит>`.
Git может показывать разделение монолита как удаление и добавление нескольких
файлов; таблица выше показывает логический перенос.

## Ответственность и совместимость

Назначение каждого Python-модуля и разрешённые импорты:
[backend.md](backend.md). Назначение восьми JS и семи CSS:
[frontend.md](frontend.md). Взаимодействие сети, снимков, модели и интерфейса:
[data-flow.md](data-flow.md).

app.py — сборка; routes — HTTP; analysis_service — полный сценарий;
scoring — численная модель; osm_service — сеть; cache_service — хранение;
config — окружение; geo/validation/formatting — общие преобразования.
state.js — единственное состояние, app.js связывает события представлений.

Сохранены API и JSON, best, ошибки/Retry-After, пять категорий, сетка 60×60,
взвешенный K-means, разделение точек 250 м и все пользовательские функции.
Сохранены 61 исходный статический HTML id, data-testid и aria-связи.
geomarketing.saved.v1 не мигрирует, прежние записи восстанавливаются.
Для monkeypatch внутренних функций используются канонические src-модули:
совместимые корневые экспорты не перенаправляют произвольные изменения глобальных переменных.

## Проверка и ограничения

51 unittest, py_compile, восемь node --check и структурный валидатор проходят.
Все 37 исходных тестовых методов/assertions сохранены. Независимое сравнение
33 ответов с исходным кодом подтверждает JSON/HTTP/числа, кроме уникального analysis_id.
Браузерные smoke/workspace/responsive/catalog-matrix/palette проходят.
Все шесть ширин без переполнения; карты 420/560/660 px, тайлы в финальных
снимках загружены без pending/failed. Проверены гонки, ошибки и прежние сохранения.
Команды — в README; детали и результаты публикации — в CHANGELOG.

13 октября 2026 версия приложения b82c87b опубликован на
https://geomarketing-lipetsk.onrender.com. CI main успешно; все пять браузерных
наборов повторены публично, включая шесть ширин и 200% текста на четырёх ширинах.

Проверки не подтверждают полноту OSM, доступность всех новых областей в Overpass,
сборку Docker, пагинацию PDF или полное соответствие WCAG.
Модель, внешний тайловый сервис, эфемерный кэш Render и локальные сохранения
сохраняют ограничения, описанные в PROJECT_ANALYSIS.md.
