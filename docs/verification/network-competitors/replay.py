"""Сравнение трёх весов на опубликованной городской выгрузке f0ca354."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from unittest.mock import patch


def score_hash(grid):
    return sha256(grid.astype('<f8').tobytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('city', type=Path)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--baseline', type=Path)
    args = parser.parse_args()
    sys.path.insert(0, str(args.project.resolve()))
    import numpy as np
    from app import app
    from src.domain.businesses import BUSINESS_CATALOG
    from src.domain.city_data import validate_bundle
    from src.domain.scoring import score_locations
    from src.services import analysis_service, city_feed_service
    from src.utils.geo import to_meters
    from src.utils.validation import area_for

    raw = args.city.read_bytes()
    assert sha256(raw).hexdigest() == 'e43c84090839e3da9bf2dce6229fdc597bdda8fffc8d5dab4c49aca4b3d1d903'
    bundle = validate_bundle(json.loads(raw))
    report = {'version': bundle['version'], 'fetched_at': bundle['fetched_at'], 'cases': {}}
    with (patch.object(city_feed_service, '_get_bundle', return_value=(bundle, 'current', True, None)),
          patch.object(analysis_service, 'CITY_DATA_URL', 'https://replay.invalid/city.json'),
          app.test_client() as client):
        for district, business in [('center', 'cafe'), ('eleytsky', 'cafe'), ('center', 'grocery')]:
            area = area_for(district)
            loaded = city_feed_service.load(area, business)
            parameters = BUSINESS_CATALOG[business]
            scored = score_locations(loaded.houses, loaded.competitors, area['center'], area['radius'], parameters)
            key = f'{district}/{business}'
            reference = {'score_grid_sha256': score_hash(scored.scores), 'grid': scored.grid,
                         'places': scored.recommendations}
            report['cases'][key] = reference
            if not args.baseline:
                continue
            baseline = json.loads(args.baseline.read_text(encoding='utf-8'))['cases'][key]
            assert reference == baseline, key
            params = {'district': district, 'type': business}
            plain = client.get('/api/calculate', query_string=params).get_json()
            full = client.get('/api/calculate', query_string={**params, 'network_weight': '1'}).get_json()
            assert full['grid'] == plain['grid'] == baseline['grid'], key
            assert full['recommendations'] == plain['recommendations'], key
            assert [{field: place[field] for field in ('rank', 'lat', 'lng', 'score')}
                    for place in full['recommendations']] == [
                        {field: place[field] for field in ('rank', 'lat', 'lng', 'score')}
                        for place in baseline['places']], key
            if business != 'grocery':
                continue
            latlng = [full['best'][coordinate] for coordinate in ('lat', 'lng')]
            fixed_xy = to_meters([latlng], *area['center'])[0]
            distances = np.linalg.norm(to_meters(loaded.competitors, *area['center']) - fixed_xy, axis=1)
            kernels = np.exp(-(distances / (parameters['R'] * 0.8)) ** 2)
            example = {}
            for weight in (1, .5, 0):
                result = client.get('/api/calculate',
                                    query_string={**params, 'network_weight': str(weight)}).get_json()
                assert result['network_competition']['weight'] == weight
                assert result['competitors'] == full['competitors']
                weights = [weight if row.get('is_chain') else 1 for row in result['competitors']]
                best = result['best']
                example[str(weight)] = {
                    'best': {field: best[field] for field in ('lat', 'lng', 'competitors_in_radius')},
                    'places': len(result['recommendations']),
                    'marked': result['network_competition']['marked'],
                    'sample_total': len(weights),
                    'competition_multiplier_at_original_best':
                        float(1 + parameters['alpha'] * (kernels * weights).sum()),
                }
            assert example['1']['competition_multiplier_at_original_best'] > (
                example['0.5']['competition_multiplier_at_original_best']) > (
                example['0']['competition_multiplier_at_original_best'])
            report['example'] = example
    if args.baseline:
        from src.domain.network_competitors import city_networks, weight_available
        coverage, ids = city_networks(bundle)
        for category, stat in coverage.items():
            stat['name'] = BUSINESS_CATALOG[category]['name']
            stat['eligible'] = weight_available(stat)
            metadata = bundle['provenance']['competitors'][category]
            stat['marked'] = sum(f"{row['osm_type']}:{row['osm_id']}" in ids for row in metadata['records'])
        report['coverage'] = coverage
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
