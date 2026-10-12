import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

import app
import osm


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    def test_nonfinite_radius_is_bad_request(self):
        for value in ('nan', 'inf', '-inf'):
            with self.subTest(value=value):
                response = self.client.get('/api/calculate', query_string={
                    'district': 'custom', 'lat': 52.61, 'lng': 39.58, 'radius': value})
                self.assertEqual(response.status_code, 400)

    def test_best_and_scores_stay_inside_analysis_circle(self):
        lat, lng = osm.DISTRICTS['eleytsky']['center']
        def coords(x, y):
            return [lat + y / 111000, lng + x / (111000 * np.cos(np.radians(lat)))]
        houses = np.array([coords(650 + i, 650 + i) + [400] for i in range(5)])
        competitors = np.array([coords(x, x) for x in (400, 500, 600)])
        with patch.object(osm, 'get_houses', return_value=(houses, True)), \
             patch.object(osm, 'get_competitors', return_value=(competitors, True)):
            data = self.client.get('/api/calculate?type=pharmacy').get_json()
        best = app.to_meters([[data['best']['lat'], data['best']['lng']]], lat, lng)
        self.assertLessEqual(np.linalg.norm(best), data['half_m'] + 1e-6)
        axis = np.linspace(-data['half_m'], data['half_m'], data['grid']['n'])
        x, y = np.meshgrid(axis, axis)
        outside = (x*x + y*y).ravel() > data['half_m']**2
        self.assertTrue(np.all(np.array(data['grid']['scores'])[outside] == 0))

    def test_server_errors_do_not_expose_internal_details(self):
        with patch.object(app, 'run_calculation', side_effect=RuntimeError('private server details')), \
             self.assertLogs(app.app.logger, level='ERROR'):
            response = self.client.get('/api/calculate')
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('private server details', response.get_json()['message'])

    def test_university_center_matches_osm_neighbourhood(self):
        # OSM relation 17717422, checked 2026-10-11.
        lat, lng = osm.DISTRICTS['universitetsky']['center']
        self.assertTrue(52.6021103 <= lat <= 52.6099012)
        self.assertTrue(39.4972877 <= lng <= 39.5123113)

    def test_all_presets_work_on_clean_deployment_without_overpass(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-') as folder, \
             patch.object(osm, 'CACHE_DIR', Path(folder)), \
             patch.object(osm, '_overpass', side_effect=AssertionError('No network expected')):
            for district in osm.DISTRICTS:
                for business in app.BUSINESS_PARAMS:
                    with self.subTest(district=district, business=business):
                        response = self.client.get('/api/calculate', query_string={'district':district, 'type':business})
                        self.assertEqual(response.status_code, 200)
                        data = response.get_json()
                        self.assertEqual(data['source'], 'cache')
                        self.assertGreaterEqual(data['stats']['houses'], 5)
                        self.assertIn('fetched_at', data['data_meta']['houses'])
                        self.assertTrue(np.isfinite(data['grid']['scores']).all())
                        self.assertEqual(max(data['grid']['scores']), 1)

    def test_health_and_local_map_assets(self):
        self.assertEqual(self.client.get('/healthz').get_json(), {'status':'ok'})
        for path in ('/', '/static/vendor/leaflet/leaflet.js', '/static/vendor/leaflet/leaflet.css'):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)

    def test_unknown_filters_are_rejected(self):
        for query in ('district=unknown', 'type=unknown', 'district=custom&lat=52.61&lng=39.58&radius=9999'):
            self.assertEqual(self.client.get('/api/calculate?' + query).status_code, 400)

    def test_busy_server_rejects_quickly_and_recovers(self):
        app.calculation_slots.acquire()
        app.calculation_slots.acquire()
        try:
            response = self.client.get('/api/calculate')
            self.assertEqual(response.status_code, 503)
            self.assertIn('Retry-After', response.headers)
            self.assertEqual(self.client.get('/healthz').status_code, 200)
        finally:
            app.calculation_slots.release()
            app.calculation_slots.release()
        self.assertEqual(self.client.get('/api/calculate?type=unknown').status_code, 400)


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.patcher = patch.object(osm, 'CACHE_DIR', self.root)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_corrupt_cache_is_replaced_from_network(self):
        (self.root / 'houses_test.json').write_text('{broken', encoding='utf-8')
        rows = [[52.61, 39.58, 100]]
        self.assertEqual(osm._cached('houses_test', lambda: rows)[0], rows)

    def test_write_failure_does_not_discard_fetched_data(self):
        rows = [[52.61, 39.58, 100]]
        with patch.object(Path, 'mkdir', side_effect=PermissionError('read-only')), \
             self.assertLogs(osm.logger, level='WARNING'):
            self.assertEqual(osm._cached('houses_test', lambda: rows)[0], rows)

    def test_failed_refresh_keeps_previous_data(self):
        rows = [[52.61, 39.58, 100]]
        (self.root / 'houses_test.json').write_text(json.dumps(rows), encoding='utf-8')
        def offline():
            raise RuntimeError('offline')
        result, cached = osm._cached('houses_test', offline, refresh=True)
        self.assertEqual(result, rows)
        self.assertTrue(cached)
        self.assertIn('Обновление', cached.warning)

    def test_changing_area_geometry_does_not_reuse_old_cache(self):
        area = osm.area_for('universitetsky')
        with patch.object(osm, '_load_houses', return_value=[[52.605 + i/1000, 39.505, 100] for i in range(5)]) as loader:
            osm.get_houses(area, refresh=True)
            moved = {**area, 'center': (52.615, 39.515)}
            osm.get_houses(moved)
        self.assertEqual(loader.call_count, 2)

    def test_partial_refresh_preserves_usable_houses(self):
        area = osm.area_for('eleytsky')
        rows = [[52.593 + i/1000, 39.480, 100] for i in range(5)]
        name = f'houses_{osm.cache_key(area)}'
        (self.root / f'{name}.json').write_text(json.dumps(rows), encoding='utf-8')
        with patch.object(osm, '_load_houses', return_value=rows[:2]):
            data, info = osm.get_houses(area, refresh=True)
        self.assertEqual(len(data), 5)
        self.assertTrue(info.warning)

    def test_busy_cache_returns_saved_copy_without_waiting(self):
        name = 'houses_test'
        rows = [[52.61, 39.58, 100]]
        (self.root / f'{name}.json').write_text(json.dumps(rows), encoding='utf-8')
        # A real lock would deadlock the old implementation: use an instrumented one.
        from unittest.mock import MagicMock, Mock
        busy = MagicMock()
        busy.acquire.return_value = False
        locks = [busy] * 32
        loader = Mock(return_value=[[52.60, 39.56, 80]])
        with patch.object(osm, '_CACHE_LOCKS', locks):
            data, info = osm._cached(name, loader, True)
        self.assertEqual(data, rows)
        loader.assert_not_called()

    def test_concurrent_refresh_reuses_previous_data(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Event
        name = 'houses_test'
        rows = [[52.61, 39.58, 100]]
        (self.root / f'{name}.json').write_text(json.dumps(rows), encoding='utf-8')
        started, release = Event(), Event()
        calls = []
        def loader():
            calls.append(1)
            started.set()
            if not release.wait(3):
                raise RuntimeError('test timeout')
            return [[52.61, 39.58, 150]]
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(osm._cached, name, loader, True)
            try:
                self.assertTrue(started.wait(1))
                second = pool.submit(osm._cached, name, loader, True)
                result, info = second.result(timeout=1)
                self.assertEqual(result, rows)
                self.assertTrue(info.warning)
            finally:
                release.set()
            self.assertEqual(first.result()[0][0][2], 150)
        self.assertEqual(len(calls), 1)

    def test_invalid_cached_values_trigger_recovery(self):
        path = self.root / 'houses_test.json'
        for invalid in ([[52,39,float('nan')]], [[52,39,-5]], [[52,39]], {'data':[], 'fetched_at':0}):
            with self.subTest(invalid=invalid):
                path.write_text(json.dumps(invalid), encoding='utf-8')
                rows = [[52.61,39.58,100]]
                self.assertEqual(osm._cached('houses_test', lambda: rows)[0], rows)


if __name__ == '__main__':
    unittest.main()
