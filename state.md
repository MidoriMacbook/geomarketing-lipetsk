# Состояние — 26 октября 2026

Активная задача: рабочее пространство по docs/specs/2026-10-26-workspace-guidance.md.
Без глобального редизайна; API/модель/данные/daily/storage/CSV/print сохраняются.
Baseline main 2e737b8, runtime Render ec325784147b4bab3baed18733dc27a5f3471803.

Реализованы transient KPI→panes/legend/guide, компактное Отображение,
сводка рекомендаций/preview/save status, тёплые токены,
безопасный mobile hero и честный контекст даты. Два worker завершили правки.
Рабочее дерево ещё не закоммичено; combined review и публикация впереди.

Свежая проверка: Python106 OK, Node86 PASS, validator85 PASS, diff check OK.
workspace-guidance и fallbacks PASS: 390/768/1024/1440, touch,
200% текста, 320–430 hero, keyboard/Escape/reduce/noLeaflet, CSV/print,
сохранение/отказ storage, исследование, расчёт/refresh, отсутствие API при KPI.
Сейчас повторяется regression mobile-feedback/workspace-interactions/palette.

Свой сервер на8092 (Start-Process PID17808, child уточнить перед stop).
CITY_DATA_URL daily; CACHE_DIR tests/artifacts/workspace-focus-cache.
Свой browser CLI workspace-focus PID18708, запускать require_escalated:
в sandbox Chrome crashpad аварийно закрывается.

Далее: документация/combined review, исправления, main push,
CI/Render live, public browser QA и hashes, audit/cleanup/clean git.
Daily pipeline и Render env не менять. Авторизация main/Render дана ранее.
