# Визуальная полировка redesign

Расчёт, серверные маршруты и API не изменены. Тёплая палитра, локальные шрифты и естественная прокрутка сохранены. Отдельный коммит на каждый пункт; дополнительная мобильная панель зафиксирована отдельно.

## Изменения

1. **Выделение:** Rosewood 23%, тёмный текст; line-height заголовка 0,96 и зазоры между строками. Контраст выделенного текста на Cream — 8,39:1. Название копируется без разрыва между «Гео» и «Маркетинг».
2. **Схема:** три прямые SVG-аннотации, две на телефоне, непрозрачный Cream, последовательное появление; регион перенесён в строку координат.
3. **Показатели:** знак ≈ перед числом, табличные цифры, одинаковые рамки и отступы; подъём и движение стрелки только при наличии hover. При повторе счётчика знак ≈ больше не пропадает.
4. **Курсив:** Playfair Display Italic от 900 px; схема опущена после найденного пересечения на 1280 px. Проверены также 1440 и 1920 px.
5. **Общее оформление:** одинаковый фокус для summary, textarea и кнопок, читаемое выделение на залитых кнопках, единые пустые состояния и skeleton, неразрывные пробелы у единиц. Исправлен перенос координат при увеличении шрифта вдвое.
6. **Мобильная панель:** автоматический half после расчёта заменён на peek 72 px. Видимость зависит от IntersectionObserver с порогами 20/40%, раскрытие — только от пользователя. Фон заблокирован в half/full, карта сохраняет высоту, слои расположены одной строкой.

## Снимки до / после

Одинаковые ширины и данные локального smoke-сервера. Внешние тайлы отключены в обеих версиях; предупреждение о подложке на этих снимках ожидаемо. Снимки фиксируют состояние соответствующего пункта, а не все последующие изменения одновременно.

| Пункт | 375 px | 768 px | 1440 px | 1920 px |
|---|---|---|---|---|
| Выделение Ctrl+A | [до](01/before-375.png) / [после](01/after-375.png) | [до](01/before-768.png) / [после](01/after-768.png) | [до](01/before-1440.png) / [после](01/after-1440.png) | [до](01/before-1920.png) / [после](01/after-1920.png) |
| SVG-аннотации | [до](02/before-375.png) / [после](02/after-375.png) | [до](02/before-768.png) / [после](02/after-768.png) | [до](02/before-1440.png) / [после](02/after-1440.png) | [до](02/before-1920.png) / [после](02/after-1920.png) |
| Показатели | [до](03/before-375.png) / [после](03/after-375.png) | [до](03/before-768.png) / [после](03/after-768.png) | [до](03/before-1440.png) / [после](03/after-1440.png) | [до](03/before-1920.png) / [после](03/after-1920.png) |
| Курсив | [до](04/before-375.png) / [после](04/after-375.png) | [до](04/before-768.png) / [после](04/after-768.png) | [до](04/before-1440.png) / [после](04/after-1440.png) | [до](04/before-1920.png) / [после](04/after-1920.png) |
| Пустые сохранения | [до](05/before-375.png) / [после](05/after-375.png) | [до](05/before-768.png) / [после](05/after-768.png) | [до](05/before-1440.png) / [после](05/after-1440.png) | [до](05/before-1920.png) / [после](05/after-1920.png) |

- [Курсив на 1280 px: до](04/before-1280.png) / [после](04/after-1280.png).
- [Загрузка, ошибка, отсутствие данных на четырёх ширинах](05/README.md).
- [Причина раскрытия панели, временные кадры и чек-лист телефона](06/README.md).

## Проверка и ограничения

95 модульных JS-тестов и валидатор структуры прошли. Проверены сценарии выбора области и бизнеса, расчёта, карты, сохранения, сравнения и исследования; все 33 smoke-сценария прошли перед публикацией. Есть регрессии для выделения, аннотаций, сохранения префикса счётчика, курсива и поведения панели.

Локальный CLS при проходе через карту: 0,000548 → 0. Карта на 375 × 667: 346,83 → 386,86 px (58% высоты). Двадцать проходов через карту не изменили состояние peek. Проверены гистерезис, touch-жест, Esc/стрелки, пин и уменьшение движения.

Навигация к сохранённым местам уже раскрывала раздел корректно — лишних изменений её обработчика нет. Основные ссылки, отступы, вторичные кнопки и тени уже используют общие токены; сохранены.

Остаётся проверка инерции и динамической адресной строки на физических iPhone Safari и Android Chrome — эмуляция её не заменяет. Детальный чек-лист из пяти действий находится в пункте 6.

## Файлы

[Все тексты интерфейса одним Markdown](../../interface-texts.md).

Raw-ссылки на изменённые файлы приложения:

- [static/css/atlas.css](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/css/atlas.css)
- [static/css/base.css](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/css/base.css)
- [static/css/components.css](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/css/components.css)
- [static/css/tokens.css](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/css/tokens.css)
- [static/index.html](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/index.html)
- [static/js/app.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/app.js)
- [static/js/atlas-interactions.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/atlas-interactions.js)
- [static/js/counters.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/counters.js)
- [static/js/map.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/map.js)
- [static/js/recommendation-brief.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/recommendation-brief.js)
- [static/js/recommendations.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/recommendations.js)
- [static/js/report.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/report.js)
- [static/js/result-format.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/result-format.js)
- [static/js/scenario-report.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/scenario-report.js)
- [static/js/ui.js](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/redesign/static/js/ui.js)
