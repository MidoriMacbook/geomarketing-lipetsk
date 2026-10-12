"""Load usable data, apply the existing demo fallback, and assemble analyses."""
import logging
import numpy as np

from src.config import MIN_HOUSES, DEMO_HALF_SIZE_M, LOW_DATA_RESIDENTS
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.models import Area, LoadedData
from src.domain.scoring import score_locations
from src.services import osm_service as osm
from src.utils.formatting import cache_metadata, analysis_payload
from src.utils.validation import UserError, validate_data

logger = logging.getLogger(__name__)

DEMO_HOUSES = {
    'eleytsky': [
        [52.5934, 39.4795, 420], [52.5925, 39.4812, 380], [52.5948, 39.4770, 510],
        [52.5912, 39.4835, 290], [52.5955, 39.4820, 350], [52.5941, 39.4800, 460],
    ],
    'universitetsky': [
        [52.6052, 39.5047, 600], [52.6067, 39.5022, 340], [52.6038, 39.5077, 280],
        [52.6079, 39.5062, 310], [52.6059, 39.5037, 450],
    ],
    'center': [
        [52.6134, 39.5855, 520], [52.6110, 39.5801, 330], [52.6155, 39.5890, 410],
        [52.6085, 39.5840, 270], [52.6120, 39.5830, 480],
    ],
}
DEMO_COMPETITORS = {
    'cafe': {
        'eleytsky': [[52.5928, 39.4790], [52.5950, 39.4815]],
        'universitetsky': [[52.6062, 39.5042], [52.6045, 39.5067]],
        'center': [[52.6128, 39.5850], [52.6100, 39.5815], [52.6150, 39.5880]],
    },
    'pharmacy': {
        'eleytsky': [[52.5940, 39.4805], [52.5915, 39.4830]],
        'universitetsky': [[52.6072, 39.5057]],
        'center': [[52.6118, 39.5835], [52.6090, 39.5850]],
    },
}

def load_data(area: Area, business: str, refresh: bool) -> LoadedData:
    """Return usable rows, source, warnings, and cache provenance."""
    try:
        houses, h_cached = osm.get_houses(area, refresh)
        competitors, c_cached = osm.get_competitors(business, area, refresh)
        houses, competitors = validate_data(houses, competitors)
        if len(houses) < MIN_HOUSES:
            raise RuntimeError(f'в OpenStreetMap найдено слишком мало домов ({len(houses)})')
        metadata = cache_metadata(h_cached, c_cached)
        warnings = sorted({info['warning'] for info in metadata.values() if info['warning']})
        if any(info['stale'] for info in metadata.values()):
            warnings.append('Сохранённым данным больше 7 дней. Обновите их перед принятием решения.')
        return LoadedData(houses, competitors, ('cache' if h_cached and c_cached else 'osm'),
                          ' '.join(warnings) or None, metadata)
    except Exception as exc:  # noqa: BLE001
        if business not in DEMO_COMPETITORS:
            raise UserError('Не удалось загрузить пригодные данные домов и конкурентов '
                            'OpenStreetMap для этого типа бизнеса. '
                            'Повторите позже или выберите другой район.') from exc
        if area['custom']:   # для произвольной области демо-данных нет
            if isinstance(exc, RuntimeError) and 'мало домов' in str(exc):
                raise UserError('В этой области в OpenStreetMap почти нет размеченных жилых домов. '
                                'Выберите другое место или увеличьте радиус.') from exc
            raise UserError('Не удалось загрузить данные OpenStreetMap. '
                            'Повторите через минуту или выберите готовый район.') from exc
        district = area['key']
        houses = np.array(DEMO_HOUSES[district], dtype=float)
        competitors = np.array(DEMO_COMPETITORS[business][district], dtype=float)
        logger.warning('Using demo data for %s: %s', district, exc)
        return LoadedData(houses, competitors, 'demo',
                          'Данные OpenStreetMap сейчас недоступны или неполны.')


def analyze(area: Area, business: str, refresh: bool = False) -> dict:
    if business not in BUSINESS_CATALOG:
        raise UserError('Неизвестный тип бизнеса. Выберите тип из списка.')
    parameters = BUSINESS_CATALOG[business]
    loaded = load_data(area, business, refresh)
    half = DEMO_HALF_SIZE_M if loaded.source == 'demo' else area['radius']
    notice = None
    if loaded.source != 'demo' and loaded.houses[:, 2].sum() < LOW_DATA_RESIDENTS:
        notice = ('В OpenStreetMap для этого района мало размеченных жилых домов, '
                  'поэтому спрос может быть занижен, а результат неточен.')
    scored = score_locations(loaded.houses, loaded.competitors, area['center'], half, parameters)
    return analysis_payload(area, business, parameters, loaded, scored, half, notice)
