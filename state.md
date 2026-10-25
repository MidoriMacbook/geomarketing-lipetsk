# Текущая работа — 25 октября 2026

Согласована ежедневная выгрузка GitHub Actions.
План docs/plans/2026-10-25-city-data-delivery.md: задачи1–6выполнены.
Остались публикация/проверка Render и документы (7–8).

Workflow40196559308 success: osm-data/city.json,587796байт,23369домов,10категорий.
Версия5f14a00d93d29620a1c10b974dbdeaefbd703127fa73707ca76fd91c6f586cb6,
fetched_at1792934059.7527606. Локальный refresh0.36s,updated,
153дома/12347жителей/2конкурента. Повторunchanged,дата прежняя.
Python103,Node77,validator82 PASS. Browser daily-data:10областей/10типов/custom1500m,
3ширины,pageErrors/overflowнет. mobile-feedback/workspace-interactions PASS с подменами.

CITY_DATA_URL default пустой: legacy локально/тесты. После runtime deploy
задать URL через Render merge env (replace=false) для srv-db65pi8473hc73d7s5vg,
workspace tea-db65k0p42hec73b06s6g:
https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/osm-data/city.json
Дождаться live, проверить реальный API refresh=1/version/fetched_at;
повторunchanged с той же датой. tests/browser/daily-data.js без подмен.

Свой локальный сервер17572 (возможен дочернийpython),порт8091;
CACHE_DIR tests/artifacts/daily-cache, логdaily-server.err.log.
Свой браузерCLI daily-feed. Остановить/закрытьпослепроверок.
Отчёт docs/verification/2026-10-25-daily-city-data.md.

Старый сбой Render: основной Overpass IPv4errno111,IPv6errno101;резервы504/readtimeout.
В daily-режиме fallback cached_only не запускает Overpass с Render.
Даты при ошибках/проверках не подделываются.
