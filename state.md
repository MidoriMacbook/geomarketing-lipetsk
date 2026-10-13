# Состояние работы

## Активная итерация: архитектура и редакционный редизайн

Промт пользователя от 12 октября 2026 выполнен по
docs/plans/2026-10-12-architecture-redesign.md и docs/design/redesign-spec.md.
Стек, API, модель, storage и DOM-контракты сохраняются.
Ветка codex/architecture-editorial-redesign, база 0ae232c.
Базовая проверка: 37 unittest, 19 групп старого браузерного сценария.
Требуемые документы и CHANGELOG созданы до изменения приложения.

Backend завершён: коммиты 96983cb и 6342424.
51 unittest, compile, foreign cwd и import DAG проходят.
Независимое серверное ревью: Spec PASS / Quality PASS; 33 ответа API совпали
с исходными, все 37 исходных test methods/assertions сохранены.
Прямой CLI-тест очищает PYTHONPATH; замечание ревью устранено.

Frontend завершён: коммит 81db43e; восемь ES-модулей, семь CSS, favicon.
Старый workspace прошёл после извлечения до редизайна.
Свежие родительские smoke/workspace/responsive/catalog-matrix/palette PASS,
pageErrors=[], 15 сочетаний работают. Шесть ширин без переполнения,
тайлы на снимках загружены полностью, 44×44 targets и клавиатура проверены.
Независимое frontend-ревью: Spec PASS / Quality APPROVED, существенных замечаний нет.

Root завершил docs/README/audit/CI/validator/fixtures и карту переносов.
Валидатор PASS: 61 обязательный файл, DAG, assets, id/aria, палитра.
Все восемь node --check, полный unittest 51, py_compile и stub scan проходят.
Docker отсутствует; actual build не выполнялся. Print CSS проверен, PDF не создавался.
Данные OSM не обновлялись в этой итерации, snapshots неизменны.

Финальное ревью выявило два Important CSS-дефекта: text200 overflow и Save hover.
Исправлены исходным frontend worker; свежий parent responsive PASS,
шесть ширин и text200360/390/1024/1280, hover/focus/pressed/saved PASS.
Ожидается узкое повторное ревью исправлений, затем публикация.

QA Waitress на 127.0.0.1:5082, helper PID 19400, родитель владеет сервером.
Именованные QA-браузеры: geomarketing-arch, geomarketing-design.
Workers не запускают сервисы; сохраняют изменения других участников.
Следующие шаги: frontend review → финальное review → main/CI → Render → public QA.
Публикация существующего бесплатного сервиса авторизована ранее.
Render srv-db65pi8473hc73d7s5vg, workspace tea-db65k0p42hec73b06s6g.
Публичный Git URL требует ручного deploy после зелёного main.
Проектные QA-артефакты/сырые XML/ревью не коммитить.

Предыдущая публикация ниже — исторический контекст.

План: docs/plans/2026-10-12-workspace.md. Все задачи 1–6 выполнены.
Согласован полный этап и новые категории: кофейня, аптека, продукты, пекарня, салон.
Независимое backend-ревью и итоговое ревью: Spec Pass / Quality Pass.
Свежие проверки: unittest 37 OK; browser-workspace и browser-smoke OK,
pageErrors=[]; node --check OK. Проверены сохранения двух вкладок, failed refresh,
canvas reuse, слои, CSV, print flow, ошибки storage/API/тайлов и мобильный экран.
Печать визуально проверена через print CSS screenshot; реальный PDF не создавался.

Геоданные: запас конкурентов >=R; pharmacy/beauty обновлены с ключами
_halo500/_halo450. Импорт отклоняет ошибочные или непокрывающие OSM XML и
неполную геометрию. Снимки всех 15 сочетаний включены в репозиторий.
Сырые XML и QA screenshots только в игнорируемых tests/, не публиковать.
PROJECT_ANALYSIS.md — незакоммиченный файл предыдущего аудита, не изменён.

Приложение опубликовано: код988589c93b015b39a9b475ada0e0f532c1c03fe6,
deploy dep-db6g2uad0e5s73akcu2g live 12 октября2026. GitHub Actions на
feature/main — success. Main содержит приложение и итоговый тестовый follow-up.
Публичные /healthz и /api/catalog OK; все15 сочетаний район/бизнес вернули
по3 рекомендации без demo. Публичные browser-workspace и browser-smoke OK,
pageErrors=[]. Сбой мгновенной delete-assertion устранён только в тесте:
теперь ждём завершения WebLock и обновления storage/DOM/comparison.
Тестовый follow-up + эти документы не меняют опубликованный runtime.
Render: существующий бесплатный srv-db65pi8473hc73d7s5vg,
workspace tea-db65k0p42hec73b06s6g, https://geomarketing-lipetsk.onrender.com.
Сервис подключён по публичному Git URL и требует ручного deploy после main.
QA-сервер порт5081 и именованные QA-браузеры закрываются после проверки. Runtime .venv/Scripts/python.exe; Git/runtime в этой среде
требуют require_escalated. Playwright wrapper C:/Users/Asus/.codex/tools/bin/playwright-cli.cmd.
