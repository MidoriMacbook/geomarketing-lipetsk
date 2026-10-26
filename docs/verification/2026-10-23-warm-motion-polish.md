# Проверка тёплой палитры и анимации — 23 октября 2026

База: main 2f52942429eefc8aeceb0ca24f218bd18d0e884a.
Спецификация: docs/specs/2026-10-23-warm-motion-polish.md.

## Реализовано

Удалён --palette-white и его экранные ссылки. Карточки #FEF1E3, вторичные
поверхности #F1EDDA, выбранный #FCE6DE, notice #EAE7D0; текст на CTA/карте Cream.
Границы Midnight Lagoon .57/.18, тени Rosewood Deep .09/.20. UA-белый фон
range заменён transparent. #FFFFFF остаётся только в @media print.

SplitText32px/740ms/stagger85ms, BlurText8px/14px/750ms/delay480ms;
ScrollReveal24px/700ms для пяти блоков. Ранний import без load/idle. SVG имеет
route24s/radius9s, однократный pin response и pause. мобильный SVG70px сохранён.
Magnet адаптирован из той же закреплённой React Bits ревизии, без новых deps.

## Исправления по фактическим сбоям

- RED: при первом клике на мобильную рекомендацию фокус завершал entrance,
  control сдвигался, click приходил на ARTICLE вместо BUTTON, выбранный ранг
  оставался1. Исправление удерживает геометрию через down/up/click.
- RED: касания без WAAPI/ResizeObserver отправлял pointerdown/up на SUMMARY,
  затем фокус завершал движение, click попадал на ARTICLE. GREEN: все события
  приходят на SUMMARY, details.open=true. Hold учитывает compatibility events
  после pointerup, освобождается после click; fallback500ms и cancel/teardown.
- Клавиатурный фокус завершает вход сразу. Раскрытие использует clip-path и версия,
  быстрые повторные действия/print/reduce не оставляют inert/обрезку.

## Выполненные проверки

- Python unittest:84/84. Node хранилище:75/75. Validator:78 файлов, DOM/import DAG.
- Deterministic первый экран build и исходный проект hashes: PASS. Before312337raw/103506gzip,
  after316045raw/104413gzip bytes (+3708raw/+907gzip, +0.88% gzip).
- warm-motion:390/768/1024/1440, no overflow, white=[], CTA44px/без рамки,
  мобильный schematic, pause, Magnet≤6px/reset/keyboard, reduce/print, early отдельный модуль
  при удержанном window.load. pageErrors[].
- первый экран heights390/768/1024/1440:505.875/490.90625/505.015625/484.5px.
- workspace: успешно (расчёт, холст reuse, хранилище, CSV/print, race/error/fallback).
- field-checks: успешно (persisted обратная связь, keyboard/touch, cross-tab, quota,
  corrupt/recovery/legacy, CSV/print и отсутствие изменения модели).
- workspace-interactions: успешно после исправления касания; trust/error/archive,
  rapid/keyboard/dynamic раскрывающиеся блоки, предварительное выделение, resize резервный режим, reduce, print.
- Ранние style/hero-island/header-anchor/header-focus/choice-menus/scenarios-ui
  также успешно; финальная профильная матрица также успешно: editorial-style, hero-island,
  header-anchor, header-focus, hero-font-fallback (19 вариантов),
  research-open-motion и warm-motion.

## Границы

Chrome настольный и mobile/touch emulation. Физические телефоны, другие движки,
нативная PDF-пагинация и серверная нагрузка отдельно не проверялись.
API/Flask/математика/каталог/форматы localStorage не изменены.

## Публикация

Версия приложения f1b0b7859e3735024920da60460c1fe4edafa52a в main.
CI исходной версии40014554183 и CI основной версии40014779563: успешно для точного SHA.
Render dep-dbdrlp8473hc73beq8ug: live с 23 октября22:53:28 Москва,
trigger new_commit. Никаких новых ресурсов или изменений сервера.
Публичные40 ресурсов совпадают с Git по SHA256; healthz={"status":"ok"}.
App error/critical logs с начала deploy пусты.


Публичные warm-motion, hero-island, workspace и research-open-motion: PASS.
Подтверждены карта/расчёт/layers/saved/CSV/print/архив, mobile/touch/keyboard,
noJS/failure/noObserver/slow load, включение режима уменьшения движения во время работы. pageErrors[].
Public отдельный модуль CLS0; начальный CLS0.001164111267843364.
Локальный проверка Python4088/30260 остановлен; CLI браузер закрывается после аудита.
Аудит документации публикуется с [skip render], версия приложения остаётся f1b0b78.
