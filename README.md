# ГеоМаркетинг Липецк

[Открыть сайт](https://geomarketing-lipetsk.onrender.com)

Помощник для выбора места под десять типов бизнеса: от кофейни до фитнес-студии
и стоматологии. Сравнивает жилые дома и конкурентов в выбранном круге,
показывает центроиды спроса и до трёх мест для проверки.

- Десять готовых областей либо центр и радиус на карте; смена готовой области
  автоматически обновляет расчёт.
- Связанные карточки и маркеры, KPI и переключение слоёв.
- До 12 сохранённых мест в браузере, сравнение до трёх, CSV и печатный отчёт.
- До 6 полных исследований: имя и заметка, карта/настройки, повторное открытие,
  дублирование, изменение, удаление и сравнение двух исследований.
- Объяснения спроса и конкуренции; краткий статус данных рядом с картой,
  подробные даты и ограничения в конце страницы; отдельные CSV и печатное
  сравнение исследований без общего рейтинга.
- Сворачиваемая проверка на месте у сохранённой точки: семь локальных отметок
  пользователя о помещении и окружении, без влияния на оценку модели.
- Локальный Leaflet и JSON-снимки районов; обработка отказа API, тайлов и хранилища.
- Тёмный сливовый интерфейс с розовыми акцентами, плавным появлением блоков и счётчиками чисел.
- На карте дома обозначены приглушённым серо-синим, конкуренты — ягодным
  со светлой обводкой; легенда использует те же цвета.

Население оценочное, расстояния прямые. Оценка нормирована внутри одного
расчёта и не означает вероятность коммерческого успеха. Сохранения доступны
в этом браузере; синхронизации между устройствами нет.

Карта растягивается до высоты рекомендаций на компьютере; подробные сведения
об источниках открываются через «Проверить детали» и находятся перед подвалом.
Пустой раздел исследований скрыт: первое полное исследование можно сохранить
действием после рабочей зоны. Записанные исследования и восстановление при
повреждении хранилища остаются доступны.

«Проверка пользователя» хранится отдельно в `geomarketing.field-checks.v1`.
Она не заменяет осмотр помещения и не влияет на оценку. При отказе хранилища
или неподдерживаемой версии исходные данные не перезаписываются; без Web Locks
отметки доступны для чтения. Старые сохранённые места и исследования не мигрируют.

Готовые области: Елецкий, Университетский, Центр (Быханов сад), Победа,
Европейский, Сокол, НЛМК, Тракторный, Матырский, Сырский Рудник.
Это круги радиусом 1 км вокруг жилых ориентиров, а не административные границы.
Категории: кофейня, аптека, продуктовый магазин, пекарня, салон красоты,
быстрое питание, цветочный магазин, зоомагазин, фитнес-студия, стоматология.
Радиусы доступности и коэффициенты конкуренции — эвристики модели.

## Быстрый старт

Нужен Python 3.14. Из корня проекта:

```bash
python -m venv .venv
# Windows PowerShell:
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe serve.py
# Linux/macOS:
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python serve.py
```

Откройте http://localhost:8080. Waitress слушает `0.0.0.0`;
HOST и PORT задаются окружением. `python app.py` — локальный режим
на http://127.0.0.1:5001 без отладчика по умолчанию.

Готовый Material Web bundle включён в `static/vendor`, поэтому для обычного
Python-запуска Node.js не нужен. Если меняется список Material-компонентов:

```bash
pnpm install --frozen-lockfile
pnpm run check:material
```

Принятое разделение Material Web и визуального референса Skiper UI описано в
[docs/design/material-web.md](docs/design/material-web.md).

Сервер и API обслуживаются одним сайтом, адресов localhost в клиенте нет.
Для новой области без сохранённой копии нужен доступный Overpass;
для подложки карты нужен интернет.

## Устройство и документация

`app.py` собирает Flask-приложение, `serve.py` запускает Waitress.
Внутренние модули: `src/routes → services → domain/utils`, настройки —
`src/config.py`. Клиент — шестнадцать ES-модулей и девять CSS-файлов; код приложения
не требует сборщика, отдельный Material vendor собирается Rollup и хранится в Git.
Корневые `osm.py` и `businesses.py` сохраняют старые публичные импорты.

- [Архитектура](docs/architecture/overview.md), [сервер](docs/architecture/backend.md),
  [клиент](docs/architecture/frontend.md), [путь данных](docs/architecture/data-flow.md).
- [Дерево и карта изменений](docs/architecture/change-map.md).
- [Дизайн-система](docs/design/design-system.md), [спецификация](docs/design/redesign-spec.md).
- [Журнал изменений](CHANGELOG.md), [аудит и ограничения](PROJECT_ANALYSIS.md).
- [Размещение, Docker и переменные окружения](DEPLOYMENT.md).
- [Происхождение и импорт геоданных](data/README.md).

17 октября Render автоматически развернул push в `main` (trigger `new_commit`).
После push сначала проверьте историю Deploys: не запускайте второй deploy,
если автоматический уже начался. На бесплатном тарифе кэш в `/tmp` эфемерный,
а снимки из репозитория сохраняются. Подробности — в DEPLOYMENT.md.

## Проверки

```bash
python -m unittest discover -s tests -v
python -m py_compile app.py serve.py osm.py businesses.py
python scripts/validate_project.py
node --check static/js/app.js
node --check static/js/api.js
node --check static/js/state.js
node --check static/js/map.js
node --check static/js/recommendations.js
node --check static/js/saved-places.js
node --check static/js/report.js
node --check static/js/ui.js
node --check static/js/counters.js
node --check static/js/choices.js
node --test tests/unit/scenario-storage.test.js
node --test tests/unit/field-check-storage.test.js
```

Серверные тесты работают без сети. GitHub Actions запускает Python-тесты,
компиляцию, структурный валидатор, синтаксические проверки JS и воспроизводимую
сборку Material на Linux (Node24, pnpm11.25.0).

Браузерная проверка: установленный playwright-cli, Chrome и запущенный сервер.

```bash
playwright-cli -s=geomarket open http://localhost:8080 --browser=chrome
playwright-cli -s=geomarket run-code --filename=tests/browser/smoke.js
playwright-cli -s=geomarket run-code --filename=tests/browser/workspace.js
playwright-cli -s=geomarket run-code --filename=tests/browser/responsive.js
playwright-cli -s=geomarket run-code --filename=tests/browser/catalog-matrix.js
playwright-cli -s=geomarket run-code --filename=tests/browser/choice-menus.js
playwright-cli -s=geomarket run-code --filename=tests/browser/workspace-layout.js
playwright-cli -s=geomarket run-code --filename=tests/browser/workspace-interactions.js
playwright-cli -s=geomarket run-code --filename=tests/browser/field-checks.js
playwright-cli -s=geomarket run-code --filename=tests/browser/scenarios-ui.js
playwright-cli -s=geomarket run-code --filename=tests/browser/scenarios.js
playwright-cli -s=geomarket run-code --filename=tests/browser/scenarios-mobile.js
playwright-cli -s=geomarket run-code --filename=tests/browser/palette.js
playwright-cli -s=geomarket close
```

responsive проверяет 360/390/768/1024/1280/1440 px, прежние сохранения,
клавиатуру и print CSS. catalog-matrix проверяет все 100 сочетаний.
`catalog-expansion.js` проверяет новые области/типы, KPI, открытие сценария
без API, CSV/печать и меню на телефоне.
Для проверки реальных тайлов нужен интернет. Эти проверки не подтверждают
полноту геоданных OSM; фактическая сборка Docker и пагинация PDF пока не проверены.

Для итерации cartography/motion достаточно одного итогового QA-сеанса:
`tests/browser/workspace.js` проверяет прежние сценарии,
`tests/browser/redesign.js` — новые состояния, движение, reduced-motion,
контраст, 200% текста и снимки390/768/1440 px. Это разные проверки;
нет необходимости каждый раз повторять все исторические матрицы.

`choice-menus.js` проверяет настоящие оформленные меню, клавиатуру, touch/swipe,
200% текста, reduced-motion и нативный fallback в отдельных чистых контекстах.
Старые сценарии с routes/storage/instrumentation запускайте в свежем сеансе,
чтобы перехваты и состояние предыдущего сценария не влияли на результаты.

## Сценарии и интерпретация

«Сохранить сценарий» фиксирует весь текущий расчёт, выбранное место, порог зон
и слои. «Открыть» восстанавливает эту копию без запроса OSM; «Найти места»
создаёт новый расчёт и не перезаписывает исследование. Название и заметку можно
изменять отдельно. Отметьте два сценария для сравнения, CSV или печати.

Сценарии используют ключ `geomarketing.scenarios.v1` с `schema_version:1`,
сохранённые места — прежний `geomarketing.saved.v1`. Миграции и аккаунтов нет.
Лимит:6сценариев,250000символов JSON на запись и1250000на список. Квота браузера
может быть меньше; ошибка записи сохраняет прежние данные. Повреждённый или
неизвестный формат не перезаписывается: доступны исходный JSON и подтверждаемая
очистка только сценариев. Без Web Locks доступны чтение/экспорт, запись отключена.
CSV сохраняет сведения, но не является импортируемой резервной копией карты.

`GET /api/calculate` дополнен `calculated_at`, `analysis_context`, `data_quality`
и `explanation` у каждой рекомендации/`best`. Старые поля/маршруты/модель прежние.
Пояснение показывает те же ядра спроса и штраф конкуренции, ближайший центр и
ограничения у края области. Это не прогноз прибыли. Качество сообщает источник,
возраст двух наборов и причины ограничений, без «процента достоверности».
Старые сохранения без новых данных выводят «не оценено».

Roadmap и контракт: [сценарии и объяснимость](docs/specs/2026-10-18-scenarios-and-explainability.md).
Каталог расширен до10областей/10типов с отдельными OSM-снимками:
[контракт расширения](docs/specs/2026-10-18-catalog-and-map-colors.md).
Далее — полевые заметки и экономические допущения.
