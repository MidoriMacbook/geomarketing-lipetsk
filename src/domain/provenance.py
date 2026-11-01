"""Необязательное происхождение числовых строк OSM без изменения прежнего формата."""
import copy
import math
import time


class ProvenancedRows(list):
    """Обычный список строк с параллельными сведениями об исходных объектах."""

    def __init__(self, rows=(), provenance=None):
        super().__init__(rows)
        self.provenance = provenance


def osm_identity(element):
    kind, ident = element.get('type'), element.get('id')
    if kind in ('node', 'way', 'relation') and type(ident) is int and ident > 0:
        return kind, ident
    return None


def source_record(element, fetched_at, population=None):
    identity = osm_identity(element)
    record = {'osm_type': identity[0] if identity else None,
              'osm_id': identity[1] if identity else None, 'fetched_at': fetched_at}
    if population is not None:
        record['population'] = population
    return record


def possible_node_way_pairs(rows, records):
    """Отмечаем близкие точку и контур; это повод для проверки, а не слияния."""
    pairs, cells = [], {}
    for index, (row, record) in enumerate(zip(rows, records, strict=True)):
        kind = record['osm_type']
        if kind not in ('node', 'way', 'relation'):
            continue
        cell = (math.floor(row[0] * 111000 / 10),
                math.floor(row[1] * 111000 * math.cos(math.radians(52.6)) / 10))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for other in cells.get((cell[0] + dx, cell[1] + dy), []):
                    if (kind == 'node') == (records[other]['osm_type'] == 'node'):
                        continue
                    distance = math.hypot((row[0] - rows[other][0]) * 111000,
                                          (row[1] - rows[other][1]) * 111000 * math.cos(math.radians(row[0])))
                    if distance <= 10:
                        pairs.append({'indices': [other, index], 'distance_m': round(distance, 3)})
                        if len(pairs) > 10000:
                            raise ValueError('Слишком много совпадений точки и контура для проверки')
        cells.setdefault(cell, []).append(index)
    return pairs


def make_rows(rows, records, duplicates_removed=0):
    metadata = {'schema': 1, 'deduplication': 'osm_type_id',
                'duplicates_removed': duplicates_removed, 'records': records,
                'possible_node_way_pairs': possible_node_way_pairs(rows, records) if rows and len(rows[0]) == 2 else [],
                'same_geometry_groups': same_geometry_groups(records)}
    return ProvenancedRows(rows, metadata)


def same_geometry_groups(records):
    groups = {}
    for index, record in enumerate(records):
        signature = record.get('geometry_sha256')
        if signature is not None:
            groups.setdefault(signature, []).append(index)
    return [indices for indices in groups.values() if len(indices) > 1]


def filter_rows(rows, predicate):
    selected = [index for index, row in enumerate(rows) if predicate(row)]
    provenance = getattr(rows, 'provenance', None)
    if provenance is None:
        return [rows[index] for index in selected]
    return make_rows([rows[index] for index in selected],
                     [copy.deepcopy(provenance['records'][index]) for index in selected],
                     provenance['duplicates_removed'])


def validate_provenance(metadata, rows, columns):
    """Повреждённые параллельные массивы не принимаются как достоверное происхождение."""
    if (not isinstance(metadata, dict) or type(metadata.get('schema')) is not int or metadata['schema'] != 1
            or metadata.get('deduplication') != 'osm_type_id'
            or type(metadata.get('duplicates_removed')) is not int
            or metadata['duplicates_removed'] < 0
            or not isinstance(metadata.get('records'), list)
            or len(metadata['records']) != len(rows)
            or not isinstance(metadata.get('possible_node_way_pairs'), list)):
        raise ValueError('Некорректное происхождение OSM')
    seen = set()
    for record in metadata['records']:
        if not isinstance(record, dict):
            raise ValueError('Некорректная запись происхождения OSM')
        kind, ident, saved = record.get('osm_type'), record.get('osm_id'), record.get('fetched_at')
        if kind is not None or ident is not None:
            if kind not in ('node', 'way', 'relation') or type(ident) is not int or ident <= 0:
                raise ValueError('Некорректный идентификатор OSM')
            if (kind, ident) in seen:
                raise ValueError('Повтор исходного объекта OSM')
            seen.add((kind, ident))
        try:
            valid_date = (type(saved) in (int, float) and math.isfinite(saved)
                          and 0 < saved <= time.time() + 300)
        except OverflowError:
            valid_date = False
        if not valid_date:
            raise ValueError('Некорректная дата получения объекта OSM')
        signature = record.get('geometry_sha256')
        if signature is not None and (not isinstance(signature, str) or len(signature) != 64
                                      or any(char not in '0123456789abcdef' for char in signature)):
            raise ValueError('Некорректная подпись геометрии')
        population = record.get('population')
        if columns == 3 and (not isinstance(population, dict)
                             or population.get('rule') not in ('flats', 'private_house', 'footprint_levels')
                             or not isinstance(population.get('tags'), dict)
                             or any(not isinstance(key, str) or not isinstance(value, str)
                                    for key, value in population['tags'].items())):
            raise ValueError('Некорректное основание оценки жителей')
        if columns == 3:
            for name in ('footprint_m2', 'persons_per_flat', 'persons_per_private_house', 'living_share', 'm2_per_resident'):
                value = population.get(name)
                try:
                    valid_number = type(value) in (int, float) and math.isfinite(value) and value > 0
                except OverflowError:
                    valid_number = False
                if not valid_number:
                    raise ValueError('Некорректные признаки оценки жителей')
    expected = possible_node_way_pairs(rows, metadata['records']) if columns == 2 else []
    if metadata['possible_node_way_pairs'] != expected:
        raise ValueError('Некорректные кандидаты точки и контура')
    if metadata.get('same_geometry_groups', []) != same_geometry_groups(metadata['records']):
        raise ValueError('Некорректные группы совпадающей геометрии')
    return metadata


def provenance_summary(rows):
    metadata = getattr(rows, 'provenance', None)
    if metadata is None:
        return None
    known = sum(record['osm_id'] is not None for record in metadata['records'])
    return {'schema': 1, 'deduplication': metadata['deduplication'],
            'identified': known, 'unknown': len(rows) - known,
            'duplicates_removed': metadata['duplicates_removed'],
            'possible_node_way_pairs': len(metadata['possible_node_way_pairs']),
            'same_geometry_groups': len(metadata.get('same_geometry_groups', []))}
