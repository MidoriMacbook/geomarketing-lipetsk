"""Explanation facts must reproduce model kernels without changing recommendations."""
import json
import math
import unittest

import numpy as np

from src.domain.explanations import explain_recommendations
from src.utils.geo import to_latlng


class ExplanationTests(unittest.TestCase):
    center = (52.5935, 39.48)

    def point(self, x, y=0):
        lat, lng = to_latlng(np.array([x, y]), *self.center)
        return {'lat': lat, 'lng': lng}

    def explain(self, houses=None, competitors=None, points=None, radius=100, alpha=1,
                half=1000, centroids=None):
        if houses is None:
            houses = np.array([[*to_latlng(np.array([0, 0]), *self.center), 200]])
        if competitors is None:
            competitors = np.empty((0, 2))
        return explain_recommendations(houses, competitors, self.center, half,
                                       {'R': radius, 'alpha': alpha},
                                       points or [self.point(0)], centroids or [])

    def test_exact_kernels_density_and_nearest_weighted_center(self):
        houses = np.array([[*to_latlng(np.array([x, 0]), *self.center), pop]
                           for x, pop in [(0, 200), (50, 100), (200, 400)]])
        rivals = np.array([to_latlng(np.array([80, 0]), *self.center)])
        result = self.explain(houses, rivals, centroids=[self.point(30), self.point(200)])[0]
        metrics = result['metrics']
        self.assertAlmostEqual(metrics['model_demand'], 200 + 100*math.exp(-0.25) + 400*math.exp(-4))
        self.assertAlmostEqual(metrics['competition_pressure'], math.exp(-1))
        self.assertAlmostEqual(metrics['competition_multiplier'], 1 + math.exp(-1))
        self.assertEqual(metrics['houses_in_radius'], 2)
        self.assertAlmostEqual(metrics['houses_per_km2'], 2/(math.pi*0.1**2))
        self.assertEqual(metrics['nearest_demand_center_m'], 30)
        self.assertTrue(result['strengths'])
        self.assertTrue(result['risks'])
        self.assertTrue(result['field_checks'])
        json.dumps(result, allow_nan=False)

    def test_competition_thresholds_and_category_alpha(self):
        competitors = np.array([self.center])
        for alpha, expected in [(0, 'low'), (1, 'low'), (1.001, 'moderate'),
                                (3, 'moderate'), (3.001, 'high')]:
            with self.subTest(alpha=alpha):
                result = self.explain(competitors=competitors, alpha=alpha)[0]
                self.assertEqual(result['competition_level'], expected)
                self.assertEqual(result['metrics']['competition_multiplier'], 1 + alpha)

    def test_demand_relative_only_to_current_recommendations(self):
        points = [self.point(0), self.point(100), self.point(200)]
        results = self.explain(points=points)
        self.assertEqual([item['demand_level'] for item in results], ['higher', 'lower', 'lower'])
        self.assertEqual(self.explain(points=[self.point(0), self.point(0)])[0]['demand_level'], 'similar')
        zero = np.array([[*self.center, 0]])
        self.assertEqual(self.explain(houses=zero)[0]['demand_level'], 'unknown')

    def test_no_rivals_no_centers_and_zero_demand_are_finite(self):
        result = self.explain(houses=np.empty((0, 3)))[0]
        self.assertIsNone(result['metrics']['nearest_demand_center_m'])
        self.assertEqual(result['metrics']['model_demand'], 0)
        self.assertEqual(result['metrics']['competition_pressure'], 0)
        self.assertEqual(result['metrics']['competition_multiplier'], 1)
        self.assertTrue(any('не отмечены' in text for text in result['risks']))
        json.dumps(result, allow_nan=False)

    def test_circle_crossing_loaded_boundary_gets_explicit_risk(self):
        results = self.explain(points=[self.point(0), self.point(950)], radius=100)
        self.assertFalse(any('границ' in text for text in results[0]['risks']))
        self.assertTrue(any('границ' in text for text in results[1]['risks']))

    def test_inputs_and_old_fields_are_unchanged(self):
        points = [{**self.point(0), 'rank': 1, 'score': 0.9}]
        before = json.dumps(points)
        self.explain(points=points)
        self.assertEqual(json.dumps(points), before)

