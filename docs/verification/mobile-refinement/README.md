# Мобильная полировка — 17 ноября 2026

Ветка redesign. Серверный расчёт, маршруты и формат API не изменены; main не затронута. Снимки сняты локально на управляемом наборе из трёх рекомендаций с настоящими картографическими тайлами. Они показывают интерфейс, а не результаты нового полевого исследования. Даты на чипе получены из метаданных, а не зашиты в интерфейс.

## Текущий этап

| Пункт | Статус и изменение | 375×667 | 390×844 | 768×1024 |
|---|---|---|---|---|
| 1. Карта, отступы и источники | Сделано. Отступ зависит от состояния панели; якоря учитывают шапку и её градиент. Чип с датой и отдельная кнопка-ссылка открывают нативный лист. Исходные даты, ограничения и обновление данных сохранены. | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-375-source.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-source.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-390-source.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-source.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-768-source.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-768-source.png) |
| 2. Сравнение | Сделано. До 600 px места стоят столбцами; первый столбец 96 px. Для двух мест действие под таблицей, для трёх — выбор пары. На 768 px сохранена обычная таблица с внутренней прокруткой. | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-375-comparison.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-comparison.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-390-comparison.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-comparison.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-768-comparison.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-768-comparison.png) |
| 3. Выноска | Сделано. «О месте» с шевроном — путь к подробностям. i рядом с баллом только объясняет относительную оценку; лист результатов не открывается. | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-375-popover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-popover.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-390-popover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-popover.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-768-popover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-768-popover.png) |
| 4. Обложка | Сделано. Отдельная строка «Липецк» убрана. Город остался в бренде и бейдже. Высота на 375×667 — 461,1 px (69,1 svh), схема сохранена. | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-375-cover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-cover.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-390-cover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-cover.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-768-cover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-768-cover.png) |
| 5. Меню и отчёт | Сделано. Повторная проверка WebKit, кадры по времени и общая таблица ниже. Физический iPhone не проверен. | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-375-menu.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-menu.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-390-menu.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-menu.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-768-menu.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-768-menu.png) |

Отступы карты: 375: [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-375-map.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-map.png) · 390: [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-390-map.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-map.png) · 768: [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/before-chromium-768-map.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-768-map.png).

Сравнение двух мест: [375](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-comparison-two.png) · [390](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-comparison-two.png). Выбор пары: [375](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-pairs.png) · [390](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-pairs.png). Общий охват: [375](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-375-coverage.png) · [390](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium-390-coverage.png).

Ширина таблицы на 375 px — 315 px, scrollWidth — 315 px; на 390 px — 330/330 px. Горизонтального переполнения страницы нет. Первый показатель виден сразу. При сравнении разных исследований подсказка о несопоставимости относительных баллов сохранена; охват доступен только для пары с домами текущего расчёта.

## Открытие меню в WebKit

**Да, исправление открывания меню подтверждено повторно.** В этом этапе само меню не переписывалось: используется уже исправленный нативный dialog в корне body, вне шапки с эффектами. Панель не обрезана, clip-path: none, opacity: 1; при прямом касании она получает событие.

Проверены профиль iPhone 13, viewport 375×667 и 390×844, дополнительно 768×1024. Для каждого размера сняты кадры после тапа с целевыми задержками 0/150/300/600 мс. После 600 мс проверены границы viewport и отличие пикселей поверхности от подложки. Тап по пункту выполняет переход и закрывает меню. Прямой тап по координатам кнопки, Tab, Esc и восстановление позиции прокрутки также прошли. Реальные интервалы снимков зависят от отрисовки и записи PNG.

| WebKit | 0 мс | 150 мс | 300 мс | 600 мс |
|---|---|---|---|---|
| 375 | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-375-0.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-375-150.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-375-300.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-375-600.png) |
| 390 | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-390-0.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-390-150.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-390-300.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-390-600.png) |
| 768 | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-768-0.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-768-150.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-768-300.png) | [кадр](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after-webkit-768-600.png) |

[Все измерения меню](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/menu/after.json) · [Сценарий проверки меню](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/scripts/frontend/mobile-visual-check.mjs).

Это **проверено в WebKit** на Windows с эмуляцией iPhone. Физический iPhone Safari, Telegram, системная клавиатура и динамическая панель браузера — **не проверено**.

## Проверки этого этапа

- Chromium: 55 smoke-тестов, без пропусков, повторов и ошибок. [Результат](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/smoke-chromium.json).
- WebKit: 14 целевых тестов — карта, выноски, сохранение, общий охват, транспонированная таблица, лист источников, ошибка расчёта. [Результат](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/smoke-webkit.json).
- Отдельные полные проходы интерфейса со снимками на трёх размерах: [Chromium](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-chromium.json) и [WebKit](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/after-webkit.json). Открытие сведений о балле не раскрывает результаты; «О месте» раскрывает выбранное место.
- Проверка проекта: 92 файла, импорты, статические ресурсы, DOM id и палитра — PASS. Разность серверных файлов относительно начала этапа пустая.
- Проверены 20 проходов прокруткой через карту, быстрые действия, reduced-motion, сохранение позиции и возврат к выбранному пину существующим smoke-набором. Новые замеры Lighthouse, CPU ×4 на 1500 домах и cold start в этом этапе не выполнялись.

## Статусы прежних заданий

«Сделано» означает реализовано и проверено в обозначенном объёме. Старые замеры не выдаются за измерения текущего коммита.

| Задание | Статус | Проверка и границы |
|---|---|---|
| Меню на iPhone / WebKit | Сделано | Проверено в WebKit и Chromium сейчас; физический iPhone не проверен |
| Выпадающие списки, выбор параметров, возврат к настройкам | Сделано | Только в Chromium: полный smoke сейчас; WebKit касания и состояния — предыдущий этап |
| Панель PEEK / EXPANDED, явное открытие, закрытие и фон | Сделано | Проверено в WebKit: тап и возврат к сравнению; только в Chromium: 20 проходов, жест, клавиши, CPU ×4 |
| Нижний отступ и источник под картой | Сделано | Проверено в WebKit и Chromium на трёх размерах сейчас |
| Выноска и единственная кнопка «О месте» | Сделано | Проверено в WebKit и Chromium сейчас |
| Точка вручную, интерполяция, сохранение и сравнение | Сделано | Проверено в WebKit и Chromium целевыми тестами сейчас; алгоритм в этом этапе не менялся |
| Связь пин ↔ карточка, Tab/Enter, слой объяснения | Сделано | Проверено в WebKit и Chromium сейчас |
| Общая аудитория двух мест, выбор пары из трёх | Сделано | Проверено в WebKit и Chromium сейчас; все три пары в smoke |
| Центры спроса и связанные места | Сделано | Проверено в WebKit и Chromium сейчас |
| Компактное сравнение без горизонтальной прокрутки | Сделано | Проверено в WebKit и Chromium на 375/390 сейчас; на 768 осталась внутренняя прокрутка обычной таблицы |
| Сохранённые места и исследования, возврат к карте | Сделано | Места — проверено в WebKit и Chromium; исследования — только в Chromium, полный smoke сейчас |
| Полоса прогресса, skeleton, повтор после ошибки | Сделано | Только в Chromium: задержанные стили/модули и медленный ответ; WebKit: ошибка и доступный повтор |
| Переключатели слоёв и читаемость карты | Сделано | Только в Chromium: целевые тесты слоёв; WebKit: снимки и маршрут выбора места |
| Leaflet-префикс и атрибуция OSM | Сделано | Проверено в WebKit и Chromium на снимках; префикс скрыт, атрибуция OSM сохранена |
| Скроллбары и естественная прокрутка | Частично | Chromium: жесты и фон, WebKit: листы и возврат; нативные полосы физического Safari не проверены |
| Заголовок, копирование, выделение и курсив | Сделано | Только в Chromium: автоматическая геометрия 375/768/1440/1920; WebKit: снимки 375/390/768. На телефоне прямое начертание |
| Схема обложки и повторный город | Сделано | Проверено в WebKit и Chromium: схема сохранена, отдельная строка города убрана |
| Палитры A/B/C и контраст | Сделано в прежнем этапе | Только в Chromium: прежние листы сравнения и расчёты; A остаётся по умолчанию. Полный контрастный аудит заново не проводился |
| Логотип, favicon, Apple icon, 10 значков бизнеса | Сделано в прежнем этапе | Только в Chromium: предыдущая проверка набора и файлов; установка на домашний экран iOS не проверена |
| Сетка 1/2/3 рекомендаций, слабый вариант, рамки и фокус | Сделано | Только в Chromium: текущие тесты представления; WebKit: обычные карточки в маршруте |
| Формулировки, даты, ограничения и доступное обновление | Сделано | Проверено в WebKit и Chromium: лист данных и настоящий источник; ежедневная выгрузка в этом этапе не перезапускалась |
| Lighthouse: пять прогонов, CLS, вес страницы | Частично для текущей версии | Только в Chromium: прежний отчёт. Пять новых прогонов этой версии не выполнялись |
| Cold start Render, инструкция показа | Частично | Инструкция уже есть; время холодного старта текущей версии не проверено |
| Скорость выбора на 1500 домах, CPU ×4 | Частично для текущей версии | Прежний замер сохранён; заново не проверено |
| Реальные Safari/Android/Telegram, клавиатура, flick | Не проверено | Требуется физическое устройство |

Предыдущие доказательства: [палитры](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/palette/README.md), [иконки и Safari](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-safari/README.md), [карта и производительность](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/map-workbench/README.md), [оформление рекомендаций](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/recommendation-polish/README.md), [Lighthouse](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/polish/06/lighthouse.md). Результаты прежних версий не заменяют проверку на реальном устройстве.

## Коммиты и файлы

### Поправка после CI

Первый Linux CI обнаружил скачок при загрузке шрифтов: CLS 0,0897 в тесте с задержкой ресурсов, хотя локальный полный набор прошёл. В кадрах trace видны смена одной строки заголовка на две и чип над картой до инициализации. Исправлено: строки заголовка заданы до загрузки шрифта с сохранением копирования «ГеоМаркетинг»; скрытие чипа над картой больше не перекрывается его новым стилем; у бренда указан компактный запасной Arial. Порог теста 0,05 не ослаблялся.

Добавлена регрессия с полностью недоступными шрифтами и скриптами. После поправки 14 целевых тестов Chromium прошли; три локальных замера CLS с задержкой 350 мс: 0,0104 / 0,0083 / 0,0068. Это тест загрузки, не новые прогоны Lighthouse. Основные 55 smoke и 14 WebKit выше относятся к версии до этой небольшой поправки; итоговый CI доступен в [запусках ветки redesign](https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/workflows/test.yml?query=branch%3Aredesign).

[Начальное состояние до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/loading-before-375.png) · [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/loading-after-375.png) · [измерения](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/mobile-refinement/loading-cls.json) · [сценарий](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/scripts/frontend/loading-layout-check.mjs) · [регрессия](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/tests/smoke/polish.spec.js).

- [источники под картой](https://github.com/MidoriMacbook/geomarketing-lipetsk/commit/ee27c8f)
- [компактное сравнение мест](https://github.com/MidoriMacbook/geomarketing-lipetsk/commit/ce7f646)
- [подробности выбранного места](https://github.com/MidoriMacbook/geomarketing-lipetsk/commit/88d29b7)
- [короткая обложка сайта](https://github.com/MidoriMacbook/geomarketing-lipetsk/commit/989821f)

- [static/index.html](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/index.html)
- [static/css/palette.css](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/css/palette.css)
- [static/js/result-sheet.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/js/result-sheet.js)
- [static/js/recommendations.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/js/recommendations.js)
- [static/js/ui.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/js/ui.js)
- [static/js/navigation.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/js/navigation.js)
- [static/js/saved-places.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/js/saved-places.js)
- [static/js/map-comparison.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/js/map-comparison.js)
- [static/js/map-inspector.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/static/js/map-inspector.js)
- [scripts/frontend/mobile-refinement-check.mjs](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/scripts/frontend/mobile-refinement-check.mjs)
- [scripts/frontend/mobile-visual-check.mjs](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/scripts/frontend/mobile-visual-check.mjs)
- [scripts/frontend/mobile-journey-check.mjs](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/scripts/frontend/mobile-journey-check.mjs)
- [tests/smoke/mobile-refinement.spec.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/tests/smoke/mobile-refinement.spec.js)
- [tests/smoke/mobile-workbench.spec.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/tests/smoke/mobile-workbench.spec.js)
- [tests/smoke/map-inspection.spec.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/tests/smoke/map-inspection.spec.js)
- [tests/smoke/recommendation-journey.spec.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/tests/smoke/recommendation-journey.spec.js)
- [tests/smoke/visual-polish.spec.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/tests/smoke/visual-polish.spec.js)
- [tests/smoke/redesign.spec.js](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/tests/smoke/redesign.spec.js)

