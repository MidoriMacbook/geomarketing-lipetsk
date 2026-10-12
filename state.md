# Состояние работы

План: docs/plans/2026-10-12-workspace.md. Задачи 1–5 выполнены; задача 6 — публикация.
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

Ветка codex/site-workspace; main/Render пока предыдущая версия 2f4a1b4.
Render: существующий бесплатный srv-db65pi8473hc73d7s5vg,
workspace tea-db65k0p42hec73b06s6g, https://geomarketing-lipetsk.onrender.com.
Сервис подключён по публичному Git URL и требует ручного deploy после main.
QA-сервер порт5081. Runtime .venv/Scripts/python.exe; Git/runtime в этой среде
требуют require_escalated. Playwright wrapper C:/Users/Asus/.codex/tools/bin/playwright-cli.cmd.
