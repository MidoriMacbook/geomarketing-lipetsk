# Проверка статуса карты, документации и иконок — 26 октября 2026

Базовая версия: b3a819e. Публикация и публичная приёмка завершены 27 октября; результаты ниже.

## Что изменено

Пояснения KPI перенесены в существующую строку статуса. Карта сохраняет временное
выделение; отдельной панели и её связей больше нет. Нативные кнопки сохраняют
доступные имена, aria-pressed и точные числа. Сброс восстанавливает исходное
сообщение; отсутствие объектов и недоступная карта описываются честно.

SVG и PNG32/180 подключены локально. Цвет панели браузера Midnight Lagoon.
Сокращённая геометрия читается в16px на светлом и тёмном фоне.

## Полученные результаты

- Новые сообщения и отсутствие данных: проверка Node сначала выявила2ошибки,
  после реализации4проверки пройдены.
- Проверка браузера сначала остановилась на отсутствии статуса KPI. После
  переноса выявила изменение высоты карты при390px/200%. Учёт размера шрифта
  исправил его; итоговая матрица8сочетаний ширины/масштаба прошла.
- Четыре KPI, повторный выбор, Enter/Space/Escape, временная видимость слоёв,
  отсутствие новых запросов и изменения хранилища, сохранение и отказ записи,
  открытие исследования, CSV и печать — пройдены. Ошибок JavaScript нет.
- Касания,320/360/390/430px,200% текста, уменьшение движения и отказ Leaflet —
  пройдены. Статус не обещает выделение на недоступной карте.
- SVG декодируется в16/32px; PNG имеют32×32/180×180. Flask отдаёт все3файла
  сHTTP200 и правильными типами. Метаданные и локальные ссылки проверены.

## Границы проверки иконки

Chromium проверен в светлой и тёмной цветовых схемах; просмотрены иконки на
светлом и тёмном фоне. Просмотр системной рамки вкладки через средство управления
Windows остановлен из-за невозможности надёжно определить URL. Фактическая рамка
вкладки, Safari и физическое устройство Apple этой проверкой не подтверждены.

## Документация и история

README, CHANGELOG, DEPLOYMENT, архитектура, оформление, планы, спецификации,
исследовательские заметки и старые отчёты очищены от внутренних формулировок.
Файлы не удалялись и не переносились; полезные даты, версии и ограничения сохранены.
Новые сообщения коммитов — русские. Опубликованные коммиты не меняются.
Порядок отдельной операции и технические исключения описаны в
[документе обслуживания](../maintenance/git-history-cleanup-plan.md).

Окончательные результаты поиска, ссылок, общих проверок и публикации приведены ниже.

## Итог локальной проверки

Python106,JavaScript86,структурный валидатор87 — успешно. Проверены68локальных
ссылок, отсутствующих файлов нет. Общий сценарий сохранений/исследований/печати,
восстановление архивного и ошибочного статуса, защита нового внешнего сообщения,
клавиатура вторичных настроек — успешно. В строке статуса остаётся ровно один
элемент текста; измерительный элемент после расчёта отсутствует.

Поиск rg по исходникам, тестам, конфигурации и документам оставляет6строк
документированных исключений: исключение локальной папки в Docker, имя HTTP-заголовка
в конфигурации и технических пояснениях. Прочих внутренних названий не найдено.
Сторонние библиотеки, lock-файлы, локальные результаты проверок и Git-метаданные
не редактировались. Поиск удалённых элементов, связей и обработчиков пуст.
API, модель, геоданные, ежедневный сбор, модули хранилища и отчётов не имеют изменений.

## Проверка документации

27 октября завершена проверка исправлений: исходники, актуальные правила,
спецификации и планы соответствуют заданию. Замечания к русским формулировкам
исправлены, исторические отчёты вычитаны с сохранением фактов. Комментарий
конфигурации исключений также переведён на русский. Опубликованные SHA не изменялись.

## Изменённые файлы

- .gitignore
- CHANGELOG.md
- DEPLOYMENT.md
- README.md
- docs/architecture/backend.md
- docs/architecture/change-map.md
- docs/architecture/data-flow.md
- docs/architecture/frontend.md
- docs/architecture/overview.md
- docs/design/design-system.md
- docs/design/material-web.md
- docs/design/redesign-spec.md
- docs/design/ui-audit.md
- docs/maintenance/git-history-cleanup-plan.md
- docs/plans/2026-10-12-architecture-redesign.md
- docs/plans/2026-10-12-workspace.md
- docs/plans/2026-10-16-cartography-motion.md
- docs/plans/2026-10-17-contrast-intro.md
- docs/plans/2026-10-17-dark-motion.md
- docs/plans/2026-10-17-map-harmony.md
- docs/plans/2026-10-17-number-counters.md
- docs/plans/2026-10-18-catalog-and-map-colors.md
- docs/plans/2026-10-18-choice-menus.md
- docs/plans/2026-10-18-scenarios-and-explainability.md
- docs/plans/2026-10-19-workspace-flow-and-field-checks.md
- docs/plans/2026-10-22-editorial-map-hero.md
- docs/plans/2026-10-25-city-data-delivery.md
- docs/plans/2026-10-26-status-and-project-docs.md
- docs/plans/2026-10-26-workspace-guidance.md
- docs/specs/2026-10-12-workspace-design.md
- docs/specs/2026-10-16-cartography-motion-design.md
- docs/specs/2026-10-17-dark-motion-design.md
- docs/specs/2026-10-17-number-counters-design.md
- docs/specs/2026-10-18-catalog-and-map-colors.md
- docs/specs/2026-10-18-choice-menus-design.md
- docs/specs/2026-10-18-scenarios-and-explainability.md
- docs/specs/2026-10-19-workspace-flow-and-field-checks.md
- docs/specs/2026-10-22-editorial-map-hero.md
- docs/specs/2026-10-23-warm-motion-polish.md
- docs/specs/2026-10-24-touch-motion-polish.md
- docs/specs/2026-10-26-status-and-project-docs.md
- docs/specs/2026-10-26-workspace-guidance.md
- docs/verification/2026-10-17-contrast-intro.md
- docs/verification/2026-10-17-dark-motion.md
- docs/verification/2026-10-17-map-harmony.md
- docs/verification/2026-10-17-number-counters.md
- docs/verification/2026-10-17-publication.md
- docs/verification/2026-10-18-catalog-and-map-colors.md
- docs/verification/2026-10-18-choice-menus.md
- docs/verification/2026-10-18-district-auto.md
- docs/verification/2026-10-18-scenarios-and-explainability.md
- docs/verification/2026-10-19-workspace-flow-and-field-checks.md
- docs/verification/2026-10-21-research-open-motion.md
- docs/verification/2026-10-22-editorial-map-hero.md
- docs/verification/2026-10-23-warm-motion-polish.md
- docs/verification/2026-10-24-mobile-feedback-fixes.md
- docs/verification/2026-10-24-touch-motion-polish.md
- docs/verification/2026-10-25-daily-city-data.md
- docs/verification/2026-10-25-data-refresh.md
- docs/verification/2026-10-26-status-and-project-docs.md
- docs/verification/2026-10-26-workspace-guidance.md
- scripts/validate_project.py
- session-log.md
- state.md
- static/assets/apple-touch-icon.png
- static/assets/favicon-32.png
- static/assets/favicon.svg
- static/css/components.css
- static/css/map.css
- static/css/responsive.css
- static/css/tokens.css
- static/index.html
- static/js/analysis-focus.js
- static/js/kpi-interactions.js
- static/js/workspace-disclosure.js
- tests/browser/workspace-guidance-fallbacks.js
- tests/browser/workspace-guidance.js
- tests/browser/workspace-interactions.js
- tests/browser/workspace.js
- tests/unit/analysis-focus.test.js

## Публикация — 27 октября 2026

Версия be7d13b8f319fea235a7b855d6564bff829e3c4c отправлена в main обычной
публикацией. Оба новых сообщения коммитов написаны по-русски.
[CI40466021438](https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/40466021438)
успешен для точного SHA. Итоговая проверка97локальных ссылок не выявила
отсутствующих файлов; структурный валидатор87файлов прошёл.


Render dep-dbg4v2jrjlhs73cpmfs0 получил статус live 27 октября в07:17:00UTC
(10:17поМоскве). Все49публичных ресурсов, включая SVG и обе PNG, совпадают
по SHA-256 с версией Git. /healthz вернул HTTP200 и status=ok.

На опубликованном сайте прошли workspace-guidance и workspace-guidance-fallbacks:
все4KPI, повторный выбор, Enter/Space/Escape, слои,4ширины с текстом100%/200%,
стабильная высота карты, сохранение/отказ записи, архив, расчёт, обновление,
CSV и печать. Касания,320–430px,уменьшение движения и отказ Leaflet также
прошли; ошибок JavaScript нет. Дополнительно подтверждены восстановление
архивного/ошибочного статуса и сохранение нового внешнего сообщения.

Публичные PNG декодируются в32×32 и180×180, SVG подключён как основной,
цвет панели#2D3A47. Мобильный снимок карты просмотрен: пояснение находится
в существующей строке и не перекрывает карту. Системная рамка вкладки и
физические устройства остаются за границами подтверждённого просмотра.

С07:17:00до07:18:55UTC error/critical сообщений Render нет. Тестовый браузер
закрыт; прежние локальные серверы проверки отсутствуют. Рабочий сервис продолжает
работать. Итоговый аудит документации публикуется без повторного развёртывания.
