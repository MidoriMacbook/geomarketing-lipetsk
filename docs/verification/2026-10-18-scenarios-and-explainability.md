# Приёмка сценариев и объяснимости

Согласованная spec и TDD plan: docs/{specs,plans}/2026-10-18-scenarios-and-explainability.md.
База main dbf8223, feature codex/scenarios-and-explainability.

## Реализация и доказательства

- Domain explanations/data_quality, additive calculated_at/analysis_context/quality/
  recommendation.explanation, прежний scoring и численные API fixtures не изменены.
- Storage отдельный scenarios.v1, version1;6сценариев, record250000/key1250000символов,
  deep validation, latest-read Web Lock, exact raw repair, no-lock read-only.
- UI create/edit/duplicate/delete/reload, distinct saved places, quality/date reasons,
  two-scenario comparison without score, CSV/print, accepted palette/motion/reduce.
- RED: серверные поля отсутствовали; storage module отсутствовал; UI save отсутствовал.
  Затем focused GREEN и весь unittest: **67тестов OK**, native Node **62/62**.
- Независимое backend/storage review нашло2Important: bbox вместо круга в boundary
  и ошибочная идентичность custom. Оба исправлены RED→GREEN, повторное review PASS.
  Дополнены exact±10% demand tests и реальный сериализованный Flask custom fixture.
- Root browser: real encoded custom save/reload/restore, rank2/threshold95/layers,
  нольAPI при открытии; late response ignored, immutable save после ожидания lock,
  две вкладки/storage/delete comparison, filter reset, missing category preserves current,
  catalog initial/loading/auto-run race. Ошибок страницы нет.
- Root print current: quality=true, explanations3, visible list checks18; старый CSV
  содержит прежний заголовок/новые quality columns. Legacy saved.v1 не мигрирует.
- UI browser GREEN: name text safety, CRUD/exact2/CSV/print contexts/Escape/focus,
  quota keeps raw, damaged key confirmation/escape, no-lock read/export, quality aging,
  unknown/demo/legacy;360/390/768 и200% без overflow, pageErrors[].
- Actual hasTouch/isMobile390: cafe→pharmacy через оформленный список, два сохранения,
  compare different category/R caveat;360/390/768/1440 и390/200% — pageWidth=viewport,
  no clipped labels/targets<44; internal comparison scroll. gm:scenario/dialog-enter/exit,
  runtime reduce без running gm effects, pageErrors[].
- Прежний workspace19groups GREEN, redesign390/768/1440/200% GREEN: карты420/560/660,
  tiles6/12/16, old controls/text contrast, map/API/storage/races/CSV/print сохранены.
- Родитель лично просмотрел desktop/mobile сценарии; spacing count-label исправлен.
- Validator70,14JSsyntax,diff-check и source stub scan пройдены. Новых пакетов нет.
- Node storage suite добавлен в GitHub Actions; Material rebuild остаётся обязательным.

Подагентский последний Chrome rerun первоначально не выполнился из-за лимита
автоматического review разрешений. После возобновления основной поток выполнил
полный финальный UI и touch прогоны с разрешёнными командами: GREEN, gap закрыт.

## Остаточные границы

OSM добровольный и неполный, население оценочное; unknown не становится нулём.
Радиусы категорий и областей различаются, stats competitors включает внешний запас.
Пояснения — факты существующей модели, не прогноз выручки. Сценарии только локальные,
CSV не импортирует полную карту. Физические телефоны/Safari/Firefox/VoiceOver/TalkBack
и нативная пагинация PDF не проверены; Chromium touch/print CSS не заменяют их.

Whole-branch review/CI/Render/public evidence добавляется по завершении выпуска.
