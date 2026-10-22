# Светлый ГеоМаркетинг: editorial hero и рабочая карта

Основание: подробный промт пользователя 22 октября и восемь визуальных
референсов. Палитра, структура и внедрение React-island заданы пользователем;
реализация и публикация продолжают ранее разрешённую работу в main/Render.

## Визуальное решение

Два уровня: компактная липкая навигация и выразительная обложка сервиса.
Кремовый фон #FFF7E6, белые рабочие панели, основной текст #2D3A47.
Палитра-примитивы также включает #F7C8D3/#B46A72/#A8B58A/#A9B7C6.
Rosewood для CTA затемняется до доступного контраста, розовый — selected фон,
sage — спрос, misty sky — дома, rosewood — конкуренты. На тёмной карте свои
on-map текст/контроли/обводки: светлая страница не инвертирует слои и маркеры.
Все цвета в компонентах — семантические токены; обычный текст ≥4.5:1,
крупный/границы активных контролов/фокус ≥3:1.

Playfair Display с кириллицей — hero и редкие крупные заголовки; Golos Text —
весь рабочий UI; прежний monospace — координаты/метки. Шрифты локальные,
font-display swap, preload только используемых критических начертаний.

Hero: «У каждого бизнеса есть своё место», короткое объяснение, CTA «Открыть
карту», вторичное «Как работает расчёт», техническая подпись. Справа — авторская
SVG-схема кварталов, радиусов и маршрута с надписью «Схема поиска»: декоративная,
aria-hidden, без ложных KPI и без притворства реальным расчётом. Референсы
определяют крупную типографику/асимметрию/воздух; фотографии/цветы/туризм не копируются.
Desktop около380–520px, mobile420–520px при стандартном размере текста;
на200% высота естественно увеличивается, ничего не обрезается.

Навигация около72–80px, компактный режим при прокрутке без прыжка страницы.
На mobile доступная кнопка меню с aria-expanded/controls, Escape/внешний клик,
возврат фокуса; без JS все ссылки доступны. Высота header учитывается якорями,
focus-scroll и программным открытием исследования/нижних данных.

## React Bits и progressive enhancement

Существующий Flask/Leaflet/ES-module UI не переносится в React. Отдельная
Rollup-точка собирает остров в static/vendor/hero/hero-motion.js с точными
версиями React/ReactDOM и только нужных движков. Material entry/bundle сохраняется.
Источник React Bits фиксируется по revision и с лицензией/описанием адаптаций.

Контракт DOM: #hero-motion-root — отдельный пустой mount; #page-title — готовый
статический h1; #hero-description — готовый абзац; #hero-art — SVG-контейнер,
его [data-hero-drift] декоративные группы. Остров — effect controller над уже
существующим статическим текстом, не второй экземпляр h1 и не владелец формы.
При отсутствии/ошибке JS или delayed bundle h1/описание/ссылки сразу доступны.
Сохранение textContent, естественных переносов и отсутствие CLS обязательны.

Split Text (исходный JS/CSS React Bits, адаптация external target): слова,
opacity/y12–20, stagger40–70ms. Blur Text: мягкий blur→sharp короткого описания.
Scroll Reveal: однократные входы только KPI/workspace/saved/research/data,
без нового эффекта на каждую строку. Если upstream Scroll Reveal рассчитан на
scrub текста, адаптировать в block-entry и честно описать отличие.
Прежний точный count-up остаётся: не заменять его вторым счётчиком.

Pointer — только fine hover, максимум6px, RAF, без бесконечного ticker и
изменения hit targets; сбрасывается при leave/blur/reduce/offscreen.
Initial/runtime reduced motion, print и fallback заканчивают эффекты и оставляют
текст/контролы в конечном состоянии. Никаких typewriter, trails, WebGL или циклов.
Остров не задерживает каталог/расчёт. Измерить raw/gzip bundle, CLS, delayed/fail.

## Сохранённые контракты

API/Flask/математика/10×10, все существующие id/testid/ARIA, Leaflet selection,
layers/resize, saved.v1/scenarios.v1/field-checks.v1, CSV/print сохраняются.
Общая высота карты/рекомендаций от1024 и нижние data-details остаются.
Pressed/hover/focus/selected читаются на светлых панелях и тёмной карте отдельно.
Новые библиотеки не обновляют несвязанные зависимости.

## Приёмка / границы

390/768/1024/1440 и200%: без overflow, targets44px, no-JS/static fallback,
sticky anchors/focus, mobile keyboard/Escape, React fail/delay, no duplicate h1,
initial/runtime reduce, pointer reset, no double section reveal, measured CLS.
Состояния initial/loading/error/results/saved; все прежние функции и print.
Сборки Material+hero воспроизводимы; Python/Node/validator/JS/browser suites,
независимое ревью и public hash/CI/Render live перед завершением.
Физические устройства/другие движки/native PDF — явные ограничения Chrome QA.
