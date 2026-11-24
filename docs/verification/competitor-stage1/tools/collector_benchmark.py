"""Time unchanged collector entry points with identical HTTP inputs in separate checkouts."""

import argparse
from collections import Counter
from contextlib import ExitStack
from datetime import UTC, datetime
import gc
import gzip
from hashlib import sha256
import json
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import time
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
PUBLIC = HERE / 'city-latest.json'
REF = 'ae79e8a90bcc0b84bc098d1f20c8f999c08cd601'
PUBLIC_SHA = '36cdb230bae742f5efe73a47ed22eaae4e23531a98fb9776521a0b49a243748e'
BASELINE = '2c7419dfc6aa1f862fc67974f34d89ee3e3fa317'
EXTRA = ('brand', 'brand:wikidata', 'operator')
FIELDS = ('name', 'address', *EXTRA)
TYPES = ('node', 'way', 'relation')


def hash_bytes(raw):
    return sha256(raw).hexdigest()


def pack(value, *, ascii=True):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False, ensure_ascii=ascii).encode()


def save(path, value):
    path.write_bytes((json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + '\n').encode())


def read_public():
    raw = PUBLIC.read_bytes()
    assert hash_bytes(raw) == PUBLIC_SHA
    return raw, json.loads(raw)


def reconstruct_competitors(published):
    tags_raw = (HERE / 'multifetch-tags.json').read_bytes()
    receipt = json.loads(tags_raw)
    assert receipt['city_file_sha256'] == PUBLIC_SHA
    versions = {}
    for batch in receipt['receipts']:
        raw = (HERE / batch['response']).read_bytes()
        assert hash_bytes(raw) == batch['response_sha256']
        for element in json.loads(raw)['elements']:
            identity = f"{element['type']}:{element['id']}"
            if receipt['by_id'][identity]['osm_version'] == element['version']:
                versions[identity] = element
    assert versions.keys() == receipt['by_id'].keys()
    elements = []
    for identity in sorted(versions, key=lambda key: (TYPES.index(key.split(':')[0]), int(key.split(':')[1]))):
        raw = versions[identity]
        row = receipt['by_id'][identity]
        item = {'type': raw['type'], 'id': raw['id'], 'tags': raw.get('tags', {})}
        if raw['type'] == 'node':
            item.update(lat=raw['lat'], lon=raw['lon'])
        else:
            item['center'] = dict(zip(('lat', 'lon'), row['coords'], strict=True))
        elements.append(item)
    meta = {key: receipt[key] for key in ('source', 'cutoff_utc', 'unique_ids', 'max_node_offset_deg',
                                        'network_seconds_total', 'network_bytes_total', 'receipts')}
    meta['tags_receipt_sha256'] = hash_bytes(tags_raw)
    meta['published_categories'] = {key: len(rows) for key, rows in published['competitors'].items()}
    return pack({'elements': elements}), meta


class PlaybackResponse:
    status_code = 200

    def __init__(self, content):
        self.content = content

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def raise_for_status(self):
        pass

    def json(self):
        return json.loads(self.content)


def identify_checkout(repo, baseline):
    if baseline:
        return {'commit': BASELINE, 'source': 'git archive'}
    head = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
    diff = subprocess.check_output(['git', '-C', str(repo), 'diff', '--binary', 'HEAD', '--', 'scripts/collect_city_data.py', 'src'])
    return {'commit': head, 'source': 'working tree', 'collector_diff_sha256': hash_bytes(diff),
            'collector_worktree_changed': bool(diff)}


def assert_published_shape(bundle, published):
    assert bundle['houses'] == published['houses']
    assert bundle['provenance']['houses'] == published['provenance']['houses']
    assert bundle['competitors'] == published['competitors']
    for key, provenance in bundle['provenance']['competitors'].items():
        def identities(source):
            return [(record['osm_type'], record['osm_id']) for record in source['records']]
        assert identities(provenance) == identities(published['provenance']['competitors'][key]), key


def load_inputs(args, published):
    if args.mode == 'overpass':
        assert args.houses and args.competitors, 'Provide --houses and --competitors for actual Overpass replay'
        replies = {name: path.read_bytes() for name, path in [('houses', args.houses), ('competitors', args.competitors)]}
        meta = {}
        for name, raw in replies.items():
            data = json.loads(raw)
            assert not data.get('remark') and data['elements']
            meta[name] = {'sha256': hash_bytes(raw), 'objects_in_response': len(data['elements']),
                          'overpass_osm_base': data.get('osm3s', {}).get('timestamp_osm_base')}
        return replies, {'kind': 'raw_complete_overpass_response_replay', 'response': meta}

    competitors, source = reconstruct_competitors(published)
    return {'houses': b'{"elements":[]}', 'competitors': competitors}, {
        'kind': 'full_published_set_replay', 'competitor_response_sha256': hash_bytes(competitors),
        'competitor_tag_provenance': source,
        'house_replay': 'all published rows and original provenance at the return boundary of parse_houses',
        'way_relation_centers': 'published coordinates; API center unavailable',
        'house_geometry_parsing_timed': False, 'network_wait_timed': False}


def run(args):
    sys.path.insert(0, str(args.repo.resolve()))
    from scripts import collect_city_data as collector
    from src.domain.provenance import ProvenancedRows

    previous_raw, published = read_public()
    stamp = published['fetched_at']
    replies, source = load_inputs(args, published)
    queries = {name: (HERE / f'{name}.overpassql').read_text() for name in ('houses', 'competitors')}
    by_query = {query: replies[name] for name, query in queries.items()}
    call_log = []

    def reply(url, *, headers, timeout, params=None):
        if url == collector.FEED_URL:
            call_log.append('previous')
            assert params is None
            return PlaybackResponse(previous_raw)
        assert url == collector.OVERPASS_URLS[0] and params['data'] in by_query
        call_log.append('houses' if params['data'] == queries['houses'] else 'competitors')
        return PlaybackResponse(by_query[params['data']])

    def houses_at_parser_boundary(elements):
        assert elements == []
        return ProvenancedRows(published['houses'], published['provenance']['houses'])

    sample_file = args.output.with_name(f'{args.output.stem}-city.json')
    processing, writing, totals = [], [], []
    code = identify_checkout(args.repo, args.baseline)
    with ExitStack() as stack:
        stack.enter_context(patch.object(collector.requests, 'get', side_effect=reply))
        stack.enter_context(patch.object(collector.time, 'time', return_value=stamp))
        if args.mode == 'published':
            stack.enter_context(patch.object(collector, 'parse_houses', side_effect=houses_at_parser_boundary))
        initial_raw = None
        for iteration in range(args.runs + 1):
            gc.collect()
            call_log.clear()
            start = time.perf_counter()
            bundle = collector.collect()
            packed_at = time.perf_counter()
            raw = pack(bundle)
            sample_file.write_bytes(raw)
            finish = time.perf_counter()
            assert call_log == ['houses', 'competitors', 'previous'], call_log
            if args.mode == 'published':
                assert_published_shape(bundle, published)
            if initial_raw is None:
                initial_raw = raw
                continue
            assert raw == initial_raw
            processing.append(packed_at - start)
            writing.append(finish - packed_at)
            totals.append(finish - start)

    category = {}
    for key, source_info in bundle['provenance']['competitors'].items():
        counts = Counter(field for record in source_info['records'] for field in FIELDS if field in record)
        category[key] = {'total': len(source_info['records']), **{key: counts[key] for key in FIELDS}}
    utf8 = pack(bundle, ascii=False)
    result = {'code': code, 'input': source, 'hours_utc_fixed': datetime.fromtimestamp(stamp, UTC).isoformat(),
              'published_previous_version': published['version'], 'published_previous_ref': REF,
              'runtime': {'python': platform.python_version(), 'platform': platform.platform(),
                          'cpu': platform.processor(), 'warmups': 1, 'samples': args.runs},
              'milliseconds': {key: {'samples': [round(x * 1000, 3) for x in values],
                                     'median': round(statistics.median(values) * 1000, 3)}
                               for key, values in [('build', processing), ('pack_and_write', writing), ('total', totals)]},
              'output': {'version': bundle['version'], 'sha256': hash_bytes(raw), 'count_houses': len(bundle['houses']),
                         'count_competitors': sum(map(len, bundle['competitors'].values())), 'by_category': category,
                         'wire_requests_replayed_locally': 3,
                         'bytes': {'production_json': len(raw), 'production_json_gzip6': len(gzip.compress(raw, 6, mtime=0)),
                                   'utf8_json': len(utf8), 'utf8_json_gzip6': len(gzip.compress(utf8, 6, mtime=0))}}}
    save(args.output, result)
    print(json.dumps({key: result[key] for key in ('code', 'milliseconds', 'output')}, indent=2))


def changes(before, after):
    return {'before': before, 'after': after, 'delta': round(after - before, 3),
            'delta_percent': round(100 * (after - before) / before, 4)}


def compare(args):
    baseline, candidate = (json.loads(path.read_bytes()) for path in (args.before, args.after))
    assert baseline['input'] == candidate['input']
    old_data, new_data = (json.loads(path.with_name(f'{path.stem}-city.json').read_bytes())
                          for path in (args.before, args.after))
    for values in new_data['provenance']['competitors'].values():
        for row in values['records']:
            for field in EXTRA:
                row.pop(field, None)
    assert {k: v for k, v in old_data.items() if k != 'version'} == {k: v for k, v in new_data.items() if k != 'version'}
    compatible = {}
    for key, repo in [('baseline', args.baseline_repo), ('candidate', args.candidate_repo)]:
        code = ('import json,sys; from pathlib import Path; from src.domain.city_data import validate_bundle; '
                'print([validate_bundle(json.loads(Path(path).read_bytes()))["version"] for path in sys.argv[1:]])')
        paths = [PUBLIC, *(path.with_name(f'{path.stem}-city.json') for path in (args.before, args.after))]
        output = subprocess.check_output([sys.executable, '-c', code, *(str(path.resolve()) for path in paths)],
                                         cwd=repo, text=True).strip()
        compatible[key] = {'all_three_full_bundles_validated': True, 'output': output}

    report = {'schema': 1, 'before': baseline, 'after': candidate, 'compatibility': compatible,
              'numeric_identity_and_other_existing_values_equal': True,
              'size_bytes': {key: changes(baseline['output']['bytes'][key], size)
                             for key, size in candidate['output']['bytes'].items()},
              'timing_median_ms': {key: changes(baseline['milliseconds'][key]['median'], result['median'])
                                   for key, result in candidate['milliseconds'].items()}}
    save(args.output, report)
    print(json.dumps({key: report[key] for key in ('size_bytes', 'timing_median_ms', 'compatibility')}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    run_parser = commands.add_parser('run')
    run_parser.add_argument('--repo', type=Path, required=True)
    run_parser.add_argument('--baseline', action='store_true')
    run_parser.add_argument('--mode', choices=('published', 'overpass'), default='published')
    run_parser.add_argument('--houses', type=Path)
    run_parser.add_argument('--competitors', type=Path)
    run_parser.add_argument('--runs', type=int, default=7)
    compare_parser = commands.add_parser('compare')
    compare_parser.add_argument('--before', type=Path, required=True)
    compare_parser.add_argument('--after', type=Path, required=True)
    compare_parser.add_argument('--baseline-repo', type=Path, default=HERE / 'baseline-2c7419d')
    compare_parser.add_argument('--candidate-repo', type=Path, default=HERE.parents[2])
    for command in (run_parser, compare_parser):
        command.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    (run if args.command == 'run' else compare)(args)


if __name__ == '__main__':
    main()
