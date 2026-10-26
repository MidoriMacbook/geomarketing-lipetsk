# Приёмка сценариев и объяснимости

Согласованная спецификация и TDD план: docs/{specs,plans}/2026-10-18-scenarios-and-explainability.md.
База main dbf8223.

## Реализация и доказательства

- Domain explanations/data_quality, additive calculated_at/analysis_context/quality/
  recommendation.explanation, прежний scoring и численные API fixtures не изменены.
- хранилище отдельный scenarios.v1, version1;6сценариев, record250000/key1250000символов,
  deep validation, latest-read Web Lock, exact raw repair, no-lock read-only.
- UI create/edit/duplicate/delete/reload, distinct saved places, quality/date reasons,
  two-scenario comparison without оценка, CSV/print, accepted palette/motion/reduce.
- RED: серверные поля отсутствовали; хранилище module отсутствовал; UI save отсутствовал.
  Затем focused GREEN и весь unittest: **67тестов OK**, native Node **62/62**.
- Независимое backend/storage проверка нашло2 существенные ошибки: bbox вместо круга в boundary
  и ошибочная идентичность custom. Оба исправлены RED→GREEN, повторное проверка PASS.
  Дополнены exact±10% demand tests и реальный сериализованный Flask custom fixture.
- Общая проверка: браузер: real encoded custom save/reload/restore, rank2/threshold95/layers,
  нольAPI при открытии; late response ignored, immutable save после ожидания lock,
  две вкладки/storage/delete comparison, filter сброс, missing category preserves current,
  catalog initial/loading/auto-run race. Ошибок страницы нет.
- Общая проверка: печать current: качество=true, explanations3, visible list checks18; старый CSV
  содержит прежний заголовок/новые качество columns. Legacy saved.v1 не мигрирует.
- UI браузер GREEN: name text safety, CRUD/exact2/CSV/print contexts/Escape/focus,
  quota keeps raw, damaged key confirmation/escape, no-lock read/export, качество aging,
  unknown/demo/legacy;360/390/768 и200% без переполнения, pageErrors[].
- Actual hasTouch/isMobile390: cafe→pharmacy через оформленный список, два сохранения,
  compare different category/R caveat;360/390/768/1440 и390/200% — pageWidth=область просмотра,
  no clipped labels/targets<44; internal comparison scroll. gm:scenario/dialog-enter/exit,
  включение режима уменьшения движения во время работы без running gm effects, pageErrors[].
- Прежний workspace19groups GREEN, redesign390/768/1440/200% GREEN: карты420/560/660,
  tiles6/12/16, old controls/text contrast, map/API/storage/races/CSV/print сохранены.
- Вручную просмотрены desktop/mobile сценарии; spacing count-label исправлен.
- Validator70,14JSsyntax,diff-check и поиск заглушек в исходниках пройдены. Новых пакетов нет.
- Node хранилище набор проверок добавлен в GitHub Actions; Material rebuild остаётся обязательным.
- Проверка реализации нашло Существенная ошибка: необязательные повреждённые quality/explanation
  старого saved.v1 могли блокировать CSV/print. Read нормализует только непригодные
  дополнительные сведения в памяти, сохраняя базовые места и исходный raw до записи;
  presentation вспомогательные функции проверяют формы/строки/массивы. legacy-enrichment RED→GREEN,
  включая object вместо status, null/reasons object/explanation arrays. CSV/print работают,
  «не оценено» вместо ложного статуса, raw не переписывается при чтении.
- Уточнение по результатам проверки: ноль конкурентов в радиусе больше не описывает всю выборку.
  Zero-local/nonempty halo regression RED→GREEN; workspace/UI повторно GREEN.
  Choice-menus5options/touch/200%/fallback также GREEN после нового пакета.

Последний прогон Chrome первоначально не состоялся из-за ограничения среды.
Позднее полный набор проверок интерфейса и касаний выполнен успешно;
первоначальный пропуск не засчитывался как успешная проверка.

## Остаточные границы

OSM добровольный и неполный, население оценочное; unknown не становится нулём.
Радиусы категорий и областей различаются, stats competitors включает внешний запас.
Пояснения — факты существующей модели, не прогноз выручки. Сценарии только локальные,
CSV не импортирует полную карту. Физические телефоны/Safari/Firefox/VoiceOver/TalkBack
и нативная пагинация PDF не проверены; Chromium touch/print CSS не заменяют их.

## Публикация

Проверка реализации после исправлений: Проверка требований, качества и безопасности пройдена,
неустранённых замечаний нет. Версия приложения01dced1a5669738b1ab9600c04387ed56830c1dc.
CI исходной версии39124731935/mainCI39124808905 успешно; предыдущий283472b CI39124260289 тоже success.
Render dep-dbab4njm8hqs73b72osg live18октября2026 14:51:08Москва, trigger new_commit.

Public HTTPS:
- scenarios-ui17groups GREEN; общая проверка: restore11groups GREEN. Custom использует
  настоящий сериализованный Flask fixture через браузер route, не live Overpass.
  Готовые районы/API/карта/сохранение сценариев обращаются к реальному серверу.
- hasTouch cafe/pharmacy с разными R,360/390/768/1440 и200%, без переполнения/targets>=44,
  internal table scroll/motion/reduce GREEN; public screenshots лично просмотрены.
- legacy-enrichment GREEN: base/raw preserved, CSV/print работают, halo wording local.
- Реальный /healthz200; /api/calculate cache/recent/3recs, новые поля version1.
  Карта390/768/1440 высоты420/560/660, tiles6/12/16, old saved2/compare2;
  начальный reduce Material static fallback/running0. Все наборы проверок pageErrors[].
-25HTML/CSS/JS/vendor/favicon и2font SHA-256 совпали с Git во время работы, HTTP200.

Собственные проверка браузеры закрыты; helper37612/child28108 остановлены после проверки
commandlines, порт5085 не слушается. Временный сервер остановлен.

Финальный коммит отчёта только документы [skip render], версия приложения остаётся01dced1.
