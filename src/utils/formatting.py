"""Conversion of analysis data and provenance to the public JSON representation."""
from dataclasses import asdict
from uuid import uuid4

from src.domain.models import Area, CacheInfo, LoadedData, ScoringResult


def cache_metadata(houses_info, competitors_info):
    return {key: asdict(value) for key, value in (
        ('houses', houses_info), ('competitors', competitors_info))
        if isinstance(value, CacheInfo)}


def analysis_payload(area: Area, business: str, parameters: dict,
                     loaded: LoadedData, scored: ScoringResult,
                     half: int, notice: str | None, *, calculated_at: str,
                     quality: dict, explanations: list[dict]) -> dict:
    houses, competitors = loaded.houses, loaded.competitors
    recommendations = [{**item, 'explanation': explanation}
                       for item, explanation in zip(scored.recommendations, explanations, strict=True)]
    return {
        'status': 'success',
        'district': area['key'],
        'district_name': area['name'],
        'business': business,
        'business_name': parameters['name'],
        'analysis_id': str(uuid4()),
        'calculated_at': calculated_at,
        'analysis_context': {'custom': area['custom'], 'requested_radius_m': area['radius'],
                             'center': list(area['center'])},
        'data_quality': quality,
        'parameters': {'radius_m': parameters['R'], 'alpha': parameters['alpha']},
        'recommendations': recommendations,
        'source': loaded.source,
        'data_meta': loaded.metadata,
        'warning': loaded.warning,
        'notice': notice,
        'center': list(area['center']),
        'half_m': half,
        'stats': {'houses': int(len(houses)), 'residents': int(houses[:, 2].sum()),
                  'competitors': int(len(competitors))},
        'best': recommendations[0],
        'grid': scored.grid,
        'centroids': scored.centroids,
        'houses': [{'lat': float(h[0]), 'lng': float(h[1]), 'residents': int(h[2])}
                   for h in houses],
        'competitors': [{'lat': float(c[0]), 'lng': float(c[1])} for c in competitors],
    }
