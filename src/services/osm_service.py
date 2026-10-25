"""OpenStreetMap loading and resident estimation without HTTP dependencies."""
import math
import logging
import time
from contextlib import contextmanager
from contextvars import ContextVar
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
logger = logging.getLogger(__name__)
_deadline = ContextVar('overpass_deadline', default=None)


@contextmanager
def loading_budget():
    """Share a retry budget across houses and competitors in one calculation."""
    token = _deadline.set(time.monotonic() + 85)
    try:
        yield
    finally:
        _deadline.reset(token)


def competitor_margin(business):
    return max(COMPETITOR_MARGIN_M, BUSINESS_CATALOG[business]['R'])


def competitor_cache_name(business, area):
    name = f'comp_{business}_{cache_key(area)}'
    margin = competitor_margin(business)
    return f'{name}_halo{margin}' if margin > COMPETITOR_MARGIN_M else name


def _overpass(query):
    errors = []
    deadline = _deadline.get() or time.monotonic() + 85
    for url in OVERPASS_URLS:
        host = urlparse(url).hostname
        for attempt in range(2):
            remaining = deadline - time.monotonic()
            if remaining <= 4:
                raise RuntimeError('Overpass API: loading time budget exhausted')
            resp = None
            started = time.monotonic()
            retry = False
            try:
                # Query execution plus the upstream queue can exceed ten seconds.
                resp = requests.get(url, params={'data': query}, headers=HEADERS,
                                    timeout=(3, min(40, remaining - 3)))
                resp.raise_for_status()
                data = resp.json()
                if not isinstance(data, dict) or not isinstance(data.get('elements'), list):
                    raise ValueError('Invalid Overpass response')
                if data.get('remark'):
                    raise ValueError('Incomplete Overpass response: ' + str(data['remark'])[:160])
                return data['elements']
            except Exception as exc:  # noqa: BLE001 - fail over without losing saved data
                # Do not log URLs containing user coordinates or entire response bodies.
                status = getattr(resp, 'status_code', None)
                reason = getattr(exc.args[0], 'reason', None) if exc.args else None
                os_errno = getattr(getattr(reason, '__cause__', None), 'errno', None)
                logger.warning('Overpass %s failed: %s cause=%s errno=%s status=%s',
                               host, type(exc).__name__, type(reason).__name__, os_errno, status)
                errors.append(f'{host}: {type(exc).__name__} status={status}')
                # A gateway may reject immediately while the data server is healthy.
                # Retry only this fast transient failure, never a timeout or rate limit.
                retry = (attempt == 0 and status in (502, 503, 504)
                         and time.monotonic() - started < 3
                         and deadline - time.monotonic() > 45)
            finally:
                if resp is not None:
                    resp.close()
            if not retry:
                break
            time.sleep(.25)
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
    query = (f'[out:json][timeout:25];('
             f'way["building"~"^({types})$"]({box});'
             f'way["building"="yes"]["building:levels"]({box});'
             f'way["building"="yes"]["addr:housenumber"]({box});'
             f');out body geom;')
    return parse_houses(_overpass(query), district)


def parse_houses(elements, district=None):
    """Use identical footprint/population rules in live and daily collection."""
    rows = []
    for el in elements:
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
        if district is not None:
            lat0, lng0 = district['center']
            dx = (lng - lng0) * 111_000 * math.cos(math.radians(lat0))
            dy = (lat - lat0) * 111_000
            if math.hypot(dx, dy) > district['radius']:
                continue
        rows.append([round(lat, 6), round(lng, 6), max(1, round(residents))])
    return rows


def _load_competitors(business, district):
    lat0, lng0 = district['center']
    radius = district['radius'] + competitor_margin(business)
    box = _bbox(district['center'], radius)
    parts = '\n'.join(f'nwr[{tag}]({box});' for tag in BUSINESS_TAGS[business])
    query = f'[out:json][timeout:25];({parts});out body center;'
    return parse_competitors(_overpass(query))


def parse_competitors(elements, deduplicate=True):
    seen, rows = set(), []
    for el in elements:
        if el['type'] == 'node':
            lat, lng = el['lat'], el['lon']
        elif 'center' in el:
            lat, lng = el['center']['lat'], el['center']['lon']
        else:
            continue
        key = (round(lat, 4), round(lng, 4))  # один объект мог попасть дважды (точка и контур)
        if not deduplicate or key not in seen:
            seen.add(key)
            rows.append([round(lat, 6), round(lng, 6)])
    return rows


def get_houses(area, refresh=False, *, cached_only=False):
    def load_usable_houses():
        if cached_only:
            raise RuntimeError('No saved houses for this area')
        rows = _load_houses(area)
        if len(rows) < 5:
            raise RuntimeError(f'в OpenStreetMap найдено слишком мало домов ({len(rows)})')
        return rows
    data, cached = _cached(f'houses_{cache_key(area)}', load_usable_houses, refresh)
    return np.array(data, dtype=float).reshape(-1, 3), cached


def get_competitors(business, area, refresh=False, *, cached_only=False):
    def load_rows():
        if cached_only:
            raise RuntimeError('No saved competitors for this area')
        return _load_competitors(business, area)
    data, cached = _cached(competitor_cache_name(business, area), load_rows,
                           refresh, allow_empty=True)
    return np.array(data, dtype=float).reshape(-1, 2), cached


def cache_key(area):
    lat, lng = area['center']
    return f'{area["key"]}_{lat:.6f}_{lng:.6f}_{area["radius"]}'
