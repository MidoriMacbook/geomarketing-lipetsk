"""Проверяемый JSON-кэш, атомарная замена и блокировки без ожидания."""
import json
import logging
import math
import tempfile
import time
from pathlib import Path
from threading import Lock

from src.config import CACHE_DIR, SNAPSHOT_DIR, CACHE_TTL
from src.domain.models import CacheInfo
from src.domain.provenance import ProvenancedRows, provenance_summary, validate_provenance

_CACHE_LOCKS = [Lock() for _ in range(32)]
logger = logging.getLogger(__name__)


def _read_cache(path, columns, allow_empty):
    payload = json.loads(path.read_text(encoding='utf-8'))
    data = payload['data'] if isinstance(payload, dict) else payload
    saved = float(payload['fetched_at']) if isinstance(payload, dict) else path.stat().st_mtime
    _validate_rows(data, columns, allow_empty)
    if isinstance(payload, dict) and 'provenance' in payload:
        data = ProvenancedRows(data, validate_provenance(payload['provenance'], data, columns))
    if not math.isfinite(saved) or saved <= 0:
        raise ValueError('Invalid cache timestamp')
    return data, saved


def _validate_rows(data, columns, allow_empty):
    if not isinstance(data, list) or (not data and not allow_empty):
        raise ValueError('Empty or invalid OSM data')
    for row in data:
        if not isinstance(row, list) or len(row) != columns:
            raise ValueError('Invalid OSM row')
        try:
            finite = all(type(v) in (int, float) and math.isfinite(v) for v in row)
        except OverflowError:
            finite = False
        if not finite:
            raise ValueError('Invalid OSM coordinates')
        if not (-90 <= row[0] <= 90 and -180 <= row[1] <= 180):
            raise ValueError('Invalid OSM coordinates')
        if columns == 3 and row[2] <= 0:
            raise ValueError('Invalid population estimate')
    if getattr(data, 'provenance', None) is not None:
        validate_provenance(data.provenance, data, columns)


def _write_cache(path, data, saved):
    """Атомарная замена: параллельный читатель не увидит неполный JSON."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=CACHE_DIR,
                                         suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            payload = {'fetched_at': saved, 'data': data}
            if getattr(data, 'provenance', None) is not None:
                payload['provenance'] = data.provenance
            json.dump(payload, stream, allow_nan=False)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _cached(name, loader, refresh=False, allow_empty=False):
    """Сразу отдаём сохранённые данные; явное обновление запрашивает OSM.

    Возраст и сбой обновления передаются интерфейсу. Готовые районные снимки
    позволяют новому развёртыванию работать при недоступности Overpass.
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
            except (OSError, ValueError, KeyError, TypeError, OverflowError):
                continue
        if previous is not None and (not refresh or not acquired):
            data, saved = previous
            stale = time.time() - saved > CACHE_TTL
            return data, CacheInfo(True, saved, stale,
                                  'Данные обновляются другим запросом. Пока показана сохранённая копия.' if not acquired else None,
                                  provenance_summary(data))
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
                                   'Обновление OSM не удалось. Использована сохранённая копия.', provenance_summary(data))
        provenance = getattr(data, 'provenance', None)
        saved = min((record['fetched_at'] for record in provenance['records']),
                    default=time.time()) if provenance else time.time()
        try:
            _write_cache(path, data, saved)
        except OSError:
            logger.warning('Could not persist OSM cache %s', name, exc_info=True)
        return data, CacheInfo(False, saved, provenance=provenance_summary(data))
    finally:
        if acquired:
            lock.release()
