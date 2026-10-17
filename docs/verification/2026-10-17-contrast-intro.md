# Приёмка контраста и первого появления заголовка

База c8c14a2, feature codex/contrast-and-typed-intro. Запрос: сохранить палитру,
разделить роли карты/панели и добавить эффект печати. Новых зависимостей нет.

- RED: Heading has no first-visit typing effect до реализации.
- GREEN contrast-intro:15 видимых букв в середине, полный неизменный AX heading;
  оригинальный textContent восстановлен, reload не повторяет анимацию.
- Геометрия заголовка до/после одинакова:390px→67px,768px→84px,
  390px/200%text→260px; без горизонтального переполнения.
- Reduce startup/runtime, print и hidden раскрывают весь текст. Storage blocked
  и animate throw на1й/3й букве не ломают heading/анализ; pageErrors[].
- Карта: голубые дома/коралловые конкуренты/золотые кольца/лиловые зоны,
  max opacity.42, shared canvas2, palette reads4/1 (render/zone).
- Отдельные поверхности settings/map/results: rgb240217228/353044/443552.
- Независимое ревью выявило светлый общий token на прежних dark buttons и
  invisible selection. Regression RED:1.20/1.20/1.00; после исправления
  saved button/dialog close14.97, settings selection12.08. Selected small text6.54.
- Workspace19groups, counters (refresh/reset/interrupted147), dark-motion,
  selected contrast, palette и redesign GREEN/pageErrors[].
- Redesign390/768/1440: map420/560/660, tiles6/12/16, targets>=44px,
  текст5.84–16.48, select borders4.24;200% текста без overflow.
- Validator63,10JS syntax и git diff --check пройдены. Backend не изменён;
  полные автоматические тесты выполняются в CI.
- Screenshot typing/top/workspace/mobile/mobile-map в ignored tests/artifacts;
  desktop и mobile лично проверены. Natural uninstrumented intro завершается.
- Скриншот выявил старые mobile padding-left:0 и border-bottom:0 на KPI.
  Regression RED «KPI card text touches its border»; старые правила удалены,
  padding16 и mobile first KPI36px, scoped сценарий перепроверен.

Тест первого кадра удерживает animation objects, а не повторно ищет их через
getAnimations: past-end paused эффекты исключаются из этого списка. Это настройка
QA для детерминированного снимка, production не приостанавливает эффекты.

CI/review/public/Render идентификаторы записываются после фактической публикации.
Проверка Chromium/AX не заменяет полный аудит assistive technologies и других engines.
