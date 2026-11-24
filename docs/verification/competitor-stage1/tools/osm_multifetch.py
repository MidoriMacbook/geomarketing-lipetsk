"""Capture OSM API fallback tags for all typed competitors in the published city."""

import argparse
from collections import defaultdict
from datetime import UTC, datetime
from hashlib import sha256
import json
from pathlib import Path
import subprocess


HERE = Path(__file__).resolve().parent
API = 'https://api.openstreetmap.org/api/0.6/'
AGENT = 'GeoMarketingLipetsk/1.0 (+https://github.com/MidoriMacbook/geomarketing-lipetsk)'
KEYS = {'name', 'name:ru', 'addr:full', 'addr:street', 'addr:place', 'addr:housenumber',
        'addr:housename', 'brand', 'brand:wikidata', 'operator'}
BATCH_SIZE = 380


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n',
                    encoding='utf-8', newline='\n')


def fetch(kind, identifiers, batch_number):
    plural = f'{kind}s'
    endpoint = f'{API}{plural}.json'
    query = ','.join(map(str, identifiers))
    path = HERE / f'osm-raw-{plural}-{batch_number}.json'
    result = subprocess.run(['curl.exe', '--compressed', '--fail', '--silent', '--show-error', '--max-time', '45',
                             '-A', AGENT, '--output', str(path), '--write-out', '%{http_code} %{time_total} %{size_download}',
                             f'{endpoint}?{plural}={query}'], check=True, capture_output=True, text=True)
    status, seconds, transferred = result.stdout.split()
    raw = path.read_bytes()
    elements = json.loads(raw)['elements']
    returned = {element['id'] for element in elements}
    expected = {int(str(identifier).split('v', maxsplit=1)[0]) for identifier in identifiers}
    assert len(returned) == len(elements) == len(identifiers) and returned == expected
    assert {element['type'] for element in elements} == {kind}
    return elements, {'kind': kind, 'batch': batch_number, 'endpoint': endpoint, 'ids': len(returned),
                      'status': int(status), 'seconds': float(seconds), 'transferred_bytes': int(transferred),
                      'response_sha256': sha256(raw).hexdigest(), 'response': path.name,
                      'received_utc': datetime.now(UTC).isoformat()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pinned', type=Path, help='Optional exact OSM version manifest for historical replay.')
    args = parser.parse_args()
    bundle_path = HERE / 'city-latest.json'
    raw = bundle_path.read_bytes()
    bundle = json.loads(raw)
    actual, receipts = {}, []
    groups = defaultdict(set)
    offsets = []
    cutoff = datetime.fromtimestamp(bundle['fetched_at'], UTC)
    for business, provenance in bundle['provenance']['competitors'].items():
        for record, coords in zip(provenance['records'], bundle['competitors'][business], strict=True):
            identity = f"{record['osm_type']}:{record['osm_id']}"
            groups[record['osm_type']].add(record['osm_id'])
            actual.setdefault(identity, {'coords': coords, 'categories': []})['categories'].append(business)

    found = {}
    exact = None
    if args.pinned:
        manifest = json.loads(args.pinned.read_bytes())
        assert manifest['city_file_sha256'] == sha256(raw).hexdigest()
        exact = manifest['versioned_ids']
        assert {kind: sorted(int(value.split('v')[0]) for value in versions) for kind, versions in exact.items()} == {
            kind: sorted(ids) for kind, ids in groups.items()}
    for kind, ids in sorted(groups.items()):
        ordered = exact[kind] if exact else sorted(ids)
        for index in range(0, len(ordered), BATCH_SIZE):
            fetched, receipt = fetch(kind, ordered[index:index + BATCH_SIZE], index // BATCH_SIZE + 1)
            receipts.append(receipt)
            for element in fetched:
                found[f"{kind}:{element['id']}"] = element

    historical = defaultdict(list)
    for element in found.values():
        if datetime.fromisoformat(element['timestamp']) > cutoff:
            assert element['version'] > 1
            historical[element['type']].append(f"{element['id']}v{element['version'] - 1}")
    for kind, ids in sorted(historical.items()):
        fetched, receipt = fetch(kind, sorted(ids), 'historical')
        receipts.append(receipt)
        for element in fetched:
            found[f"{kind}:{element['id']}"] = element

    for identity, entry in actual.items():
        element = found[identity]
        assert element.get('visible', True), identity
        assert datetime.fromisoformat(element['timestamp']) <= cutoff, (identity, element['timestamp'], cutoff)
        if element['type'] == 'node':
            offset = max(abs(a - b) for a, b in zip(entry['coords'], (element['lat'], element['lon']), strict=True))
            assert offset <= 0.000000501, (identity, offset)
            offsets.append(offset)
        entry['tags'] = {key: value for key, value in element.get('tags', {}).items() if key in KEYS}
        entry['osm_version'] = element['version']
        entry['osm_timestamp'] = element['timestamp']

    result = {'source': 'OpenStreetMap object API multi-fetch by typed ID', 'city_file_sha256': sha256(raw).hexdigest(),
              'city_version': bundle['version'], 'cutoff_utc': cutoff.isoformat(),
              'unique_ids': len(actual), 'max_node_offset_deg': max(offsets, default=0.0),
              'network_seconds_total': sum(receipt['seconds'] for receipt in receipts),
              'network_bytes_total': sum(receipt['transferred_bytes'] for receipt in receipts),
              'attribution': '© OpenStreetMap contributors', 'license_url': 'https://www.openstreetmap.org/copyright',
              'receipts': receipts, 'by_id': actual}
    write_json(HERE / 'multifetch-tags.json', result)
    print(json.dumps({key: value for key, value in result.items() if key != 'by_id'}, indent=2))


if __name__ == '__main__':
    main()
