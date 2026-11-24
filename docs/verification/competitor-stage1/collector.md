# Этап 1 — замер городской выгрузки

Кандидат `2c7419dfc6aa1f862fc67974f34d89ee3e3fa317` и код этапа 1 обработали один набор из 23 415 жилых объектов и 1 215 записей конкурентов по всем 10 категориям. Исходная городская выгрузка `9eb56bd533610832491e68c26e61a814be7fc0efc53d95979b3a263e52ed620b`, время сбора 24.11.2026 14:00:29.245828 UTC (17:00:29.245828 МСК), SHA-256 файла `36cdb230bae742f5efe73a47ed22eaae4e23531a98fb9776521a0b49a243748e`. Рамка `52.475,39.31,52.745,39.84`. В замеренной версии этапа 1 Git blob `src/domain/provenance.py` — `7f7ec2fff390404f45cb0044079b8522c04f5a71`. [Исходный срез](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/ae79e8a90bcc0b84bc098d1f20c8f999c08cd601/city.json).

| Показатель | `2c7419d` | Этап 1 | Разница |
| --- | ---: | ---: | ---: |
| Штатный `city.json`, байты | 10 846 842 | 10 891 133 | +44 291 (+0,4083 %) |
| Штатный `city.json` после gzip-6, байты | 1 524 222 | 1 525 809 | +1 587 (+0,1041 %) |
| JSON с кириллицей в UTF-8 без `\u`-экранирования, байты | 10 796 376 | 10 821 221 | +24 845 (+0,2301 %) |
| Локальное исполнение `collect()`, медиана | 1 977,521 мс | 2 104,032 мс | +126,511 мс (+6,3975 %) |
| Локальное исполнение, сериализация и запись, медиана | 2 153,521 мс | 2 272,903 мс | +119,382 мс (+5,5436 %) |

Сборщик выполнил по семь замеров после прогрева, на Windows и Python 3.14.7. Диапазоны времени всей локальной сборки перекрываются, 1 745–2 533 мс и 2 002–2 580 мс. Рост штатного файла на 0,41 % оставляет пригодным текущий формат с необязательными полями в записи происхождения. Срез сравнения `a2e6b29804ad608cdc50be2930735912fc1829947e201be2e34d4ee27fa3dad8`, срез этапа 1 `748c60187882b3c457f7c66884613789474fbb9fd30de9eedd8fbcd08fff8e69`. Кандидат с SHA-256 `a3ab94e10b64697d5d2edbb69700feabb323a64a281bba9209028566982f1ec0` воспроизводится из фиксированного ввода. Проверка полного содержимого подтвердила равенство домов, координат, порядка, типизированных ID и прежних полей структуры после исключения трёх добавленных полей и контрольной суммы.

Замер использовал сохранённые ответы на границе HTTP. Полные запросы жилой геометрии к трём настроенным Overpass вернули HTTP 502 за 1,345 с, HTTP 504 за 50,364 с и таймаут 60,004 с. Ответ VK Maps на запрос конкурентов также вернул 504. Поэтому все проверенные строки домов и исходное происхождение воспроизводились на выходе `parse_houses`, а штатный отбор, разбор конкурентов, обе валидации, защита от потерь, расчёт версии, сериализация и запись вошли в замер. Разбор жилой геометрии и ожидание сети остались за пределами этих времён. [Публичные узлы Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).

24.11.2026 в 20:23:05–20:23:08 МСК API OSM вернул 1 085 узлов, 129 линий и одно отношение, всего 1 215 уникальных типизированных ID в пяти пакетах. Суммарное время сетевых запросов 3,802 с, передано 63 885 байт в сжатом виде. Время правки каждого объекта предшествует исходному сбору. У узлов разница с опубликованными координатами укладывается в 0,0000005°, центры линий и отношения взяты из опубликованного среза. Файл `osm-competitor-versions.json` фиксирует версии всех объектов. Контрольное пакетное чтение по типизированным ID и точным версиям вернуло те же теги. [Пакетное чтение объектов OSM](https://wiki.openstreetmap.org/wiki/API_v0.6#Multi_fetch) · [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

| Категория | Объекты | Название | Полный адрес | `brand` | `brand:wikidata` | `operator` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Кофейня | 166 | 136 | 26 | 0 | 0 | 7 |
| Аптека | 199 | 150 | 14 | 49 | 34 | 13 |
| Продуктовый магазин | 417 | 339 | 97 | 219 | 219 | 167 |
| Пекарня | 32 | 19 | 3 | 0 | 0 | 0 |
| Салон красоты | 160 | 101 | 13 | 0 | 0 | 4 |
| Быстрое питание | 106 | 74 | 11 | 29 | 28 | 4 |
| Цветочный магазин | 56 | 17 | 4 | 0 | 0 | 0 |
| Зоомагазин | 18 | 13 | 2 | 2 | 2 | 2 |
| Фитнес-студия | 18 | 15 | 3 | 1 | 1 | 0 |
| Стоматология | 43 | 26 | 7 | 0 | 0 | 1 |
| Всего | 1 215 | 890 | 180 | 300 | 284 | 198 |

В интерфейсе карта, CSV и печать опираются на заполненные имя и адрес. Три новых поля доступны клиенту в режиме явного запроса метаданных и могут сохраняться в снимке. Это счётчики отдельных полей разметки, а оценка сетевого статуса относится к следующему этапу.

Обе версии прочитали прежнюю выгрузку `4140bc58bd5b74b5e879b569034ee58183ab4224cb415a02eaf49191eddcb532`, приняли полную новую через штатный загрузчик, сохранили файл кэша и повторно прочитали его после очистки памяти. Имитация сетевого сбоя при обновлении сохранила последнюю полную выгрузку. Обычный GET вернул строки с координатами, явный запрос в этапе 1 для «Центр × Продуктовый магазин» вернул 36 записей с `brand`, 36 с `brand:wikidata` и 27 с `operator`. Штатный запуск после слияния даст длительность разбора реальной жилой геометрии и загрузки, а также данные для проверки обновления на Render. [Прежний срез](https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/c9775bfbcb16de2690448b2653a6c87262dab40c/city.json).

## Повторение замера

Поместить `capture_queries.py`, `osm_multifetch.py`, `collector_benchmark.py`, `feed_compatibility.py` и `osm-competitor-versions.json` в один каталог под `tests/artifacts` и запустить из корня репозитория с установленными зависимостями Python. Сырые ответы OSM остаются локально. `collector-benchmark.json` содержит отдельные времена каждого прогона и отпечатки входов.

```powershell
$p = 'tests/artifacts/competitor-stage1'
New-Item -ItemType Directory -Force $p | Out-Null
Copy-Item docs/verification/competitor-stage1/tools/*.py $p
Copy-Item docs/verification/competitor-stage1/osm-competitor-versions.json $p
$python = '.venv/Scripts/python.exe'
curl.exe -fsSL 'https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/ae79e8a90bcc0b84bc098d1f20c8f999c08cd601/city.json' --output "$p/city-latest.json"
curl.exe -fsSL 'https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/c9775bfbcb16de2690448b2653a6c87262dab40c/city.json' --output "$p/city-older.json"
git archive --format=zip "--output=$p/baseline-2c7419d.zip" 2c7419d -- app.py scripts/collect_city_data.py src
Expand-Archive -LiteralPath "$p/baseline-2c7419d.zip" -DestinationPath "$p/baseline-2c7419d" -Force
& $python "$p/capture_queries.py"
& $python "$p/osm_multifetch.py" --pinned "$p/osm-competitor-versions.json"
& $python "$p/collector_benchmark.py" run --repo "$p/baseline-2c7419d" --baseline --runs 7 --output "$p/baseline.json"
& $python "$p/collector_benchmark.py" run --repo . --runs 7 --output "$p/stage1.json"
& $python "$p/collector_benchmark.py" compare --before "$p/baseline.json" --after "$p/stage1.json" --output "$p/collector-benchmark.json"
& $python "$p/feed_compatibility.py" --repo "$p/baseline-2c7419d" --old "$p/city-older.json" --output "$p/feed-compatibility-baseline.json"
& $python "$p/feed_compatibility.py" --repo . --candidate --old "$p/city-older.json" --output "$p/feed-compatibility-stage1.json"
```
