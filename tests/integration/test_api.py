import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

import app
from src.routes import calculate as calculate_routes
from src.domain import scoring
from src.services import analysis_service
from src.domain.businesses import BUSINESS_CATALOG
from src.utils.geo import to_meters
from src.services import osm_service as osm
from src.services import cache_service


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
        best = to_meters([[data['best']['lat'], data['best']['lng']]], lat, lng)
        self.assertLessEqual(np.linalg.norm(best), data['half_m'] + 1e-6)
        axis = np.linspace(-data['half_m'], data['half_m'], data['grid']['n'])
        x, y = np.meshgrid(axis, axis)
        outside = (x*x + y*y).ravel() > data['half_m']**2
        self.assertTrue(np.all(np.array(data['grid']['scores'])[outside] == 0))

    def test_server_errors_do_not_expose_internal_details(self):
        with patch.object(calculate_routes, 'run_calculation', side_effect=RuntimeError('private server details')), \
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
             patch.object(cache_service, 'CACHE_DIR', Path(folder)), \
             patch.object(osm, '_overpass', side_effect=AssertionError('No network expected')):
            for district in osm.DISTRICTS:
                for business in BUSINESS_CATALOG:
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
        calculate_routes.calculation_slots.acquire()
        calculate_routes.calculation_slots.acquire()
        try:
            response = self.client.get('/api/calculate')
            self.assertEqual(response.status_code, 503)
            self.assertIn('Retry-After', response.headers)
            self.assertEqual(response.headers['Retry-After'], '30')
            self.assertEqual(response.get_json(), {
                'status': 'error',
                'message': 'Сервис занят расчётами. Повторите через минуту.',
            })
            self.assertEqual(self.client.get('/healthz').status_code, 200)
        finally:
            calculate_routes.calculation_slots.release()
            calculate_routes.calculation_slots.release()
        self.assertEqual(self.client.get('/api/calculate?type=unknown').status_code, 400)


if __name__ == '__main__':
    unittest.main()
