# Приёмка тёмной версии и viewport motion

Пользователь отверг светлый фон и незаметное движение, затем явно согласовал
графит/бирюзу. База7195dbe, ветка codex/dark-motion-redesign.

## Доказательства

- Новый dark-motion RED: все три mobile recommendation entrances были запущены
  на y2324/2604/2883 до просмотра, duration420ms.
- GREEN: до прокрутки trace пуст, после просмотра вход700ms, задержки0/75.
  Содержимое не скрыто в ожидании JS; noObserver fallback работает.
- После runtime reduce → no-preference оставшаяся карточка не получает старый
  вход. Два последовательных новых расчёта не анимируют заменённые DOM-узлы.
- Print computed white rgb255/255/255, ink21/25/28; UI scheme dark.
- Decorative mobile overflow пойман отдельным RED и исправлен геометрией pseudo.
- Ревью нашло selected text contrast1.366:1; отдельный RED, исправление foreground,
  GREEN10.83:1. Это единственный production fix после основного browser прохода.
- Workspace:19групп PASS, pageErrors=[]. Redesign PASS с viewport-aware ожиданием.
-390/768/1440: page width соответствует viewport, карта420/560/660,
  tiles6/12/16 loaded, targets>=44;200% mobile/desktop helpers122/122.
- Проверенный обычный текст8.37–17.50:1, borders4.31:1.
- Настоящий Material Shadow runtime reduced-motion, missing-bundle, storage locks,
  errors/refresh, CSV/print, dialog/Escape и сохранения/сравнение пройдены.
- Validator61,8JS syntax и git diff --check PASS. Новых зависимостей/entry changes нет;
  Material bundle не менялся. Сервер не изменялся;51unittest и воспроизводимый
  Material rebuild выполняются CI, дополнительный одинаковый local набор не запускался.
- Три финальных local экрана и кадр во время входа лично просмотрены.
  tests/artifacts/dark-final-{390,768,1440}.png и dark-reveal-mid.png игнорируются Git.

## Независимое ревью

gpt-6-astra: Spec PASS / Quality APPROVED, включая исправление selection.
Нет нерешённых production/security finding. Queue cleanup/callers проверены.
Дополнительные предложения по queue tests выполнены после ревью; targeted GREEN.
Прежние ограничения старого redesign harness документированы в предыдущей приёмке;
новый dark-motion использует disposable page без оставленного instrumentation.

## Публикация

Source CI39015667858: success для1966a1be1cfa314f77d2daf35e2139ff4d368ab7.
Ветка объединена fast-forward в main. Render автоматически начал
dep-db9im8rm8hqs73ahhjfg с trigger new_commit, тариф не менялся.
Main CI39015746356: completed/success. Render live17октября08:02:19 UTC
(11:02:19 Москвы), runtime1966a1be1cfa314f77d2daf35e2139ff4d368ab7.

Публичный smoke: health200/statusok, три реальных рекомендации, два сохранения
и две строки сравнения; pageErrors=[]. Initial reduced-motion: background8/15/24,
fallback visible, Material hidden/indeterminatefalse/shadow running0.
390/768/1440: безoverflow, карта420/560/660, tiles6/12/16 loaded.
SHA-256 public tokens.css/base.css/ui.js совпали с Git blobs runtime1966a1b;
vendor/fonts HTTP200 и совпали с прежними проверенными assets.

Новый dark-motion сценарий отдельно пройден на public: offscreen trace[],
видимый entrance700ms, reduce→no-preference безстарого входа, два новых расчёта
без stale entrance, noObserver fallback, selectedtext10.83:1 и белая печать.
Три public-dark-{390,768,1440}.png лично просмотрены, desktop-top также сохранён.
Последний документальный коммит использует skip render, без повторной сборки.

## Границы

OSM tone filter применяется только к tiles, data canvas/pins не меняются;
новый провайдер не добавлен. Скриншоты проверены визуально, cartographic labels
не проходили отдельный инструментальный contrast audit. Chrome/native print CSS
проверены; Firefox/Safari, OS-specific dropdown и PDF pagination не проверялись.
Геоданные/модель/storage v1 и прежние функциональные ограничения сохраняются.
