"""Pure scoring checks: no Flask application, cache writes, or network access."""
import unittest
from unittest.mock import patch

import numpy as np

from src.domain.businesses import BUSINESS_CATALOG
from src.domain import scoring
from src.utils.validation import UserError


class ScoringTests(unittest.TestCase):
    def setUp(self):
        self.center = (52.5935, 39.48)
        self.houses = np.array([
            [52.5934, 39.4795, 420], [52.5925, 39.4812, 380],
            [52.5948, 39.4770, 510], [52.5912, 39.4835, 290],
            [52.5955, 39.4820, 350], [52.5941, 39.4800, 460],
        ])

    def test_original_grid_maximum_and_demand_weighted_clusters(self):
        result = scoring.score_locations(
            self.houses, np.array([[52.5928, 39.4790], [52.5950, 39.4815]]),
            self.center, 1000, BUSINESS_CATALOG['cafe'])
        best = result.recommendations[0]
        self.assertAlmostEqual(best['lat'], 52.59517964574744, places=12)
        self.assertAlmostEqual(best['lng'], 39.4762295401344, places=12)
        self.assertEqual(best['residents_in_radius'], 1390)
        self.assertEqual(best['nearest_competitor_m'], 324)
        self.assertEqual(result.grid['n'], 60)
        self.assertEqual(len(result.grid['scores']), 3600)
        self.assertEqual(sum(item['residents'] for item in result.centroids),
                         int(self.houses[:, 2].sum()))

    def test_empty_competitors_preserve_useful_recommendations(self):
        result = scoring.score_locations(self.houses, np.empty((0, 2)), self.center,
                                         1000, BUSINESS_CATALOG['grocery'])
        self.assertEqual(len(result.recommendations), 3)
        self.assertEqual(result.recommendations[0]['score'], 1)
        for item in result.recommendations:
            self.assertEqual(item['competitors_in_radius'], 0)
            self.assertIsNone(item['nearest_competitor_m'])

    def test_zero_demand_raises_user_error(self):
        houses = self.houses.copy()
        houses[:, 0] += 1
        with self.assertRaises(UserError):
            scoring.score_locations(houses, np.empty((0, 2)), self.center,
                                    1000, BUSINESS_CATALOG['grocery'])

    def test_small_area_can_return_one_recommendation(self):
        with patch.object(scoring, 'GRID_SIZE', 3):
            result = scoring.score_locations(self.houses, np.empty((0, 2)), self.center,
                                             100, BUSINESS_CATALOG['cafe'])
        self.assertEqual(len(result.recommendations), 1)
        self.assertEqual(result.recommendations[0]['rank'], 1)
