"""Compatibility exports; implementation lives in src services and utilities."""
from src.config import (
    APARTMENT_TYPES, PRIVATE_TYPES, DEFAULT_LEVELS, LIVING_SHARE, M2_PER_RESIDENT,
    PERSONS_PER_FLAT, PERSONS_PER_PRIVATE_HOUSE, MIN_FOOTPRINT_M2, COMPETITOR_MARGIN_M,
    NON_RESIDENTIAL_KEYS, YES_MIN_LEVELS_APARTMENTS,
    YES_MIN_FOOTPRINT_APARTMENTS, YES_MAX_FOOTPRINT_PRIVATE,
)
from src.services.osm_service import (
    OVERPASS_URLS, HEADERS, DISTRICTS, LIPETSK_BOUNDS, MIN_RADIUS, MAX_RADIUS,
    BUSINESS_TAGS, CacheInfo, area_for, custom_area, competitor_margin,
    competitor_cache_name, cache_key, estimate_residents, get_houses, get_competitors,
    _overpass, _num, _load_houses, _load_competitors,
)
from src.services.cache_service import (
    CACHE_DIR, SNAPSHOT_DIR, CACHE_TTL, _CACHE_LOCKS, logger,
    _read_cache, _validate_rows, _write_cache, _cached,
)
from src.utils.geo import _bbox, _footprint_m2
