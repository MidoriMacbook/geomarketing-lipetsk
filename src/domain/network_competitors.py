"""Сетевые признаки и покрытие брендовой разметкой городской выгрузки."""
from collections import defaultdict
import re
from unicodedata import normalize


WIKIDATA_ID = re.compile(r'Q[1-9][0-9]*')
MIN_BRAND_COVERAGE_PERCENT = 20


def city_networks(bundle):
    """Считаем записи по категориям, а повторяемость бренда по объектам города."""
    groups = bundle.get('provenance', {}).get('competitors', {})
    coverage, ids = {}, set()
    brands = defaultdict(set)
    for business, rows in bundle['competitors'].items():
        tagged = 0
        for record in (groups.get(business) or {}).get('records', []):
            brand = ' '.join(normalize('NFKC', record.get('brand', '')).casefold().split())
            wikidata = record.get('brand:wikidata', '')
            tagged += bool(brand or wikidata)
            if record['osm_id'] is None:
                continue
            identity = f"{record['osm_type']}:{record['osm_id']}"
            if WIKIDATA_ID.fullmatch(wikidata):
                ids.add(identity)
            if brand:
                brands[brand].add(identity)
        coverage[business] = {'total': len(rows), 'tagged': tagged}
    for members in brands.values():
        if len(members) >= 2:
            ids.update(members)
    return coverage, ids


def store_network_flags(bundle):
    """Записываем положительные признаки рядом с исходными тегами в city.json."""
    groups = bundle['provenance']['competitors']
    _, ids = city_networks(bundle)
    for business, metadata in groups.items():
        if metadata is None:
            continue
        records = []
        for original in metadata['records']:
            record = dict(original)
            record.pop('is_chain', None)
            if f"{record['osm_type']}:{record['osm_id']}" in ids:
                record['is_chain'] = True
            records.append(record)
        groups[business] = {**metadata, 'records': records}


def weight_available(coverage):
    return (coverage is not None and coverage['total'] > 0
            and coverage['tagged'] * 100 >= coverage['total'] * MIN_BRAND_COVERAGE_PERCENT)
