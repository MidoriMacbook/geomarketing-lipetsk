# Контраст и печатающийся заголовок

**Goal:** разделить визуальные роли интерфейса и карты, добавить первое появление h1.
**Architecture:** существующие CSS tokens и компоненты; изолированный intro.js,
вызов bootstrap; scoped light palette настроек, прежние Leaflet renderers.
**Stack:** vanilla JS/WAAPI/Leaflet/Flask, без зависимостей.
**Spec:** docs/specs/2026-10-17-contrast-intro-design.md.

## Constraints / Review Focus
- Полный h1 доступен сразу, интро не блокирует анализ; сбои storage/animation безопасны.
- При reduce/print/hidden нет скрытых букв; refresh не повторяет интро.
- Светлая панель: >=4.5 текста, >=3 контролов, 44px targets, no overflow.
- Карта имеет различные роли, canvas остаётся2; нет чтения стилей на каждую точку.

## Task1: RED
- [x] Новый isolated tests/browser/contrast-intro.js: разные поверхности/карта/legend,
  h1 partial visual + stable AX/layout, first-session/reduce/hidden/print/storage failure.
- [x] Запустить и увидеть отсутствие различимых панелей/typing.

## Task2: Implement
- [x] tokens/layout/components/responsive: settings light scope, grouped KPI,
  recommendations/saved headings and surfaces, map palette and legend shapes.
- [x] map.js: golden ring centroid and lower zone opacity, same shared renderers.
- [x] intro.js initHeadline() + bootstrap: text-node wrappers, steps opacity,
  idempotent cleanup and session guard; exact heading restored after cancellation.
- [x] GREEN targeted scenario; counters/dark-motion/selected/palette/redesign/workspace,
  validator/syntax, screenshots desktop/mobile/200%.

## Task3: Release
- [ ] Independent whole-branch review, fix concrete issues and document evidence.
- [ ] Feature CI, main/Render, public browser/asset verification.
- [ ] Update docs/state/session-log and close own QA processes.
