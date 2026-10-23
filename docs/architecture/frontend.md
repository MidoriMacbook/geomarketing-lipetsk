# Клиентские модули

Раньше весь клиент находился в `static/workspace.js`. Код перенесён
по ответственности, с неизменными DOM-контрактами и браузерными сценариями.
Основные ES-модули приложения не требуют сборщика и не зависят от React.

Исходная точка отдельного vendor-bundle Material Web находится
в `scripts/frontend/material-web-entry.js`, а Rollup создаёт
`static/vendor/material-web/material-components.js`. Основные модули приложения
не импортируют npm-пакеты и продолжают работать без сборки. Подробности и правила
поэтапного внедрения: `docs/design/material-web.md`.

## React Bits island: отдельный слой улучшения

`navigation.js` обслуживает статическую навигацию/фокус/реальный header offset.
`hero-loader.js` независимо и асинхронно загружает локальный
`static/vendor/hero/hero-motion.js` сразу из deferred script, не ожидая window.load; каталог и расчёт этого не ждут.
`scripts/frontend/hero-entry.js` монтирует React effect-controller в пустой
`#hero-motion-root`, не заменяя h1/описание/CTA/SVG. Нет второго React-дерева приложения.

Адаптированные исходники SplitText/BlurText/ScrollReveal/Magnet, точный upstream revision,
SHA256 и лицензия находятся в scripts/frontend/hero/upstream и SOURCES.md рядом
с bundle. SplitText использует GSAP word-splitting с revert, BlurText — Motion mini,
ScrollReveal — пять одноразовых block entrances вместо текстового scrub.
PointerDrift — код приложения с событийным RAF, максимум6px, без постоянного ticker.
Reduced motion/print/visibility/unmount завершают эффекты и восстанавливают стили.
Отсутствие Observer либо сбой bundle оставляют обычный читаемый DOM.

Тексты, hit targets и геометрия доступны до JS; font fallback не меняет перенос
через ch-ширину. React не меняет фактические числа/copy/CSV/печать. `ui.reveal`
пропускает старые row/panel entrances при наличии hero mount, сохраняя отдельные
feedback/disclosure/map/counter эффекты: у крупных блоков только один владелец.

Rollup конфиг разделяет Material и `--configHero`, npm-версии зафиксированы.
`pnpm check:hero` проверяет исходные hashes, byte-reproducible build и≤180KiB gzip;
CI также собирает прежний Material без изменений. Bundle заранее включён в Git:
production Flask/Render не получает новой зависимости от Node.

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
| `static/js/counters.js` | Визуальный count-up, один RAF, viewport, reset/reduce/print cleanup |
| `static/js/choices.js` | Необязательное улучшение select: combobox/listbox, клавиатура, каталог и motion |
| `static/js/scenario-storage.js` | Проверка схемы полного снимка, лимиты, latest-read Web Lock, exact repair |
| `static/js/scenarios.js` | Список/формы/сравнение сценариев, callbacks capture/restore из app |
| `static/js/data-quality.js` | Читаемые причины/даты/возраст архивов и структурированные объяснения |
| `static/js/scenario-report.js` | Отдельные CSV и печать двух сценариев, без общего score |
| `static/js/field-check-storage.js` | Чистое проверяемое хранилище семи пользовательских отметок, отдельная версия/лимиты/locks |
| `static/js/field-checks.js` | Сворачиваемая проверка сохранённого места, статусы записи, безопасная синхронизация вкладок |

Успешный `restoreScenario` сначала восстанавливает снимок и фокус заголовка карты,
затем явно прокручивает `map-card` в поле зрения. Один `focus({preventScroll:true})`
оставлял результат вне экрана, поэтому кнопка казалась неработающей. Прокрутка
использует общий `motionReduced()`: smooth либо instant, без запросов геоданных.
Hover исследований добавлен в существующие правила `states.css`; более позднее
правило `.scenario-card.is-compared` сохраняет inset-выделение сравнения.

Состояние хранится в JS, сохранённые копии — в localStorage. Другие модули
не ведут собственную скрытую копию списка. DOM строится через textContent;
пользовательские строки не интерполируются в HTML.

`geomarketing.scenarios.v1` хранит envelope schema_version1 и до6полных снимков;
это отдельная сущность от сохранённого места. app.captureCurrent фиксирует анализ
до ожидания lock. restoreScenario проверяет каталог и снимок до reset, отменяет
запрос/увеличивает версию, применяет фильтры/порог/слои/ранг и рисует сохранённые
данные без сети. selection.district='custom' — значение меню; analysis.district
сохраняет настоящий API key custom_<lat4>_<lng4>_<radius>, координаты/радиус проверяются.
Late response и catalog auto-run не могут заменить открытый снимок.
Смена фильтров снимает архивный контекст; пересчёт не изменяет сохранённую копию.
Ошибки/quota/version не превращаются в пустой список или успешное сохранение.
Очистка повреждённого ключа требует подтверждения и повторной проверки exact raw.
Storage events синхронизируют список/сравнение; без Web Locks изменения недоступны.
Необязательные quality/explanation старых сохранённых мест проверяются перед
представлением; непригодные сведения нормализуются в памяти как «не оценено»,
не скрывая базовую рекомендацию и не переписывая localStorage при чтении.

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
`scenarios.css` — локальные стили исследований/quality/details/диалогов и печати.
`field-checks.css` — локальная проверка пользователя и доступные checkbox targets.

## Рабочая зона и локальная проверка

На desktop карта и рекомендации занимают общий растягиваемый ряд. Высота
Leaflet определяется flex-контейнером с разумным минимумом и пределом;
ResizeObserver объединяет invalidateSize в RAF, не меняя выбранную точку.
Прежний window resize служит fallback. Раскрытие карточки не делает API-запрос.
Данные и ограничения находятся перед footer, краткое состояние — возле карты.
Переход к деталям открывает native disclosure, учитывает reduce и фокус.
Экранное свёрнутое состояние не ограничивает отдельный печатный DOM.
Контекст текущего расчёта печатается один раз и при0рекомендаций;
каждое сохранённое место в сравнении сохраняет собственные источник и даты.
Статус исследования находится вне условно скрытого раздела. После удаления
и восстановления focus получает доступную карточку/кнопку/заголовок;
при отказе очистки фокус остаётся на доступном действии восстановления.

initDisclosure — общий cancel-safe helper для native details. Hover preview
маркера не меняет selectedRank. Однократный viewport reveal не запускается
повторно от переключения слоя; runtime reduce завершает активные эффекты.

Полные сценарии в UI называются «Исследования». Пустой раздел скрыт,
но первое сохранение вынесено наружу; ошибка хранилища показывает восстановление.
Внутренние ids и scenarios.v1 не переименованы, старые записи открываются без API.

geomarketing.field-checks.v1 хранит envelope schema_version1 и до48 записей
{place_id, checks:[7boolean], updated_at:ISO}, не более65536UTF-16символов.
Это отметки пользователя, а не данные модели/score или фото-хранилище.
Чтение не трогает ключи saved/scenarios и не исправляет сырой JSON автоматически.
Запись проверяет актуальную принадлежность места сохранённым и использует
фиксированный порядок locks saved → field. Удаление очищает только соответствующую
проверку после успешного saved commit; отказ очистки не отменяет уже удалённое место.
Между двумя localStorage-ключами нет crash-atomic commit: orphan безопасно
остаётся без автоматического pruning. Future schema сохраняется для новой версии.
Без Web Locks доступно чтение; quota, отказ storage, повреждение или неподдерживаемая
схема не останавливают карту. Синхронизация обновляет существующие widgets,
сохраняя focus; detached callbacks не перезаписывают новый интерфейс.
Node field-check-storage.test.js и browser field-checks.js проверяют эти границы.

Порядок stylesheet фиксируется в index.html. Leaflet и Unbounded/Golos Text
загружаются локально; отказ шрифта оставляет системный fallback.
Отказ Leaflet не блокирует API. UI primary и функциональный map primary разделены.

## Состояния и движение

Коррекция17октября: `reveal` откладывает вход offscreen-элементов до видимости
через IntersectionObserver; контент при этом не скрывается и доступен без JS motion.
`cancelRevealsWithin` очищает очередь и активные эффекты перед перестроением
рекомендаций и reset. Отсоединённые/hidden элементы удаляются из очереди;
runtime reduced-motion и печать отменяют ожидающие входы. Без Observer эффект
выполняется сразу. Статические настройки/карта/shortlist используют тот же helper.
CSS-палитра теперь тёмная, tile-only filter не затрагивает canvas и геометрию.

`app` вызывает `setAnalysisState`: initial/calculating/refreshing/success/error.
Только актуальный requestVersion изменяет результат и busy. `#map[aria-busy]`,
`#analysis-status` и полоса ожидания согласованы; refresh сохраняет прошлый результат.
Значения KPI/hidden/ARIA обновляются до эффектов.

Числовой эффект изолирован в `counters.js`: `countTo` сразу записывает точный
текст в `.counter-final`; aria-hidden overlay выводит промежуточное число через
CSS generated content. В accessibility tree/копировании остаётся финальный текст.
Один RAF и кешированный Intl formatter обслуживают все видимые счётчики, без
измерений layout в tick. Refresh начинается от текущего визуального значения,
reset удаляет history. Observer откладывает вход до viewport; reduce/print/hidden
завершают счётчики сразу. Перед заменой карточек/фильтра вызывается resetCounters.

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
`catalog-matrix.js` — все 100 сочетаний; `palette.js` — чтение токенов и canvas.
`catalog-expansion.js` — новые области/типы, точные KPI, сценарии, отчёты и меню.
Снимки и выгрузки браузерных проверок игнорируются Git.

Сценарии проверяются отдельно: scenarios-ui.js — CRUD/quality/export/repair;
scenarios.js — реальный custom API, восстановление/late request/catalog/две вкладки;
scenarios-mobile.js — actual touch, две категории с разными радиусами, viewport/200%/motion.
Node built-in runner проверяет scenario-storage.test.js без DOM/сети.

`redesign.js` проверяет новые состояния/motion, живой Material progress,
runtime reduced-motion, fallback без bundle, контраст, targets, 200% текста,
print и три финальных снимка. `material-web.js` — точечная проверка upgraded DOM.
В этой итерации итоговый QA объединяет workspace+redesign; исторические матрицы
без нового основания повторно не запускаются.

`dark-motion.js` сохраняет историческое имя, проверяя текущую кремовую палитру,
отсутствие per-row entrances, reduced motion, noObserver и светлую печать.
`hero-island.js` доказывает реальные word/blur эффекты, identity/text/geometry,
delay/failure/noJS/noObserver, pointer reset, reduce/print и отдельный/полный CLS.
`editorial-navigation.js` добавляет sticky/menu/anchor/focus/noJS/short200%;
`editorial-style.js` — семантическую палитру, шрифт, AA,8width/scale состояний.

## Motion polish — 23 октября 2026

CityMotion управляет только CSS-классами SVG и кнопкой паузы. Магнит использует
адаптированные reach/maxOffset/spring из React Bits на существующей ссылке,
без React-обёртки вокруг приложения. Предел6px, RAF прекращается в покое.
ScrollReveal готовит пять блоков классом motion-prepared; finish/cleanup
снимают opacity/transform. Pointerdown удерживает геометрию до завершения click (включая touch compatibility events),
чтобы focus не перемещал кнопку между down/up. Keyboard focus завершает вход.
Нативный details остаётся источником состояния; clip-path360ms не измеряет
и не анимирует layout-height. Повторное действие отменяет предыдущее через revision.

Отдельный warm-motion.js проверяет четырёхширинную матрицу, отсутствие белых
поверхностей, mobile SVG/560px, pause/Magnet/reduce/print и запуск до window.load.
