"""Загрузка пригодных данных, доступных демонаборов и подготовка результата расчёта."""
import logging
from dataclasses import replace
from datetime import datetime, timezone
from functools import lru_cache
import numpy as np

from src.config import MIN_HOUSES, DEMO_HALF_SIZE_M, LOW_DATA_RESIDENTS, CITY_DATA_URL
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.corrections import Corrections, recommendation_deltas
from src.domain.models import Area, LoadedData
from src.domain.data_quality import assess_data_quality
from src.domain.explanations import explain_recommendations
from src.domain.scoring import score_locations
from src.services import osm_service as osm
from src.services import city_feed_service as city_feed
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
    """Возвращаем пригодные строки, источник, предупреждения и происхождение кэша."""
    feed_warning = None
    if CITY_DATA_URL:
        try:
            return city_feed.load(area, business, refresh)
        except city_feed.FeedUnavailable as exc:
            feed_warning = str(exc)
    try:
        options = {'cached_only': True} if CITY_DATA_URL else {}
        with osm.loading_budget():
            houses, h_cached = osm.get_houses(area, refresh if not CITY_DATA_URL else False, **options)
            competitors, c_cached = osm.get_competitors(business, area, refresh if not CITY_DATA_URL else False, **options)
        houses, competitors = validate_data(houses, competitors)
        if len(houses) < MIN_HOUSES:
            raise RuntimeError(f'в OpenStreetMap найдено слишком мало домов ({len(houses)})')
        metadata = cache_metadata(h_cached, c_cached)
        warnings = sorted({info['warning'] for info in metadata.values() if info['warning']})
        if feed_warning:
            warnings.append(feed_warning)
        if any(info['stale'] for info in metadata.values()):
            warnings.append('Сохранённым данным больше 7 дней. Обновите их перед принятием решения.')
        return LoadedData(houses, competitors, ('cache' if h_cached and c_cached else 'osm'),
                          ' '.join(warnings) or None, metadata,
                          {'mode': 'daily', 'status': 'unavailable', 'interval_hours': 24}
                          if CITY_DATA_URL else None,
                          competitor_ids=getattr(c_cached, 'competitor_ids', ()))
    except Exception as exc:  # noqa: BLE001
        if CITY_DATA_URL:
            raise UserError('Ежедневная выгрузка временно недоступна, а для этой области '
                            'нет пригодной сохранённой копии. Повторите проверку позже.') from exc
        if area['custom']:   # для произвольной области демо-данных нет
            if isinstance(exc, RuntimeError) and 'мало домов' in str(exc):
                raise UserError('В этой области в OpenStreetMap почти нет размеченных жилых домов. '
                                'Выберите другое место или увеличьте радиус.') from exc
            raise UserError('Не удалось загрузить данные OpenStreetMap. '
                            'Повторите через минуту или выберите готовый район.') from exc
        district = area['key']
        if district not in DEMO_HOUSES or district not in DEMO_COMPETITORS.get(business, {}):
            raise UserError('Не удалось загрузить пригодные данные домов и конкурентов '
                            'OpenStreetMap для выбранных района и типа бизнеса. '
                            'Сохранённой копии и демонстрационного набора для этой пары нет. '
                            'Повторите позже или выберите другой район.') from exc
        houses = np.array(DEMO_HOUSES[district], dtype=float)
        competitors = np.array(DEMO_COMPETITORS[business][district], dtype=float)
        logger.warning('Using demo data for %s: %s', district, exc)
        return LoadedData(houses, competitors, 'demo',
                          'Демонстрационные данные: OpenStreetMap сейчас недоступен или неполон. '
                          'Пример показывает работу интерфейса и не подходит для выбора помещения.')


@lru_cache(maxsize=16)
def _cached_score(version, business, center, half, houses_bytes, competitors_bytes, corrections=None):
    # Числовые входы входят в ключ вместе с датой и версией. Даже при
    # неизменной дате источника другая версия массива даёт отдельный результат.
    houses = np.frombuffer(houses_bytes, dtype=float).reshape(-1, 3)
    competitors = np.frombuffer(competitors_bytes, dtype=float).reshape(-1, 2)
    return score_locations(houses, competitors, center, half, BUSINESS_CATALOG[business])


def _score_with_corrections(area, business, loaded, half, corrections):
    effective, context = corrections.apply(loaded)
    version = (
        area['key'], (loaded.delivery or {}).get('version'),
        *(loaded.metadata.get(kind, {}).get('fetched_at') for kind in ('houses', 'competitors')),
    )
    scoring_inputs = (version, business, area['center'], half, loaded.houses.tobytes())
    baseline = _cached_score(*scoring_inputs, loaded.competitors.tobytes())
    if corrections.added or corrections.removed:
        adjusted = np.array([(row['lat'], row['lng']) for row in effective], dtype=float).reshape(-1, 2)
        scored = _cached_score(*scoring_inputs, adjusted.tobytes(), corrections)
        loaded = replace(loaded, competitors=adjusted)
    else:
        scored = baseline
    return loaded, scored, baseline, effective, context


def analyze(area: Area, business: str, refresh: bool = False, *, corrections: Corrections | None = None) -> dict:
    if business not in BUSINESS_CATALOG:
        raise UserError('Неизвестный тип бизнеса. Выберите тип из списка.')
    parameters = BUSINESS_CATALOG[business]
    loaded = load_data(area, business, refresh)
    half = DEMO_HALF_SIZE_M if loaded.source == 'demo' else area['radius']
    notice = None
    if loaded.source != 'demo' and loaded.houses[:, 2].sum() < LOW_DATA_RESIDENTS:
        notice = ('В OpenStreetMap для этого района мало размеченных жилых домов, '
                  'поэтому спрос может быть занижен, а результат неточен.')
    # Качество данных относится к OSM. Личные поправки не меняют сведения об источнике.
    original_competitor_count = len(loaded.competitors)
    if corrections is None:
        scored = score_locations(loaded.houses, loaded.competitors, area['center'], half, parameters)
    else:
        if loaded.source == 'demo':
            raise UserError('Поправки доступны для расчётов по данным OpenStreetMap.')
        loaded, scored, baseline, effective, context = _score_with_corrections(
            area, business, loaded, half, corrections)
    calculated_at = datetime.now(timezone.utc)
    explanations = explain_recommendations(loaded.houses, loaded.competitors, area['center'],
                                           half, parameters, scored.recommendations, scored.centroids)
    quality = assess_data_quality(
        source=loaded.source, metadata=loaded.metadata, house_count=len(loaded.houses),
        residents=int(loaded.houses[:, 2].sum()), competitor_count=original_competitor_count,
        warning=loaded.warning, notice=notice, now=calculated_at)
    payload = analysis_payload(area, business, parameters, loaded, scored, half, notice,
                               calculated_at=quality['assessed_at'], quality=quality,
                               explanations=explanations)
    if corrections is not None:
        payload['competitors'] = effective
        payload['correction_context'] = context
        for row, delta in zip(payload['recommendations'], recommendation_deltas(baseline, scored), strict=True):
            row['correction_delta'] = delta
    return payload
