"""Загрузка домов и конкурентов из OpenStreetMap через Overpass API.

Сохранённые копии читаются сразу; обновление запрашивается пользователем.
После 7 дней данные помечаются устаревшими. Для подложки карты нужен интернет.
"""
import json
import math
import os
import logging
import time
import tempfile
from dataclasses import dataclass
from threading import Lock
from urllib.parse import urlparse
from pathlib import Path

import numpy as np
import requests
from businesses import BUSINESS_CATALOG

OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',   # бывший overpass.kumi.systems
]
HEADERS = {'User-Agent': 'GeoMarketingLipetsk/1.0 (student project)'}
CACHE_DIR = Path(os.environ.get('CACHE_DIR', Path(__file__).parent / 'cache'))
SNAPSHOT_DIR = Path(__file__).parent / 'data' / 'snapshots'
CACHE_TTL = 7 * 24 * 3600
_CACHE_LOCKS = [Lock() for _ in range(32)]
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CacheInfo:
    cached: bool
    fetched_at: float
    stale: bool = False
    warning: str | None = None

    def __bool__(self):
        return self.cached

# Районы анализа: центр (широта, долгота) и радиус в метрах.
# Университетский: OSM relation 17717422, Nominatim, проверено 2026-10-11.
DISTRICTS = {
    'eleytsky': {'name': 'мкр. Елецкий', 'center': (52.5935, 39.4800), 'radius': 1000},
    'universitetsky': {'name': 'мкр. Университетский', 'center': (52.605945, 39.505230), 'radius': 1000},
    'center': {'name': 'Центр (Быханов сад)', 'center': (52.6122, 39.5843), 'radius': 1000},
}

# Границы поиска для произвольной области (с запасом вокруг Липецка), чтобы не слать запросы куда попало
LIPETSK_BOUNDS = {'lat': (52.50, 52.72), 'lng': (39.35, 39.80)}
MIN_RADIUS, MAX_RADIUS = 500, 1500


def area_for(district_key):
    """Готовый район -> область анализа."""
    return {'key': district_key, 'custom': False, **DISTRICTS[district_key]}


def custom_area(lat, lng, radius):
    """Произвольная область: центр — клик на карте. Кэш хранится отдельно для каждой области."""
    lat, lng = round(lat, 4), round(lng, 4)
    radius = int(min(max(radius, MIN_RADIUS), MAX_RADIUS))
    return {'key': f'custom_{lat:.4f}_{lng:.4f}_{radius}', 'custom': True,
            'name': 'Выбранная область', 'center': (lat, lng), 'radius': radius}


# Теги OSM, по которым ищем конкурентов
BUSINESS_TAGS = {key: info['tags'] for key, info in BUSINESS_CATALOG.items()}


def competitor_margin(business):
    return max(COMPETITOR_MARGIN_M, BUSINESS_CATALOG[business]['R'])


def competitor_cache_name(business, area):
    name = f'comp_{business}_{cache_key(area)}'
    margin = competitor_margin(business)
    return f'{name}_halo{margin}' if margin > COMPETITOR_MARGIN_M else name

# --- Допущения для оценки числа жителей (калибруйте по данным Росстата / ГИС ЖКХ) ---
APARTMENT_TYPES = {'apartments', 'residential', 'dormitory'}
PRIVATE_TYPES = {'house', 'detached', 'semidetached_house'}
DEFAULT_LEVELS = 5            # этажность, если в OSM не указана
LIVING_SHARE = 0.75           # доля жилой площади от площади всех этажей
M2_PER_RESIDENT = 20          # м² общей площади на одного жителя
PERSONS_PER_FLAT = 2.4        # если в OSM указано число квартир (building:flats)
PERSONS_PER_PRIVATE_HOUSE = 3
MIN_FOOTPRINT_M2 = 40         # отсекаем сараи и пристройки
COMPETITOR_MARGIN_M = 400     # конкуренты чуть за границей района тоже влияют


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


def _bbox(center, radius):
    """Прямоугольник вокруг центра в формате Overpass: юг,запад,север,восток.
    Фильтр по рамке работает намного быстрее, чем around (по расстоянию)."""
    lat, lng = center
    dlat = radius / 111_000
    dlng = radius / (111_000 * math.cos(math.radians(lat)))
    return f'{lat - dlat:.6f},{lng - dlng:.6f},{lat + dlat:.6f},{lng + dlng:.6f}'


def _read_cache(path, columns, allow_empty):
    payload = json.loads(path.read_text(encoding='utf-8'))
    data = payload['data'] if isinstance(payload, dict) else payload
    saved = float(payload['fetched_at']) if isinstance(payload, dict) else path.stat().st_mtime
    _validate_rows(data, columns, allow_empty)
    if not math.isfinite(saved) or saved <= 0:
        raise ValueError('Invalid cache timestamp')
    return data, saved


def _validate_rows(data, columns, allow_empty):
    if not isinstance(data, list) or (not data and not allow_empty):
        raise ValueError('Empty or invalid OSM data')
    for row in data:
        if not isinstance(row, list) or len(row) != columns:
            raise ValueError('Invalid OSM row')
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in row):
            raise ValueError('Invalid OSM coordinates')
        if not (-90 <= row[0] <= 90 and -180 <= row[1] <= 180):
            raise ValueError('Invalid OSM coordinates')
        if columns == 3 and row[2] <= 0:
            raise ValueError('Invalid population estimate')


def _write_cache(path, data, saved):
    """Replace atomically: concurrent readers never see a partial JSON file."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=CACHE_DIR,
                                         suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump({'fetched_at': saved, 'data': data}, stream, allow_nan=False)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _cached(name, loader, refresh=False, allow_empty=False):
    """Serve saved data immediately; explicit refresh updates it from OSM.

    Age and refresh failures are returned to the UI. Shipped district snapshots
    allow a fresh deployment to work when Overpass is unavailable.
    """
    lock = _CACHE_LOCKS[hash(name) % len(_CACHE_LOCKS)]
    acquired = lock.acquire(blocking=False)
    try:
        path = CACHE_DIR / f'{name}.json'
        columns = 3 if name.startswith('houses_') else 2
        previous = None
        for candidate in (path, SNAPSHOT_DIR / f'{name}.json'):
            try:
                previous = _read_cache(candidate, columns, allow_empty)
                break
            except (OSError, ValueError, KeyError, TypeError):
                continue
        if previous is not None and (not refresh or not acquired):
            data, saved = previous
            stale = time.time() - saved > CACHE_TTL
            return data, CacheInfo(True, saved, stale,
                                  'Данные обновляются другим запросом. Пока показана сохранённая копия.' if not acquired else None)
        if not acquired:
            raise RuntimeError('Загрузка уже выполняется. Повторите запрос позже.')
        try:
            data = loader()
            _validate_rows(data, columns, allow_empty)
        except Exception:
            if previous is None:
                raise
            data, saved = previous
            return data, CacheInfo(True, saved, time.time() - saved > CACHE_TTL,
                                   'Обновление OSM не удалось. Использована сохранённая копия.')
        saved = time.time()
        try:
            _write_cache(path, data, saved)
        except OSError:
            logger.warning('Could not persist OSM cache %s', name, exc_info=True)
        return data, CacheInfo(False, saved)
    finally:
        if acquired:
            lock.release()


def _num(value):
    """'5', '5;6', '5.5' -> число; иначе None."""
    if value is None:
        return None
    try:
        number = float(str(value).replace(',', '.').split(';')[0])
        return number if math.isfinite(number) and number > 0 else None
    except ValueError:
        return None


def _footprint_m2(geom):
    lat0 = geom[0]['lat']
    k_lat = 111_000
    k_lng = 111_000 * math.cos(math.radians(lat0))
    pts = [((g['lon'] - geom[0]['lon']) * k_lng, (g['lat'] - lat0) * k_lat) for g in geom]
    area = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


NON_RESIDENTIAL_KEYS = ('shop', 'amenity', 'office', 'tourism', 'craft', 'industrial', 'man_made', 'healthcare', 'leisure')
YES_MIN_LEVELS_APARTMENTS = 3   # building=yes, 3+ этажей и большая площадь: считаем многоквартирным домом
YES_MIN_FOOTPRINT_APARTMENTS = 250
YES_MAX_FOOTPRINT_PRIVATE = 250


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
