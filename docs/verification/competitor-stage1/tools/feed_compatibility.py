"""Exercise a fresh full bundle in the published loader and its disk-cache fallback."""

import argparse
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
URL = 'https://stage1-replay.invalid/city.json'
EXTRA = {'brand', 'brand:wikidata', 'operator'}
PARAMS = {'district': 'center', 'type': 'grocery'}


def read(client, version, status, **params):
    response = client.get('/api/calculate', query_string={**PARAMS, **params})
    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body['status'] == 'success'
    assert body['data_delivery']['mode'] == 'daily'
    assert body['data_delivery']['version'] == version, body['data_delivery']
    assert body['data_delivery']['status'] == status, body['data_delivery']
    return body


def run(args):
    sys.path.insert(0, str(args.repo.resolve()))
    os.environ['CITY_DATA_URL'] = URL
    import requests
    from app import create_app
    from src.services import city_feed_service as feed

    older_raw = args.old.read_bytes()
    newer_raw = args.new.read_bytes()
    older, newer = map(json.loads, (older_raw, newer_raw))
    assert older['fetched_at'] < newer['fetched_at']

    response = requests.Response()
    response.raw = BytesIO(newer_raw)
    response.status_code = 200
    response.url = URL
    response.headers['ETag'] = '"stage1-fixture"'
    app = create_app()

    with (tempfile.TemporaryDirectory(dir=HERE) as folder, app.test_client() as client,
          patch('requests.sessions.Session.request', side_effect=AssertionError('Unexpected network')),
          patch.object(feed.requests, 'get', side_effect=(response, requests.ConnectionError('replay outage'))) as get,
          patch.object(feed, 'CACHE_FILE', Path(folder) / 'city-v1.json')):
        feed.CACHE_FILE.write_bytes(older_raw)
        feed._last_check = time.time()
        old = read(client, older['version'], 'current', competitor_details='1')
        assert old['competitors'] and all(not EXTRA.intersection(row) for row in old['competitors'])
        get.assert_not_called()

        rich = read(client, newer['version'], 'updated', refresh='1', competitor_details='1')
        counts = {key: sum(key in row for row in rich['competitors']) for key in sorted(EXTRA)}
        if args.candidate:
            assert all(counts.values()), counts
        else:
            assert not any(counts.values()), counts
        get.assert_called_once()
        assert get.call_args.args == (URL,)
        assert get.call_args.kwargs['stream'] is True
        assert feed.CACHE_FILE.read_bytes() == newer_raw

        feed._memory = None
        plain = read(client, newer['version'], 'current')
        assert plain['competitors'] == [{key: row[key] for key in ('lat', 'lng')}
                                       for row in rich['competitors']]
        assert all(set(row) == {'lat', 'lng'} for row in plain['competitors'])
        assert plain['grid'] == rich['grid']
        get.assert_called_once()
        read(client, newer['version'], 'unavailable', refresh='1')
        assert feed.CACHE_FILE.read_bytes() == newer_raw
        assert get.call_count == 2

    result = {'implementation': args.label or ('stage1' if args.candidate else '2c7419d'),
              'previous_version': older['version'], 'accepted_version': newer['version'],
              'accepted_sha256': sha256(newer_raw).hexdigest(), 'first_read_previous_status': 'current',
              'refresh_status': 'updated', 'cache_reload_status': 'current',
              'offline_refresh_status': 'unavailable', 'last_complete_payload_preserved': True,
              'plain_get_preserved': True, 'opt_in_center_grocery_counts': counts}
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--old', type=Path, default=HERE.parent / 'competitor-details' / 'city-4140bc58bd5b.json')
    parser.add_argument('--new', type=Path, default=HERE / 'stage1-city.json')
    parser.add_argument('--candidate', action='store_true')
    parser.add_argument('--label')
    parser.add_argument('--output', type=Path, required=True)
    run(parser.parse_args())


if __name__ == '__main__':
    main()
