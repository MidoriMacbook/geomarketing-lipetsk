# Меню выбора: план

**Goal:** оформить и анимировать выбор области/бизнеса/радиуса без потери поведения.
**Architecture:** choices.js + существующие ui motion, original select value/change,
portal listbox и scoped CSS; vanilla JS/Flask/Leaflet, без новых пакетов.
**Spec:** docs/specs/2026-10-18-choice-menus-design.md.

## Review focus
- Catalog retry/disabled/options/value не расходятся между native и trigger.
- Esc/outside/Tab/typeahead/scroll/resize/hidden не оставляют orphan menu/focus.
- Только один popup, reduced/print и fast close/reopen безопасны, no overflow.
- UI commit вызывает исходный change один раз, custom area/radius/API не ломаются.

## Tasks
- [x] RED: новый isolated choice-menus.js для pointer/keyboard/typeahead/disabled/
  retry/custom/radius/focus/viewport/motion/fallback, исходный UI не имеет trigger.
- [x] choices.js/initChoiceMenus() в bootstrap, tokens/CSS/ARIA/fallback.
- [x] Native contract tests force hidden select; настоящие user flows новым UI.
- [x] GREEN new scenario/workspace/redesign/counters; syntax/validator/screenshots.
- [x] Independent review, CI/main/Render/public, docs and owned QA cleanup.
