# Мобильный интерфейс · 17 ноября 2026

Ветка redesign. Расчёт, API и формат сохранённых данных не менялись. Основная обложка на ПК и палитра A сохранены. Физического iPhone на проверке не было.

## Исправления и границы проверки

| Пункт | Результат | Проверка |
|---|---|---|
| 0. Диагностика | Сделано: `/?debug=1`, noindex, размеры, safe area, шрифты, геометрия карты, копирование | Chromium и WebKit; Safari/Telegram на устройстве не проверены |
| 1. Пустота | Убран margin-bottom внутри карточки карты. Резерв учитывает активность панели и ResizeObserver; при скрытии равен нулю | Chromium и WebKit: peek, раскрытие, закрытие, источники, изменение высоты и поворот. Между карточкой карты и следующим блоком 16 px |
| 2. Шапка | Вторичная подпись скрыта на телефоне; знак, бренд и меню помещаются; касания от 44 px | 320–430 px, текст 200%, CTA на первом экране 375×667 |
| 3. Шрифт | Playfair Display Italic для «Маркетинг», насыщенный Rosewood; запасной Golos Fallback с корректировкой метрик | Chromium и WebKit. Блокировка шрифтов: CLS Chromium 0,00186 |
| 4. Меню | Открытие 240 мс, закрытие 190 мс; начальный кадр 0/−8 px; двойной RAF; закрытие после перехода; reduced-motion только fade | Chromium и WebKit: повторные нажатия, ссылки, Esc, крестик, подложка, обработчик свайпа, фокус |
| 4. Частота кадров | Частично: Chromium 46 промежуточных кадров открытия и 44 закрытия; Windows WebKit — 4 и 2 | Требование десяти промежуточных значений в WebKit не достигнуто. Запись оставлена без интерполяции; плавность на iPhone не подтверждена |
| 5. Регрессия | Полные наборы и текущие метрики находятся рядом с отчётом | CI проверяется по последней версии ветки; не следует считать старый красный запуск успешным |
| 6. Снимки | До/после на 320×667, 375×667, 390×844 | Обложка, переход к карте, конец карты, диагностический экран |

Причина пустоты: `--results-inset` раньше оставался 128 px после исчезновения полосы и вырастал до 587–743 px при раскрытии. Он использовался как нижний margin источников внутри карты. Теперь резерв нужен для доступности последних действий и прокрутки, а не для пустого блока внутри карты. Раскрытый список закрывается обратно в peek; полоса исчезает при уходе от карты.

Причина резкого меню: прежняя анимация меняла opacity только с 0,96 до 1, а `dialog.close()` выполнялся сразу. Теперь начальное положение действительно отрисовывается, а повторное действие отменяет незавершённый переход.

## Снимки

Все ссылки ведут в GitHub. В имени `gap` — весь видимый участок от конца карты к следующему содержательному блоку.

| Ширина | Обложка до / после | Под картой до / после |
|---|---|---|
| 320 | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/before-webkit-320-cover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/after-webkit-320-cover.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/before-webkit-320-gap.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/after-webkit-320-gap.png) |
| 375 | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/before-webkit-375-cover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/after-webkit-375-cover.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/before-webkit-375-gap.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/after-webkit-375-gap.png) |
| 390 | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/before-webkit-390-cover.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/after-webkit-390-cover.png) | [до](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/before-webkit-390-gap.png) / [после](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/after-webkit-390-gap.png) |

[Все PNG Chromium и WebKit, геометрия JSON](https://github.com/MidoriMacbook/geomarketing-lipetsk/tree/redesign/docs/verification/iphone-layout). [Кадры Chromium](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/menu-chromium.md), [график](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/menu-chromium.svg), [кадры WebKit](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/menu-webkit.md), [график](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/menu-webkit.svg).

## Метрики и предыдущие сценарии

Lighthouse 13.6.0 mobile на Render, CPU ×4, пять прогонов 17.11.2026. Сервер предварительно ответил на запрос. Это лабораторные измерения прогретого сайта.

| Прогон | LCP, мс | CLS | TBT, мс | Performance | Accessibility | Передано, байт |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 1308 | 0,004573 | 82,5 | 99 | 100 | 701085 |
| 2 | 1458 | 0,000026 | 140 | 98 | 100 | 701108 |
| 3 | 1443 | 0,004598 | 133,5 | 98 | 100 | 701134 |
| 4 | 1436 | 0,000026 | 116 | 99 | 100 | 700907 |
| 5 | 1366 | 0,000026 | 202 | 96 | 100 | 700835 |
| Медиана | 1436 | 0,000026 | 133,5 | 98 | 100 | 701085 |

[Пять полных отчётов и сводка](https://github.com/MidoriMacbook/geomarketing-lipetsk/tree/redesign/docs/verification/iphone-layout/metrics/lighthouse). Все пять CLS меньше 0,05. [Реальный путь на Render, 375/390 px](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/metrics/render-journey.json): сохранение двух мест, сравнение, возврат к карте; переполнения страницы нет.

На 1500 синтетических домах с CPU ×4 медиана интервала кадра — 16,9 мс (375 px), 18,5 мс (1440 px); p95 — 25,1 и 24,7 мс. Медиана обработки выбора — 3,4 и 3,8 мс. Это измерение Chromium на локальном стенде, не физического телефона. [Исходные результаты](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/metrics/performance/metrics.json).

Контраст 24 проверенных сочетаний реальных элементов — 5,58–10,90:1. Проверены шапка, меню, настройки, действия, источники; это не утверждение о каждом пикселе карты. [Расчёты](https://github.com/MidoriMacbook/geomarketing-lipetsk/blob/redesign/docs/verification/iphone-layout/metrics/contrast.json).

Первый ответ Render после нескольких часов без запросов с этого стенда: TTFB 47,537 с, всего 47,542 с, HTTP 200. Повторный запрос: 0,244/0,245 с, HTTP 200. Вероятен холодный старт; серверный журнал остановки/пробуждения недоступен, поэтому причина не доказана.

Выпадающие списки, исследования, слои, заголовок, карта → сохранение → сравнение → возврат включены в оба smoke-набора. Два прежних дефекта тестового стенда WebKit устранены: ожидание `fonts.ready` при заблокированных скриптах и неподдерживаемый mobile mouse.wheel. Перетаскивание в Chromium проверяется через CDP touch; WebKit использует доверенный mouse pointer. Свайп меню дополнительно проверяет обработчик событий. Это не заменяет физическое касание.

Палитры B/C и набор значков в этом этапе не изменялись; новый полный визуальный аудит этих вариантов не проводился. [CI ветки](https://github.com/MidoriMacbook/geomarketing-lipetsk/actions?query=branch%3Aredesign).

## Проверка на iPhone

1. В Safari и затем в Telegram открыть адрес preview с `/?debug=1`: `https://geomarketing-lipetsk-redesign.onrender.com/?debug=1`. Дождаться загрузки шрифтов, нажать «Обновить», сделать обычный снимок экрана. «Копировать» сохраняет полный JSON для передачи.
2. Нажать «Скрыть», перейти к карте, раскрыть результаты, затем открыть кнопку «Диагностика» и обновить. Повторить после закрытия результатов и поворота телефона.
3. Открыть/закрыть меню несколько раз быстро; проверить крестик, подложку, свайп вверх и переход к карте. Страница должна вернуться к прежней позиции.
4. Медленно и быстро прокрутить через карту в обе стороны. Полоса не раскрывается сама; после ухода от карты исчезает, пустой промежуток не остаётся. Проверить при скрытии адресной строки.
5. Выбрать место, открыть «О месте», сохранить два варианта, сравнить и вернуться на карту. Увеличить текст в настройках телефона: проверить шапку и доступность кнопок.

## Файлы

[Изменения этапа](https://github.com/MidoriMacbook/geomarketing-lipetsk/compare/2333eef56845bf61c47c4ef3d50701615e8cf986...redesign): CSS atlas/base/palette/tokens, opt-in mobile-debug, result-sheet, navigation, index.html, целевые smoke-тесты, конфигурация двух браузеров CI и воспроизводимые скрипты измерений.

Отчёт разведки категорий `docs/research/categories.md` принят как контекст следующего этапа. Он не является разрешением добавлять категории: ноябрьская рабочая выгрузка и октябрьские снимки имеют разные ограничения, R и α остаются эвристиками.
