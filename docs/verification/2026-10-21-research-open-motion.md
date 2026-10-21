# Исследования: открытие на карте и hover

Опубликовано 21 октября 2026 в main и существующем Render.
Runtime: `11a6faf6ed6bbe1058b02fae8beda80d6705ddf5`.

## Причина и исправление

«Открыть» успешно восстанавливала снимок и фокусировала заголовок карты с
`preventScroll:true`. Прокрутки не было: при воспроизведении map-title находился
на top=-1523px, хотя analysis/rank/business и архивное уведомление уже обновились.
Пользователь оставался в разделе исследований и не видел результат нажатия.

После успешного восстановления map-card явно прокручивается в поле зрения:
smooth в обычном режиме, instant через существующий motionReduced() при reduce.
Фокус остаётся у map-title; подпись кнопки — «Открыть на карте». Схема хранения,
данные снимка, модель и запросы не меняются. Ошибка каталога по-прежнему
не заменяет текущую карту и не запускает переход.

Карточки исследований отсутствовали в существующих правилах hover/transition.
Они добавлены в тот же набор селекторов, что saved-card: подъём на 3px,
подсветка границы и тень только для fine pointer с hover. Reduced motion
отключает подъём/переходы, touch не получает hover-перемещения. Более поздний
scenario-card.is-compared сохраняет inset-выделение сравнения.

## Проверка

- RED research-open-motion: успешное восстановление с map-title вне экрана.
  После исправления — GREEN. Отдельный RED подтвердил отсутствие hover-подъёма;
  добавление CSS-селекторов дало GREEN.
- Новый tests/browser/research-open-motion.js: 1440/reduce с клавиатурой,
  1440/normal с мышью, 390/reduce и 390/normal с мобильным касанием.
  Проверяются восстановленные analysis/rank/category, фокус, видимый заголовок,
  отсутствие новых calculate и изменения localStorage, hover/compare/runtime reduce.
  Все четыре режима прошли локально и на Render, pageErrors: [].
- Локальная интеграция: scenarios-ui (17 групп), scenarios (11 групп),
  scenarios-mobile, workspace-interactions — GREEN. Сохранены восстановление
  custom area, late response, two-tab sync, CSV, печать, focus, recovery и fallback.
- Мобильные размеры 360/390/768/1440 и 390/200%: без horizontal overflow,
  targets ≥44px, подписи кнопок не обрезаны; актуальный screenshot просмотрен.
- Локальный Node scenario-storage: 62/62. Validator: 73 файла. Syntax checks
  обоих изменённых модулей и нового browser suite, diff check — PASS; stub scan
  изменённых production-модулей без совпадений.
- Независимое focused code-review `44c4f04..11a6faf`: PASS, замечаний нет.
  Мобильный normal-режим дополнительно проверен root после ревью.
- Source CI [39659628732](https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/39659628732): Success, 48s.
- Main CI [39659829541](https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/39659829541): Success, 47s; полный SHA совпадает.
- Render `dep-dbcgtvpsrm7s73d01irg`: live 21 октября 22:15:23 Москва,
  trigger new_commit. Повторный ручной deploy не запускался.
- Public /healthz: 200, status ok. SHA256 всех 28 runtime-ресурсов совпал
  с Git source SHA. App error/critical с начала deploy: отсутствуют.
- Тестовые browser contexts закрыты. Собственный временный сервер остановлен
  после проверки PID/command line/parent/executable; порт 5085 свободен.

Итоговый аудит и расширение только browser-покрытия используют [skip render],
чтобы не пересобирать неизменный runtime. Существующие platform notices Actions
о Node20 wrappers/Ubuntu migration не являются падениями CI.

## Границы

Приёмка выполнена в Chrome, мобильные проверки — touch emulation.
Другие движки, физические устройства и native PDF pagination не проверялись.
Полнота OSM и коммерческая пригодность места этим исправлением не оцениваются.
