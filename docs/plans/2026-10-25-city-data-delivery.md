# Ежедневная доставка данных — план

Goal: Получать проверенную городскую выгрузку с GitHub на Render.
Spec: docs/specs/2026-10-25-data-delivery-proposal.md; согласована пользователем 25 октября.
Execution: последовательно, через executing-plans и TDD.

Architecture: два запроса Overpass выполняются в GitHub Actions ежедневно.
Ветка osm-data хранит city.json независимо от кода и перезапусков Render.
Сервис проверяет схему/полноту/версию, фильтрует готовые и произвольные области.
Даты выгрузки сохраняются при повторной проверке; сбой оставляет рабочую копию.
Dependencies: только существующие Python/requests/numpy, без новых аккаунтов и платных ресурсов.
Assumptions: GitHub raw доступен с Render; сборка Overpass успешна хотя бы периодически.
Failure coverage: повреждение, откат даты, пустые категории, конкурентные запросы, нет сети/нет файла.

- [x] 1. RED: tests/unit/test_city_data.py — фильтрация, контракт и целостность.
- [x] 2. GREEN: src/domain/city_data.py; общие парсеры в osm_service.py.
- [x] 3. RED→GREEN: tests/unit/test_city_feed.py и src/services/city_feed_service.py — атомарная загрузка, сохранение даты/копии, откат, начальная загрузка.
- [x] 4. RED→GREEN: интеграция в analysis_service.py; поле data_delivery в payload без изменения модели и архива исследований.
- [x] 5. scripts/collect_city_data.py и .github/workflows/osm-data.yml: ежедневная атомарная публикация ветки osm-data, ограниченная конкуренция, отказ без затирания предыдущей версии.
- [x] 6. UI: «Проверить обновления», периодичность и дата, состояния новой/той же/недоступной версии; мобильная проверка.
- [x] 7. Полные Python/Node/структурные проверки; реальный workflow GitHub, загрузка с Render, повторная проверка той же версии, район/тип/custom.
- [x] 8. Документы, публикация, CI/Render live, чистый репозиторий.

Команды: python -m unittest discover -s tests -q; node --test tests/unit/*.test.js;
python scripts/validate_project.py; Playwright browser + фактические data_delivery/version/fetched_at.
Публичная проверка свежести не подменяет сетевые ответы.
