# Приёмка тёмной версии и область просмотра анимации

Пользователь отверг светлый фон и незаметное движение, затем явно согласовал
графит/бирюзу. База7195dbe.

## Доказательства

- Новый dark-motion RED: все три мобильный recommendation entrances были запущены
  на y2324/2604/2883 до просмотра, duration420ms.
- GREEN: до прокрутки trace пуст, после просмотра вход700ms, задержки0/75.
  Содержимое не скрыто в ожидании JS; noObserver резервный режим работает.
- После включение режима уменьшения движения во время работы → no-preference оставшаяся карточка не получает старый
  вход. Два последовательных новых расчёта не анимируют заменённые DOM-узлы.
- печать computed white rgb255/255/255, ink21/25/28; UI scheme dark.
- Decorative мобильный overflow пойман отдельным RED и исправлен геометрией pseudo.
- Ревью нашло выбранный text contrast1.366:1; отдельный RED, исправление foreground,
  GREEN10.83:1. Это единственный production fix после основного браузер прохода.
- Workspace:19групп успешно, pageErrors=[]. Redesign успешно с viewport-aware ожиданием.
-390/768/1440: ширина страницы соответствует область просмотра, карта420/560/660,
  tiles6/12/16 loaded, области нажатия>=44;200% mobile/desktop helpers122/122.
- Проверенный обычный текст8.37–17.50:1, borders4.31:1.
- Настоящий Material Shadow включение режима уменьшения движения во время работы, missing-bundle, хранилище locks,
  errors/refresh, CSV/print, dialog/Escape и сохранения/сравнение пройдены.
- Validator61,8JS syntax и git diff --check PASS. Новых зависимостей/entry changes нет;
  Material сборка не менялся. Сервер не изменялся;51unittest и воспроизводимый
  Material rebuild выполняются CI, дополнительный одинаковый local набор не запускался.
- Три финальных local экрана и кадр во время входа лично просмотрены.
  tests/artifacts/dark-final-{390,768,1440}.png и dark-reveal-mid.png игнорируются Git.

## Проверка реализации

Проверка требований и качества пройдена, включая исправление selection.
Нет нерешённых production/security finding. Queue cleanup/callers проверены.
Дополнительные предложения по queue tests выполнены после проверка; targeted GREEN.
Прежние ограничения старого redesign harness документированы в предыдущей приёмке;
новый dark-motion использует disposable page без оставленного instrumentation.

## Публикация

CI исходной версии39015667858: успешно для1966a1be1cfa314f77d2daf35e2139ff4d368ab7.
Изменения опубликованы в main без переписывания истории. Render автоматически начал
dep-db9im8rm8hqs73ahhjfg с trigger new_commit, тариф не менялся.
CI основной версии39015746356: completed/success. Render live17октября08:02:19 UTC
(11:02:19 Москвы), runtime1966a1be1cfa314f77d2daf35e2139ff4d368ab7.

Публичный краткая проверка: health200/statusok, три реальных рекомендации, два сохранения
и две строки сравнения; pageErrors=[]. начальный reduced-motion: background8/15/24,
резервный режим visible, Material hidden/indeterminatefalse/shadow running0.
390/768/1440: без переполнения, карта420/560/660, tiles6/12/16 loaded.
SHA-256 public tokens.css/base.css/ui.js совпали с Git blobs runtime1966a1b;
vendor/fonts HTTP200 и совпали с прежними проверенными assets.

Новый dark-motion сценарий отдельно пройден на public: offscreen trace[],
видимый entrance700ms, reduce→no-preference безстарого входа, два новых расчёта
без stale entrance, noObserver резервный режим, selectedtext10.83:1 и белая печать.
Три public-dark-{390,768,1440}.png лично просмотрены, desktop-top также сохранён.
Последний документальный коммит использует skip render, без повторной сборки.

## Границы

OSM tone filter применяется только к tiles, data canvas/pins не меняются;
новый провайдер не добавлен. Скриншоты проверены визуально, cartographic labels
не проходили отдельный инструментальный contrast audit. Chrome/native печать CSS
проверены; Firefox/Safari, OS-specific dropdown и PDF pagination не проверялись.
Геоданные/модель/storage v1 и прежние функциональные ограничения сохраняются.
