"""Validated JSON cache, atomic replacement, and nonblocking striped locks."""
import json
import logging
import math
import tempfile
import time
from pathlib import Path
from threading import Lock

from src.config import CACHE_DIR, SNAPSHOT_DIR, CACHE_TTL
from src.domain.models import CacheInfo

_CACHE_LOCKS = [Lock() for _ in range(32)]
logger = logging.getLogger(__name__)


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

