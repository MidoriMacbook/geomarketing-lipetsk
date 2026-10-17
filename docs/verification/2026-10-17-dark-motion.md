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

После CI — main/Render, actual public fingerprints и smoke; фактические
идентификаторы и результаты будут внесены после развёртывания.

## Границы

OSM tone filter применяется только к tiles, data canvas/pins не меняются;
новый провайдер не добавлен. Скриншоты проверены визуально, cartographic labels
не проходили отдельный инструментальный contrast audit. Chrome/native print CSS
проверены; Firefox/Safari, OS-specific dropdown и PDF pagination не проверялись.
Геоданные/модель/storage v1 и прежние функциональные ограничения сохраняются.
