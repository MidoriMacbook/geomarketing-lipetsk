# Cartography motion redesign

**Goal:** выполнить пользовательский визуальный редизайн и motion, сохранив функции.
**Architecture:** прежние HTML/CSS/ES-модули; motion helpers в ui.js, composition в app.js.
**Tech Stack:** Flask/Leaflet, native HTML/CSS/JS, локальный Material Web2.5.0.
**Spec:** docs/specs/2026-10-16-cartography-motion-design.md; исходный промт пользователя.
**Assumptions:** API/snapshots пригодны; новые данные/другой stack не входят в итерацию.

## Global Constraints

- Пользователь прямо поручил полную реализацию; не останавливаться после плана.
- Сохранить API/JSON/модель/localStorage/CSV/print/id/data-testid/доступные имена.
- Нет React/Tailwind/shadcn/GSAP/Framer; палитра только tokens.css и MD var references.
- Внешние движения не влияют на правильность DOM, storage, focus или версию запроса.
- Не откатывать подготовленные пользовательские изменения Material Web.
- Не запускать повторно полный одинаковый набор тестов без нового основания.

## Review Focus

1. Rapid filter/refresh: только актуальный запрос меняет busy и результат.
2. Reduced-motion во время эффекта: отмена, видимый финальный DOM, нет rejection.
3. Native dialog/hidden: анимация не задерживает Esc, focus или доступность.
4. Storage mutation/ghost: нет дублей testid/id, fake-success или задержек Web Lock.
5. Leaflet transforms/canvas: движения не портят позиции, zoom и два renderer.

## Task 1: Визуальная система и композиция

Files: static/index.html, static/css/**, static/assets/**.
Ownership: только эти файлы; не менять JS/test/bundle/docs других исполнителей.
Interfaces: consumes прежние DOM contracts; produces hooks/spec из раздела DOM,
семантические токены прежних имён + motion-fast/base/slow/stagger и ease-standard/emphasized/spring.
Security flag: none.
- [ ] Применить согласованную палитру/шрифты/сетки и новую композицию всех разделов.
- [ ] Добавить hooks analysis-progress/status/context/header-sentinel, md-linear-progress/fallback.
- [ ] Полная CSS-система состояний, первый экран, reduced-motion/print, targets/contrast/text200.
- [ ] Шрифты локальные с лицензиями; favicon/знак согласованы; никакой fake data/декоративной карты.
- [ ] Сделать diff check и визуальный self-review без повторения итогового набора.

## Task 2: Motion и Material integration

Files: static/js/{ui,app,map,recommendations,saved-places}.js,
scripts/frontend/material-web-entry.js, static/vendor/material-web/**.
Ownership: только эти файлы; HTML/CSS пишет другой исполнитель.
Interfaces: consumes hooks/tokens Task1; produces animateUI/animation cleanup,
setAnalysisState, native dialog choreography и поведение по спецификации.
Security flag: security — сохраняются безопасный DOM и границы записи storage.
Does NOT cover: backend/newdata/auth; motion не применяется per-point к3600cells.
- [ ] Начать после RED теста Task3: actual progress отсутствует в прежнем DOM.
- [ ] Добавить конечные DOM/ARIA состояния и cancel-safe Web Animations helpers.
- [ ] Связать 12 типов motion с реальными событиями, new analysis_id и успешной записью.
- [ ] Настроить reduced-motion runtime change, native controls/focus и vendor fallback.
- [ ] Оставить в Material entry фактически используемый progress, без новых зависимостей.
- [ ] Syntax/diff self-check; сборку и общий браузерный набор выполняет parent один раз.

## Task 3: Браузерные проверки и итоговая передача

Files: tests/browser/redesign.js, tests/browser/material-web.js.
Ownership: только эти тесты. Документы/CI/коммиты/публикация принадлежат parent.
Interfaces: consumes hooks/Animation.id gm:* /public functions из Task1/2;
produces один прицельный браузерный сценарий и actual Material DOM-check.
Security flag: none.
- [ ] Написать новый тест до production motion; запустить до первой проверки, увидеть RED.
- [ ] Проверить busy/refresh/error/stagger/selection/save/compare/dialog/notices/custom/print.
- [ ] Проверить rapid changes и runtime reduced-motion, bundle fallback, 200% текста.
- [ ] Итоговый прогон parent: workspace + redesign в одном QA-сеансе, screenshots390/768/1440.
- [ ] Итоговый набор parent: check:material,51 unittest,validator; независимое ревью.
- [ ] Обновить design-system/redesign-spec/material-web/frontend/CHANGELOG/state.
- [ ] После CI опубликовать на прежнем Render, проверить публичную новую версию.

Preflight: Task2 consumes ровно hooks/tokens Task1; Task3 tests их и поведение Task2.
Первая волна: Task1 и написание RED Task3; вторая: Task2 параллельно завершению Task1.
