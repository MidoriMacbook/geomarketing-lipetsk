# Состояние — 25 октября 2026

Ежедневная выгрузка GitHub Actions реализована и опубликована.
План docs/plans/2026-10-25-city-data-delivery.md выполнен.
Runtime ec325784147b4bab3baed18733dc27a5f3471803 на main.
Render dep-dbf0bh3phbkc73a34mrg live25октября13:38:36UTC.
CITY_DATA_URL настроен merge env, replace=false.

Daily workflow40198340211 success; CI40198340203 success.
Веткаosm-data/city.json:23369домов,10категорий.
Версияdd1000d07fa394b8f7cb6f67c057137d583e8c9bb5a60d3beee6180ab40a458a,
fetched_at1792935470.0598962. Публичный refresh3.210s:updated,обаcached=false,
153дома/12347жителей/2конкурента. Повтор0.574s:unchanged,дата прежняя.

Публичный browser daily-data:10областей/10категорий/custom1500m,
390/768/1440безoverflow,pageErrors[]. Кнопка0.53s,новыхданныхнет,датапрежняя.
44публичныхресурса SHA256 совпали с Git; error/criticalлоговнет.
Python106,Node77,validator82 PASS; ревью замечаний не осталось.
Отчёт docs/verification/2026-10-25-daily-city-data.md.

Свой локальный сервер17572/19712 остановлен; CLI daily-feed закрыт.
Итоговый аудит сохраняется docs-only коммитом [skip render] [skip ci].

Исходные даты всегда сохраняются. CITY_DATA_URL default пустой для старого
локального режима; настройка daily приведена в README/DEPLOYMENT.
При отказе GitHub остаётся городская копия либо старый районный снимок,
без сетевого Overpass с Render. Архивы исследований и модель не изменены.
