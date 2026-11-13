"""Выбор независимых максимумов через публичный интерфейс расчёта."""
import hashlib
import json
from pathlib import Path
import unittest

import numpy as np
from threadpoolctl import threadpool_limits

from src.domain.businesses import BUSINESS_CATALOG
from src.domain.scoring import score_locations
from src.utils.geo import to_latlng

FIXTURE = json.loads(Path('tests/fixtures/scoring-clusters.json').read_text(encoding='utf-8'))


class ClusterRecommendationsTests(unittest.TestCase):
    def test_eleytsky_does_not_offer_same_residents_twice(self):
        case = next(c for c in FIXTURE['cases'] if c['key'] == 'eleytsky')
        with threadpool_limits(limits=1):
            result = score_locations(np.array(case['houses']), np.array(case['competitors']),
                                     case['center'], case['radius'], BUSINESS_CATALOG['cafe'])
        self.assertEqual(len(result.recommendations), 2)
        self.assertEqual(result.recommendations[1]['comparison_to_best']['shared_houses'], 0)
        self.assertEqual(result.recommendations[1]['comparison_to_best']['shared_residents_fraction'], 0)
        self.assertGreater(result.recommendations[1]['comparison_to_best']['distance_m'], 1200)

    def test_real_areas_keep_original_score_surface_and_are_reproducible(self):
        expected = {
            'center': (1, '62f98f5bd0d217674461a44da9101b94cbf832addcb616378da872f2880c6a21'),
            'eleytsky': (2, '5d9fa14a9399d3804796acb1b35ba475fec59f4be0074d25da5c029209f23c55'),
            'small': (1, 'cbc8a68ae248f3501779b6f369ce14e79a88d759a5d5bb4c6cacf98221156110'),
        }
        with threadpool_limits(limits=1):
            for case in FIXTURE['cases']:
                with self.subTest(area=case['key']):
                    args = (np.array(case['houses']), np.array(case['competitors']), case['center'],
                            case['radius'], BUSINESS_CATALOG['cafe'])
                    result = score_locations(*args)
                    self.assertEqual(result, score_locations(*args))
                    count, digest = expected[case['key']]
                    self.assertEqual(len(result.recommendations), count)
                    self.assertEqual(len({r['cluster_id'] for r in result.recommendations}), count)
                    self.assertEqual(result.recommendations[0]['score'], 1)
                    self.assertEqual(hashlib.sha256(json.dumps(result.grid, sort_keys=True).encode()).hexdigest(), digest)

    def test_overlap_counts_houses_and_population_not_circle_area(self):
        # Единственный общий дом — 10 жителей, собственные дома — по 1000.
        houses = np.array([(*to_latlng(np.array([x, 0]), 52.6, 39.5), pop)
                           for x, pop in [(-700, 1000), (0, 1000), (600, 1000), (300, 10)]])
        with threadpool_limits(limits=1):
            result = score_locations(houses, np.empty((0, 2)), (52.6, 39.5), 1200,
                                     BUSINESS_CATALOG['cafe'])
        self.assertEqual(len(result.recommendations), 3)
        comparison = result.recommendations[1]['comparison_to_best']
        self.assertEqual(comparison['shared_houses'], 1)
        self.assertEqual(comparison['shared_residents'], 10)
        self.assertAlmostEqual(comparison['shared_residents_fraction'], 10 / 1010)
        self.assertEqual(result.recommendations[2]['comparison_to_best']['shared_houses'], 0)

    def test_coincident_house_coordinates_do_not_create_duplicate_zones(self):
        houses = np.array([[52.6, 39.5, 100], [52.6, 39.5, 200]])
        with threadpool_limits(limits=1):
            result = score_locations(houses, np.empty((0, 2)), (52.6, 39.5), 500,
                                     BUSINESS_CATALOG['cafe'])
        self.assertEqual(len(result.recommendations), 1)
        self.assertEqual(result.recommendations[0]['residents_in_radius'], 300)
