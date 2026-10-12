import math
import unittest
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


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()
        self.houses = np.array(analysis_service.DEMO_HOUSES['eleytsky'], dtype=float)
        self.competitors = np.array(analysis_service.DEMO_COMPETITORS['cafe']['eleytsky'], dtype=float)

    def calculate(self, business='cafe', houses=None, competitors=None, **query):
        houses = self.houses if houses is None else houses
        competitors = self.competitors if competitors is None else competitors
        with patch.object(osm, 'get_houses', return_value=(houses, True)), \
             patch.object(osm, 'get_competitors', return_value=(competitors, True)):
            return self.client.get('/api/calculate', query_string={'type': business, **query})

    def test_catalog_exposes_five_businesses_and_three_preset_districts(self):
        response = self.client.get('/api/catalog')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'success')
        businesses = {item['key']: item for item in data['businesses']}
        expected = {'cafe': (350, 1.5), 'pharmacy': (500, 3), 'grocery': (400, 2),
                    'bakery': (350, 1.8), 'beauty': (450, 1.6)}
        self.assertEqual(set(businesses), set(expected))
        for key, (radius, alpha) in expected.items():
            self.assertEqual(businesses[key]['radius_m'], radius)
            self.assertEqual(businesses[key]['alpha'], alpha)
            self.assertTrue(businesses[key]['name'])
        self.assertEqual({item['key'] for item in data['districts']}, set(osm.DISTRICTS))
        for item in data['districts']:
            self.assertEqual(item['center'], list(osm.DISTRICTS[item['key']]['center']))
            self.assertEqual(item['radius_m'], osm.DISTRICTS[item['key']]['radius'])

    def test_all_five_categories_calculate_with_catalog_parameters(self):
        for key, radius in [('cafe', 350), ('pharmacy', 500), ('grocery', 400),
                            ('bakery', 350), ('beauty', 450)]:
            with self.subTest(business=key):
                response = self.calculate(key)
                self.assertEqual(response.status_code, 200)
                data = response.get_json()
                self.assertEqual(data['business'], key)
                self.assertTrue(data['business_name'])
                self.assertEqual(data['parameters']['radius_m'], radius)
                self.assertEqual(data['best']['radius_m'], radius)

    def test_recommendations_are_ranked_separated_inside_circle_and_match_best(self):
        data = self.calculate().get_json()
        recommendations = data['recommendations']
        self.assertEqual(len(recommendations), 3)
        self.assertEqual(data['best'], recommendations[0])
        self.assertEqual([item['rank'] for item in recommendations], [1, 2, 3])
        self.assertEqual(recommendations[0]['score'], 1)
        self.assertEqual(sorted([item['score'] for item in recommendations], reverse=True),
                         [item['score'] for item in recommendations])
        xy = to_meters([[item['lat'], item['lng']] for item in recommendations], *data['center'])
        self.assertTrue(np.all(np.linalg.norm(xy, axis=1) <= data['half_m'] + 1e-6))
        for idx, item in enumerate(recommendations):
            self.assertTrue(0 <= item['score'] <= 1)
            house_xy = to_meters(self.houses[:, :2], *data['center'])
            competitor_xy = to_meters(self.competitors, *data['center'])
            self.assertEqual(item['residents_in_radius'],
                             int(self.houses[np.linalg.norm(house_xy - xy[idx], axis=1) <= 350, 2].sum()))
            distances = np.linalg.norm(competitor_xy - xy[idx], axis=1)
            self.assertEqual(item['competitors_in_radius'], int((distances <= 350).sum()))
            self.assertEqual(item['nearest_competitor_m'], round(float(distances.min())))
            for other in xy[:idx]:
                self.assertGreaterEqual(np.linalg.norm(xy[idx] - other), 250 - 1e-6)

    def test_original_best_coordinate_is_preserved(self):
        data = self.calculate().get_json()
        self.assertAlmostEqual(data['best']['lat'], 52.59517964574744)
        self.assertAlmostEqual(data['best']['lng'], 39.4762295401344)
        self.assertEqual(data['best']['residents_in_radius'], 1390)
        self.assertEqual(data['best']['nearest_competitor_m'], 324)

    def test_analysis_id_identifies_each_response(self):
        first, second = self.calculate().get_json(), self.calculate().get_json()
        self.assertIsInstance(first['analysis_id'], str)
        self.assertTrue(first['analysis_id'])
        self.assertNotEqual(first['analysis_id'], second['analysis_id'])

    def test_successful_empty_competitors_are_not_data_failure(self):
        data = self.calculate('grocery', competitors=np.empty((0, 2))).get_json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['source'], 'cache')
        self.assertEqual(data['stats']['competitors'], 0)
        for item in data['recommendations']:
            self.assertEqual(item['competitors_in_radius'], 0)
            self.assertIsNone(item['nearest_competitor_m'])

    def test_new_business_network_failure_has_clear_safe_error(self):
        for business in ('grocery', 'bakery', 'beauty'):
            with self.subTest(business=business), \
                 patch.object(osm, 'get_houses', return_value=(self.houses, True)), \
                 patch.object(osm, 'get_competitors', side_effect=RuntimeError('private network details')):
                response = self.client.get('/api/calculate', query_string={'type': business})
            self.assertEqual(response.status_code, 400)
            data = response.get_json()
            self.assertEqual(data['status'], 'error')
            self.assertIn('конкурент', data['message'].lower())
            self.assertNotIn('private network details', data['message'])

    def test_original_categories_keep_demo_fallback(self):
        for business in ('cafe', 'pharmacy'):
            with self.subTest(business=business), \
                 patch.object(osm, 'get_houses', side_effect=RuntimeError('offline')):
                response = self.client.get('/api/calculate', query_string={'type': business})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()['source'], 'demo')

    def test_fewer_than_three_candidates_returns_actual_count(self):
        area = {**osm.area_for('eleytsky'), 'radius': 100}
        lat, lng = area['center']
        houses = np.array([[lat + i / 1000000, lng, 100] for i in range(5)])
        with patch.object(calculate_routes, 'resolve_area', return_value=area), patch.object(scoring, 'GRID_SIZE', 3):
            data = self.calculate(houses=houses, competitors=np.empty((0, 2))).get_json()
        self.assertEqual(len(data['recommendations']), 1)
        self.assertEqual(data['best'], data['recommendations'][0])

    def test_equal_scores_have_deterministic_first_and_order(self):
        area = {**osm.area_for('eleytsky'), 'radius': 1500}
        lat, lng = area['center']
        houses = np.array([[lat, lng, 100]] * 5)
        with patch.object(scoring, 'GRID_SIZE', 4), patch.object(scoring, 'N_CLUSTERS', 1), \
             patch.object(calculate_routes, 'resolve_area', return_value=area):
            first = self.calculate(houses=houses, competitors=np.empty((0, 2))).get_json()
            second = self.calculate(houses=houses, competitors=np.empty((0, 2))).get_json()
        self.assertEqual(first['recommendations'], second['recommendations'])
        self.assertLess(first['best']['lat'], lat)
        self.assertLess(first['best']['lng'], lng)

    def test_malformed_or_nonfinite_competitors_cannot_become_empty_success(self):
        for competitors in (np.array([[52, 39, 10], [52, 39, 20]]),
                            np.array([[math.nan, 39]]), np.array([[52, math.inf]])):
            with self.subTest(competitors=competitors):
                response = self.calculate('grocery', competitors=competitors)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()['status'], 'error')

    def test_zero_or_nonfinite_data_does_not_produce_successful_recommendations(self):
        for population in (0, math.nan, math.inf):
            houses = self.houses.copy()
            houses[:, 2] = population
            with self.subTest(population=population):
                response = self.calculate('grocery', houses=houses)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()['status'], 'error')

    def test_all_zero_demand_cannot_recommend_arbitrary_grid_corner(self):
        lat, lng = osm.DISTRICTS['eleytsky']['center']
        houses = np.array([[lat + 1 + i / 10000, lng, 100] for i in range(5)])
        response = self.calculate('grocery', houses=houses, competitors=np.empty((0, 2)))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()['status'], 'error')


if __name__ == '__main__':
    unittest.main()
