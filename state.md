# Состояние работы

## Current Goal
Исправление исследований завершено 21 октября 2026, опубликовано в main/Render.
Пользователь сообщил отсутствие hover и неработающую на вид кнопку «Открыть».
Предыдущий workspace flow также опубликован; не начинать его заново.

## Decisions
Restore работал, но focus preventScroll оставлял карту вне экрана (top=-1523px).
После успешного restore карта явно показывается: smooth или instant при reduce.
Фокус остаётся на map-title, подпись действия — «Открыть на карте».
Исследования включены в существующие hover/transition CSS-селекторы;
compare inset, fine-pointer-only и reduced motion сохранены.
Схемы storage, API, модель, 10×10, Material и данные снимков не менялись.

## Release
Runtime: 11a6faf6ed6bbe1058b02fae8beda80d6705ddf5.
Ветка codex/research-open-motion сохранена; main обновлён fast-forward.
Independent focused review PASS, замечаний нет.
Source/main CI Success: 39659628732 / 39659829541.
Render dep-dbcgtvpsrm7s73d01irg live 21 октября 22:15:23 Москва, new_commit.
Сайт: https://geomarketing-lipetsk.onrender.com.
Документы и расширение browser-покрытия — отдельный [skip render] audit.

## Evidence
Два RED→GREEN: карта вне экрана после открытия; отсутствие hover исследований.
research-open-motion локально/public GREEN: 1440 keyboard/reduce и mouse/normal,
390 mobile touch/reduce и touch/normal, unchanged storage/no calculate/focus,
compare emphasis/runtime reduce. pageErrors[].
scenarios-ui17/scenarios11/mobile/workspace-interactions GREEN.
Node scenario62/62, validator73, JSsyntax/diff/stub checks PASS.
360/390/768/1440 и 390/200% без overflow, targets≥44px; screenshot просмотрен.
Public healthz200/28asset hashes совпали; app error/critical после deploy нет.
Приёмка: docs/verification/2026-10-21-research-open-motion.md.
Предыдущий пакет: docs/verification/2026-10-19-workspace-flow-and-field-checks.md.

## QA Cleanup
Тестовые browser contexts и research-fix закрыты. Временный сервер остановлен
после проверки PID/command line/parent/executable; порт5085 свободен.
Не останавливать чужие процессы при следующей сессии.

## Open Issues
Нет нерешённых требований этого исправления.
Chrome/touch emulation; физические устройства/другие engines/nativePDF вне приёмки.
GitHub REST rate403: Actions UI с полным SHA — рабочий fallback.
Прежний checklist cross-key storage не crash-atomic; автоматического sweeping нет.
