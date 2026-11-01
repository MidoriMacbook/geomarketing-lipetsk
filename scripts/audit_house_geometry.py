"""Офлайн-анализ возможного завышения жителей из-за совпадающей геометрии домов.

Результат keep-one — только гипотеза для оценки чувствительности. Скрипт не
изменяет исходную выгрузку, рабочий кэш, правила расчёта или OpenStreetMap.
"""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np

from src.config import MIN_HOUSES
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import in_circle, select_area, validate_bundle
from src.domain.explanations import explain_recommendations
from src.domain.scoring import score_locations
from src.utils.validation import UserError, validate_data


def find_candidates(bundle, evidence):
    """Отделяем кандидата для ручной проверки от разрешения объединить дома."""
    metadata = bundle.get('provenance', {}).get('houses')
    if not metadata:
        return {'status': 'unavailable', 'reason': 'house_provenance_missing', 'groups': []}
    records, rows = metadata['records'], bundle['houses']
    if len(records) != len(rows):
        raise ValueError('Происхождение не соответствует числу домов')
    by_geometry = defaultdict(list)
    for index, record in enumerate(records):
        if record.get('geometry_sha256'):
            by_geometry[record['geometry_sha256']].append(index)
    result = []
    for signature, indices in sorted(by_geometry.items()):
        if len(indices) < 2:
            continue
        identities = [(records[i].get('osm_type'), records[i].get('osm_id')) for i in indices]
        if len(set(identities)) != len(identities) or any(kind != 'way' or ident is None for kind, ident in identities):
            raise ValueError('Для геометрического сравнения нужны разные исходные way ID')
        originals = [evidence.get(identity) for identity in identities]
        blockers = []
        if not all(item and isinstance(item.get('tags'), dict) and item.get('node_refs') for item in originals):
            blockers.append('full_source_evidence_missing')
        else:
            tags = [item['tags'] for item in originals]
            if any(item['node_refs'] != originals[0]['node_refs'] for item in originals[1:]):
                blockers.append('node_sequence_differs')
            if any('building:part' in item for item in tags):
                blockers.append('building_part_present')
            if any(item.get('local_relation_memberships') for item in originals):
                blockers.append('relation_membership_needs_review')
            if len({item.get('building') for item in tags}) != 1 or tags[0].get('building') not in ('residential', 'apartments', 'house', 'detached', 'semidetached_house', 'dormitory'):
                blockers.append('building_types_differ_or_unknown')
            # Отсутствующая этажность не подтверждает совпадение с известной.
            if any(len({item.get(key) for item in tags}) != 1 for key in ('building:levels', 'building:flats', 'building:min_level', 'height', 'min_height')):
                blockers.append('population_or_vertical_tags_differ')
            address_keys = {key for item in tags for key in item if key.startswith('addr:')}
            if any(len({item[key] for item in tags if key in item}) > 1 for key in address_keys):
                blockers.append('address_tags_conflict')
        if len({tuple(rows[i][:2]) for i in indices}) != 1:
            blockers.append('geometry_centers_differ')
        if len({rows[i][2] for i in indices}) != 1:
            blockers.append('population_estimates_differ')
        # Предпочтение адресованной записи нужно только для воспроизводимой гипотезы.
        keep = min(indices, key=lambda i: (
            -sum(key.startswith('addr:') for key in (evidence.get((records[i]['osm_type'], records[i]['osm_id'])) or {}).get('tags', {})),
            records[i]['osm_id']))
        result.append({
            'geometry_sha256': signature, 'indices': indices, 'identities': identities,
            'center': rows[indices[0]][:2], 'residents_per_record': [rows[i][2] for i in indices],
            'source_objects': originals, 'candidate': not blockers, 'blockers': blockers,
            'automatic_merge': False, 'keep_index': keep,
            'hypothetical_remove_indices': [i for i in indices if i != keep] if not blockers else [],
            'unresolved': 'Совпадение узлов и совместимые теги не доказывают один реальный дом; полнота отношений и разметка частей не установлены.',
        })
    return {'status': 'available', 'groups': result}


def _facts(houses, competitors, area, business, points, centroids=()):
    return explain_recommendations(houses, competitors, area['center'], area['radius'],
                                   BUSINESS_CATALOG[business], points, centroids)


def _calculate(rows, competitors, area, business):
    summary = {'houses': len(rows), 'residents': sum(row[2] for row in rows)}
    if len(rows) < MIN_HOUSES:
        return {**summary, 'status': 'insufficient_houses', 'recommendations': []}
    houses, competitors = validate_data(rows, competitors)
    try:
        scored = score_locations(houses, competitors, area['center'], area['radius'], BUSINESS_CATALOG[business])
    except UserError as exc:
        return {**summary, 'status': 'insufficient_demand', 'reason': str(exc), 'recommendations': []}
    facts = _facts(houses, competitors, area, business, scored.recommendations, scored.centroids)
    recs = [{**rec, 'model_demand': fact['metrics']['model_demand'],
             'competition_pressure': fact['metrics']['competition_pressure'],
             'raw_score': fact['metrics']['model_demand'] / fact['metrics']['competition_multiplier']}
            for rec, fact in zip(scored.recommendations, facts, strict=True)]
    return {**summary, 'status': 'calculated', 'recommendations': recs}


def distance_m(a, b):
    return math.hypot((a[0] - b[0]) * 111000,
                      (a[1] - b[1]) * 111000 * math.cos(math.radians(b[0])))


def impact_for_area(bundle, area, business, groups):
    """Пересчитываем прежнюю модель и сравниваем спрос также в одинаковых точках."""
    indices = [i for i, row in enumerate(bundle['houses']) if in_circle(row, area)]
    excluded = set(i for group in groups for i in group['hypothetical_remove_indices'])
    removed = sorted(set(indices) & excluded)
    rows = [bundle['houses'][i] for i in indices]
    adjusted = [bundle['houses'][i] for i in indices if i not in excluded]
    _, competitors = select_area(bundle, area, business)
    baseline = _calculate(rows, competitors, area, business)
    counterfactual = _calculate(adjusted, competitors, area, business)
    excess = baseline['residents'] - counterfactual['residents']
    checks, shift = [], None
    if baseline['status'] == 'calculated' and counterfactual['status'] == 'calculated':
        houses, competitor_array = validate_data(adjusted, competitors)
        points = baseline['recommendations']
        after = _facts(houses, competitor_array, area, business, points)
        checks = [{'rank': point['rank'], 'lat': point['lat'], 'lng': point['lng'],
                   'baseline_demand': point['model_demand'],
                   'counterfactual_demand': fact['metrics']['model_demand'],
                   'baseline_raw_score': point['raw_score'],
                   'counterfactual_raw_score': fact['metrics']['model_demand'] / fact['metrics']['competition_multiplier']}
                  for point, fact in zip(points, after, strict=True)]
        best_before, best_after = points[0], counterfactual['recommendations'][0]
        shift = distance_m((best_before['lat'], best_before['lng']), (best_after['lat'], best_after['lng']))
    return {'area': area, 'business': business, 'hypothesis': 'keep_one_candidate_per_exact_geometry',
            'not_a_corrected_truth': True, 'hypothetical_removed_indices': removed,
            'baseline': baseline, 'counterfactual': counterfactual,
            'possible_excess_residents': excess,
            'possible_excess_share_of_baseline_pct': 100 * excess / baseline['residents'] if baseline['residents'] else None,
            'best_point_shift_m': shift, 'baseline_points_after_hypothesis': checks}


def load_evidence(manifest_path):
    """Читаем полные теги и локальные связи только из сохранённых проверенных XML."""
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    evidence, sources = {}, []
    for item in manifest:
        path = (manifest_path.parent / item['response_file']).resolve()
        if not path.is_relative_to(manifest_path.parent.resolve()):
            raise ValueError('XML должен находиться рядом с журналом сверки')
        raw = path.read_bytes()
        if len(raw) > 10 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != item['sha256']:
            raise ValueError('Размер или SHA-256 исходного XML не совпадает с журналом')
        root = ET.fromstring(raw)
        for match in item['matches']:
            identity = (match['record']['osm_type'], match['record']['osm_id'])
            way = next((el for el in root.findall('way') if el.get('id') == str(identity[1])), None)
            if identity[0] != 'way' or way is None:
                raise ValueError('В сохранённом XML нет заявленного way')
            memberships = [{'relation_id': rel.get('id'), 'relation_tags': {tag.get('k'): tag.get('v') for tag in rel.findall('tag')},
                            'role': member.get('role')}
                           for rel in root.findall('relation') for member in rel.findall('member')
                           if member.get('type') == 'way' and member.get('ref') == str(identity[1])]
            evidence[identity] = {
                'osm_type': identity[0], 'osm_id': identity[1],
                'tags': {tag.get('k'): tag.get('v') for tag in way.findall('tag')},
                'node_refs': [node.get('ref') for node in way.findall('nd')],
                'local_relation_memberships': memberships,
                'relation_coverage': 'Только отношения в сохранённом map-ответе; полнота принадлежности не доказана.',
                'source_url': item['url'], 'requested_at': item['requested_at'],
                'response_sha256': item['sha256'],
            }
        sources.append({key: item[key] for key in ('url', 'requested_at', 'http_status', 'sha256', 'response_file')})
    return evidence, sources


def audit(bundle_path, manifest_path, businesses, radii):
    raw = bundle_path.read_bytes()
    bundle = validate_bundle(json.loads(raw))
    evidence, sources = load_evidence(manifest_path)
    candidates = find_candidates(bundle, evidence)
    analyses = []
    for number, group in enumerate(candidates['groups'], 1):
        for radius in radii:
            area = {'key': f'geometry_{number}_{radius}', 'custom': True,
                    'center': group['center'], 'radius': radius}
            for business in businesses:
                analyses.append(impact_for_area(bundle, area, business, candidates['groups']))
    removed = sorted({i for group in candidates['groups'] for i in group['hypothetical_remove_indices']})
    if bundle_path.read_bytes() != raw:
        raise RuntimeError('Исходный файл изменился во время аудита')
    return {'created_at': datetime.now(timezone.utc).isoformat(), 'input_file': str(bundle_path),
            'input_sha256': hashlib.sha256(raw).hexdigest(), 'input_unchanged': True,
            'sources': sources, 'candidates': candidates,
            'global_hypothesis': {'removed_houses': len(removed),
                                  'removed_residents': sum(bundle['houses'][i][2] for i in removed)},
            'analyses': analyses, 'production_rule_changed': False,
            'unresolved': 'Автоматическое объединение не разрешено: совпадение последовательности узлов и тегов не устанавливает число реальных зданий.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', required=True, type=Path)
    parser.add_argument('--evidence', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--business', action='append', choices=sorted(BUSINESS_CATALOG))
    parser.add_argument('--radius', action='append', type=int, choices=(500, 1000, 1500))
    args = parser.parse_args()
    if args.output.resolve() in (args.bundle.resolve(), args.evidence.resolve()):
        raise ValueError('Отчёт не должен заменять исходные данные')
    result = audit(args.bundle, args.evidence, args.business or ['cafe', 'pharmacy', 'fitness'], args.radius or [500, 1000, 1500])
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(json.dumps({'groups': len(result['candidates']['groups']), 'analyses': len(result['analyses']),
                      'hypothesis': result['global_hypothesis'], 'input_unchanged': result['input_unchanged']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
