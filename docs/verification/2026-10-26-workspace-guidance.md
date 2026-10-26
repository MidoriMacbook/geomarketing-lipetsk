# Приёмка рабочего пространства — 26 октября 2026

Baseline: main2e737b8. Спецификация: ../specs/2026-10-26-workspace-guidance.md.
Публикация и итоговое ревью пока ожидаются.

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
- Регрессии mobile-feedback/workspace-interactions/palette: выполняются отдельно.

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
