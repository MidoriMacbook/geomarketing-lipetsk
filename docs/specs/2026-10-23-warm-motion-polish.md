# Тёплая палитра и заметная анимация

Основание: подробный промт пользователя от 23 октября 2026. Это визуальное
развитие опубликованного editorial hero, без изменений API, модели, каталога,
хранилищ и пользовательских сценариев. Реализация и публикация разрешены.

## Аудит и направление

Сохраняем Playfair Display/Golos Text, знак-карту, структуру header/hero/KPI/
workspace/saved/research/data, метаданные и все рабочие ID. Устраняем белые
панели, невидимые entrance-эффекты, ожидание window.load, скрытую мобильную
схему и вторичную CTA с рамкой. Стиль — editorial для предпринимателей,
действующая собственная система + Material Web; плотность рабочих данных прежняя.

## Цвета

Шесть исходных цветов остаются примитивами. --palette-white удалён.
Экранные поверхности --palette-warm #FEF1E3 (Cream/Blush 88/12), более плотный
--palette-paper #F1EDDA (Cream/Sage 84/16), мягкий selected #FCE6DE (64/36).
Sage tint #EAE7D0 (Cream/Sage 76/24). Границы — Midnight Lagoon с opacity .57,
разделители .18; тени — Rosewood Deep .09/.20. Cream используется на тёмных
CTA и карте. Чистый белый допустим только в @media print.

## Движение и состояния

| Элемент | Событие | Движение |
|---|---|---|
| H1 / SplitText | Шрифты готовы, hero виден | 32px вверх, opacity 0→1, 740ms, stagger85ms, один раз |
| Описание / BlurText | После начала заголовка | blur8→0, y14→0, 750ms, delay480ms |
| KPI/workspace/saved/research/data | Первое пересечение viewport | y24→0, opacity0→1, 700ms |
| Основная CTA / Magnet | Fine pointer | До6px, spring170/damping26; мягкий возврат; без touch/keyboard |
| Вторичная CTA | Hover/focus | Линия только под текстом, стрелка3px, цель44px |
| SVG | Видимый hero | Маршрут24s, радиус9s .55–.95, ответ точки900ms один раз |
| SVG слои | Fine pointer над hero | До6px, плавный translate500ms |
| Select trigger/menu | Hover/open | Lift2px, arrow180°, menu y8→0/opacity, метка+галочка |
| Рекомендация | Hover/selection | Lift3px, тень/граница, существующий preview, метка420ms |
| Маркер | Новая выбранная рекомендация | Один pulse480ms; существующий pan |
| Слои | Включение/выключение | Fade220ms; состояние меняется сразу, без расчёта |
| Details | Toggle | Clip-path/opacity360ms, chevron; native details владеет open |

Подготовленное состояние разделов устанавливает только работающий остров.
Без JS/при отказе острова контент виден. Focus-visible завершает вход; pointerdown
приостанавливает геометрию до завершения click (включая touch compatibility events), чтобы кнопка не уходила из-под клика.
Пять блоков анимируются один раз, строки не получают новые эффекты.

SVG имеет доступную кнопку паузы. Вне viewport, при hidden document, print,
reduced motion и размонтировании циклы и pointer-эффекты прекращаются.
Нет typewriter, WebGL, глобального курсора, ScrollTrigger или новых зависимостей.
Загрузка острова начинается из deferred script, без ожидания тайлов/window.load.

## Адаптация и проверка

До600px — горизонтальная SVG-полоса70px под CTA. Hero до560px при обычном
размере текста; при200% естественно растёт, не обрезая текст. Рабочая карта
и рекомендации сохраняют общую desktop-высоту.

Матрица390/768/1024/1440, noJS/failed island/slow fonts/slow load/noObserver,
initial/runtime reduce, keyboard, точность клика при движении, контраст,
расчёт/карта/layers/saved/research/CSV/print. Проверка bundle и источников
воспроизводимая; исходник Magnet закреплён той же upstream-ревизией и SHA256.
