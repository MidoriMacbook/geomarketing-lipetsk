"""Допуски, совместимость ответа и эталонные результаты расчёта."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import numpy as np
from threadpoolctl import threadpool_limits

from app import app
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.models import LoadedData
from src.domain.scoring import score_locations
from src.services import analysis_service
from src.utils.geo import to_latlng


CENTER = (52.6122, 39.5843)


class AlternativeSelectionTests(unittest.TestCase):
    def select(self, points, houses, *, scores=None, useful=None, selected=(0,)):
        # The production grid and house counts are expressed in these same units.
        from src.domain.alternative_places import select_alternative_places

        grid = np.array(points, dtype=float)
        home_xy = np.array([row[:2] for row in houses], dtype=float).reshape(-1, 2)
        population = np.array([row[2] for row in houses], dtype=float)
        memberships = [np.linalg.norm(home_xy - grid[index], axis=1) <= 100 for index in selected]
        return select_alternative_places(
            grid, np.array(scores if scores is not None else [1] * len(grid)),
            np.array(useful if useful is not None else [True] * len(grid)),
            home_xy, population, 100, list(selected), memberships,
        )

    def test_distance_boundary_includes_80_m_and_rejects_just_shorter(self):
        result = self.select([(0, 0), (79.99999, 0), (80, 0)], [(-90, 0, 10), (170, 0, 10)])
        self.assertEqual([index for index, _, _ in result], [2])
        self.assertEqual(result[0][2], {'rank': 1, 'distance_m': 80.0, 'shared_residents_fraction': 0.0})

    def test_overlap_boundary_uses_population_of_smaller_reach(self):
        grid = [(0, 0), (80, 0)]
        houses = [(-90, 0, 1000), (40, 0, 6), (170, 0, 4)]
        result = self.select(grid, houses)
        self.assertEqual(result[0][2]['shared_residents_fraction'], 0.6)
        houses[-1] = (170, 0, 3.99999)
        self.assertEqual(self.select(grid, houses), [])

    def test_zero_population_coverage_has_an_unavailable_fraction(self):
        result = self.select([(0, 0), (200, 0)], [(0, 0, 10)])
        self.assertIsNone(result[0][2]['shared_residents_fraction'])

    def test_valid_against_main_can_still_overlap_a_previously_selected_alternative(self):
        result = self.select(
            [(0, 0), (250, 0), (350, 0), (500, 0)],
            [(0, 0, 80), (300, 0, 120), (500, 0, 90)],
            scores=[1, 0.9, 0.8, 0.7],
        )
        self.assertEqual([index for index, _, _ in result], [1, 3])
        self.assertEqual(result[1][2], {'rank': 2, 'distance_m': 250.0, 'shared_residents_fraction': 0.0})

    def test_against_every_main_even_when_the_first_main_passes(self):
        result = self.select(
            [(0, 0), (300, 0), (375, 0), (550, 0)],
            [(0, 0, 80), (300, 0, 120), (550, 0, 90)],
            scores=[1, 0.9, 0.8, 0.7], selected=(0, 1),
        )
        self.assertEqual([index for index, _, _ in result], [3])

    def test_ties_use_grid_order_and_total_places_are_capped_at_three(self):
        points = [(0, 0), (250, 0), (500, 0), (750, 0), (1000, 0)]
        houses = [(x, y, 50) for x, y in points]
        result = self.select(points, houses, scores=[1, 0.8, 0.9, 0.9, 0.9])
        self.assertEqual([index for index, _, _ in result], [2, 3])
        self.assertEqual(self.select(points, houses, selected=(0, 1, 2)), [])

    def test_exhausted_candidates_do_not_fill_any_slots(self):
        result = self.select([(0, 0), (79, 0), (200, 0)], [(0, 0, 80)], useful=[True, True, False])
        self.assertEqual(result, [])


class AlternativesCompatibilityTests(unittest.TestCase):
    def _api(self, houses, *, with_correction=False):
        loaded = LoadedData(houses, np.empty((0, 2)), 'osm', None)
        base = '/api/calculate?district=center&type=cafe'
        client = app.test_client()
        with threadpool_limits(limits=1), patch.object(analysis_service, 'load_data', return_value=loaded):
            plain = client.get(base)
            included = client.get(base + '&include_alternatives=1')
            params = {'district': 'center', 'type': 'cafe'}
            plain_post = client.post('/api/calculate', json=params)
            included_post = client.post('/api/calculate', json={**params, 'include_alternatives': 1})
            responses = [plain, included, plain_post, included_post]
            if with_correction:
                params['corrections'] = {'added': [{'id': 'osm-check', 'lat': CENTER[0], 'lng': CENTER[1]}]}
                responses.extend([
                    client.post('/api/calculate', json=params),
                    client.post('/api/calculate', json={**params, 'include_alternatives': 1}),
                ])
        stable = []
        for response in responses:
            self.assertEqual(response.status_code, 200, response.get_json().get('message'))
            payload = response.get_json()
            del payload['analysis_id'], payload['calculated_at'], payload['data_quality']['assessed_at']
            stable.append(payload)
        return stable

    @staticmethod
    def _houses(points):
        return np.array([(*to_latlng((x, y), *CENTER), residents)
                         for (x, y, residents) in points])

    def test_get_post_default_and_opt_in_use_same_main_rows(self):
        houses = self._houses([(0, 0, 1000)])
        plain, included, plain_post, included_post, corrected, corrected_included = self._api(
            houses, with_correction=True)
        self.assertEqual(plain, plain_post)
        self.assertEqual(included, included_post)
        for ordinary, opt_in in ((plain, included), (corrected, corrected_included)):
            old_rows = ordinary['recommendations']
            new_rows = opt_in['recommendations']
            self.assertEqual(len(old_rows), 1)
            self.assertEqual(len(new_rows), 3)
            self.assertEqual(old_rows, new_rows[:1])
            self.assertEqual(ordinary, {**opt_in, 'recommendations': new_rows[:1]})
            self.assertEqual([row['role'] for row in new_rows[1:]], ['alternative', 'alternative'])
            self.assertEqual([row['rank'] for row in new_rows], [1, 2, 3])
            self.assertTrue(all(row['alternative_comparison']['distance_m'] >= 280 for row in new_rows[1:]))
            reference = new_rows[0]['explanation']['metrics']['model_demand']
            for row in new_rows[1:]:
                explanation = row['explanation']
                demand = explanation['metrics']['model_demand']
                self.assertLess(demand, reference * 0.9)
                self.assertEqual(explanation['demand_level'], 'lower')
        for row in corrected_included['recommendations'][1:]:
            grid = plain['grid']
            x = (row['lng'] - grid['lng_min']) * (grid['n'] - 1) / (grid['lng_max'] - grid['lng_min'])
            y = (row['lat'] - grid['lat_min']) * (grid['n'] - 1) / (grid['lat_max'] - grid['lat_min'])
            baseline = grid['scores'][round(y) * grid['n'] + round(x)]
            self.assertAlmostEqual(row['correction_delta']['baseline_score'], baseline, delta=0.0005)
            self.assertEqual(row['correction_delta']['score_delta'],
                             row['score'] - row['correction_delta']['baseline_score'])

    def test_opt_in_preserves_full_response_when_main_fills_all_places(self):
        houses = self._houses([(-700, 0, 900), (0, 0, 1000), (700, 0, 800)])
        plain, included, plain_post, included_post = self._api(houses)
        self.assertEqual(len(plain['recommendations']), 3)
        self.assertEqual(plain, included)
        self.assertEqual(plain, plain_post)
        self.assertEqual(plain, included_post)

    def test_reference_centers_keep_exact_primary_coordinates_order_and_scores(self):
        fixture = json.loads(Path('tests/fixtures/scoring-clusters.json').read_text(encoding='utf-8'))
        with threadpool_limits(limits=1):
            for case in fixture['cases']:
                if case['key'] not in ('center', 'eleytsky'):
                    continue
                with self.subTest(district=case['key']):
                    args = (np.array(case['houses']), np.array(case['competitors']), case['center'],
                            case['radius'], BUSINESS_CATALOG['cafe'])
                    plain = score_locations(*args)
                    included = score_locations(*args, include_alternatives=True)
                    self.assertEqual(plain.recommendations, included.recommendations)
                    self.assertEqual(plain.grid, included.grid)
                    self.assertEqual(plain.centroids, included.centroids)
                    np.testing.assert_array_equal(plain.scores, included.scores)
                    self.assertEqual(len(included.recommendations) + len(included.alternatives), 3)
