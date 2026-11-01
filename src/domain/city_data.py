"""Проверенная ежедневная городская выгрузка и правила геометрии области и конкурентов."""
import hashlib
import json
import math
import time

from src.config import DISTRICTS, LIPETSK_BOUNDS, COMPETITOR_MARGIN_M
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.provenance import ProvenancedRows, filter_rows, validate_provenance
from src.utils.geo import _bbox

SCHEMA_VERSION = 1
# Покрываем все разрешённые центры, радиус анализа 1500 м и максимальный запас 900 м.
COVERAGE = {'south': LIPETSK_BOUNDS['lat'][0] - .025,
            'west': LIPETSK_BOUNDS['lng'][0] - .04,
            'north': LIPETSK_BOUNDS['lat'][1] + .025,
            'east': LIPETSK_BOUNDS['lng'][1] + .04}


def digest(bundle):
    data = {key: value for key, value in bundle.items() if key != 'version'}
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':'),
                                     allow_nan=False).encode()).hexdigest()


def make_bundle(houses, competitors, fetched_at):
    bundle = {'schema': SCHEMA_VERSION, 'coverage': dict(COVERAGE),
              'fetched_at': fetched_at, 'houses': houses, 'competitors': competitors}
    house_provenance = getattr(houses, 'provenance', None)
    competitor_provenance = {key: getattr(rows, 'provenance', None) for key, rows in competitors.items()}
    if house_provenance is not None or any(value is not None for value in competitor_provenance.values()):
        bundle['provenance'] = {'schema': 1, 'houses': house_provenance, 'competitors': competitor_provenance}
    bundle['version'] = digest(bundle)
    return validate_bundle(bundle)


def _finite_number(value):
    try:
        return (not isinstance(value, bool) and isinstance(value, (int, float))
                and math.isfinite(value))
    except OverflowError:
        return False


def validate_bundle(bundle):
    required = {'schema', 'coverage', 'fetched_at', 'houses', 'competitors', 'version'}
    if (not isinstance(bundle, dict) or not required <= set(bundle)
            or set(bundle) - required - {'provenance'}):
        raise ValueError('Invalid city data fields')
    if bundle['schema'] != SCHEMA_VERSION or bundle['coverage'] != COVERAGE:
        raise ValueError('Unsupported city data coverage/schema')
    saved = bundle['fetched_at']
    if not _finite_number(saved) or saved <= 0 or saved > time.time() + 300:
        raise ValueError('Invalid source date')
    competitors = bundle['competitors']
    if not isinstance(competitors, dict) or set(competitors) != set(BUSINESS_CATALOG):
        raise ValueError('Incomplete business catalog')
    for rows, columns in [(bundle['houses'], 3), *[(r, 2) for r in competitors.values()]]:
        if not isinstance(rows, list) or len(rows) > 200000:
            raise ValueError('Invalid city rows')
        for row in rows:
            if (not isinstance(row, list) or len(row) != columns
                    or any(not _finite_number(v) for v in row)
                    or not COVERAGE['south'] <= row[0] <= COVERAGE['north']
                    or not COVERAGE['west'] <= row[1] <= COVERAGE['east']
                    or (columns == 3 and row[2] <= 0)):
                raise ValueError('Invalid city coordinate/population')
    try:
        population = math.fsum(row[2] for row in bundle['houses'])
    except OverflowError:
        raise ValueError('Invalid city population total') from None
    if not math.isfinite(population):
        raise ValueError('Invalid city population total')
    if len(bundle['houses']) < 500 or sum(map(len, competitors.values())) < 10:
        raise ValueError('Incomplete city extract')
    if 'provenance' in bundle:
        provenance = bundle['provenance']
        if (not isinstance(provenance, dict) or type(provenance.get('schema')) is not int or provenance['schema'] != 1
                or set(provenance) != {'schema', 'houses', 'competitors'}
                or not isinstance(provenance['competitors'], dict)
                or set(provenance['competitors']) != set(competitors)):
            raise ValueError('Некорректное происхождение городской выгрузки')
        for metadata, rows, columns in [(provenance['houses'], bundle['houses'], 3),
                                        *[(provenance['competitors'][key], rows, 2)
                                          for key, rows in competitors.items()]]:
            if metadata is not None:
                validate_provenance(metadata, rows, columns)
    if bundle['version'] != digest(bundle):
        raise ValueError('City data checksum mismatch')
    # Готовые районы должны оставаться пригодными: неполный ответ не заменяет их.
    for district in DISTRICTS.values():
        if sum(in_circle(row, district) for row in bundle['houses']) < 5:
            raise ValueError('Incomplete district coverage')
    return bundle


def in_circle(row, area):
    lat, lng = area['center']
    dx = (row[1] - lng) * 111000 * math.cos(math.radians(lat))
    dy = (row[0] - lat) * 111000
    return math.hypot(dx, dy) <= area['radius']


def select_area(bundle, area, business):
    provenance = bundle.get('provenance', {})
    house_rows = ProvenancedRows(bundle['houses'], provenance.get('houses'))
    houses = filter_rows(house_rows, lambda row: in_circle(row, area))
    halo = max(COMPETITOR_MARGIN_M, BUSINESS_CATALOG[business]['R'])
    south, west, north, east = map(float, _bbox(area['center'], area['radius'] + halo).split(','))
    if not (COVERAGE['south'] <= south and COVERAGE['west'] <= west
            and COVERAGE['north'] >= north and COVERAGE['east'] >= east):
        raise ValueError('Area is outside the daily extract')
    metadata = provenance.get('competitors', {}).get(business)
    if metadata is not None:
        return houses, filter_rows(ProvenancedRows(bundle['competitors'][business], metadata),
                                   lambda row: south <= row[0] <= north and west <= row[1] <= east)
    # Старые выгрузки без ID сохраняют прежнюю семантику чтения и архивных расчётов.
    seen, competitors = set(), []
    for row in bundle['competitors'][business]:
        if south <= row[0] <= north and west <= row[1] <= east:
            key = tuple(round(v, 4) for v in row)
            if key not in seen:
                seen.add(key); competitors.append(row)
    return houses, competitors
