"""Полнота разметки OSM по одной проверенной городской выгрузке."""
from math import fsum

from src.config import OSM_RELIABILITY_MIN_CITY_OBJECTS, OSM_RELIABILITY_THRESHOLDS
from src.domain.city_data import in_circle
from src.domain.provenance import COMPETITOR_TEXT_LIMITS


def _result(level, code, reason, metrics=None):
    return {'level': level, 'code': code, 'reason': reason, 'metrics': metrics}


def unavailable_data_reliability():
    return _result(None, 'source_unavailable', 'Полная городская выгрузка OSM недоступна.')


def _details_available(provenance):
    # В прежней схеме отдельного признака обогащения нет. Все категории
    # собираются одним запросом, поэтому достаточно свидетельства в одной из них.
    return any(COMPETITOR_TEXT_LIMITS.keys() & record.keys()
               for category in provenance.values() if category is not None
               for record in category['records'])


def _records_at(metadata, indices):
    if not indices:
        return []
    if metadata is None:
        return None
    records = [metadata['records'][index] for index in indices]
    if any(record.get('osm_id') is None for record in records):
        return None
    return records


def _share(count, total):
    return {'count': count, 'share': count / total if count is not None and total else None}


def _missing_counts(records, details_available):
    if records is None or (records and not details_available):
        return None, None, None
    missing_names = sum('name' not in record for record in records)
    missing_addresses = sum('address' not in record for record in records)
    missing_both = sum('name' not in record and 'address' not in record for record in records)
    return missing_names, missing_addresses, missing_both


def _percent(value):
    return f'{value * 100:g}\u00a0%'


def _density_reason(threshold):
    density = f'{threshold:g}'.replace('.', ',')
    return f'В OSM отмечено меньше {density} продуктового магазина на 1\u00a0000 расчётных жителей.'


def _classification(metrics):
    threshold = OSM_RELIABILITY_THRESHOLDS
    if metrics['city_objects'] < OSM_RELIABILITY_MIN_CITY_OBJECTS:
        return 'low', 'few_city_objects', 'В OSM отмечено мало объектов.'
    if not metrics['area_objects']:
        return 'low', 'no_area_objects', 'В OSM в круге поиска нет объектов этой категории.'
    missing_names = metrics['missing_names']['share']
    missing_addresses = metrics['missing_addresses']['share']
    missing_both = metrics['missing_both']['share']
    density = metrics['grocery_per_1000']
    if None in (missing_names, missing_addresses, missing_both, density):
        missing = []
        if None in (missing_names, missing_addresses, missing_both):
            missing.append('доли объектов без названия и полного адреса')
        if density is None:
            missing.append('плотность продуктовых магазинов')
        return None, 'incomplete_metrics', f'Не удалось оценить {" и ".join(missing)}.'
    if missing_both >= threshold['low_missing_both_share']:
        limit = _percent(threshold['low_missing_both_share'])
        return 'low', 'missing_both', f'Не менее чем у {limit} объектов нет ни названия, ни полного адреса.'
    if density < threshold['low_grocery_density']:
        return 'low', 'very_low_grocery_density', _density_reason(threshold['low_grocery_density'])
    if metrics['area_objects'] < threshold['medium_min_area_objects']:
        limit = threshold['medium_min_area_objects']
        return 'medium', 'few_area_objects', f'В круге поиска отмечено меньше {limit} объектов этой категории.'
    if missing_names >= threshold['medium_missing_names_share']:
        limit = _percent(threshold['medium_missing_names_share'])
        return 'medium', 'missing_names', f'Не менее чем у {limit} объектов нет названия.'
    if missing_addresses >= threshold['medium_missing_addresses_share']:
        limit = _percent(threshold['medium_missing_addresses_share'])
        return 'medium', 'missing_addresses', f'Не менее чем у {limit} объектов нет полного адреса.'
    if density < threshold['medium_grocery_density']:
        return 'medium', 'low_grocery_density', _density_reason(threshold['medium_grocery_density'])
    return 'high', 'sufficient_coverage', 'Показатели разметки проходят предварительные пороги.'


def assess_data_reliability(bundle, area, business):
    """Считаем записи проверенной выгрузки по типу и ID, без внешнего запаса."""
    provenance = bundle.get('provenance', {}).get('competitors', {})
    rows = bundle['competitors'][business]
    inside = [index for index, row in enumerate(rows) if in_circle(row, area)]
    records = _records_at(provenance.get(business), inside)
    names, addresses, both = _missing_counts(records, _details_available(provenance))
    grocery_indices = [index for index, row in enumerate(bundle['competitors']['grocery'])
                       if in_circle(row, area)]
    groceries = len(grocery_indices)
    residents = fsum(row[2] for row in bundle['houses'] if in_circle(row, area))
    city_records = _records_at(provenance.get(business), range(len(rows)))
    grocery_records = _records_at(provenance.get('grocery'), grocery_indices)
    metrics = {
        'city_objects': len(rows),
        'area_objects': len(inside),
        'missing_names': _share(names, len(inside)),
        'missing_addresses': _share(addresses, len(inside)),
        'missing_both': _share(both, len(inside)),
        'grocery_stores': groceries,
        'estimated_residents': residents,
        'grocery_per_1000': groceries / residents * 1000 if residents else None,
        'counts_basis': {
            'city_objects': 'rows' if city_records is None else 'osm_type_id',
            'area_objects': 'rows' if records is None else 'osm_type_id',
            'grocery_stores': 'rows' if grocery_records is None else 'osm_type_id',
        },
    }
    return _result(*_classification(metrics), metrics)
