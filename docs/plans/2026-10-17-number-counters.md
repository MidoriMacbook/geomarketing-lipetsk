# Анимация чисел

**Goal:** добавить визуальный count-up без изменения точных результатов.
**Architecture:** новый counters.js, интеграция app/recommendations, CSS overlay.
**Tech Stack:** прежний vanilla JS/Flask/Leaflet, requestAnimationFrame, без пакетов.
**Spec:** docs/specs/2026-10-17-number-counters-design.md.

## Global Constraints
- Финальный DOM/state/API/storage/print не ждут анимации.
- Overlay aria-hidden; один RAF; viewport/reduced-motion/cancel учитываются.
- Только целые неотрицательные метрики, никаких счётчиков координат/рангов.

## Review Focus
1. Refresh/reset во время tick не возвращает старые числа или скрытый overlay.
2. Offscreen/hidden/reduce/print оставляют финальные значения и очищают очередь.
3. Доступный текст не меняется на каждом кадре; overlay не влияет на layout.

## Task 1: RED
- [ ] Disposable browser scenario: count-up, final text, reset/refresh/reduced/viewport.
- [ ] Подтвердить отсутствие новой функции до production изменений.

## Task 2: Реализация
- [ ] counters.js: countTo/resetCounters, один RAF, observer и cleanup.
- [ ] Интеграция KPI/метрик/score, CSS и доступность/печать.
- [ ] GREEN и прицельный workspace/dark regression, syntax/validator.

## Task 3: Публикация
- [ ] Независимое whole-branch review и документы.
- [ ] CI/main/Render/public проверка.
