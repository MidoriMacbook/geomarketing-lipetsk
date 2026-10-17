# Проверка cartography/motion редизайна

Реализация начата 16 октября, публикация выполняется 17 октября 2026.
Проверяемая версия исходников: `2caac1140175eef94aa1c1b6728212fcf71675cb`.
Ветка: `codex/cartography-motion-redesign`, база `17dc3d8`.

## Реализация и локальная приёмка

- `pnpm install --frozen-lockfile`: Already up to date, pnpm 11.25.0.
- `pnpm run check:material`: успешная сборка локального vendor (38 866 байт).
- `python -m unittest discover -s tests -v`: 51 тест, OK.
- `python scripts/validate_project.py`: PASS, 61 обязательный файл, import DAG,
  ссылки на assets, DOM ids и семантические токены.
- Синтаксис восьми клиентских модулей: PASS; `git diff --check`: PASS.
- Stub scan изменённого JS не нашёл TODO/FIXME/placeholder/NotImplementedError.
- Прежний `workspace.js`: 19 групп, pageErrors=[]; утверждения не изменены.
- Новый `redesign.js`: PASS, pageErrors=[]. Начальный RED отсутствующих hooks
  получен до реализации motion; интеграционные ошибки исправлялись прицельно.

| Ширина | Ширина страницы | Карта, высота | Загруженные тайлы | Малые цели |
| --- | --- | --- | --- | --- |
| 390 | 390 | 420 | 6 из 6 | нет |
| 768 | 768 | 560 | 12 из 12 | нет |
| 1440 | 1440 | 660 | 16 из 16 | нет |

При 1440 карта шириной 824 px, настройки 220 px, рекомендации 290 px.
Проверенные контрасты текста 4.99–15.68:1; границ select 3.78:1.
Нажатая кнопка сохраняет раскладку 188×44 и фактическую высоту не меньше 44 px.
200% текста: mobile без переполнения; desktop helpers clientWidth/scrollWidth
122/122. Исправлены длинные KPI-подписи и метки конкурентов внутри карточек.

Реальные Animation.id `gm:*` зафиксированы для карты, слоёв, KPI, рекомендаций,
выбора, pin pulse, сохранения/удаления/FLIP, сравнения, диалога, уведомлений,
своей области и пустого состояния. Stagger 0/75/150 ms. Сохранение анимируется
после записи; очередь Web Lock и отказ хранилища не показывают ложный успех.

Во время реального pending-состояния Material имел четыре running shadow
animations; runtime reduced-motion остановил их после Lit update и сохранил
статический доступный индикатор без процента. Отказ bundle не сломал native UI/API.
Проверены устаревший запрос, ошибочный refresh с прежним результатом, Escape/focus,
быстрое переоткрытие, безопасные копии, печатный CSS.

Финальные снимки `tests/artifacts/urban-final-{390,768,1440}.png` лично просмотрены.
Артефакты QA игнорируются Git; они не подменяют реальные данные на публичном сайте.

## Ревью

Task2: Spec PASS / Quality APPROVED. Task3: PASS / APPROVED с minor follow-ups:
изолировать test init script от последующих QA-навигаций; усилить отдельные
assertions обеих panes и FLIP. Они относятся к тестовому harness, не к продукту.
Выбранный порядок workspace → redesign безопасен; исходные трассы подтверждают
оба opacity-pane и saved-flip. Сценарий после себя не используется для иной QA.

Task1: desktop 200% helper overflow исправлен, повторное независимое ревью
PASS/APPROVED. Финальное whole-branch review (gpt-6-astra): Spec PASS,
Quality APPROVED с теми же двумя Minor follow-ups тестового harness.
Security review не нашло новых actionable дефектов. Блокирующих замечаний нет.
Границы source review: vendor и лицензии просмотрены ограниченно, зависимости
не проходили отдельный внешний advisory audit; glyph internals не декодировались.

## Публикация

Ветка отправлена в GitHub. Linux CI для полного source SHA выше:
[39014252941](https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/39014252941),
completed/success. Frozen install, Material rebuild/diff, Python и JS checks прошли.
Перенос в main и обновление существующего бесплатного Render выполняются;
идентификаторы публичной проверки будут внесены после развёртывания.

## Границы проверки

Chrome: три ширины, увеличение CSS-текста, keyboard/focus, print CSS и preference.
Это не полный WCAG-аудит, не проверка всех browser engines/native zoom и не
проверка пагинации PDF. Docker не собирался. Полнота OSM и доступность внешних
тайлов/Overpass не гарантируются. API/модель и схема storage v1 не менялись.
