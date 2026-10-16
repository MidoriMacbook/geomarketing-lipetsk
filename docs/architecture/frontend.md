# Клиентские модули

Раньше весь клиент находился в `static/workspace.js`. Код перенесён
по ответственности, с неизменными DOM-контрактами и браузерными сценариями.
Основные ES-модули браузера не требуют сборщика или npm-зависимостей.

Исключение — изолированный vendor-bundle Material Web. Его исходная точка
находится в `scripts/frontend/material-web-entry.js`, а Rollup создаёт
`static/vendor/material-web/material-components.js`. Основные модули приложения
не импортируют npm-пакеты и продолжают работать без сборки. Подробности и правила
поэтапного внедрения: `docs/design/material-web.md`.

| Модуль | Ответственность |
| --- | --- |
| `static/js/app.js` | Bootstrap, события фильтров, согласование API и представлений |
| `static/js/api.js` | Запросы, таймауты, AbortController и ошибки загрузки |
| `static/js/state.js` | Единственный объект состояния: каталог, текущий анализ, версия запроса, список и сравнение |
| `static/js/map.js` | Leaflet, тайлы, retry, слои, preview, маркеры, два общих canvas |
| `static/js/recommendations.js` | Карточки, выбранный ранг, KPI и связь с маркерами |
| `static/js/saved-places.js` | Проверка старых записей, latest-read под Web Lock, storage sync, лимиты и сравнение |
| `static/js/report.js` | CSV с защитой формул и печатный DOM-отчёт |
| `static/js/ui.js` | DOM-утилиты, форматирование, cancel-safe motion, progress и native dialog |

Состояние хранится в JS, сохранённые копии — в localStorage. Другие модули
не ведут собственную скрытую копию списка. DOM строится через textContent;
пользовательские строки не интерполируются в HTML.

## Поток взаимодействия

`app` загружает каталог, запускает расчёт, проверяет актуальность ответа,
обновляет state, карту, карточки и KPI. Смена фильтра отменяет предыдущий запрос
и очищает устаревший анализ. Обновление тех же фильтров сохраняет предыдущий
успешный результат до нового успеха; при отказе он остаётся доступным.

Карточка и маркер выбирают один rank. Слой рекомендаций остаётся видимым
при выключении домов, конкурентов, центроидов или зон. Сохранение фиксирует
копию анализа до ожидания Web Lock и согласует изменения между вкладками.
Сравнение выводит абсолютные показатели и контекст; общий рейтинг по score
для разных анализов не создаётся.

## CSS

`tokens.css` — значения; `base.css` — общие элементы; `layout.css` — композиция;
`components.css` — формы/карточки/KPI/таблицы/диалог/печать;
`map.css` — Leaflet; `states.css` — состояние и обратная связь;
`responsive.css` — адаптация 360–1440 px и reduced-motion.

Порядок stylesheet фиксируется в index.html. Leaflet и Unbounded/Golos Text
загружаются локально; отказ шрифта оставляет системный fallback.
Отказ Leaflet не блокирует API. UI primary и функциональный map primary разделены.

## Состояния и движение

`app` вызывает `setAnalysisState`: initial/calculating/refreshing/success/error.
Только актуальный requestVersion изменяет результат и busy. `#map[aria-busy]`,
`#analysis-status` и полоса ожидания согласованы; refresh сохраняет прошлый результат.
Значения KPI/hidden/ARIA обновляются до эффектов.

`ui.animateUI` хранит WAAPI по элементу, отменяет предыдущий эффект,
обрабатывает обе ветки finished и выполняет cleanup. Идентификаторы `gm:*`
описывают цель. Motion-токены читаются один раз; палитра карты — на перерисовку.
Leaflet transform сохраняется: opacity pane и transform только внутреннего pin.
Сохраняются два общих canvas, нет анимации каждой точки или ячейки.

`recommendations` сравнивает analysis_id для stagger; selection не перезапускает
появление результатов. `saved-places` добавляет feedback после записи под Web Lock
и FLIP соседей при изменении списка. Копии для выхода inert/aria-hidden,
без id/testid/data-контрактов, удаляются при finish/cancel/print. Native dialog
закрывается сразу и возвращает focus независимо от выхода копии.

Runtime reduced-motion отменяет эффекты; статический fallback заменяет Material.
Отложенное Lit обновление защищено revision. Отказ vendor не блокирует bootstrap.
Матрица эффектов и токены — `docs/design/design-system.md`.

Проверки: `smoke.js` — основные сценарии и отказ тайлов/API;
`workspace.js` — полный пользовательский сценарий, гонки и хранилище;
`responsive.js` — шесть ширин, старые записи, клавиатура и print CSS;
`catalog-matrix.js` — все 15 сочетаний; `palette.js` — чтение токенов и canvas.
Снимки и выгрузки браузерных проверок игнорируются Git.

`redesign.js` проверяет новые состояния/motion, живой Material progress,
runtime reduced-motion, fallback без bundle, контраст, targets, 200% текста,
print и три финальных снимка. `material-web.js` — точечная проверка upgraded DOM.
В этой итерации итоговый QA объединяет workspace+redesign; исторические матрицы
без нового основания повторно не запускаются.
