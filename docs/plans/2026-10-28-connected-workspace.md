# План связанного рабочего сценария

**Цель:** связать повторный визит, фактические причины, сохранение и сравнение.
**Спецификация:** docs/specs/2026-10-28-connected-workspace.md.
**Архитектура:** существующее состояние и события; DOM-презентация без новых хранилищ.
**Стек:** ES modules, CSS tokens, Node test, Playwright CLI, Python validators.
**Ограничения:** сохраняются палитра/шрифты/сервер/API/модель/Leaflet/хранение/отчёты.
**Допущение:** последний несохранённый расчёт доступен только в открытой сессии.

## Задачи (последовательно, общий DOM и состояние)

- [x] 1. RED → GREEN: recommendationDecision(rec) возвращает factual headline/reasons;
  проверить ноль/положительные/неизвестные конкуренты, жители, demand centre и legacy.
  Файлы: recommendation-brief.js, recommendations.js, unit/recommendation-brief.test.js.
  Команда: Node --test tests/unit/recommendation-brief.test.js.
- [x] 2. RED → GREEN: рабочая навигация и контекст hero без восстановления.
  Файлы: workspace-return.js (новый), navigation.js, app.js, index.html, hero.css.
  Контракт: initWorkspaceReturn(); focusWorkspaceMap(); существующая ссылка #settings
  использует прежний мобильный sheet. Событие gm:scenarios-changed — только UI.
  Browser connected-workspace.js: fresh/reload/save/scenario/current/error/focus.
- [x] 3. RED → GREEN: панель сравнения всех размеров и явные обратные переходы;
  actual count, лимит/ручные checkbox, сообщение 1/2/3, резерв текста без скачка.
  Файлы: comparison-guide.js, index.html, components.css, responsive.css.
  Browser connected-workspace.js: 1/2/3/full/manual/return/settings/scenario.
- [x] 4. Упорядочить вспомогательные блоки в прежних details, проверить матрицу
  размеров и масштаба, reduced motion/keyboard/JS errors, CSV/печать/архивы.
  Файлы: layout.css, scenarios.css, static/index.html; tests/browser/connected-layout.js.
  Проверки: scripts/validate_project.py; Node --test tests/unit/*.test.js;
  Python -m unittest discover -v; новые и связанные browser-regression наборы.
- [ ] 5. Независимое ревью полного diff; исправить значимые замечания, обновить
  README/CHANGELOG/architecture/state/verification, публикация в существующие Git/Render
  и проверка публичных файлов/health/CI.

## Review Focus

- Первый автозапуск не создаёт ложный «повторный визит»; archive context не восстанавливает.
- Удаление/изменение в другой вкладке, повреждённое хранилище, отсутствие Web Locks.
- Заполненный набор 3 при сохранении четвёртого, счётчик при ручном выборе.
- Сравнение → карта/параметры при смене размера, закрытые details, reduced motion.
- Legacy без explanation не превращается в «высокий спрос»; число жителей в карточке один раз.
