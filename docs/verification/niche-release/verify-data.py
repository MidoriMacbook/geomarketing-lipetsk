"""Воспроизводимая проверка расчёта и последней полной копии."""

import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from uuid import UUID

os.environ['OMP_NUM_THREADS'] = '1'
os.environ['OPENBLAS_NUM_THREADS'] = '1'


def stable(payload):
    for key in ('calculated_at', 'analysis_id'):
        payload.pop(key)
    payload['data_quality'].pop('assessed_at')
    return payload


def read_source(checkout, data_file, *, candidate):
    sys.path.insert(0, str(checkout.resolve()))
    import numpy as np
    import requests

    from app import create_app
    from src.domain.businesses import BUSINESS_CATALOG
    from src.domain.city_data import validate_bundle
    from src.domain.scoring import score_locations
    from src.services import analysis_service, city_feed_service
    from src.utils import formatting
    from src.utils.geo import to_meters
    from src.utils.validation import area_for

    raw = data_file.read_bytes()
    bundle = validate_bundle(json.loads(raw))
    now = datetime.fromtimestamp(bundle['fetched_at'] + 3 * 86400, tz=timezone.utc)
    output = {
        'version': bundle['version'], 'file_sha256': sha256(raw).hexdigest(),
        'fetched_at': datetime.fromtimestamp(bundle['fetched_at'], tz=timezone.utc).isoformat(),
        'cases': {},
    }
    with (TemporaryDirectory() as cache,
          patch.object(analysis_service, 'CITY_DATA_URL', 'https://fixture.invalid/city.json'),
          patch.object(city_feed_service, 'CITY_DATA_URL', 'https://fixture.invalid/city.json'),
          patch.object(city_feed_service, 'CACHE_FILE', Path(cache) / 'city.json'),
          patch.object(city_feed_service.time, 'time', return_value=now.timestamp()),
          patch.object(analysis_service, 'datetime') as clock,
          patch.object(formatting, 'uuid4', return_value=UUID(int=1)),
          patch.object(city_feed_service.requests, 'get') as get,
          create_app().test_client() as client):
        response = Mock()
        response.status_code = 200
        response.headers = {}
        response.iter_content.return_value = [raw]
        get.return_value.__enter__.return_value = response
        clock.now.return_value = now

        def calculate(params, *, post=False):
            url = '/api/calculate'
            reply = client.post(url, json=params) if post else client.get(url, query_string=params)
            assert reply.status_code == 200, reply.get_json()
            return reply.get_json()

        # Warm up the downloaded data so both ordinary snapshots use the same source status.
        calculate({'district': 'center', 'type': 'cafe'})
        for area_id in ('center', 'eleytsky'):
            options = {'district': area_id, 'type': 'cafe'}
            area = area_for(area_id)
            loaded = city_feed_service.load(area, 'cafe')
            default = stable(calculate(options))
            post = stable(calculate(options, post=True))
            assert post == default
            score_options = {'include_alternatives': True} if candidate else {}
            scored = score_locations(
                loaded.houses, loaded.competitors, area['center'], area['radius'],
                BUSINESS_CATALOG['cafe'], **score_options,
            )
            if candidate:
                full = stable(calculate({
                    **options, 'network_weight': '1', 'data_reliability': '1', 'include_alternatives': '1',
                }))
                main = [place for place in full['recommendations'] if place.get('role') != 'alternative']
                assert main == default['recommendations'] and full['grid'] == default['grid']
                assert full['network_competition']['weight'] == 1 and full['data_reliability']['level']
            output['cases'][area_id] = {
                'ordinary_sha256': sha256(json.dumps(default, sort_keys=True).encode()).hexdigest(),
                'grid_sha256': sha256(scored.scores.astype('<f8').tobytes()).hexdigest(),
                'primary': [{k: place[k] for k in ('rank', 'lat', 'lng', 'score')} for place in scored.recommendations],
            }

        if not candidate:
            return output

        area = area_for('center')
        parameters = BUSINESS_CATALOG['grocery']
        loaded = city_feed_service.load(area, 'grocery')
        options = {'district': 'center', 'type': 'grocery', 'data_reliability': '1', 'include_alternatives': '1'}
        evaluations = [calculate({**options, 'network_weight': str(weight)}) for weight in (1, 0.5, 0)]
        first = evaluations[0]['best']
        point = to_meters([[first['lat'], first['lng']]], *area['center'])[0]
        xy = to_meters(loaded.competitors, *area['center'])
        kernel = np.exp(-(np.linalg.norm(xy - point, axis=1) / (0.8 * parameters['R'])) ** 2)
        marked = np.asarray([key in loaded.network_ids for key in loaded.competitor_ids])
        pressures = [float((kernel * np.where(marked, factor, 1)).sum()) for factor in (1, 0.5, 0)]
        assert pressures[0] > pressures[1] > pressures[2]
        assert math.isclose(pressures[1], (pressures[0] + pressures[2]) / 2)
        assert len({tuple(row['grid']['scores']) for row in evaluations}) == 3
        assert all(item['competitors'] == evaluations[0]['competitors'] for item in evaluations)
        alternatives = [item['recommendations'] for item in evaluations]
        output['network_pressure'] = {
            'coordinate': [first['lat'], first['lng']], 'weights': [1, 0.5, 0],
            'at_fixed_coordinate': pressures,
            'network_markers': sum(row.get('is_chain', False) for row in evaluations[0]['competitors']),
            'results': [[{'role': row.get('role', 'primary'), 'score': row['score']}
                        for row in rows] for rows in alternatives],
        }

        # Failed HTTP stream and a syntactically valid but incomplete replacement.
        get.side_effect = requests.ConnectionError('verification: city feed offline')
        failure = calculate({**options, 'refresh': '1', 'network_weight': '1'})
        get.side_effect = None
        response.iter_content.return_value = [b'{"schema": 1, "houses": []}']
        city_feed_service._memory = None  # cold candidate instance must use the persisted complete copy
        partial = calculate({**options, 'refresh': '1', 'network_weight': '1'})
        assert city_feed_service.CACHE_FILE.is_file()
        for restored in (failure, partial):
            assert restored['data_delivery']['version'] == bundle['version']
            assert restored['data_delivery']['fetched_at'] == bundle['fetched_at']
            assert restored['data_delivery']['status'] == 'unavailable'
            assert restored['grid'] == evaluations[0]['grid']
            assert restored['data_reliability'] == evaluations[0]['data_reliability']
            assert 'больше двух суток' in restored['warning']
        output['fallback'] = {
            'version': bundle['version'], 'status': partial['data_delivery']['status'],
            'recovered_after_restart': True, 'warning': partial['warning'],
        }
    return output


def main():
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument('base', type=Path)
    arguments.add_argument('candidate', type=Path)
    arguments.add_argument('city', type=Path)
    arguments.add_argument('--fresh', type=Path)
    arguments.add_argument('--worker', choices=('base', 'candidate'))
    args = arguments.parse_args()
    if args.worker:
        candidate = args.worker == 'candidate'
        result = read_source(args.candidate if candidate else args.base, args.city, candidate=candidate)
    else:
        def run(mode, source):
            received = subprocess.check_output([
                sys.executable, __file__, str(args.base), str(args.candidate), str(source),
                '--worker', mode,
            ])
            return json.loads(received)

        pinned_base = run('base', args.city)
        pinned_candidate = run('candidate', args.city)
        assert pinned_base['cases'] == pinned_candidate['cases']
        result = {'pinned': pinned_candidate, 'base_matches': True}
        if args.fresh is not None:
            fresh_base = run('base', args.fresh)
            fresh_candidate = run('candidate', args.fresh)
            assert fresh_base['cases'] == fresh_candidate['cases']
            result.update(fresh=fresh_candidate, fresh_base_matches=True)
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
