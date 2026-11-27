"""Пересчитать таблицу запасных вариантов на закреплённой городской выгрузке."""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
from itertools import combinations
import json
from pathlib import Path
import sys

import numpy as np
from threadpoolctl import threadpool_limits

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DISTRICTS, MAX_RECOMMENDATIONS
from src.domain.alternative_places import (
    MAX_SHARED_RESIDENTS_FRACTION, MIN_DISTANCE_RADIUS_FACTOR, shared_resident_counts,
)
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import select_area, validate_bundle
from src.domain.scoring import score_locations
from src.utils.geo import to_meters
from src.utils.validation import area_for, validate_data


SOURCE_SHA = 'f0ca354905fef8b4dc405624591460b3133b3e58'
SOURCE_HASH = 'e43c84090839e3da9bf2dce6229fdc597bdda8fffc8d5dab4c49aca4b3d1d903'
SOURCE_URL = f'https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/{SOURCE_SHA}/city.json'
CATEGORIES = ('cafe', 'grocery', 'fitness')
OUTPUT = PROJECT_ROOT / 'docs' / 'research' / 'alternative-places.md'
NBSP = '\N{NO-BREAK SPACE}'


def decimal(value, places=None):
    text = repr(value) if places is None else f'{value:.{places}f}'
    return text.replace('.', ',')


def scores_text(rows):
    return '<br>'.join(f'№{NBSP}{row["rank"]} · {decimal(row["score"])}' for row in rows) or '—'


def pair_text(result, houses, area, radius):
    rows = result.recommendations + result.alternatives
    grid = result.grid
    axis = np.linspace(-area['radius'], area['radius'], grid['n'])
    homes = to_meters(houses[:, :2], *area['center'])
    population = houses[:, 2]
    points = []
    memberships = []
    for row in rows:
        # Восстанавливаем точные метровые координаты ячейки исходной сетки.
        x = round((row['lng'] - grid['lng_min']) * (grid['n'] - 1) / (grid['lng_max'] - grid['lng_min']))
        y = round((row['lat'] - grid['lat_min']) * (grid['n'] - 1) / (grid['lat_max'] - grid['lat_min']))
        point = np.array([axis[x], axis[y]])
        points.append(point)
        memberships.append(np.linalg.norm(homes - point, axis=1) <= radius)

    pairs = []
    for first, second in combinations(range(len(rows)), 2):
        distance = float(np.linalg.norm(points[first] - points[second]))
        shared, smaller = shared_resident_counts(population, memberships[first], memberships[second])
        fraction = f'{decimal(100 * shared / smaller, 3)}{NBSP}%' if smaller else 'н/д'
        pairs.append(f'{rows[first]["rank"]}–{rows[second]["rank"]} · {decimal(distance, 3)}{NBSP}м · {fraction}')
    return '<br>'.join(pairs) or '—'


def matrix_rows(bundle):
    for district in DISTRICTS:
        area = area_for(district)
        for business in CATEGORIES:
            parameters = BUSINESS_CATALOG[business]
            houses, competitors = validate_data(*select_area(bundle, area, business))
            scored = score_locations(houses, competitors, area['center'], area['radius'], parameters,
                                     include_alternatives=True)
            yield area, parameters, houses, scored


def scenario_examples(rows):
    examples = []
    for count in range(1, MAX_RECOMMENDATIONS + 1):
        area, parameters, _, scored = next(row for row in rows if len(row[3].recommendations) == count)
        examples.append(f'- {count} осн. · {area["name"]} × {parameters["name"]}. '
                        f'Запасных вариантов — {len(scored.alternatives)}.')

    area, parameters, _, scored = next(row for row in rows if len(row[3].recommendations) + len(row[3].alternatives)
                                      < MAX_RECOMMENDATIONS)
    examples.append(f'- Менее трёх мест · {area["name"]} × {parameters["name"]}. '
                    f'Основных — {len(scored.recommendations)}, запасных — {len(scored.alternatives)}.')
    return examples


def render_report(bundle):
    with threadpool_limits(limits=1):
        rows = list(matrix_rows(bundle))
        examples = scenario_examples(rows)

    moscow = timezone(timedelta(hours=3))
    exported = datetime.fromtimestamp(bundle['fetched_at'], moscow).strftime('%d.%m.%Y, %H:%M:%S МСК')
    cafe = BUSINESS_CATALOG['cafe']['R']
    grocery = BUSINESS_CATALOG['grocery']['R']
    fitness = BUSINESS_CATALOG['fitness']['R']
    minimum_distance = decimal(MIN_DISTANCE_RADIUS_FACTOR)
    maximum_shared = decimal(MAX_SHARED_RESIDENTS_FRACTION * 100, 0)
    coverage = bundle['coverage']
    lines = [
        '# Запасные варианты. Матрица 10 × 3',
        '',
        f'Полная выгрузка от {exported}, версия `{bundle["version"]}`. SHA коммита выгрузки `{SOURCE_SHA}`. '
        f'SHA-256 файла `{SOURCE_HASH}`. [Городская выгрузка OSM]({SOURCE_URL}).',
        '',
        f'Рамка выгрузки — {decimal(coverage["south"], 3)}–{decimal(coverage["north"], 3)}° с. ш. и '
        f'{decimal(coverage["west"], 3)}–{decimal(coverage["east"], 3)}° в. д. Использованы десять настроенных '
        'кругов, полный вес конкурентов и исходные данные без личных поправок.',
        '',
        f'Кофейня входит в эталон ({cafe}{NBSP}м). Продуктовый магазин ({grocery}{NBSP}м) даёт близкий '
        f'радиус с другим набором конкурентов. Фитнес-студия ({fitness}{NBSP}м) проверяет отбор при широком охвате жителей.',
        '',
        '## Как читать результаты',
        '',
        '- Сначала модель полностью формирует основные рекомендации. Затем она рассматривает оставшиеся ячейки '
        'расчётной сетки внутри круга, где спрос положителен. Порядок — по убыванию неокруглённого балла, '
        'при равенстве побеждает меньший индекс ячейки. Общий лимит — три места.',
        f'- Каждый новый запасной вариант проверяется попарно со всеми выбранными местами. Расстояние '
        f'должно быть ≥{NBSP}{minimum_distance} × R, а доля общих жителей ≤{NBSP}{maximum_shared}{NBSP}%. '
        'Расстояние измеряется в той же локальной метровой проекции, что и сетка. Общих жителей считают '
        'по домам, входящим в R обеих точек. Знаменатель — расчётное население меньшего из двух охватов. '
        'При нулевом знаменателе общих жителей ноль и ограничение выполнено. В таблице доля помечена `н/д`.',
        '- В таблице приведены все выбранные пары, в том числе пары двух основных мест. Для основных пар '
        'действуют исходные критерии. Баллы приведены с точностью результата модели. Расстояния и доли '
        'в таблице округлены до трёх знаков после запятой. При отборе сравниваются исходные значения. '
        '`—` означает, что мест или пар в колонке нет.',
        '- Сайт запрашивает `include_alternatives=1`. GET принимает параметр запроса, POST — поле JSON. '
        'В обычном ответе остаётся прежний список. В ответе по запросу за основными идут запасные '
        'с `role: "alternative"` и номером в общем порядке. `alternative_comparison` указывает ближайшее '
        'ранее выбранное место (при равенстве — с меньшим номером), сырое расстояние и долю. '
        'Если запасных нет, форма ответа прежняя при любом способе запроса.',
        '',
        '## Результаты',
        '',
        '| Область | Категория | Основных | Запасных | Баллы основных | Баллы запасных | Пары · расстояние · общие жители |',
        '| --- | --- | ---: | ---: | --- | --- | --- |',
    ]
    for area, parameters, houses, scored in rows:
        cells = (area['name'], parameters['name'], len(scored.recommendations), len(scored.alternatives),
                 scores_text(scored.recommendations), scores_text(scored.alternatives),
                 pair_text(scored, houses, area, parameters['R']))
        lines.append('| ' + ' | '.join(map(str, cells)) + ' |')

    lines.extend(['', '## Контрольные сценарии', '', *examples, '', '## Воспроизведение', '',
                  'Установите версии из `requirements.txt` и выполните из корня проекта.', '', '```sh',
                  f'curl -fL "{SOURCE_URL}" -o stage4-city.json',
                  'python scripts/generate_alternative_places.py stage4-city.json', '```', '',
                  'Генератор проверяет SHA-256, валидирует выгрузку и использует штатные выборку области '
                  'и расчёт выдачи. Таблица записывается в `docs/research/alternative-places.md`.', ''])
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('city_file', type=Path, help='Закреплённый городской JSON')
    parser.add_argument('--output', type=Path, default=OUTPUT, help='Путь к Markdown-таблице')
    args = parser.parse_args()
    raw = args.city_file.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_HASH:
        parser.error(f'Для матрицы нужен файл {SOURCE_URL} с SHA-256 {SOURCE_HASH}')
    bundle = validate_bundle(json.loads(raw))
    args.output.write_text(render_report(bundle), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
