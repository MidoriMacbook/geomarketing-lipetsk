# ГеоМаркетинг Липецк

[Открыть сайт](https://geomarketing-lipetsk.onrender.com)

Помощник для выбора места под кофейню, аптеку, продуктовый магазин, пекарню
или салон красоты. Сравнивает жилые дома и конкурентов в выбранном круге,
показывает центроиды спроса и до трёх мест для проверки.

- Три готовых района либо центр и радиус на карте.
- Связанные карточки и маркеры, KPI и переключение слоёв.
- До 12 сохранённых мест в браузере, сравнение до трёх, CSV и печатный отчёт.
- Локальный Leaflet и JSON-снимки районов; обработка отказа API, тайлов и хранилища.

Население оценочное, расстояния прямые. Оценка нормирована внутри одного
расчёта и не означает вероятность коммерческого успеха. Сохранения доступны
в этом браузере; синхронизации между устройствами нет.

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

Сервер и API обслуживаются одним сайтом, адресов localhost в клиенте нет.
Для новой области без сохранённой копии нужен доступный Overpass;
для подложки карты нужен интернет.

## Устройство и документация

`app.py` собирает Flask-приложение, `serve.py` запускает Waitress.
Внутренние модули: `src/routes → services → domain/utils`, настройки —
`src/config.py`. Клиент — восемь ES-модулей и семь CSS-файлов без сборщика.
Корневые `osm.py` и `businesses.py` сохраняют старые публичные импорты.

- [Архитектура](docs/architecture/overview.md), [сервер](docs/architecture/backend.md),
  [клиент](docs/architecture/frontend.md), [путь данных](docs/architecture/data-flow.md).
- [Дерево и карта изменений](docs/architecture/change-map.md).
- [Дизайн-система](docs/design/design-system.md), [спецификация](docs/design/redesign-spec.md).
- [Журнал изменений](CHANGELOG.md), [аудит и ограничения](PROJECT_ANALYSIS.md).
- [Размещение, Docker и переменные окружения](DEPLOYMENT.md).
- [Происхождение и импорт геоданных](data/README.md).

Текущий Render подключён по публичному Git URL: после зелёных проверок `main`
нужен ручной Deploy latest commit. На бесплатном тарифе кэш в `/tmp` эфемерный,
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
```

51 серверный тест работает без сети. GitHub Actions запускает Python-тесты,
компиляцию, структурный валидатор и синтаксические проверки JS на Linux.

Браузерная проверка: установленный playwright-cli, Chrome и запущенный сервер.

```bash
playwright-cli -s=geomarket open http://localhost:8080 --browser=chrome
playwright-cli -s=geomarket run-code --filename=tests/browser/smoke.js
playwright-cli -s=geomarket run-code --filename=tests/browser/workspace.js
playwright-cli -s=geomarket run-code --filename=tests/browser/responsive.js
playwright-cli -s=geomarket run-code --filename=tests/browser/catalog-matrix.js
playwright-cli -s=geomarket run-code --filename=tests/browser/palette.js
playwright-cli -s=geomarket close
```

responsive проверяет 360/390/768/1024/1280/1440 px, прежние сохранения,
клавиатуру и print CSS. catalog-matrix проверяет все 15 сочетаний.
Для проверки реальных тайлов нужен интернет. Эти проверки не подтверждают
полноту геоданных OSM; фактическая сборка Docker и пагинация PDF пока не проверены.
