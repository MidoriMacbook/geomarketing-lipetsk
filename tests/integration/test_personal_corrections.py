"""Совместимость HTTP и пересчёт на неподвижных исходных снимках."""
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from uuid import UUID

from app import app
from src.domain.businesses import BUSINESS_CATALOG
from src.services import analysis_service, cache_service, city_feed_service
from src.services import osm_service as osm
from src.utils import formatting
from src.utils.validation import area_for


FIXTURES = Path(__file__).resolve().parents[1] / 'fixtures'
BASELINES = json.loads((FIXTURES / 'corrections-baseline.json').read_bytes())
FROZEN_DATE = datetime(2026, 11, 18, tzinfo=timezone.utc)
URL = '/api/calculate'
EMPTY = {'added': [], 'removed': []}


class PersonalCorrectionsTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        folder = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch.object(cache_service, 'CACHE_DIR', Path(folder)))
        self.enterContext(patch.object(cache_service.time, 'time', return_value=FROZEN_DATE.timestamp()))
        self.enterContext(patch.object(analysis_service, 'CITY_DATA_URL', ''))
        self.enterContext(patch.object(osm, '_overpass', side_effect=AssertionError('No network expected')))
        self.enterContext(patch.object(formatting, 'uuid4', return_value=UUID(int=42)))
        self.enterContext(patch.object(analysis_service, 'datetime')).now.return_value = FROZEN_DATE

    def post(self, corrections, **params):
        return self.client.post(URL, json={'corrections': corrections, **params})

    def test_ordinary_calculation_preserves_snapshot_and_plain_post_bytes(self):
        for district, baseline in BASELINES.items():
            with self.subTest(district=district):
                params = {'district': district, 'type': 'cafe'}
                original = self.client.get(URL, query_string=params)
                self.assertEqual(original.status_code, 200)
                legacy = original.get_json()
                self.assertEqual(self.client.post(URL, json=params).data, original.data)
                # Привязка всех байтов к эталону Windows. На других платформах
                # библиотека линейной алгебры может округлить последние разряды.
                if sys.platform == 'win32':
                    self.assertEqual(sha256(original.data).hexdigest(), baseline['response_sha256_windows'])
                serialized_grid = json.dumps(legacy['grid']['scores'], separators=(',', ':')).encode()
                self.assertEqual(sha256(serialized_grid).hexdigest(), baseline['grid_sha256'])
                for row, expected in zip(legacy['recommendations'], baseline['recommendations'], strict=True):
                    for key, value in zip(('lat', 'lng', 'score'), expected, strict=True):
                        self.assertAlmostEqual(row[key], value, places=12)
                edited = self.post(EMPTY, **params).get_json()
                self.assertEqual(edited['grid'], legacy['grid'])
                self.assertEqual(edited['correction_context']['counts'], {'added': 0, 'removed': 0})
                for rec, previous in zip(edited['recommendations'], legacy['recommendations'], strict=True):
                    self.assertEqual(rec.pop('correction_delta'), {
                        'baseline_score': previous['score'], 'score_delta': 0.0, 'is_new_location': False,
                    })
                    self.assertEqual(rec, previous)

    def test_typed_ids_survive_cache_and_remove_only_one_of_two_objects_at_same_point(self):
        area = area_for('eleytsky')
        lat, lng = area['center']
        source = osm.parse_competitors([
            {'type': 'node', 'id': 14, 'lat': lat, 'lon': lng},
            {'type': 'way', 'id': 14, 'center': {'lat': lat, 'lon': lng}},
            {'type': 'node', 'lat': lat, 'lon': lng},
        ])
        original = {'id': 'node:14', 'lat': lat, 'lng': lng, 'source': 'osm'}
        cache_path = cache_service.CACHE_DIR / (osm.competitor_cache_name('cafe', area) + '.json')
        cache_service._write_cache(cache_path, source, FROZEN_DATE.timestamp())
        old = self.client.get(URL).get_json()
        entry = self.post({})
        self.assertEqual(entry.status_code, 200)
        baseline = entry.get_json()
        self.assertEqual(baseline['correction_context']['base_competitors'], [
            original, {**original, 'id': 'way:14'}, {**original, 'id': None},
        ])

        point = {'id': 'manual-1', 'lat': old['best']['lat'], 'lng': old['best']['lng']}
        response = self.post({'added': [point], 'removed': ['node:14']})
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result['competitors'], [
            {**original, 'id': 'way:14'}, {**original, 'id': None}, {**point, 'source': 'manual'},
        ])
        self.assertEqual(result['correction_context']['counts'], {'added': 1, 'removed': 1})
        self.assertEqual(result['correction_context']['base_competitors'],
                         baseline['correction_context']['base_competitors'])
        self.assertEqual(result['correction_context']['applied'], {'added': [point], 'removed': ['node:14']})
        self.assertNotEqual(result['grid'], old['grid'])
        grid = old['grid']
        for rec in result['recommendations']:
            x = round((rec['lng'] - grid['lng_min']) * (grid['n'] - 1) / (grid['lng_max'] - grid['lng_min']))
            y = round((rec['lat'] - grid['lat_min']) * (grid['n'] - 1) / (grid['lat_max'] - grid['lat_min']))
            delta = rec['correction_delta']
            self.assertAlmostEqual(delta['baseline_score'], grid['scores'][y * grid['n'] + x], delta=0.0005)
            self.assertAlmostEqual(delta['score_delta'], rec['score'] - delta['baseline_score'])
            self.assertEqual(delta['is_new_location'], not any(
                (rec['lat'], rec['lng']) == (prev['lat'], prev['lng']) for prev in old['recommendations']))
        self.assertEqual(self.client.get(URL).get_json(), old)
        self.assertEqual(self.post(EMPTY).get_json(), baseline)

    def test_opt_in_details_survive_removal_and_reset_at_same_coordinates(self):
        area = area_for('eleytsky')
        lat, lng = area['center']
        source = osm.parse_competitors([
            {'type': 'node', 'id': 14, 'lat': lat, 'lon': lng, 'tags': {'name': 'Роза'}},
            {'type': 'way', 'id': 14, 'center': {'lat': lat, 'lon': lng},
             'tags': {'addr:full': 'Новая, 11'}},
            {'type': 'relation', 'id': 14, 'center': {'lat': lat, 'lon': lng}},
        ])
        cache_path = cache_service.CACHE_DIR / (osm.competitor_cache_name('cafe', area) + '.json')
        cache_service._write_cache(cache_path, source, FROZEN_DATE.timestamp())
        coords = {'lat': lat, 'lng': lng}
        expected = [
            {**coords, 'id': 'node:14', 'source': 'osm', 'name': 'Роза'},
            {**coords, 'id': 'way:14', 'source': 'osm', 'address': 'Новая, 11'},
            {**coords, 'id': 'relation:14', 'source': 'osm'},
        ]
        plain = self.client.get(URL).get_json()
        opt_in = self.client.get(URL, query_string={'competitor_details': '1'}).get_json()
        self.assertEqual(plain['competitors'], [coords] * 3)
        self.assertEqual(opt_in['competitors'], expected)
        self.assertEqual({**opt_in, 'competitors': plain['competitors']}, plain)

        manual = {**coords, 'id': 'local-1'}
        edited = self.post({'added': [manual], 'removed': ['node:14']}).get_json()
        self.assertEqual(edited['correction_context']['base_competitors'], expected)
        self.assertEqual(edited['competitors'], [*expected[1:], {**manual, 'source': 'manual'}])
        reset = self.post(EMPTY).get_json()
        self.assertEqual(reset['competitors'], expected)
        self.assertEqual(reset['correction_context']['base_competitors'], expected)
        self.assertEqual(reset['grid'], plain['grid'])

    def test_warm_scoring_cache_canonicalizes_additions_and_reuses_baseline(self):
        lat, lng = area_for('eleytsky')['center']
        edits = [{'id': 'b', 'lat': lat, 'lng': lng},
                 {'id': 'a', 'lat': lat + 0.001, 'lng': lng}]
        with patch.object(analysis_service, 'score_locations', wraps=analysis_service.score_locations) as score:
            empty = self.post(EMPTY, district='eleytsky', type='bakery')
            first = self.post({'added': edits}, district='eleytsky', type='bakery')
            reordered = self.post({'added': edits[::-1]}, district='eleytsky', type='bakery')
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(reordered.data, first.data)
        self.assertEqual(score.call_count, 2)

    def test_replaced_source_rows_invalidate_baseline_and_edited_score(self):
        area = area_for('eleytsky')
        lat, lng = area['center']
        edits = {'added': [{'id': 'manual-2', 'lat': lat, 'lng': lng}]}
        first = self.post(edits).get_json()
        self.assertEqual(first['status'], 'success')
        updated_competitors = [[lat, lng - 0.003]]
        cache_path = cache_service.CACHE_DIR / (osm.competitor_cache_name('cafe', area) + '.json')
        cache_service._write_cache(cache_path, updated_competitors,
                                   first['data_meta']['competitors']['fetched_at'])
        second = self.post(edits).get_json()
        self.assertEqual(second['status'], 'success')
        self.assertEqual(second['stats']['competitors'], 2)
        self.assertNotEqual(second['grid'], first['grid'])
        self.assertNotEqual(second['correction_context']['base_competitors'],
                            first['correction_context']['base_competitors'])

    def test_invalid_or_excessive_corrections_fail_without_scoring(self):
        lat, lng = area_for('eleytsky')['center']
        entry = {'id': 'manual-1', 'lat': lat, 'lng': lng}
        invalid = [
            None, [], {'added': [entry] * 51}, {'added': True}, {'removed': {}},
            {'added': [entry, entry]}, {'added': [{**entry, 'id': 'node:42'}]},
            {'added': [{**entry, 'lat': None}]}, {'added': [{**entry, 'lat': float('nan')}]},
            {'added': [{**entry, 'lat': 0}]}, {'removed': ['node:1', 'node:1']},
            {'removed': ['bad']}, {'removed': ['node:404']}, {'removed': [42]},
            {'unknown': []}, {'added': [[], entry]},
        ]
        with patch.object(analysis_service, 'score_locations') as score:
            for corrections in invalid:
                with self.subTest(corrections=corrections):
                    response = self.post(corrections)
                    self.assertEqual(response.status_code, 400, response.get_json())
                    self.assertEqual(response.get_json()['status'], 'error')
            score.assert_not_called()

    def test_large_and_invalid_json_do_not_reach_calculation(self):
        self.assertEqual(self.client.post(URL, json={'ignored': 'x' * 20000}).status_code, 413)
        for invalid in ([], None, {'lat': {}}, {'type': False}):
            self.assertEqual(self.client.post(URL, data=json.dumps(invalid),
                                             content_type='application/json').status_code, 400)
        self.assertEqual(self.client.post(URL, data='{', content_type='application/json').status_code, 400)

    def test_saved_legacy_source_supports_addition_but_not_removal(self):
        response = self.post(EMPTY)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['competitors'])
        self.assertTrue(all(row['id'] is None for row in response.get_json()['competitors']))
        opt_in = self.client.get(URL, query_string={'competitor_details': '1'}).get_json()
        self.assertEqual(opt_in['competitors'], response.get_json()['competitors'])
        self.assertEqual(self.post({'removed': ['node:1']}).status_code, 400)
        lat, lng = area_for('eleytsky')['center']
        rows = [{'id': str(i), 'lat': lat, 'lng': lng} for i in range(50)]
        applied = self.post({'added': rows})
        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.get_json()['correction_context']['counts']['added'], 50)

    def test_daily_source_filters_provenance_with_same_indices_as_coordinates(self):
        area = area_for('eleytsky')
        lat, lng = area['center']
        houses_path = cache_service.SNAPSHOT_DIR / f'houses_{osm.cache_key(area)}.json'
        houses = json.loads(houses_path.read_bytes())['data']
        competitors = osm.parse_competitors([
            {'type': 'node', 'id': 41, 'lat': lat + 0.03, 'lon': lng, 'tags': {'name': 'За пределами'}},
            {'type': 'node', 'id': 42, 'lat': lat, 'lon': lng, 'tags': {'name': 'Первая'}},
            {'type': 'node', 'id': 43, 'lat': lat + 0.001, 'lon': lng, 'tags': {
                'addr:full': 'Новая, 11', 'brand': 'Вишня', 'brand:wikidata': 'Q42', 'operator': 'ООО Вишня',
            }},
        ])
        bundle = {'houses': houses, 'competitors': {'cafe': competitors}, 'version': 'daily-fixture',
                  'fetched_at': FROZEN_DATE.timestamp(),
                  'provenance': {'competitors': {'cafe': competitors.provenance}}}
        with patch.object(analysis_service, 'CITY_DATA_URL', 'daily-fixture'), \
             patch.object(city_feed_service, '_get_bundle', return_value=(bundle, 'current', True, None)):
            plain = self.client.get(URL).get_json()
            self.assertEqual(plain['competitors'], [{'lat': lat, 'lng': lng},
                                                   {'lat': round(lat + 0.001, 6), 'lng': lng}])
            detailed = self.client.get(URL, query_string={'competitor_details': '1'}).get_json()
            self.assertEqual(detailed['competitors'][1]['brand:wikidata'], 'Q42')
            response = self.post({'removed': ['node:42']})
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertEqual(data['correction_context']['base_competitors'], [
                {'id': 'node:42', 'source': 'osm', 'lat': lat, 'lng': lng, 'name': 'Первая'},
                {'id': 'node:43', 'source': 'osm', 'lat': round(lat + 0.001, 6), 'lng': lng,
                 'address': 'Новая, 11', 'brand': 'Вишня', 'brand:wikidata': 'Q42', 'operator': 'ООО Вишня'},
            ])
            self.assertEqual(data['competitors'], data['correction_context']['base_competitors'][1:])
            self.assertEqual(self.post({'removed': ['node:41']}).status_code, 400)

    def test_edits_do_not_treat_demo_competitors_as_osm(self):
        with patch.object(osm, 'get_houses', side_effect=RuntimeError('offline')):
            original = self.client.get(URL)
            opt_in = self.client.get(URL, query_string={'competitor_details': '1'})
            response = self.post(EMPTY)
        self.assertEqual(original.get_json()['source'], 'demo')
        self.assertEqual(opt_in.get_json()['competitors'],
                         [{**row, 'source': 'demo', 'id': None}
                          for row in original.get_json()['competitors']])
        self.assertEqual(response.status_code, 400)
        self.assertIn('OpenStreetMap', response.get_json()['message'])
