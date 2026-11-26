"""Воспроизводит таблицу полноты OSM по закреплённой городской выгрузке."""
import argparse
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.config import DISTRICTS, OSM_RELIABILITY_MIN_CITY_OBJECTS, OSM_RELIABILITY_THRESHOLDS
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import validate_bundle
from src.domain.data_reliability import assess_data_reliability
from src.utils.validation import area_for


SOURCE_URL = ('https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/'
              'f0ca354905fef8b4dc405624591460b3133b3e58/city.json')
SOURCE_SHA256 = 'e43c84090839e3da9bf2dce6229fdc597bdda8fffc8d5dab4c49aca4b3d1d903'
OUTPUT = ROOT / 'docs/research/reliability.md'
UNAVAILABLE = 'н/д'
LEVELS = {'low': 'низкая', 'medium': 'средняя', 'high': 'высокая', None: UNAVAILABLE}


def number(value, decimals=0):
    if value is None:
        return UNAVAILABLE
    return f'{value:,.{decimals}f}'.replace(',', '\u00a0').replace('.', ',')


def percentage(value):
    return UNAVAILABLE if value is None else f'{number(value * 100, 1)}\u00a0%'


def count_with_share(metric):
    return f"{number(metric['count'])} ({percentage(metric['share'])})"


def source_description(bundle):
    coverage = bundle['coverage']
    moscow = timezone(timedelta(hours=3))
    source_time = datetime.fromtimestamp(bundle['fetched_at'], moscow).strftime('%d.%m.%Y %H:%M:%S')
    return f'''# Надёжность данных OpenStreetMap для ГеоМаркетинга

Индикатор описывает полноту разметки OpenStreetMap для пары «область × категория».
Он выводится отдельно от предупреждения о возрасте выгрузки. Модель получает
прежние входы и считает спрос, конкуренцию и рекомендации независимо от
индикатора. Личные поправки и настройка веса сетей применяются к модели после
того, как определён исходный набор для оценки разметки.

## Источник и география

- Полная ежедневная выгрузка с метаданными, принятая Render. [Сырой city.json на закреплённом коммите]({SOURCE_URL})
- Версия выгрузки `{bundle['version']}`. Время получения **{source_time} МСК**.
- SHA-256 файла `{SOURCE_SHA256}`.
- Рабочая рамка города — прямоугольник `coverage` ежедневной выгрузки,
  от {coverage['south']:.3f}° до {coverage['north']:.3f}° с. ш. и от
  {coverage['west']:.3f}° до {coverage['east']:.3f}° в. д. включительно.
  Рамка включает запас для допустимых центров и радиусов приложения.
- Для каждой готовой области используется её центр из `DISTRICTS` и настроенный
  радиус. На момент расчёта у всех десяти радиус 1\u00a0000\u00a0м. Точка на границе
  входит в круг. Модель может учитывать конкурентов из внешнего запаса, а
  показатели местной полноты считают только объекты внутри круга.

## Формулы

- **Объекты в городе и круге.** Используются действующие фильтры `BUSINESS_CATALOG`
  и координаты готовой выгрузки. Внутри категории повтор одной пары OSM «тип + ID»
  считается один раз. Типы `node`, `way`, `relation` имеют раздельные пространства
  ID. Близкие точка и контур с разными ID остаются отдельными объектами. Объект
  может попасть в несколько категорий или в пересекающиеся круги.
- **Название и полный адрес.** Применяются уже обработанные поля этапа 1.
  Название берётся из `name:ru`, затем из `name`. Полный адрес берётся из `addr:full`
  или составляется из `addr:street` либо `addr:place` и `addr:housenumber` либо
  `addr:housename`. Учитываются теги самого объекта после удаления крайних
  пробелов. Частичный адрес и бренд сами по себе не заполняют эти поля.
- **Пропуски.** Каждая доля равна числу записей с соответствующим пропуском,
  делённому на число объектов категории в круге. «Без обоих» — пересечение
  двух множеств пропусков. При нуле объектов числа пропусков равны нулю,
  а доли неопределённы.
- **Продуктовое покрытие.** `1\u00a0000 × магазины / оценочные жители`. Магазины
  берутся из категории «Продуктовый магазин» (`shop=supermarket` и
  `shop=convenience`) в том же круге. Оценка жителей — сумма оценок для жилых
  объектов выгрузки в круге. Показатель косвенный. В жилом или торговом районе
  плотность может быть выше, чем в районе с иной застройкой и характером торговли,
  даже при одинаковой полноте OSM. При нуле жителей плотность неопределённа.
- **Старые данные.** Если в выгрузке сохранены только координаты, числа объектов
  означают число строк и дают приближение количества разных OSM-объектов.
  Плотность в этом случае использует число строк продуктовой категории.
  Если нет надёжного признака, что поля названия и адреса собирались, доли
  пропусков неизвестны. В старой схеме таким признаком служит хотя бы одно
  сохранённое текстовое поле конкурента в общей выгрузке. Для локальных наборов
  без полной городской выгрузки индикатор недоступен. Архив, сохранённый до
  появления индикатора, открывается без оценки разметки.

**{UNAVAILABLE}** — нет сведений или показатель неопределён. Число `0` обозначает
измеренный ноль. Доли в таблице округлены до 0,1 процентного пункта, оценки
жителей и плотность — до двух знаков. Правила применяются к исходным значениям.
'''


def rules_description():
    limits = OSM_RELIABILITY_THRESHOLDS
    return f'''## Порядок правил и предварительные пороги

Первая подходящая строка задаёт уровень и причину. Порог городской выборки
согласован. Остальные пороги **предварительные** и заданы в `src/config.py`.

| Условие | Уровень | Причина |
| --- | --- | --- |
| Меньше {OSM_RELIABILITY_MIN_CITY_OBJECTS} объектов категории в рабочей рамке | низкая | В городе отмечено мало объектов |
| Нет объектов категории в круге | низкая | Местная выборка пуста |
| Доли пропусков или плотность магазинов неопределённы | {UNAVAILABLE} | Причина перечисляет отсутствующие показатели |
| Без обоих полей не менее {percentage(limits['low_missing_both_share'])} | низкая | Много объектов без названия и полного адреса |
| Меньше {number(limits['low_grocery_density'], 2)} магазина на 1\u00a0000 жителей | низкая | Низкая плотность продуктовых магазинов |
| Меньше {limits['medium_min_area_objects']} объектов категории в круге | средняя | Малая местная выборка |
| Без названия не менее {percentage(limits['medium_missing_names_share'])} | средняя | Много объектов без названия |
| Без полного адреса не менее {percentage(limits['medium_missing_addresses_share'])} | средняя | Много объектов без полного адреса |
| Меньше {number(limits['medium_grocery_density'], 2)} магазина на 1\u00a0000 жителей | средняя | Плотность ниже предварительного ориентира |
| Остальные случаи | высокая | Показатели разметки проходят предварительные пороги |
'''


def result_table(bundle):
    columns = ('Область', 'Категория', 'В городе', 'В круге', 'Без названия',
               'Без полного адреса', 'Без обоих', 'Продуктовые магазины',
               'Оценочные жители', 'Магазинов на 1\u00a0000 жителей', 'Уровень', 'Причина')
    rows = [columns, ('---',) * len(columns)]
    for district in DISTRICTS:
        area = area_for(district)
        for category, settings in BUSINESS_CATALOG.items():
            result = assess_data_reliability(bundle, area, category)
            metrics = result['metrics']
            rows.append((
                area['name'], settings['name'], number(metrics['city_objects']), number(metrics['area_objects']),
                count_with_share(metrics['missing_names']), count_with_share(metrics['missing_addresses']),
                count_with_share(metrics['missing_both']), number(metrics['grocery_stores']),
                number(metrics['estimated_residents'], 2), number(metrics['grocery_per_1000'], 2),
                LEVELS[result['level']], result['reason'],
            ))
    heading = f'## Таблица {len(DISTRICTS)} × {len(BUSINESS_CATALOG)}\n\n'
    return heading + '\n'.join('| ' + ' | '.join(row) + ' |' for row in rows) + '\n'


def render_report(bundle):
    return '\n'.join((source_description(bundle), rules_description(), result_table(bundle), f'''## Ручная сверка

Для окончательной калибровки нужна сверка 2–3 областей с 2ГИС и Яндекс Картами
в тех же поисковых кругах. Для каждой выбранной пары следует записать дату,
число совпадений, расхождения по пропускам и возможные дубли. Пороговые
значения и выводы по расхождениям ждут результатов этой сверки.

| Область и категория | Дата | 2ГИС | Яндекс Карты | Расхождения и вывод |
| --- | --- | --- | --- | --- |
| {UNAVAILABLE} | {UNAVAILABLE} | {UNAVAILABLE} | {UNAVAILABLE} | {UNAVAILABLE} |

## Воспроизведение

Из корня проекта с установленными зависимостями загрузите закреплённый
файл и запустите генератор. Он проверяет SHA-256, валидирует схему и вызывает
тот же расчёт показателей, который использует API. Для сравнения с уже
сохранённой таблицей добавьте к команде `--check`.

```sh
curl -fL {SOURCE_URL} -o city.json
python scripts/generate_data_reliability.py city.json
```
'''))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('city_json', type=Path)
    parser.add_argument('--check', action='store_true', help='сравнить с сохранённой таблицей')
    args = parser.parse_args()
    raw = args.city_json.read_bytes()
    if sha256(raw).hexdigest() != SOURCE_SHA256:
        parser.error('SHA-256 файла отличается от закреплённой выгрузки')
    document = render_report(validate_bundle(json.loads(raw)))
    if args.check:
        if document != OUTPUT.read_text(encoding='utf-8'):
            parser.error('Сохранённая таблица отличается от результата генерации')
    else:
        OUTPUT.write_text(document, encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
