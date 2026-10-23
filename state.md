# Состояние работы

## Current Goal
23 октября 2026: светлый редизайн опубликован в main и существующем Render.
Пользовательский запрос реализован. Runtime: 56f3555a4c17a43ccf1896362a8c899a5e8ee7ef.
Сайт: https://geomarketing-lipetsk.onrender.com
Ветка разработки codex/editorial-map-hero сохранена; текущая ветка main.

## Decisions
- Cream/white, шесть цветов пользователя, Playfair Display + Golos; карта имеет отдельные тёмные токены.
- Статический HTML/SVG и асинхронный React effect-controller: текст, форма и карта не зависят от island.
- Локальные адаптации React Bits SplitText/BlurText/ScrollReveal с точным source/license; без полной React-миграции.
- Переносы h1 зависят от ширины его контейнера; большой текст не обрезается и не уменьшается ради высоты.
- Header измеряется до перехода; общий scroll-padding учитывает его один раз и защищает фокус без id.
- API, математика, каталог10×10, три storage-схемы, Leaflet, CSV/print и Material сохранены.

## Plan Status
План docs/plans/2026-10-22-editorial-map-hero.md выполнен.
Whole-branch review исходного диапазона и отдельное review исправлений: PASS, открытых замечаний нет.
Source CI39930316425 и main CI39932049840: Success для runtime56f3555.
Render dep-dbdih6lbedkc73d1f420 live с23 октября12:29:19 Москва.
Итоговый doc-only аудит использует [skip render]; его собственный CI проверяется по текущему SHA main.

## Evidence
Формальная приёмка: docs/verification/2026-10-22-editorial-map-hero.md.
Локально покрыты19 исходных browser suites и3 новых regression; Python84, Node75, validator78.
Финальные профильные suites, responsive/research и публичные9 suites GREEN.
Font19 вариантов, anchors12 маршрутов, focus27 переходов; no overflow на проверенных ширинах.
Публичные40 ресурсов совпали с Git; healthz200, каталог10×10, pageErrors[], app error/critical logs пусты.
Hero312337raw/103506gzip; source hashes/deterministic build PASS, islandCLS0, initialCLS0.001164.
Hero1440/1024/768/390:484.5/477.516/463.406/440px; desktop map/recs по1100px.
Публичные screenshots в ignored tests/artifacts/editorial/public-*.png.

## Open Issues / QA limits
Нет открытых замечаний, блокирующих согласованный выпуск.
Chrome/touch emulation; физические телефоны, другие движки и native PDF отдельно не проверялись.
320px/200% вне основной матрицы; наблюдённый overflow не введён последними исправлениями хедера.
Дополнительный независимый sweep не запустился из-за approval deadline; фактический font19 повторён независимо.
QA Python30176/25340 остановлены. Закрывать только собственные CLI browser sessions после финального CI.
GitHub REST rate-limit обходится чтением Actions UI с проверкой полного SHA; не дублировать Render deploy.
