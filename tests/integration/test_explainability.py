"""API enrichment is additive; old scoring and input provenance stay intact."""
import json
import unittest
from datetime import datetime
from unittest.mock import patch

import numpy as np

import app
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.models import CacheInfo
from src.domain.scoring import score_locations
from src.services import analysis_service, osm_service as osm


class ExplainabilityApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    def test_demo_context_separates_requested_radius_and_loaded_area(self):
        with patch.object(osm, 'get_houses', side_effect=RuntimeError('offline')):
            data = self.client.get('/api/calculate?type=cafe').get_json()
        self.assertEqual(data['analysis_context'], {
            'custom': False, 'requested_radius_m': 1000, 'center': data['center']})
        self.assertEqual(data['half_m'], 600)
        self.assertEqual(data['data_quality']['source'], 'demo')
        self.assertEqual(data['data_quality']['freshness']['status'], 'demo')
        self.assertEqual(data['data_quality']['completeness']['status'], 'limited')
        self.assertEqual(data['data_quality']['assessed_at'], data['calculated_at'])
        self.assertIsNotNone(datetime.fromisoformat(data['calculated_at'].replace('Z', '+00:00')).tzinfo)
        self.assertEqual(data['best'], data['recommendations'][0])
        for recommendation in data['recommendations']:
            self.assertEqual(recommendation['explanation']['version'], 1)
        json.dumps(data, allow_nan=False)

    def test_custom_analysis_keeps_all_scoring_numbers_and_mixed_provenance(self):
        center = (52.5935, 39.48)
        houses = np.array(analysis_service.DEMO_HOUSES['eleytsky'], dtype=float)
        competitors = np.array(analysis_service.DEMO_COMPETITORS['cafe']['eleytsky'], dtype=float)
        expected = score_locations(houses, competitors, center, 1200, BUSINESS_CATALOG['cafe'])
        with patch.object(osm, 'get_houses', return_value=(houses, CacheInfo(True, 1792231200))), \
             patch.object(osm, 'get_competitors', return_value=(competitors, CacheInfo(False, 1792317600))):
            data = self.client.get('/api/calculate', query_string={
                'district': 'custom', 'lat': center[0], 'lng': center[1], 'radius': 1200, 'type': 'cafe'}).get_json()
        self.assertEqual(data['analysis_context'], {
            'custom': True, 'requested_radius_m': 1200, 'center': list(center)})
        self.assertEqual(data['source'], 'osm')
        self.assertEqual(data['data_meta']['houses']['fetched_at'], 1792231200)
        self.assertEqual(data['data_meta']['competitors']['fetched_at'], 1792317600)
        self.assertEqual(data['grid'], expected.grid)
        self.assertEqual(data['centroids'], expected.centroids)
        self.assertEqual([{k: v for k, v in rec.items() if k != 'explanation'}
                          for rec in data['recommendations']], expected.recommendations)
        json.dumps(data, allow_nan=False)

