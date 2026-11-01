"""Совместимость происхождения и различение исходных объектов без удаления по близости."""
import copy
import json
from pathlib import Path
import tempfile
import time
import unittest

from src.domain.businesses import BUSINESS_CATALOG
from src.domain import city_data
from src.services import osm_service as osm, cache_service
from src.utils.validation import area_for
from tests.unit.test_city_data import city_rows


def competitor(kind, ident, lat=52.5935, lng=39.48):
    return ({'type': kind, 'id': ident, 'lat': lat, 'lon': lng}
            if kind == 'node' else
            {'type': kind, 'id': ident, 'center': {'lat': lat, 'lon': lng}})


def house(ident):
    return {'type': 'way', 'id': ident,
            'tags': {'building': 'apartments', 'building:flats': '10', 'building:levels': '3'},
            'geometry': [{'lat': 52.593, 'lon': 39.480}, {'lat': 52.593, 'lon': 39.481},
                         {'lat': 52.594, 'lon': 39.481}, {'lat': 52.594, 'lon': 39.480},
                         {'lat': 52.593, 'lon': 39.480}]}


class ProvenanceTests(unittest.TestCase):
    def test_same_identity_is_removed_but_nearby_distinct_objects_survive(self):
        elements = [competitor('node', 1), competitor('node', 1),
                    competitor('node', 2, lng=39.48001), competitor('way', 1)]
        rows = osm.parse_competitors(elements)
        self.assertEqual(len(rows), 3)
        self.assertEqual(len(rows.provenance['records']), 3)
        self.assertEqual(rows.provenance['duplicates_removed'], 1)
        self.assertEqual(rows.provenance['deduplication'], 'osm_type_id')
        self.assertTrue(rows.provenance['possible_node_way_pairs'])

    def test_houses_keep_identity_date_and_population_inputs(self):
        rows = osm.parse_houses([house(1), house(1), house(2)], fetched_at=100)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0], rows[1])
        record = rows.provenance['records'][0]
        self.assertEqual(record['osm_type'], 'way')
        self.assertEqual(record['osm_id'], 1)
        self.assertEqual(record['fetched_at'], 100)
        self.assertEqual(record['population']['rule'], 'flats')
        self.assertEqual(record['population']['tags']['building:flats'], '10')
        self.assertEqual(rows[0][2], 24)
        self.assertEqual(rows.provenance['same_geometry_groups'], [[0, 1]])

    def test_missing_identity_does_not_allow_coordinate_merging(self):
        rows = osm.parse_competitors([{'type': 'node', 'lat': 52.59, 'lon': 39.48}] * 2)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows.provenance['duplicates_removed'], 0)

    def test_conflicting_repeat_identity_is_rejected(self):
        with self.assertRaises(ValueError):
            osm.parse_competitors([competitor('node', 1), competitor('node', 1, lng=39.49)])

    def test_new_bundle_preserves_nearby_objects_and_legacy_remains_readable(self):
        rows = osm.parse_competitors([competitor('node', 1), competitor('node', 2)])
        bundle = city_data.make_bundle(city_rows(), {key: rows for key in BUSINESS_CATALOG}, time.time())
        self.assertIn('provenance', bundle)
        restored = city_data.validate_bundle(json.loads(json.dumps(bundle)))
        self.assertEqual(len(city_data.select_area(restored, area_for('eleytsky'), 'cafe')[1]), 2)
        legacy = city_data.make_bundle(city_rows(), {key: list(rows) for key in BUSINESS_CATALOG}, time.time())
        self.assertNotIn('provenance', legacy)
        self.assertEqual(len(city_data.select_area(legacy, area_for('eleytsky'), 'cafe')[1]), 1)

    def test_cache_round_trip_retains_provenance_without_changing_numeric_rows(self):
        rows = osm.parse_competitors([competitor('node', 1), competitor('way', 1)])
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-') as folder:
            from unittest.mock import patch
            target = Path(folder) / 'comp.json'
            with patch.object(cache_service, 'CACHE_DIR', Path(folder)):
                cache_service._write_cache(target, rows, 100)
                restored, saved = cache_service._read_cache(target, 2, True)
        self.assertEqual(restored, rows)
        self.assertEqual(saved, 100)
        self.assertEqual(restored.provenance, rows.provenance)

    def test_live_daily_and_snapshot_keep_the_same_distinct_competitors(self):
        from unittest.mock import patch
        rows = osm.parse_competitors([competitor('node', 1), competitor('node', 1),
                                     competitor('way', 1), competitor('node', 2, lng=39.48001)])
        bundle = city_data.make_bundle(city_rows(), {key: rows for key in BUSINESS_CATALOG}, time.time())
        daily = city_data.select_area(json.loads(json.dumps(bundle)), area_for('eleytsky'), 'cafe')[1]
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-') as folder, \
             patch.object(cache_service, 'CACHE_DIR', Path(folder)), \
             patch.object(cache_service, 'SNAPSHOT_DIR', Path(folder) / 'none'):
            live, _ = cache_service._cached('comp_test', lambda: rows, allow_empty=True)
            snapshot, info = cache_service._cached('comp_test', lambda: self.fail('Сеть не нужна'), allow_empty=True)
        self.assertEqual(live, daily)
        self.assertEqual(snapshot, daily)
        self.assertEqual(info.provenance['identified'], 3)
        self.assertNotIn('records', info.provenance)

    def test_corrupted_new_provenance_cannot_replace_last_valid_cache(self):
        from unittest.mock import patch
        rows = osm.parse_competitors([competitor('node', 1)])
        damaged = copy.deepcopy(rows)
        damaged.provenance['records'].clear()
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-') as folder, \
             patch.object(cache_service, 'CACHE_DIR', Path(folder)), \
             patch.object(cache_service, 'SNAPSHOT_DIR', Path(folder) / 'none'):
            cache_service._cached('comp_test', lambda: rows, allow_empty=True)
            before = (Path(folder) / 'comp_test.json').read_bytes()
            restored, info = cache_service._cached('comp_test', lambda: damaged, refresh=True, allow_empty=True)
            self.assertEqual((Path(folder) / 'comp_test.json').read_bytes(), before)
        self.assertTrue(info.warning)
        self.assertEqual(restored, rows)

    def test_new_feed_reports_actual_row_dates_with_compact_summary(self):
        from unittest.mock import patch
        from src.services import city_feed_service as feed
        rows = osm.parse_competitors([competitor('node', 1)], fetched_at=100)
        bundle = city_data.make_bundle(city_rows(), {key: rows for key in BUSINESS_CATALOG}, 200)
        with patch.object(feed, '_get_bundle', return_value=(bundle, 'current', True, None)):
            loaded = feed.load(area_for('eleytsky'), 'cafe')
        self.assertEqual(loaded.metadata['houses']['fetched_at'], 200)
        self.assertEqual(loaded.metadata['competitors']['fetched_at'], 100)
        self.assertNotIn('records', loaded.metadata['competitors']['provenance'])

    def test_partial_or_corrupt_metadata_is_rejected_even_with_recomputed_digest(self):
        rows = osm.parse_competitors([competitor('node', 1)])
        bundle = city_data.make_bundle(city_rows(), {key: rows for key in BUSINESS_CATALOG}, time.time())
        for mutate in [lambda p: p['competitors']['cafe']['records'].clear(),
                       lambda p: p['competitors']['cafe']['records'][0].__setitem__('osm_id', True),
                       lambda p: p.__setitem__('schema', 99)]:
            changed = copy.deepcopy(bundle)
            mutate(changed['provenance'])
            changed['version'] = city_data.digest(changed)
            with self.assertRaises(ValueError):
                city_data.validate_bundle(changed)

    def test_boolean_rows_are_not_population_numbers(self):
        with self.assertRaises(ValueError):
            cache_service._validate_rows([[52.59, 39.48, True]], 3, False)

    def test_unrepresentable_cache_date_does_not_hide_valid_snapshot(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-') as folder:
            root = Path(folder)
            snapshot = root / 'snapshots'
            snapshot.mkdir()
            filename = 'houses_test.json'
            (root / filename).write_text(json.dumps({'fetched_at': 10**500, 'data': [[52.59, 39.48, 10]]}), encoding='utf-8')
            (snapshot / filename).write_text(json.dumps({'fetched_at': 100, 'data': [[52.59, 39.48, 20]]}), encoding='utf-8')
            with patch.object(cache_service, 'CACHE_DIR', root), patch.object(cache_service, 'SNAPSHOT_DIR', snapshot):
                rows, info = cache_service._cached('houses_test', lambda: self.fail('Есть пригодный снимок'))
            self.assertEqual(rows, [[52.59, 39.48, 20]])
            self.assertTrue(info.cached)


if __name__ == '__main__':
    unittest.main()
