# Светлый editorial-redesign — приёмка 22 октября

Локальная реализация и task reviews завершены. Итоговое whole-branch review,
CI, публикация и публичная приёмка выполняются перед завершением задачи.
Spec/plan: docs/{specs,plans}/2026-10-22-editorial-map-hero.md.

## Реализация

Статический доступный hero с Playfair/Golos, cream/white palette и собственной
SVG-схемой; sticky-navigation и мобильное меню с measured header/available height.
Шесть цветов пользователя сохранены примитивами; глубокий Rosewood для AA.
Тёмная карта имеет собственные on-map роли, остальные рабочие панели светлые.
Все 106 прежних DOM id сохранены, 114 текущих уникальны. API/математика/10×10,
три прежние localStorage-схемы, CSV/print и Material bundle не менялись.

React effect-controller не владеет текстом/формой/Leaflet. Источники и адаптации
SplitText/BlurText/ScrollReveal закреплены revision
e12c22192ac7b4b452c5e2feb9b586d74765d696, SHA256 и точной лицензией
MIT+Commons Clause, GSAP standard notices сохранены. Это компоненты в составе
приложения; они не объявляются неизменёнными upstream или отдельным пакетом.
Подробности: static/vendor/hero/SOURCES.md.

## Доказательства

- RED старой темы/отсутствующего island/header, затем GREEN новых suites.
- Python 84/84 за20.508s; Node75/75; validator78files; JSsyntax; DOM/DAG/ARIA,
  diff/stub checks. Material пересобран без изменения содержимого.
- Frozen install/audit0; exactdeps/lock. check:hero проверяет pinned source hashes,
  deterministic bundle312337raw/103506gzip bytes, меньше180KiB gzip.
- Hero suite доказывает реальные word wrappers и активный blur0–4px, identity
  h1/text/geometry, delayed/failed bundle, noJS/noObserver, initial/runtime reduce,
  прерывание печатью, pointer≤6px и reset leave/blur/offscreen/visibility.
  Полный initial CLS0.001164, добавленный островом0.
- Independent Task2 review Spec/Quality/Security PASS: дополнительная проверка
  mid-entrance visibility/unmount закончилась без split/blur/drift, WAAPI/RAF0,
  errors[]. Source/build/CI/lock/licenses прочитаны, нет открытых замечаний.
- Task1 review обнаружило две Important-границы. NoJS390/200% header346px закрывал
  target192.30px; short390×320/200% menu скрывало finalaction342–402px.
  RED воспроизведён; a48e54e/bab1e85 + root measured menu cap исправляют причины.
  Повторное независимое review PASS: noJSheader уходит в потоке; menu102px,
  scrollHeight196, lastaction248–308px внутри320. Root тест проверяет вертикальный
  nowrap/scroll, nooverflow, Escape/фокус/anchors и диалоги на1440/768/390.
- Responsive выявил реальный transient AA dip3.62 при переходе savedbuttonfg/bg.
  8a4b2f7 переключает пару атомарно, оставляет shadow/transform; исходный строгий
  responsive suite GREEN, measured save states6.05–9.27. Ожидания не ослаблены.
- Итоговая интеграция GREEN: editorial-navigation/style/hero-island,
  workspace-layout48, workspace-interactions, field-checks, workspace19,
  choice-menus, scenarios-ui17, scenarios11, scenarios-mobile,
  research-open-motion, responsive, palette, selected-contrast, redesign,
  dark-motion, map-harmony, contrast-intro. Успешные группы после остановки
  матрицы не повторялись; исправленная/оставшаяся часть проверена отдельно.
- Исторические тесты темы адаптированы к прямо заданному новому дизайну:
  cream/white, новые функциональные цвета и print ink, block-entry вместо row
  stagger/CSS-intro. Семантика карты/легенды/обводок, AA, контракты данных,
  print/focus/reduce сохранены. HEX-сравнения нормализуют регистр.
- Real dense visual: Европейский/магазин,738домов/32конкурента. Hero на
  1440/1024/768/390:484.5/444.5/430/440px; desktop map/recs1100px обе.
  Все4ширины без overflow. Header/hero,1024workspace и research screenshots
  просмотрены; сохранения/данные/карта читаются в новой теме.

## Границы

Chrome и touch emulation; физические устройства, другие движки и native PDF
пагинация отдельно не проверялись. Компактная схема hero скрыта на телефоне
ради читаемости CTA; fallback без island остаётся статическим. Производительность
оценивалась по bundle/CLS и отсутствию фоновых RAF, не нагрузкой сервера.
