"""Preset district and business catalog representation."""
from src.config import DISTRICTS
from src.domain.businesses import BUSINESS_CATALOG


def get_catalog() -> dict:
    return {
        'status': 'success',
        'businesses': [{'key': key, 'name': item['name'], 'radius_m': item['R'],
                        'alpha': item['alpha']} for key, item in BUSINESS_CATALOG.items()],
        'districts': [{'key': key, 'name': item['name'], 'center': list(item['center']),
                       'radius_m': item['radius']} for key, item in DISTRICTS.items()],
    }
