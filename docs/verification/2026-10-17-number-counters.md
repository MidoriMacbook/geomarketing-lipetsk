# Приёмка счётчиков чисел

Запрос: анимации загрузки чисел в тёмном интерфейсе. База456f59d,
ветка codex/animated-number-counters. Новых зависимостей нет.

Уточнение пользователя: заменить бирюзу палитрой с изображения. Фон #16131F,
акценты #F0D9E4, приглушённые #C1A0AC/#4A3F4B/#806C79; карта/favicon согласованы.
Обнаруженный при просмотре screenshot дефект: вложенные span получили 12px вместо52px.
Regression RED: Counter children override the large KPI typography. Scoped direct-child
label selectors исправили причину; GREEN проверяет наследование размера и цвета.
После исправления counters: visual5771/final12344, refreshFrom12344, pageErrors[].
Обновлённые screenshots лично просмотрены: крупные KPI и тёмно-розовая гамма.
Palette/dark-motion GREEN, selection contrast13.73; redesign390/768/1440 GREEN:
текст6.87–13.73, границы5.25, no overflow/маленьких targets, print светлый.
Независимое ревью выявило два дефекта; оба подтверждены RED и исправлены:
- refresh карточек терял history при замене DOM. Значения переносятся по lat/lng/radius,
  reset фильтров очищает их. GREEN: unchanged score100 без replay, уменьшение к37,
  прерывание и новый target10000 продолжают с текущего145, не с0.
- muted на выбранном #4A3F4B давал4.226. Selected surface #3D3340 даёт5.092
  для текста выбранной второй рекомендации и отмеченного saved card. Palette test GREEN.

- Browser RED до production: KPI has no accessible animated number overlay.
- GREEN: final12344, промежуточное визуальное3827/4049, доступный snapshot
  «strong:12 344». Точный textContent остаётся финальным во время всех кадров.
- Refresh12344→19750 начинается от12344, затем проверено уменьшение к37.
- Filter reset оставляет «—», отменённый tick его не перезаписывает; новый район
  начинается от0. Runtime/initial reduce завершает сразу; noObserver работает.
- Offscreen score ждёт просмотра; exact score100% сохраняется. Print не включает overlay.
- Workspace19groups PASS/pageErrors[]. Dark-motion PASS/pageErrors[].
- Redesign PASS после уточнения старого теста empty: сам блок был выше viewport
  (bottom−94), вход правомерно ждал просмотра; test теперь прокручивает к нему.
-390/768/1440, targets>=44, tiles6/12/16,200%mobile/desktop и контраст пройдены.
- Validator61,9JS syntax, git diff --check PASS.
- Реальный screenshot middle: exact12344/visual4824, зарезервированная ширина424px.
  counters-middle.png и counters-final.png в ignored tests/artifacts.

Один RAF и кешированный Intl formatter, layout не измеряется в tick.
Overlay aria-hidden и CSS-generated visual text, final span сохраняет layout/доступность.
API/model/state/storage/report/CSV не зависят от display values.

Независимое ревью/CI/main/Render/public выполняются после локальной приёмки;
фактические идентификаторы будут внесены после публикации.

Проверка Chrome/ARIA snapshot не заменяет полный аудит assistive technologies,
всех browser engines и native PDF. Прежние ограничения OSM/storage сохраняются.
