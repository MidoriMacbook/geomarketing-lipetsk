# Палитра карты и отступы

**Goal:** согласовать карту с розово-лиловой палитрой и убрать тесные строки телефона.
**Architecture:** существующие map tokens, Leaflet styling и responsive CSS.
**Spec:** docs/specs/2026-10-17-map-harmony-design.md.

## Tasks
- [x] RED: isolated browser scenario mobile panel inset/select/button padding;
  текущая причина padding:0 воспроизводится. Проверить карту и легенду.
- [x] Implement: map palette/competitor outline/house opacity/legend;
  responsive recommendation padding16, phone buttons/select12/tooltip8x12.
- [x] GREEN360/390/430/768,200% и actual map canvas/contrast/screenshots;
  selected contrast/palette regression, validator/syntax.
- [x] Уточнение пользователя: RED letter typing still enabled → удалить intro.js,
  использовать CSS whole-heading intro; сохранить map/geometry/AX/reduce/print тесты.
- [ ] Whole-branch review, CI/main/Render/public, docs and cleanup.

Review focus: narrow phones/wrapped long labels, hit targets, visible distinction
between related marker colours and translucent zones; preserve shared canvas2.
