# Приёмка счётчиков чисел

Запрос: анимации загрузки чисел в тёмном интерфейсе. База456f59d,
ветка codex/animated-number-counters. Новых зависимостей нет.

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
