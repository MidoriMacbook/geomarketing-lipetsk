# Тёмная картография: план

**Goal:** исправить визуальное направление по отзыву пользователя и сделать motion видимым.
**Architecture:** существующие CSS tokens/components + cancel-safe helpers ui.js.
**Tech Stack:** Flask/Leaflet/HTML/CSS/ES modules, без новых библиотек.
**Spec:** docs/specs/2026-10-17-dark-motion-design.md.
**Assumptions:** начальное направление графит/бирюза; ответ пользователя заменяет его.

## Global Constraints
- Сохранить API/storage/геометрию/DOM contracts/native controls/CSV/print.
- Данные и фокус не ждут анимации. Reduced-motion учитывается в runtime.
- Тёмные surfaces и OSM tile-only filter; функциональные слои не фильтруются.
- Не повторять одинаковые полные suites без нового основания.

## Review Focus
1. Offscreen очередь: удаление, новый расчёт и reduced-motion не воскрешают старый вход.
2. Focus/hidden/print: содержимое доступно до эффекта; печать читаема.
3. Dark contrast: selected/hover/native options/notice и карта сохраняют читаемость.
4. Нет IntersectionObserver: UI и входы не блокируются, нет скрытого контента.

## Task 1: Проверка причины
Files: tests/browser/dark-motion.js.
Interfaces: consumes existing ui.reveal and public DOM; produces real browser RED/GREEN.
- [x] Изолированный disposable page, offscreen animations не должны проигрываться до просмотра.
- [x] Проверить reveal после прокрутки, runtime reduce, повторный расчёт и no observer.
- [x] Запустить RED до изменения production motion.

## Task 2: Реализация
Files: static/css/**, static/index.html, static/js/ui.js, recommendations.js.
Interfaces: preserves reveal(element,purpose,options); produces viewport-aware entry and dark tokens.
- [x] Обновить тёмную палитру/глубину/hero/состояния/карту/print без нового стека.
- [x] Добавить viewport-aware reveal и cleanup, видимые section entries.
- [x] Проверить GREEN и реальный вид/анимацию на трёх ширинах.

## Task 3: Проверка и публикация
Files: docs/design/**, CHANGELOG, state/session-log, CI evidence.
- [x] Workspace regression и прицельные новые проверки, contrast/text/print/reduced.
- [x] Независимое ревью, обновление документов и CI.
- [x] Main/Render/public проверка и скриншоты.
