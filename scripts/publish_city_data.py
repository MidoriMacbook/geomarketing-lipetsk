"""Атомарная публикация проверенного файла в ветку данных с токеном Actions."""
import base64
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import requests
from src.domain.city_data import validate_bundle


_DATA_LICENSE = """# Городская выгрузка Липецка

[city.json](city.json) — производная база данных OpenStreetMap.
Данные © [участники OpenStreetMap](https://www.openstreetmap.org/copyright),
лицензия [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Численность жителей рассчитана проектом по тегам жилых домов.
""".encode('utf-8')


def _publish_file(session, api, name, raw, message):
    url = f'{api}/contents/{name}'
    existing = session.get(url, params={'ref': 'osm-data'}, timeout=20)
    encoded = base64.b64encode(raw).decode('ascii')
    payload = {'message': message, 'branch': 'osm-data', 'content': encoded}
    if existing.status_code != 404:
        existing.raise_for_status()
        current = existing.json()
        if ''.join((current.get('content') or '').splitlines()) == encoded:
            return
        payload['sha'] = current['sha']
    session.put(url, json=payload, timeout=60).raise_for_status()


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
        _publish_file(session, api, 'CITY-DATA-LICENSE.md', _DATA_LICENSE, 'лицензия данных города')
        _publish_file(session, api, 'city.json', raw, 'ежедневные данные города')
    print('Published validated city version ' + bundle['version'])


if __name__ == '__main__':
    publish(Path(sys.argv[1]))
