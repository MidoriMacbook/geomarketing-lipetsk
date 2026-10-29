"""Воспроизводимый аудит снимков; внешняя сверка включается явно."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.config import CACHE_DIR, DISTRICTS, HEADERS, LIPETSK_BOUNDS, SNAPSHOT_DIR
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import select_area, validate_bundle
from src.domain.scoring import score_locations
import numpy as np
from src.services.osm_service import cache_key, competitor_cache_name


def iso(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()


def distance(a, b):
    return math.hypot((a[0] - b[0]) * 111000,
                      (a[1] - b[1]) * 111000 * math.cos(math.radians(b[0])))


def nearby_pairs(rows, threshold=10):
    """Близость служит поводом для проверки, а не доказательством дубля."""
    cells, pairs = {}, []
    for index, row in enumerate(rows):
        x = row[1] * 111000 * math.cos(math.radians(52.6))
        y = row[0] * 111000
        cell = (math.floor(x / threshold), math.floor(y / threshold))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for other in cells.get((cell[0] + dx, cell[1] + dy), []):
                    meters = distance(row, rows[other])
                    if meters <= threshold:
                        pairs.append({'indices': [other, index], 'distance_m': round(meters, 3)})
        cells.setdefault(cell, []).append(index)
    return pairs


def audit_file(path, area, business, now, binding=None):
    result = {'file': str(path), 'area': area['key'], 'business': business}
    try:
        raw = path.read_bytes()
        payload = json.loads(raw)
        rows = payload['data']
        if not isinstance(rows, list):
            raise ValueError('Набор записей не является списком')
        saved = payload.get('fetched_at')
        valid_date = (isinstance(saved, (int, float)) and not isinstance(saved, bool)
                      and math.isfinite(saved) and saved > 0)
        result.update(sha256=hashlib.sha256(raw).hexdigest(), rows=len(rows),
                      fetched_at=iso(saved) if valid_date else None,
                      age_days=round((now - saved) / 86400, 4) if valid_date else None,
                      date_status=('unknown' if not valid_date else 'future' if saved > now + 300
                                   else 'stale' if now - saved > 604800
                                   else 'recent' if now - saved > 86400 else 'fresh'))
        columns = 2 if business else 3
        valid, invalid = [], []
        for index, row in enumerate(rows):
            if (not isinstance(row, list) or len(row) != columns
                    or any(isinstance(v, bool) or not isinstance(v, (int, float))
                           or not math.isfinite(v) for v in row)
                    or not -90 <= row[0] <= 90 or not -180 <= row[1] <= 180
                    or (not business and row[2] <= 0)):
                invalid.append(index)
            else:
                valid.append(row)
        exact = Counter(tuple(row) for row in valid)
        coords = Counter(tuple(round(v, 4) for v in row[:2]) for row in valid)
        halo = max(400, BUSINESS_CATALOG[business]['R']) if business else 0
        lat, lng = area['center']
        extent = area['radius'] + halo
        outside_bbox = [i for i, row in enumerate(valid)
                        if abs(row[0] - lat) * 111000 > extent + .2
                        or abs(row[1] - lng) * 111000 * math.cos(math.radians(lat)) > extent + .2]
        result.update(invalid_indices=invalid,
                      outside_lipetsk_bbox=sum(not (LIPETSK_BOUNDS['lat'][0] <= r[0] <= LIPETSK_BOUNDS['lat'][1]
                                                    and LIPETSK_BOUNDS['lng'][0] <= r[1] <= LIPETSK_BOUNDS['lng'][1]) for r in valid),
                      outside_expected_bbox=len(outside_bbox),
                      outside_house_circle=sum(distance(r, area['center']) > area['radius'] + .2 for r in valid) if not business else None,
                      exact_duplicate_excess=sum(n - 1 for n in exact.values()),
                      rounded_coordinate_excess=sum(n - 1 for n in coords.values()))
        result['pairs_within_10m'] = nearby_pairs(valid)
        if not business and valid:
            result.update(residents=sum(r[2] for r in valid), max_house_residents=max(r[2] for r in valid),
                          houses_over_2000=[r for r in valid if r[2] > 2000])
        if binding:
            result.update(manifest_hash_matches=result['sha256'] == binding['sha256'],
                          manifest_date_matches=saved == binding['fetched_at'],
                          provenance_status=binding['status'], source_id=binding['source_id'])
    except (OSError, ValueError, TypeError, KeyError, OverflowError) as exc:
        result['error'] = f'{type(exc).__name__}: {exc}'
    return result


def runtime_audit(output_dir):
    """Читаем опубликованную выгрузку и ответы приложения без refresh."""
    feed_url = 'https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/osm-data/city.json'
    result = {'feed_url': feed_url, 'requested_at': datetime.now(timezone.utc).isoformat(), 'analyses': []}
    bundle = None
    try:
        with urlopen(Request(feed_url, headers=HEADERS), timeout=20) as response:
            raw = response.read(10 * 1024 * 1024 + 1)
            result['feed_http_status'] = response.status
        if len(raw) > 10 * 1024 * 1024:
            raise ValueError('Выгрузка больше 10 МиБ')
        bundle = validate_bundle(json.loads(raw))
        target = output_dir / 'public-city.json'
        target.write_bytes(raw)
        result.update(feed_file=str(target), feed_sha256=hashlib.sha256(raw).hexdigest(),
                      feed_version=bundle['version'], fetched_at=iso(bundle['fetched_at']),
                      feed_age_hours=round((datetime.now(timezone.utc).timestamp() - bundle['fetched_at']) / 3600, 4),
                      validation='validate_bundle: успешно', dataset_counts={'houses': len(bundle['houses']),
                          **{key: len(rows) for key, rows in bundle['competitors'].items()}})
        datasets = {'houses': bundle['houses'], **bundle['competitors']}
        result['dataset_checks'] = {}
        for key, rows in datasets.items():
            exact = Counter(tuple(row) for row in rows)
            rounded = Counter(tuple(round(v, 4) for v in row[:2]) for row in rows)
            result['dataset_checks'][key] = {
                'exact_duplicate_excess': sum(n-1 for n in exact.values()),
                'exact_duplicate_rows': [{'row': list(row), 'count': n} for row, n in exact.items() if n > 1],
                'rounded_coordinate_excess': sum(n-1 for n in rounded.values()),
                'outside_lipetsk_bbox': sum(not (LIPETSK_BOUNDS['lat'][0] <= row[0] <= LIPETSK_BOUNDS['lat'][1]
                                               and LIPETSK_BOUNDS['lng'][0] <= row[1] <= LIPETSK_BOUNDS['lng'][1]) for row in rows),
                'pairs_within_10m_count': len(nearby_pairs(rows))}
    except Exception as exc:
        result['feed_error'] = f'{type(exc).__name__}: {exc}'
    for key, business in [('eleytsky', 'cafe'), ('center', 'pharmacy'),
                          ('traktorny', 'grocery'), ('matyrsky', 'fitness')]:
        url = f'https://geomarketing-lipetsk.onrender.com/api/calculate?district={key}&type={business}'
        record = {'area': key, 'business': business, 'url': url,
                  'requested_at': datetime.now(timezone.utc).isoformat()}
        try:
            with urlopen(Request(url, headers=HEADERS), timeout=30) as response:
                raw = response.read(5 * 1024 * 1024 + 1)
                record['http_status'] = response.status
            payload = json.loads(raw)
            target = output_dir / f'public-analysis-{key}-{business}.json'
            target.write_bytes(raw)
            record.update(response_file=str(target), response_sha256=hashlib.sha256(raw).hexdigest(),
                          **{name: payload.get(name) for name in ['status', 'source', 'stats', 'data_meta',
                              'data_delivery', 'data_quality', 'warning', 'notice', 'parameters']})
            if bundle is not None:
                area = {'key': key, **DISTRICTS[key]}
                houses, competitors = select_area(bundle, area, business)
                expected = {'houses': len(houses), 'residents': int(sum(row[2] for row in houses)),
                            'competitors': len(competitors)}
                record['feed_selected_stats'] = expected
                record['stats_match_feed'] = payload.get('stats') == expected
                record['version_matches_feed'] = payload.get('data_delivery', {}).get('version') == bundle['version']
                record['source_dates_match_feed'] = all(payload.get('data_meta', {}).get(name, {}).get('fetched_at') == bundle['fetched_at']
                                                        for name in ('houses', 'competitors'))
                scored = score_locations(np.asarray(houses, dtype=float).reshape(-1, 3),
                                         np.asarray(competitors, dtype=float).reshape(-1, 2),
                                         area['center'], area['radius'], BUSINESS_CATALOG[business])
                remote_recommendations = [{name: item.get(name) for name in scored.recommendations[0]}
                                          for item in payload.get('recommendations', [])]
                record['local_grid_matches_api'] = scored.grid == payload.get('grid')
                record['local_recommendations_exact_match_api'] = scored.recommendations == remote_recommendations
                record['local_recommendations_match_api'] = (
                    len(scored.recommendations) == len(remote_recommendations)
                    and all(all(math.isclose(value, remote[name], rel_tol=1e-12, abs_tol=1e-10)
                                if name == 'score' else value == remote[name]
                                for name, value in local.items())
                            for local, remote in zip(scored.recommendations, remote_recommendations)))
                record['max_recommendation_score_difference'] = max(
                    (abs(local['score'] - remote['score'])
                     for local, remote in zip(scored.recommendations, remote_recommendations)), default=0)
        except Exception as exc:
            record['error'] = f'{type(exc).__name__}: {exc}'
        result['analyses'].append(record)
    return result


def public_sample(area_key, business, output_dir):
    area = {'key': area_key, **DISTRICTS[area_key]}
    name = competitor_cache_name(business, area) if business else 'houses_' + cache_key(area)
    rows = json.loads((SNAPSHOT_DIR / (name + '.json')).read_text(encoding='utf-8'))['data']
    row = rows[0] if business else max(rows, key=lambda item: item[2])
    lat, lng = row[:2]
    url = f'https://api.openstreetmap.org/api/0.6/map?bbox={lng-.0015:.7f},{lat-.001:.7f},{lng+.0015:.7f},{lat+.001:.7f}'
    result = {'area': area_key, 'business': business, 'snapshot_row': row, 'url': url,
              'requested_at': datetime.now(timezone.utc).isoformat()}
    try:
        with urlopen(Request(url, headers=HEADERS), timeout=15) as response:
            raw = response.read(8 * 1024 * 1024 + 1)
            result['http_status'] = response.status
        if len(raw) > 8 * 1024 * 1024:
            raise ValueError('Ответ больше 8 МиБ')
        root = ET.fromstring(raw)
        if root.tag != 'osm':
            raise ValueError('Ответ не является OSM XML')
        output_dir.mkdir(parents=True, exist_ok=True)
        target = output_dir / f'public-{area_key}-{business or "houses"}.osm'
        target.write_bytes(raw)
        result.update(raw_file=str(target), sha256=hashlib.sha256(raw).hexdigest())
        nodes = {el.attrib['id']: [float(el.attrib['lat']), float(el.attrib['lon'])] for el in root.findall('node')}
        matches = []
        pairs = [tuple(part.strip('"') for part in tag.split('=', 1))
                 for tag in BUSINESS_CATALOG[business]['tags']] if business else []
        for el in root:
            tags = {tag.attrib['k']: tag.attrib['v'] for tag in el.findall('tag')}
            if business:
                if not any(tags.get(k) == v for k, v in pairs):
                    continue
            elif el.tag != 'way' or 'building' not in tags:
                continue
            if el.tag == 'node':
                points = [nodes[el.attrib['id']]]
            elif el.tag == 'way':
                refs = [nd.attrib['ref'] for nd in el.findall('nd')]
                if not refs or any(ref not in nodes for ref in refs):
                    continue
                points = [nodes[ref] for ref in refs]
            else:
                continue
            point = ([sum(p[i] for p in points) / len(points) for i in (0, 1)] if not business
                     else [(min(p[i] for p in points) + max(p[i] for p in points)) / 2 for i in (0, 1)])
            matches.append({'type': el.tag, 'id': el.attrib['id'], 'version': el.attrib.get('version'),
                            'timestamp': el.attrib.get('timestamp'), 'tags': tags,
                            'distance_m': round(distance(point, row), 3),
                            'closed_way': points[0] == points[-1] if el.tag == 'way' else None})
        result['nearest_candidates'] = sorted(matches, key=lambda item: item['distance_m'])[:3]
        result['status'] = 'получен публичный ответ; совпадение требует оценки расстояния и тегов'
    except Exception as exc:
        result.update(status='внешняя сверка недоступна', error=f'{type(exc).__name__}: {exc}')
    return result


def audit(now, external=False, output_dir=Path('tests/artifacts/mobile-data-audit'), runtime=False):
    manifest = json.loads((SNAPSHOT_DIR.parent / 'catalog-provenance.json').read_text(encoding='utf-8'))
    records, cache_records = [], []
    for key, district in DISTRICTS.items():
        area = {'key': key, **district}
        for business in [None, *BUSINESS_CATALOG]:
            name = (competitor_cache_name(business, area) if business else 'houses_' + cache_key(area)) + '.json'
            records.append(audit_file(SNAPSHOT_DIR / name, area, business, now, manifest['outputs'].get(name)))
            if (CACHE_DIR / name).exists():
                cache_records.append(audit_file(CACHE_DIR / name, area, business, now))
    source_geometry = {key: value.get('geometry_validation') for key, value in manifest['sources'].items()}
    mismatches = []
    for key in DISTRICTS:
        group = [r for r in records if r['area'] == key]
        house = next(r for r in group if r['business'] is None)
        for competitor in group:
            if competitor['business'] and house.get('fetched_at') != competitor.get('fetched_at'):
                mismatches.append({'area': key, 'business': competitor['business'],
                                   'houses_at': house.get('fetched_at'), 'competitors_at': competitor.get('fetched_at')})
    result = {'assessed_at': iso(now), 'snapshots': records, 'active_cache_overrides': cache_records,
              'unbound_cache_files': sorted(p.name for p in CACHE_DIR.glob('*.json')
                                            if p.name not in manifest['outputs']),
              'mixed_source_dates': mismatches, 'manifest_geometry_claims': source_geometry,
              'geometry_limit': 'В снимках нет исходных контуров и ID. Заявления manifest об импорте не являются повторной проверкой геометрии.',
              'public_samples': []}
    if external:
        for key, business in [('eleytsky', None), ('center', 'cafe'), ('traktorny', 'grocery'), ('pobeda', 'pharmacy')]:
            result['public_samples'].append(public_sample(key, business, output_dir))
    if runtime:
        output_dir.mkdir(parents=True, exist_ok=True)
        result['public_runtime'] = runtime_audit(output_dir)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--at', help='Фиксированное время ISO UTC для повторяемости')
    parser.add_argument('--external', action='store_true', help='Четыре небольших запроса чтения к OSM API')
    parser.add_argument('--runtime', action='store_true', help='Чтение ежедневной выгрузки и четырёх расчётов публичного приложения')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    now = datetime.fromisoformat(args.at.replace('Z', '+00:00')).timestamp() if args.at else datetime.now(timezone.utc).timestamp()
    result = audit(now, args.external, args.output.parent, args.runtime)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    print(f'Проверено снимков: {len(result["snapshots"])}; результат: {args.output}')


if __name__ == '__main__':
    main()
