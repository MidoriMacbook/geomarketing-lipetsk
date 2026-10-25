"""Validated daily city extract and the existing area/competitor geometry rules."""
import hashlib
import json
import math
import time

from src.config import DISTRICTS, LIPETSK_BOUNDS, MAX_RADIUS, COMPETITOR_MARGIN_M
from src.domain.businesses import BUSINESS_CATALOG
from src.utils.geo import _bbox

SCHEMA_VERSION = 1
# Covers every allowed center plus 1500m analysis and the largest 900m halo.
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
    bundle['version'] = digest(bundle)
    return validate_bundle(bundle)


def validate_bundle(bundle):
    if not isinstance(bundle, dict) or set(bundle) != {
            'schema', 'coverage', 'fetched_at', 'houses', 'competitors', 'version'}:
        raise ValueError('Invalid city data fields')
    if bundle['schema'] != SCHEMA_VERSION or bundle['coverage'] != COVERAGE:
        raise ValueError('Unsupported city data coverage/schema')
    saved = bundle['fetched_at']
    if (isinstance(saved, bool) or not isinstance(saved, (int, float))
            or not math.isfinite(saved) or saved <= 0 or saved > time.time() + 300):
        raise ValueError('Invalid source date')
    competitors = bundle['competitors']
    if not isinstance(competitors, dict) or set(competitors) != set(BUSINESS_CATALOG):
        raise ValueError('Incomplete business catalog')
    for rows, columns in [(bundle['houses'], 3), *[(r, 2) for r in competitors.values()]]:
        if not isinstance(rows, list) or len(rows) > 200000:
            raise ValueError('Invalid city rows')
        for row in rows:
            if (not isinstance(row, list) or len(row) != columns
                    or any(isinstance(v, bool) or not isinstance(v, (int, float))
                           or not math.isfinite(v) for v in row)
                    or not COVERAGE['south'] <= row[0] <= COVERAGE['north']
                    or not COVERAGE['west'] <= row[1] <= COVERAGE['east']
                    or (columns == 3 and row[2] <= 0)):
                raise ValueError('Invalid city coordinate/population')
    if len(bundle['houses']) < 500 or sum(map(len, competitors.values())) < 10:
        raise ValueError('Incomplete city extract')
    if bundle['version'] != digest(bundle):
        raise ValueError('City data checksum mismatch')
    # Presets must remain usable; an incomplete city response cannot replace them.
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
    houses = [row for row in bundle['houses'] if in_circle(row, area)]
    halo = max(COMPETITOR_MARGIN_M, BUSINESS_CATALOG[business]['R'])
    south, west, north, east = map(float, _bbox(area['center'], area['radius'] + halo).split(','))
    if not (COVERAGE['south'] <= south and COVERAGE['west'] <= west
            and COVERAGE['north'] >= north and COVERAGE['east'] >= east):
        raise ValueError('Area is outside the daily extract')
    seen, competitors = set(), []
    for row in bundle['competitors'][business]:
        if south <= row[0] <= north and west <= row[1] <= east:
            key = tuple(round(v, 4) for v in row)
            if key not in seen:
                seen.add(key); competitors.append(row)
    return houses, competitors
