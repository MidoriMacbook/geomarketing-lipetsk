# Приёмка рабочего пространства — 26 октября 2026

Baseline: main2e737b8. Спецификация: ../specs/2026-10-26-workspace-guidance.md.
Независимое combined review: Critical/Important нет; Minor в историческом тесте исправлен. Публикация и публичная приёмка завершены; детали ниже.

## Проверки

- Python unittest discover:106 OK; Node suites:86 PASS,0failed;
  validate_project:85 файлов PASS; git diff --check без ошибок.
- workspace-guidance:390/768/1024/1440, keyboard Enter/Space/Escape,
  один aria-pressed, отключённый слой временно показан и восстановлен,
  rapid layer toggles, guide без изменения размеров карты, focus-visible,
  явный переход к первому месту, preview и выбор без pan, сводка4строки,
  успешное сохранение/отказ locks, исследование/архив, реальный CSVdownload,
  print DOM/вызов, расчёт/refresh,200% и reduced motion — PASS, pageErrors[].
- KPI/preview не меняют current/rank/threshold/checkbox/localStorage/map view;
 0APIcalls до явного расчёта/refresh,2после. Пять persistent canvas.
- workspace-guidance-fallbacks: actual touch context, business reset,
  hero320/360/390/430 при обычном/200% тексте, guide keyboard scroll,
  reduced и отказ Leaflet без pageErrors — PASS.
- Визуально просмотрены1440/390; скриншоты локально tests/artifacts/workspace-after-*.
- mobile-feedback, workspace-interactions, palette, contrast-intro: PASS. Прежний hover-lift рекомендаций восстановлен после RED ожидания движения; reduced motion по-прежнему без lift. Семантические тёплые поверхности заменили устаревшее ожидание белого в contrast-intro (RED→GREEN).

## Выявленные и исправленные регрессии

Перед исправлением наблюдались RED: KPI не выделяет карту; Escape не закрывает
«Отображение»; map-stage увеличивает ширину mobile; при200% прокручиваемое
пояснение недоступно клавиатуре; пустые конкуренты описаны как имеющиеся точки.
После исправлений целевые browser/Node сценарии GREEN.

## Границы доказательств

Chromium, desktop/touch-эмуляция. Физические телефоны и Safari не проверялись.
200% проверено увеличением шрифта; печать — DOM/media и вызов диалога,
без проверки физического принтера/PDF-пагинации. Плитки OpenStreetMap зависят
от внешнего сервера: предупреждение и анализ готовых областей сохранены.
Новые KPI помогают прочитать текущие данные; их акцент не вычисляет новую
оценку и не устраняет неполноту OSM. Снимок архива остаётся архивом.

## Неизменные контракты

Нет diff в src/, requirements.txt, data/, collect_city_data.py, osm-data.yml,
scenario-storage.js, saved-places.js, scenarios.js, report.js,
scenario-report.js и vendor/. Новые модули не добавляют storage keys.
API/геометрия/схема данных покрыты прежними Python/Node tests.


Быстрый open/close/open обоих новых disclosure, Escape с возвратом фокуса,
смена района со штатным одним auto-calculate и обновлением контекста — PASS.
Представительский тест KPI повторён после hover-fix: PASS, pageErrors[].

## Изменённые файлы

- .github/workflows/test.yml
- CHANGELOG.md
- docs/architecture/frontend.md
- docs/design/design-system.md
- docs/design/redesign-spec.md
- docs/plans/2026-10-26-workspace-guidance.md
- docs/specs/2026-10-26-workspace-guidance.md
- docs/verification/2026-10-26-workspace-guidance.md
- scripts/validate_project.py
- session-log.md
- state.md
- static/css/components.css
- static/css/hero.css
- static/css/layout.css
- static/css/map.css
- static/css/responsive.css
- static/css/states.css
- static/css/tokens.css
- static/index.html
- static/js/analysis-focus.js
- static/js/app.js
- static/js/kpi-interactions.js
- static/js/map.js
- static/js/recommendation-brief.js
- static/js/recommendations.js
- static/js/ui.js
- static/js/workspace-disclosure.js
- tests/browser/contrast-intro.js
- tests/browser/palette.js
- tests/browser/workspace-guidance-fallbacks.js
- tests/browser/workspace-guidance.js
- tests/unit/analysis-focus.test.js
- tests/unit/recommendation-brief.test.js

## Внешние данные вне этой UI-итерации

Последний плановый запуск Daily Lipetsk OSM data (40297274617,26октября)
завершился failure на Collect complete city data. Pipeline этой задачей не менялся.
Проверяется сохранение последней корректной копии25октября и её исходной даты,
а не успешность нового сбора. Статус запуска:
https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/40297274617

## Публикация

Runtime f31ee4e975b51ee3ebe64266a2ca810f670a55b8 опубликован в main.
Render dep-dbfmv5o473hc73aa8vp0 live26октября15:21:18UTC.
CI40348255264 success. Все47 публичных ресурсов совпадают SHA256 с Git.
На публичном сайте workspace-guidance PASS:390/768/1024/1440,200%,keyboard,
KPI/layers/guide/save denial/scenario/CSV/print/calculate/refresh/reduce;
pageErrors[]. Error/critical логов Render после live на15:22:21UTC нет.

Публичные workspace-guidance-fallbacks PASS:touch/320–430hero/200%/reduce,
отказ Leaflet без JSошибок. Контекст: «мкр. Елецкий · Кофейня · данные от25.10.2026».
Финальные публичные снимки1440/390 (hero и map) просмотрены; горизонтального
переполнения нет. Изменённые файлы перечислены выше (33). Физические устройства,
Safari, реальные screen reader и PDF-пагинация остаются непроверенными.
