# Публичное размещение

- Адрес: https://geomarketing-lipetsk.onrender.com
- Панель сервиса: https://dashboard.render.com/web/srv-db65pi8473hc73d7s5vg
- Хостинг: Render, Web Service, бесплатный тариф, Frankfurt.
- ID сервиса: `srv-db65pi8473hc73d7s5vg`.
- Исходники: https://github.com/MidoriMacbook/geomarketing-lipetsk, ветка `main`.
- Сборка: `pip install -r requirements.txt`.
- Запуск: `python serve.py`, Waitress слушает порт из `PORT`.
- Проверка приложения: `GET /healthz` → HTTP 200, `{"status":"ok"}`.

Последняя публикация: 21 октября 2026, runtime `11a6faf`,
deploy `dep-dbcgtvpsrm7s73d01irg` live с 22:15:23 по Москве, trigger `new_commit`.
Source/main CI success: run39659628732/run39659829541.
«Открыть на карте» показывает восстановленный снимок; hover исследований
согласован с сохранёнными местами. Проверены мышь/клавиатура/mobile touch,
обычный и reduced motion, отсутствие нового расчёта и изменения сохранений.
Все 28 runtime-ресурсов совпали с Git, /healthz200, pageErrors[]. Подробности:
docs/verification/2026-10-21-research-open-motion.md.
Предыдущий пакет: docs/verification/2026-10-19-workspace-flow-and-field-checks.md.
Итоговый аудит и расширение browser-теста используют `[skip render]`;
runtime повторно не собирается.

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
