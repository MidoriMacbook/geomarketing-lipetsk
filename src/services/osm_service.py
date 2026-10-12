"""OpenStreetMap loading and resident estimation without HTTP dependencies."""
import math
from urllib.parse import urlparse
import numpy as np
import requests

from src.config import (
    OVERPASS_URLS, HEADERS, DISTRICTS, LIPETSK_BOUNDS, MIN_RADIUS, MAX_RADIUS,
    APARTMENT_TYPES, PRIVATE_TYPES, DEFAULT_LEVELS, LIVING_SHARE, M2_PER_RESIDENT,
    PERSONS_PER_FLAT, PERSONS_PER_PRIVATE_HOUSE, MIN_FOOTPRINT_M2, COMPETITOR_MARGIN_M,
    NON_RESIDENTIAL_KEYS, YES_MIN_LEVELS_APARTMENTS,
    YES_MIN_FOOTPRINT_APARTMENTS, YES_MAX_FOOTPRINT_PRIVATE,
)
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.models import CacheInfo
from src.services.cache_service import _cached
from src.utils.geo import _bbox, _footprint_m2
from src.utils.validation import area_for, custom_area

BUSINESS_TAGS = {key: info['tags'] for key, info in BUSINESS_CATALOG.items()}


def competitor_margin(business):
    return max(COMPETITOR_MARGIN_M, BUSINESS_CATALOG[business]['R'])


def competitor_cache_name(business, area):
    name = f'comp_{business}_{cache_key(area)}'
    margin = competitor_margin(business)
    return f'{name}_halo{margin}' if margin > COMPETITOR_MARGIN_M else name


def _overpass(query):
    errors = []
    for url in OVERPASS_URLS:
        host = urlparse(url).hostname
        for attempt in range(1):
            try:
                resp = requests.post(url, data={'data': query}, headers=HEADERS, timeout=(3, 10))
                resp.raise_for_status()
                data = resp.json()
                remark = data.get('remark', '')
                if 'error' in remark.lower():   # запрос не уложился во время или не хватило памяти
                    raise RuntimeError(remark)
                return data['elements']
            except Exception as exc:  # noqa: BLE001 - пробуем следующий сервер
                errors.append(f'{host}: {str(exc)[:110]}')
                break
    raise RuntimeError('Overpass API недоступен (' + '; '.join(errors) + ')')


def _num(value):
    """'5', '5;6', '5.5' -> число; иначе None."""
    if value is None:
        return None
    try:
        number = float(str(value).replace(',', '.').split(';')[0])
        return number if math.isfinite(number) and number > 0 else None
    except ValueError:
        return None


def estimate_residents(tags, footprint):
    """Число жителей по тегам здания. None — здание не жилое или непонятно, жилое ли оно."""
    btype = tags.get('building')
    levels = _num(tags.get('building:levels'))
    flats = _num(tags.get('building:flats'))

    if btype == 'yes':
        # В OSM много домов размечены просто building=yes: угадываем по этажности и адресу.
        if any(key in tags for key in NON_RESIDENTIAL_KEYS):
            return None
        if flats:
            return flats * PERSONS_PER_FLAT
        if levels is not None and levels >= YES_MIN_LEVELS_APARTMENTS and footprint >= YES_MIN_FOOTPRINT_APARTMENTS:
            return footprint * levels * LIVING_SHARE / M2_PER_RESIDENT
        if (levels is None or levels <= 2) and footprint <= YES_MAX_FOOTPRINT_PRIVATE and 'addr:housenumber' in tags:
            return PERSONS_PER_PRIVATE_HOUSE
        return None

    if flats:
        return flats * PERSONS_PER_FLAT
    if btype in PRIVATE_TYPES:
        return PERSONS_PER_PRIVATE_HOUSE
    return footprint * (levels or DEFAULT_LEVELS) * LIVING_SHARE / M2_PER_RESIDENT


def _load_houses(district):
    lat0, lng0 = district['center']
    types = '|'.join(sorted(APARTMENT_TYPES | PRIVATE_TYPES))
    box = _bbox(district['center'], district['radius'])
    query = (f'[out:json][timeout:8];('
             f'way["building"~"^({types})$"]({box});'
             f'way["building"="yes"]["building:levels"]({box});'
             f'way["building"="yes"]["addr:housenumber"]({box});'
             f');out body geom;')
    rows = []
    for el in _overpass(query):
        geom = el.get('geometry')
        if not geom or len(geom) < 3:
            continue
        footprint = _footprint_m2(geom)
        if footprint < MIN_FOOTPRINT_M2:
            continue
        residents = estimate_residents(el.get('tags', {}), footprint)
        if residents is None:
            continue
        lat = sum(g['lat'] for g in geom) / len(geom)
        lng = sum(g['lon'] for g in geom) / len(geom)
        dx = (lng - lng0) * 111_000 * math.cos(math.radians(lat0))
        dy = (lat - lat0) * 111_000
        if math.hypot(dx, dy) > district['radius']:   # рамка шире круга: срезаем углы
            continue
        rows.append([round(lat, 6), round(lng, 6), max(1, round(residents))])
    return rows


def _load_competitors(business, district):
    lat0, lng0 = district['center']
    radius = district['radius'] + competitor_margin(business)
    box = _bbox(district['center'], radius)
    parts = '\n'.join(f'nwr[{tag}]({box});' for tag in BUSINESS_TAGS[business])
    query = f'[out:json][timeout:8];({parts});out center tags;'
    seen, rows = set(), []
    for el in _overpass(query):
        if el['type'] == 'node':
            lat, lng = el['lat'], el['lon']
        elif 'center' in el:
            lat, lng = el['center']['lat'], el['center']['lon']
        else:
            continue
        key = (round(lat, 4), round(lng, 4))  # один объект мог попасть дважды (точка и контур)
        if key not in seen:
            seen.add(key)
            rows.append([round(lat, 6), round(lng, 6)])
    return rows


def get_houses(area, refresh=False):
    def load_usable_houses():
        rows = _load_houses(area)
        if len(rows) < 5:
            raise RuntimeError(f'в OpenStreetMap найдено слишком мало домов ({len(rows)})')
        return rows
    data, cached = _cached(f'houses_{cache_key(area)}', load_usable_houses, refresh)
    return np.array(data, dtype=float).reshape(-1, 3), cached


def get_competitors(business, area, refresh=False):
    data, cached = _cached(competitor_cache_name(business, area), lambda: _load_competitors(business, area),
                           refresh, allow_empty=True)
    return np.array(data, dtype=float).reshape(-1, 2), cached


def cache_key(area):
    lat, lng = area['center']
    return f'{area["key"]}_{lat:.6f}_{lng:.6f}_{area["radius"]}'

