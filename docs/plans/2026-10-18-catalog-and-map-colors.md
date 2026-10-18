# Каталог 10×10 и цвета карты — план реализации

**Goal:** Разделить дома/конкурентов и опубликовать десять готовых областей и типов.
**Architecture:** Существующие каталоги остаются источником API и меню. Подготовка
OSM-снимков работает отдельно от runtime, используя прежние правила оценки домов.
**Tech Stack:** Flask/Python/numpy, Leaflet/ES modules/CSS, unittest/Node/Playwright.
**Spec:** docs/specs/2026-10-18-catalog-and-map-colors.md (согласована).
**Assumptions:** OSM содержит достаточные реальные дома; неполный/неполученный
экстракт не даёт пригодного снимка. Не предполагается полнота реальных конкурентов.
**Execution:** subagent-driven-development; пользователь уже разрешил реализацию
и публикацию, повторного согласования плана не требуется.

## Global Constraints

- Сохранить старые ключи, координаты и численные fixtures; не менять scoring.
- Дома #91A5B8/.78; конкуренты #B94F7B с существующей светлой обводкой.
- Все100пар работают offline на настоящих снимках; не создавать синтетических данных.
- Проверять halo max(400,R), provenance, границы покрытия и полную геометрию.
- Сохранить saved.v1/scenarios.v1, API-free restore, автоматический расчёт района.
- Новых зависимостей нет. Существующий бесплатный Render и main — цель публикации.

## Review Focus

- Неполная relation/way не превращается в ноль конкурентов: тест импортера.
- Первый геокодированный магазин/завод не принимается за район: provenance/география.
- Фитнес R900 требует1900м покрытия снимка: negative bbox test.
- Меню10элементов остаётся доступным touch/keyboard/200%: browser regression.
- Новый сценарий восстанавливается без API, старые расчёты не изменяются: integration QA.

## Task 1 — Бизнес-каталог и импорт реальных снимков

Owner: worker backend. Files: src/domain/businesses.py,
scripts/import_osm_area.py (new), tests/integration/test_import_area.py (new),
tests/integration/test_workspace.py. Existing scripts/import_osm_competitors.py
можно использовать без изменения его публичного extract_competitors.
Consumes: estimate_residents(tags,footprint), extract_competitors(source,business,area).
Produces: BUSINESS_CATALOG +5 записей из spec;
generate_snapshots(source: Path, area: dict, output_dir: Path, businesses=None) -> list[Path],
extract_houses(source: Path, area: dict) -> list[list[number]], CLI
python scripts/import_osm_area.py --district KEY --source FILE --output-dir DIR
[--business KEY ...], где без business создаются дома и все категории.
Security flag: security (validation of imported data, no runtime network changes).
Does NOT cover: network download or choosing geographic centers; owner geography.

- [ ] RED catalog exact ten names/R/alpha/tags; importer valid houses/circle/footprint,
  missing nodes/relation/bounds, empty competitors only from complete extract,
  radius+900 coverage; no output changes when validation fails.
- [ ] Implement catalog and importer using existing resident/competitor rules,
  complete-source validation and atomic file replacement; preserve old script tests.
- [ ] GREEN: .venv/Scripts/python.exe -m unittest tests.integration.test_import_area
  tests.integration.test_importer tests.integration.test_workspace -v.
- [ ] Commit only owned files; report RED/GREEN and exact public signatures.

## Task 2 — Цвета и интерфейс расширенного каталога

Owner: worker frontend. Files: static/css/tokens.css, static/js/map.js,
static/js/app.js (only model-parameter copy), static/index.html (area hint),
tests/browser/{map-harmony,choice-menus,catalog-matrix,workspace}.js.
Consumes: existing CSS tokens, API catalog arrays, current menu contract.
Produces: #91A5B8 house token/.78 circle opacity, matching legend,
copy explaining search circles and heuristic parameters, catalog-size-aware tests.
Security flag: none. Does NOT cover: changing map scoring, competitors, saved data.

- [ ] RED map-harmony approved new color/opacity, legend matches, actual canvas
  options and dense viewport geometry; test must fail on old palette.
- [ ] Implement token/opacity/copy and replace fixed5/15 menu assertions with
  catalog-derived counts/last item while retaining keyboard/touch expectations.
- [ ] GREEN on root QA server5085 after restart, mobile390/768/1440/200%, reduced motion.
- [ ] Commit only owned files; root owns server lifecycle and final screenshots.

## Task 3 — Проверенные области и снимки данных

Owner: worker geography. Files: src/config.py (DISTRICTS only), data/snapshots/*.json,
data/catalog-provenance.json (new), tests/integration/test_catalog_data.py (new),
docs/research/2026-10-18-catalog-data-discovery.md.
Consumes: Task1 generate_snapshots interface after it exists; current area_for/cache keys.
Produces: seven new1000m preset circles at verified residential centers; ten house
snapshots and100competitor snapshots total, preserving18existing files exactly;
provenance source/OSM object or address/coordinate/coverage/time/raw hash.
Security flag: security (data provenance/complete coverage). Does NOT cover: build-time
network dependency, synthetic residents, geocoder-first-hit guessing.

- [ ] Research centers via primary OSM/address sources; record rejection of factory/shop
  hits. Download complete OSM API0.6 bbox extracts sequentially with bounded requests.
- [ ] RED exact10districts and110snapshots, original18hashes preserved, valid circles,
  geo coverage/provenance/halo and source dates; no network in tests.
- [ ] Add presets and import snapshots. For old three districts, import only the five
  new businesses; do not regenerate original houses or original competitor records.
- [ ] GREEN: .venv/Scripts/python.exe -m unittest tests.integration.test_catalog_data
  tests.integration.test_api -v, including100offline calculations.
- [ ] Commit owned files and report sources, counts and any failed acquisition.

## Task 4 — Интеграция, review и выпуск

Owner: root. Files: docs/verification/2026-10-18-catalog-and-map-colors.md,
README.md, CHANGELOG.md, DEPLOYMENT.md, state.md/session-log.md and this plan.
Consumes: Tasks1–3 and committed diffs. Produces: verified Git main and Render release.
Security flag: none. Does NOT cover: physical phones/new browser engines/OSM completeness.

- [ ] Full Python and Node tests, validator, JS syntax, unchanged Material build,
  diff/stub scan; all100API pairs offline.
- [ ] Browser palette/menus/catalog100, KPI auto-change, archive newtype/newdistrict,
  CSV/print, original scenario/storage regressions, mobile and screenshots.
- [ ] Independent task review (spec + quality) and most-capable whole-branch review
  with this Review Focus and diff package; resolve findings RED→GREEN.
- [ ] SourceCI success → main fast-forward/push → automatic Render live.
- [ ] Public new areas/categories/KPIs/map/archive/mobile and static SHA256 match;
  audit docs [skip render], CI and clean checkout; close only own QA processes.
