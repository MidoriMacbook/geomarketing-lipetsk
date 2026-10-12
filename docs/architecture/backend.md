# Серверные модули

## Ответственность и разрешённые импорты

| Модуль | Назначение | Может использовать |
| --- | --- | --- |
| `src/config.py` | Корень проекта, CACHE_DIR, SNAPSHOT_DIR, server_host/server_port, ограничения и параметры | Стандартную библиотеку |
| `src/routes/health.py` | `/healthz` | Flask |
| `src/routes/catalog.py` | `/api/catalog`, JSON | Flask, catalog_service |
| `src/routes/calculate.py` | `/api/calculate`, семафор2, ошибки, параметры | Flask, analysis_service, validation |
| `src/domain/businesses.py` | Пять категорий, R, alpha, OSM-теги | Константы |
| `src/domain/models.py` | Данные области и результатов загрузки/вычислений | Типы и dataclasses |
| `src/domain/scoring.py` | Взвешенный K-means, спрос, конкуренция, сетка, рекомендации | NumPy, SciPy, sklearn, geo, config |
| `src/services/analysis_service.py` | Загрузка, демо-резерв, предупреждения, полный результат | OSM, scoring, models, formatting |
| `src/services/catalog_service.py` | Каталог районов и категорий | config, businesses |
| `src/services/cache_service.py` | Проверка JSON, атомарная запись, stale, блокировки | Файлы, время, models, config |
| `src/services/osm_service.py` | Overpass, теги, оценка населения и получение рядов | requests, cache_service, geo, config, businesses |
| `src/utils/geo.py` | Координаты↔метры, bbox и площадь | math, NumPy |
| `src/utils/validation.py` | Конечные числа, допустимая область/категория, UserError | config, типы домена |
| `src/utils/formatting.py` | JSON-представление и метаданные | Типы домена, dataclasses |

HTTP-логика не выполняет кластеризацию и не пишет файлы. Вычисления не
читают request.args, не возвращают jsonify и не делают сетевых запросов.
Сервисы возвращают обычные данные; routes определяют HTTP-статус.

## Результаты, которые необходимо сохранить

Дома — `[lat,lng,residents]`, конкуренты — `[lat,lng]`.
Кэш и исходные снимки читаются как старые массивы либо объект
`{fetched_at,data}` с дополнительными полями происхождения.
CacheInfo сохраняет cached/fetched_at/stale/warning и bool-семантику.
Успешный пустой список конкурентов отличается от ошибки загрузки.
Для новых категорий нет выдуманных демонстрационных конкурентов.

Ближайший конкурент может находиться за границей круга анализа: запас выборки
равен max(400м,R). Ключи pharmacy/beauty включают _halo500/_halo450.
Снимки и пользовательский кэш остаются в прежнем формате и под прежними именами.

## Риски переноса

Пути вычисляются от корня проекта, а не от положения нового сервисного файла.
В Docker необходимо копировать `src/`. Тесты с mock должны подменять функцию
там, где она вызывается; исправляются адреса подстановок, а не ожидаемые результаты.
Вложенные тесты требуют `__init__.py`, чтобы unittest discover не пропустил их.
