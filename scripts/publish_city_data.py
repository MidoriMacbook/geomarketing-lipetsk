"""Publish the validated file atomically to the data branch using Actions' token."""
import base64
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import requests
from src.domain.city_data import validate_bundle


def publish(path):
    raw = path.read_bytes()
    bundle = validate_bundle(json.loads(raw))
    repo = os.environ['GITHUB_REPOSITORY']
    api = f'https://api.github.com/repos/{repo}'
    with requests.Session() as session:
        session.headers.update({'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'],
                                'Accept': 'application/vnd.github+json',
                                'X-GitHub-Api-Version': '2022-11-28'})
        branch = session.get(api + '/git/ref/heads/osm-data', timeout=20)
        if branch.status_code == 404:
            created = session.post(api + '/git/refs', json={
                'ref': 'refs/heads/osm-data', 'sha': os.environ['GITHUB_SHA']}, timeout=20)
            created.raise_for_status()
        else:
            branch.raise_for_status()
        existing = session.get(api + '/contents/city.json', params={'ref': 'osm-data'}, timeout=20)
        payload = {'message': 'data: daily Lipetsk OSM extract [skip ci] [skip render]',
                   'branch': 'osm-data', 'content': base64.b64encode(raw).decode('ascii')}
        if existing.status_code != 404:
            existing.raise_for_status()
            payload['sha'] = existing.json()['sha']
        published = session.put(api + '/contents/city.json', json=payload, timeout=60)
        published.raise_for_status()
    print('Published validated city version ' + bundle['version'])


if __name__ == '__main__':
    publish(Path(sys.argv[1]))
