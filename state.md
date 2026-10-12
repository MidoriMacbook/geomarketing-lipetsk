# Состояние работы

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
