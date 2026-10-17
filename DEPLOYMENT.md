# Публичное размещение

- Адрес: https://geomarketing-lipetsk.onrender.com
- Панель сервиса: https://dashboard.render.com/web/srv-db65pi8473hc73d7s5vg
- Хостинг: Render, Web Service, бесплатный тариф, Frankfurt.
- ID сервиса: `srv-db65pi8473hc73d7s5vg`.
- Исходники: https://github.com/MidoriMacbook/geomarketing-lipetsk, ветка `main`.
- Сборка: `pip install -r requirements.txt`.
- Запуск: `python serve.py`, Waitress слушает порт из `PORT`.
- Проверка приложения: `GET /healthz` → HTTP 200, `{"status":"ok"}`.

Последняя проверенная публикация: 17 октября 2026, runtime `c438cc2`,
deploy `dep-db9ibsflk1mc73bvimng` в статусе live, trigger `new_commit`.
Main CI success: run39014382031. Публично проверены health, реальный расчёт,
карта390/768/1440, сохранение и сравнение, initial reduced-motion; pageErrors=[].
SHA-256 CSS/JS/vendor и шрифтов совпали с Git blobs опубликованного коммита.
Итоговая запись аудита меняет только документы; runtime повторно не собирается.

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
но исходные снимки всех трёх районов входят в репозиторий. Для новых областей
без снимков нужен работающий Overpass API. Копии старше 7 дней помечаются в UI.

Бесплатный сервис засыпает после 15 минут без посетителей; первое открытие после
паузы может занять около минуты. У тарифа есть лимиты часов, трафика и сборки:
https://render.com/docs/free. Платные ресурсы при первом запуске не создавались.
