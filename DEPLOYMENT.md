## Публикация 24 октября 2026 — touch polish

Опубликовано: runtime `a251cb107510f8a77eee3b4367537475650522eb` (основной
пакет `9a272f74a7171cf4c54fed26babf7223bfddf82b`, затем CSS hover220ms).
Render `dep-dbe98h3bc2fs738043pg`: live24октября2026,14:21:05МСК.
https://geomarketing-lipetsk.onrender.com/

CI основного пакета и финальной CSS-правки success:
- https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/40070915547
- https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/40089443798

На публичном9a272f7 прошли touch-motion/workspace/scenarios-ui, включая
четыре ширины, реальные касания/клавиатуру, сохранения, CSV/печать, сравнение.
После CSS-only измененияa251cb1 отдельно подтверждены интерполяция hover220ms,
конечный offset−1px и отсутствие движения при reduce. SHA256 всех43 публичных
ресурсов совпали сa251cb1. Health status=ok; error/critical app logs пусты.

Полный прогон после CSS-only строки не повторялся: изменение проверено узким
browser-тестом и CI, функциональные проверки основного пакета приведены выше.

---

# Публичное размещение

- Адрес: https://geomarketing-lipetsk.onrender.com
- Панель сервиса: https://dashboard.render.com/web/srv-db65pi8473hc73d7s5vg
- Хостинг: Render, Web Service, бесплатный тариф, Frankfurt.
- ID сервиса: `srv-db65pi8473hc73d7s5vg`.
- Исходники: https://github.com/MidoriMacbook/geomarketing-lipetsk, ветка `main`.
- Сборка: `pip install -r requirements.txt`.
- Запуск: `python serve.py`, Waitress слушает порт из `PORT`.
- Проверка приложения: `GET /healthz` → HTTP 200, `{"status":"ok"}`.

Последняя публикация: 23 октября 2026, runtime `f1b0b78`,
deploy `dep-dbdrlp8473hc73beq8ug` live с22:53:28 по Москве, trigger `new_commit`.
Source/main CI success: run40014554183/run40014779563.
Опубликованы тёплые поверхности без экранного белого, заметные React Bits
анимации, Magnet на CTA и мобильная SVG-схема с паузой. Публичные warm-motion,
hero-island, workspace, research-open-motion PASS: карта, сохранения, CSV,
печать, открытие исследования, reduce/keyboard/mobile/fallback.
Все40 ресурсов совпали с Git, healthz200, pageErrors[], app error logs пусты.
Подробности: docs/verification/2026-10-23-warm-motion-polish.md.
Предыдущая версия: docs/verification/2026-10-22-editorial-map-hero.md.
Итоговый аудит документации использует `[skip render]` без повторной сборки.

Сервис создан через подключение Render; исходная конфигурация для повторного
развёртывания через Blueprint хранится в `render.yaml`. Она включает HTTP
healthcheck `/healthz`; созданный через API сервис использует стандартную
проверку доступности порта Render. `/healthz` можно выбрать как Health Check Path
в настройках сервиса для проверки состояния приложения вместо проверки порта.

После изменений выполните `python -m unittest discover -s tests -v`, затем
`python scripts/validate_project.py` и браузерные сценарии
`tests/browser/smoke.js`, `tests/browser/workspace.js`. В Docker вместе с
корневыми входами копируется `src/`; пути снимков вычисляются от корня проекта.
После проверок отправьте коммит в `main` и проверьте GitHub Actions и историю
Render Deploys. 17 октября push автоматически запустил обновление с trigger
`new_commit`; прежнее утверждение об обязательном ручном запуске больше не
соответствует наблюдаемому поведению этого сервиса. Не дублируйте начатый deploy.
Если автоматический не появился, используйте **Manual Deploy → Deploy latest commit**.
Для коммита только с документацией можно использовать `[skip render]`, как описано
в [официальной документации Render](https://render.com/docs/deploys#skipping-an-auto-deploy).
Проверьте статус Render, затем `/healthz`, карту и расчёт.
При неудачной сборке изучите логи в панели Render; повторное создание сервиса
для исправления не требуется. Для отката используйте предыдущий успешный Deploy
в этой же панели.

Временный кэш: `/tmp/geomarketing-cache`. Он не сохраняется при перезапуске,
но исходные снимки всех десяти готовых областей входят в репозиторий. Для новых областей
без снимков нужен работающий Overpass API. Копии старше 7 дней помечаются в UI.

Бесплатный сервис засыпает после 15 минут без посетителей; первое открытие после
паузы может занять около минуты. У тарифа есть лимиты часов, трафика и сборки:
https://render.com/docs/free. Платные ресурсы при первом запуске не создавались.

### Ежедневная городская выгрузка

Для новой согласованной схемы задайте `CITY_DATA_URL`:
`https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/osm-data/city.json`.
Переменная добавлена в render.yaml; существующий сервис обновляется отдельно
через merge переменных окружения, без замены других значений.
Без этой переменной сохраняется прежний локальный режим Overpass/снимков.

Workflow `.github/workflows/osm-data.yml` собирает данные ежедневно примерно
в06:23поМоскве (03:23UTC; запуск GitHub может задержаться) и вручную через Run workflow.
Публикация идёт в ветку `osm-data`, `city.json`; код и Render от неё не перестраиваются.
При сбое сохраняется прежняя версия. GitHub может отключить schedule публичного
репозитория после60дней без активности; состояние проверяется в Actions.
API-ключи сторонних поставщиков не нужны.

Сервис проверяет checksum/схему/покрытие/категории/дату, атомарно сохраняет
`CACHE_DIR/city-v1.json`. Повторная проверка версии не меняет исходную дату.
Обычный расчёт использует память; проверка источника — не чаще раза в час,
кнопка проверяет явно. При отказе остаётся городская копия, затем старые готовые
снимки без сетевого Overpass; без копии возвращается понятная ошибка.
Проверять `data_delivery.mode=daily`, `version` и исходный `fetched_at`;
повтор должен дать `unchanged` и тот же `fetched_at`.

### Overpass — сохранённый локальный режим

Загрузка двух наборов имеет бюджет повторов 85s; браузер — 100s. Основной endpoint overpass-api.de, независимые резервы — VK Maps и Private.coffee. Отдельный gall с Render также давал отказ соединения и удалён из резерва. Логи Overpass содержат hostname, тип ошибки, errno и HTTP-статус без координат. Успех обновления проверять по обоим `data_meta.*.cached=false` и новым `fetched_at`, а не только `source=osm` (источник может быть частично свежим). Локальный успешный запрос не подтверждает доступность источника с Render.
