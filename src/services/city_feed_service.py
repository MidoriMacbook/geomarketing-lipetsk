"""Bounded GitHub extract loading with atomic replacement and source dates."""
import json
import logging
import tempfile
import time
from threading import Lock

import numpy as np
import requests

from src.config import CACHE_DIR, CACHE_TTL, CITY_DATA_URL, HEADERS
from src.domain.city_data import select_area, validate_bundle
from src.domain.models import CacheInfo, LoadedData
from src.utils.formatting import cache_metadata
from src.utils.validation import UserError

CACHE_FILE = CACHE_DIR / 'city-v1.json'
MAX_BYTES = 10 * 1024 * 1024
_memory = None
_last_check = 0
_etag = None
_last_error = None
_lock = Lock()
logger = logging.getLogger(__name__)


class FeedUnavailable(RuntimeError):
    """Neither remote data nor a valid local city copy can be used."""


def _save(bundle):
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8',
                                         dir=CACHE_FILE.parent, delete=False) as stream:
            temporary = type(CACHE_FILE)(stream.name)
            json.dump(bundle, stream, sort_keys=True, separators=(',', ':'), allow_nan=False)
        temporary.replace(CACHE_FILE)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _download(previous, refresh):
    global _etag
    headers = {**HEADERS, 'Cache-Control': 'no-cache'}
    if _etag:
        headers['If-None-Match'] = _etag
    # Explicit checks must not be answered by an older CDN cache entry.
    params = {'check': int(time.time())} if refresh else None
    with requests.get(CITY_DATA_URL, headers=headers, params=params,
                      timeout=(3, 12), stream=True) as response:
        if response.status_code == 304:
            if previous is None:
                raise ValueError('304 without a local city copy')
            return previous
        response.raise_for_status()
        chunks, size = [], 0
        for chunk in response.iter_content(65536):
            size += len(chunk)
            if size > MAX_BYTES:
                raise ValueError('City data exceeds download limit')
            chunks.append(chunk)
        bundle = validate_bundle(json.loads(b''.join(chunks)))
        if previous and (bundle['fetched_at'] < previous['fetched_at']
                         or bundle['fetched_at'] == previous['fetched_at']
                         and bundle['version'] != previous['version']):
            raise ValueError('City data date rollback')
        _etag = response.headers.get('ETag')
        return bundle


def _get_bundle(refresh):
    global _memory, _last_check, _last_error
    if not _lock.acquire(blocking=False):
        if _memory is None:
            raise FeedUnavailable('City data is loading')
        return _memory, 'checking', True, 'Проверка обновлений уже выполняется. Показана доступная версия.'
    try:
        if _memory is None:
            try:
                if CACHE_FILE.stat().st_size > MAX_BYTES:
                    raise ValueError('City cache too large')
                _memory = validate_bundle(json.loads(CACHE_FILE.read_bytes()))
            except (OSError, ValueError, TypeError, KeyError):
                pass
        if _memory is not None and not refresh and time.time() - _last_check < 3600:
            return _memory, 'unavailable' if _last_error else 'current', True, _last_error
        previous = _memory
        try:
            bundle = _download(previous, refresh)
            changed = previous is None or previous['version'] != bundle['version']
            if changed:
                try:
                    _save(bundle)
                except OSError:
                    logger.warning('Could not persist daily city data')
            _memory = bundle
            _last_error = None
            return bundle, ('updated' if changed else 'unchanged') if refresh else 'current', not changed, None
        except (requests.RequestException, OSError, ValueError, TypeError, KeyError):
            _last_error = 'Не удалось проверить ежедневную выгрузку. Показана последняя доступная копия с прежней датой.'
            logger.warning('Daily city data unavailable; keeping last complete version')
            if previous is None:
                raise FeedUnavailable(_last_error) from None
            return previous, 'unavailable', True, _last_error
        finally:
            _last_check = time.time()
    finally:
        _lock.release()


def load(area, business, refresh=False):
    bundle, status, cached, warning = _get_bundle(refresh)
    houses, competitors = select_area(bundle, area, business)
    if len(houses) < 5:
        raise UserError('В этой области в ежедневной выгрузке мало жилых домов. '
                        'Выберите другое место или увеличьте радиус.')
    age = time.time() - bundle['fetched_at']
    if age > 2 * 86400:
        warning = ' '.join(filter(None, [warning, 'Выгрузка не обновлялась больше двух суток. Проверьте изменения на местности.']))
    info = CacheInfo(cached, bundle['fetched_at'], age > CACHE_TTL, warning)
    return LoadedData(np.asarray(houses, dtype=float).reshape(-1, 3),
                      np.asarray(competitors, dtype=float).reshape(-1, 2),
                      'cache' if cached else 'osm', warning, cache_metadata(info, info),
                      {'mode': 'daily', 'status': status, 'version': bundle['version'],
                       'fetched_at': bundle['fetched_at'], 'checked_at': _last_check,
                       'interval_hours': 24})
