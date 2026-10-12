"""Characterization of the public JSON contract before backend modularization."""
import unittest
from unittest.mock import patch

import app
from src.services import osm_service as osm
from src.services import cache_service


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    def test_catalog_exact_payload_keys(self):
        response = self.client.get('/api/catalog')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(set(data), {'status', 'businesses', 'districts'})
        for item in data['businesses']:
            self.assertEqual(set(item), {'key', 'name', 'radius_m', 'alpha'})
        for item in data['districts']:
            self.assertEqual(set(item), {'key', 'name', 'center', 'radius_m'})

    def test_calculate_exact_payload_keys_and_demo_best(self):
        with patch.object(osm, 'get_houses', side_effect=RuntimeError('offline')):
            response = self.client.get('/api/calculate?district=eleytsky&type=cafe')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(set(data), {
            'status', 'district', 'district_name', 'business', 'business_name',
            'analysis_id', 'parameters', 'recommendations', 'source', 'data_meta',
            'warning', 'notice', 'center', 'half_m', 'stats', 'best', 'grid',
            'centroids', 'houses', 'competitors',
        })
        self.assertEqual(set(data['parameters']), {'radius_m', 'alpha'})
        self.assertEqual(set(data['stats']), {'houses', 'residents', 'competitors'})
        self.assertEqual(set(data['grid']), {'n', 'lat_min', 'lat_max', 'lng_min', 'lng_max', 'scores'})
        recommendation_keys = {'rank', 'lat', 'lng', 'score', 'residents_in_radius',
                               'radius_m', 'competitors_in_radius', 'nearest_competitor_m'}
        for item in data['recommendations'] + [data['best']]:
            self.assertEqual(set(item), recommendation_keys)
        for item in data['centroids'] + data['houses']:
            self.assertEqual(set(item), {'lat', 'lng', 'residents'})
        for item in data['competitors']:
            self.assertEqual(set(item), {'lat', 'lng'})
        self.assertEqual(data['source'], 'demo')
        self.assertEqual(data['half_m'], 600)
        self.assertEqual(data['grid']['n'], 60)
        self.assertEqual(len(data['grid']['scores']), 3600)
        self.assertEqual(data['best'], data['recommendations'][0])
        self.assertAlmostEqual(data['best']['lat'], 52.59524072377462, places=12)
        self.assertAlmostEqual(data['best']['lng'], 39.47653117692364, places=12)
        self.assertEqual(data['best']['residents_in_radius'], 1390)
        self.assertEqual(data['best']['nearest_competitor_m'], 318)


if __name__ == '__main__':
    unittest.main()
