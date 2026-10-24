# Проверка touch motion polish — 24 октября 2026

## Объём
Навигация, KPI replay, состояния интерфейса, локальный Onest и конечный motion
схемы. Сервер/API/модель/структуры хранилищ и экспорт не менялись.

## Локальные результаты
- Python unittest:84/84. Node storage:75/75.
- Structural validator:79 файлов, assets/import DAG/DOM ids/palette PASS.
- Hero reproducible build:315624 raw /104243 gzip bytes; source hashes PASS.
- Browser:header-anchor, header-focus, choice-menus, hero-font-fallback,
  workspace, workspace-interactions, research-open-motion, warm-motion, hero-island PASS.
- Финальные touch-motion/editorial-style/scenarios-ui PASS:4 ширины×100/200%,
  selected/hint/map text contrast5.03–10.90:1; сценарии save/edit/duplicate/compare/CSV/print/open.
- field-checks full suite PASS:проверка сохранений/ошибок/вкладок/CSV/печати.
  В первом объединённом запуске был один непройденный uncheck после движения;
  отдельно suite прошёл. Инструментированное воспроизведение с pointer/focus/click
  и8 повторов прошло, источник единичного сбоя не установлен. Код хранилища и
  checkbox-обработчика не менялся; результат не скрыт повтором теста.
- Новый touch-motion:390/768/1024/1440 — меню400/300ms, inert/Escape/outside,
  scroll после закрытия, кремовый фон, touch/click/Enter/Space,8 быстрых повторов,
  точный текст и state неизменны, reduced tint-only, no overflow/no pageerrors.
- Hero высота:456.27 /430 /477.52 /484.5px. Onest применяется на всех ширинах.
- В тесте KPI ожидание завершения увеличено с750 до1000ms: тональная заливка
  снимается на620ms и имеет отдельный переход180ms. Изменение не маскирует
  зависшую анимацию: проверяются отсутствие effects и is-counting/is-replaying.
- В reduced CSS исключён indicator из transform:none: он должен сразу оказаться
  в финальной позиции. Иконка меню также сохраняет геометрию трёх линий/креста.

## Ограничения
Проверки выполняются в Chrome с desktop/touch emulation; физических устройств
и других браузерных движков в этом прогоне нет. Native печатная пагинация и
нагрузочное тестирование сервера не входят в визуальный этап.

## Публикация
Опубликовано: runtime `a251cb107510f8a77eee3b4367537475650522eb` (основной
пакет `9a272f74a7171cf4c54fed26babf7223bfddf82b`, затем CSS hover220ms).
Render `dep-dbe98h3bc2fs738043pg`: live24октября2026,14:21:05МСК.
https://geomarketing-lipetsk.onrender.com/

CI основного пакета и финальной CSS-правки success:
- https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/40070915547
- https://github.com/MidoriMacbook/geomarketing-lipetsk/actions/runs/40089443798

На публичном9a272f7 прошли touch-motion/workspace/scenarios-ui, включая
четыре ширины, реальные касания/клавиатуру, сохранения, CSV/печать, сравнение.
После CSS-only измененияa251cb1 отдельно подтверждены интерполяция hover220ms,
конечный offset−1px и отсутствие движения при reduce. SHA256 всех43 публичных
ресурсов совпали сa251cb1. Health status=ok; error/critical app logs пусты.

Полный прогон после CSS-only строки не повторялся: изменение проверено узким
browser-тестом и CI, функциональные проверки основного пакета приведены выше.

