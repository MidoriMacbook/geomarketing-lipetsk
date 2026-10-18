"""Project-root paths and unchanged data/model parameters."""
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
_cache_path = Path(os.environ.get('CACHE_DIR', 'cache')).expanduser()
CACHE_DIR = (_cache_path if _cache_path.is_absolute() else PROJECT_ROOT / _cache_path).resolve()
SNAPSHOT_DIR = PROJECT_ROOT / 'data' / 'snapshots'
CACHE_TTL = 7 * 24 * 3600


def server_host(default: str) -> str:
    return os.environ.get('HOST', default)


def server_port(default: int) -> int:
    return int(os.environ.get('PORT', str(default)))

OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',   # бывший overpass.kumi.systems
]
HEADERS = {'User-Agent': 'GeoMarketingLipetsk/1.0 (student project)'}
DISTRICTS = {
    'eleytsky': {'name': 'мкр. Елецкий', 'center': (52.5935, 39.4800), 'radius': 1000},
    'universitetsky': {'name': 'мкр. Университетский', 'center': (52.605945, 39.505230), 'radius': 1000},
    'center': {'name': 'Центр (Быханов сад)', 'center': (52.6122, 39.5843), 'radius': 1000},
    'pobeda': {'name': 'мкр. Победа', 'center': (52.5745635, 39.5190712), 'radius': 1000},
    'evropeysky': {'name': 'мкр. Европейский', 'center': (52.5773187, 39.5035733), 'radius': 1000},
    'sokol': {'name': 'Сокол', 'center': (52.6397328, 39.6531076), 'radius': 1000},
    'nlmk': {'name': 'НЛМК', 'center': (52.5817828, 39.6193687), 'radius': 1000},
    'traktorny': {'name': 'Тракторный', 'center': (52.5358289, 39.5896508), 'radius': 1000},
    'matyrsky': {'name': 'Матырский', 'center': (52.5350695, 39.7960791), 'radius': 1000},
    'syrsky_rudnik': {'name': 'Сырский Рудник', 'center': (52.5792160, 39.4834900), 'radius': 1000},
}

# Границы поиска для произвольной области (с запасом вокруг Липецка), чтобы не слать запросы куда попало
LIPETSK_BOUNDS = {'lat': (52.50, 52.72), 'lng': (39.35, 39.80)}
MIN_RADIUS, MAX_RADIUS = 500, 1500
GRID_SIZE = 60
N_CLUSTERS = 3
LOW_DATA_RESIDENTS = 3000  # меньше жителей в районе — предупреждаем о неполных данных
MIN_HOUSES = 5          # меньше — считаем, что в OSM для района мало данных
DEMO_HALF_SIZE_M = 600  # размер области анализа для демо-данных
MIN_RECOMMENDATION_DISTANCE_M = 250
MAX_RECOMMENDATIONS = 3
APARTMENT_TYPES = {'apartments', 'residential', 'dormitory'}
PRIVATE_TYPES = {'house', 'detached', 'semidetached_house'}
DEFAULT_LEVELS = 5            # этажность, если в OSM не указана
LIVING_SHARE = 0.75           # доля жилой площади от площади всех этажей
M2_PER_RESIDENT = 20          # м² общей площади на одного жителя
PERSONS_PER_FLAT = 2.4        # если в OSM указано число квартир (building:flats)
PERSONS_PER_PRIVATE_HOUSE = 3
MIN_FOOTPRINT_M2 = 40         # отсекаем сараи и пристройки
COMPETITOR_MARGIN_M = 400     # конкуренты чуть за границей района тоже влияют
NON_RESIDENTIAL_KEYS = ('shop', 'amenity', 'office', 'tourism', 'craft', 'industrial', 'man_made', 'healthcare', 'leisure')
YES_MIN_LEVELS_APARTMENTS = 3   # building=yes, 3+ этажей и большая площадь: считаем многоквартирным домом
YES_MIN_FOOTPRINT_APARTMENTS = 250
YES_MAX_FOOTPRINT_PRIVATE = 250
