"""Инварианты модели и границы доказательств качества без сети и записи кэша."""
import copy
from datetime import datetime, timezone
import unittest
from unittest.mock import patch

import numpy as np

from src.domain.businesses import BUSINESS_CATALOG
from src.domain.data_quality import assess_data_quality
from src.domain.explanations import explain_recommendations
from src.domain.models import CacheInfo, LoadedData
from src.domain.scoring import score_locations
from src.services import analysis_service as analysis
from src.utils.formatting import cache_metadata
from src.utils.geo import to_meters
from src.utils.validation import UserError, area_for, validate_data


class ModelInvariantTests(unittest.TestCase):
    center = (52.5935, 39.48)
    now = datetime(2026, 10, 29, 12, tzinfo=timezone.utc)

    def setUp(self):
        self.houses = np.array([[52.5934, 39.4795, 420], [52.5925, 39.4812, 380],
                                [52.5948, 39.4770, 510], [52.5912, 39.4835, 290],
                                [52.5955, 39.4820, 350], [52.5941, 39.4800, 460]], dtype=float)
        self.competitors = np.array([[52.5928, 39.4790], [52.5950, 39.4815]])
        self.points = [{'lat': lat, 'lng': lng} for lat, lng in
                       [self.center, (52.5915, 39.477), (52.596, 39.484)]]

    def metrics(self, houses, competitors, business):
        return [item['metrics'] for item in explain_recommendations(
            houses, competitors, self.center, 1000, BUSINESS_CATALOG[business], self.points, [])]

    def quality(self, metadata, **changes):
        args = dict(source='cache', metadata=metadata, house_count=6, residents=3500,
                    competitor_count=2, now=self.now)
        args.update(changes)
        return assess_data_quality(**args)

    def test_repeatability_and_no_input_mutation(self):
        houses, competitors = self.houses.copy(), self.competitors.copy()
        parameters = copy.deepcopy(BUSINESS_CATALOG['cafe'])
        before = copy.deepcopy(parameters)
        first = score_locations(houses, competitors, self.center, 1000, parameters)
        second = score_locations(houses, competitors, self.center, 1000, parameters)
        self.assertEqual(first, second)
        np.testing.assert_array_equal(houses, self.houses)
        np.testing.assert_array_equal(competitors, self.competitors)
        self.assertEqual(parameters, before)

    def test_more_residents_raise_unnormalized_demand_at_fixed_points(self):
        increased = self.houses.copy()
        increased[0, 2] += 500
        for business in BUSINESS_CATALOG:
            with self.subTest(business=business):
                before = self.metrics(self.houses, self.competitors, business)
                after = self.metrics(increased, self.competitors, business)
                for old, new in zip(before, after, strict=True):
                    self.assertGreater(new['model_demand'], old['model_demand'])
                    self.assertEqual(new['competition_multiplier'], old['competition_multiplier'])
                    self.assertGreater(new['model_demand'] / new['competition_multiplier'],
                                       old['model_demand'] / old['competition_multiplier'])

    def test_added_competitor_cannot_raise_raw_score_at_fixed_points(self):
        increased = np.vstack([self.competitors, self.center])
        for business in BUSINESS_CATALOG:
            with self.subTest(business=business):
                before = self.metrics(self.houses, self.competitors, business)
                after = self.metrics(self.houses, increased, business)
                for old, new in zip(before, after, strict=True):
                    self.assertEqual(old['model_demand'], new['model_demand'])
                    self.assertGreater(new['competition_multiplier'], old['competition_multiplier'])
                    self.assertLess(new['model_demand'] / new['competition_multiplier'],
                                    old['model_demand'] / old['competition_multiplier'])

    def test_grid_and_explanations_agree_with_independent_kernel_values(self):
        for business in ['cafe', 'pharmacy', 'fitness']:
            with self.subTest(business=business):
                parameters = BUSINESS_CATALOG[business]
                scored = score_locations(self.houses, self.competitors, self.center, 1000, parameters)
                n = scored.grid['n']
                axis = np.linspace(-1000, 1000, n)
                grid = np.array([(x, y) for y in axis for x in axis])
                h_xy = to_meters(self.houses[:, :2], *self.center)
                c_xy = to_meters(self.competitors, *self.center)
                demand = np.zeros(len(grid))
                pressure = np.zeros(len(grid))
                for row, xy in zip(self.houses, h_xy, strict=True):
                    demand += row[2] * np.exp(-np.sum((grid - xy)**2, axis=1) / parameters['R']**2)
                for xy in c_xy:
                    pressure += np.exp(-np.sum((grid - xy)**2, axis=1) / (.8 * parameters['R'])**2)
                raw = demand / (1 + parameters['alpha'] * pressure)
                raw[np.linalg.norm(grid, axis=1) > 1000] = 0
                np.testing.assert_allclose(scored.grid['scores'], np.round(raw / raw.max(), 3), atol=1e-12)
                explanations = explain_recommendations(self.houses, self.competitors, self.center,
                                                       1000, parameters, scored.recommendations, scored.centroids)
                for recommendation, explanation in zip(scored.recommendations, explanations, strict=True):
                    xy = to_meters([[recommendation['lat'], recommendation['lng']]], *self.center)[0]
                    index = int(np.argmin(np.linalg.norm(grid - xy, axis=1)))
                    metrics = explanation['metrics']
                    self.assertAlmostEqual(metrics['model_demand'], demand[index], places=7)
                    self.assertAlmostEqual(metrics['competition_pressure'], pressure[index], places=8)
                    self.assertAlmostEqual(recommendation['score'], raw[index] / raw.max(), places=10)
                    distances = np.linalg.norm(h_xy - xy, axis=1)
                    self.assertEqual(recommendation['residents_in_radius'],
                                     int(self.houses[distances <= parameters['R'], 2].sum()))
                    self.assertEqual(metrics['houses_in_radius'], int((distances <= parameters['R']).sum()))

    def test_zero_houses_are_rejected_before_model_and_empty_competitors_are_valid(self):
        for houses in [[], np.empty((0, 3))]:
            with self.subTest(houses=repr(houses)), self.assertRaises(ValueError):
                validate_data(houses, [])
        houses, competitors = validate_data(self.houses, [])
        result = score_locations(houses, competitors, self.center, 1000, BUSINESS_CATALOG['cafe'])
        self.assertTrue(result.recommendations)
        explanations = explain_recommendations(houses, competitors, self.center, 1000,
                                               BUSINESS_CATALOG['cafe'], result.recommendations, result.centroids)
        for item, explanation in zip(result.recommendations, explanations, strict=True):
            self.assertEqual(item['competitors_in_radius'], 0)
            self.assertIsNone(item['nearest_competitor_m'])
            self.assertEqual(explanation['metrics']['competition_multiplier'], 1)
            self.assertTrue(any('не означает отсутствия' in risk for risk in explanation['risks']))

    def test_corrupted_rows_are_rejected_before_scoring(self):
        for value in [float('nan'), float('inf'), -1, 0]:
            houses = self.houses.copy()
            houses[0, 2] = value
            with self.subTest(population=value), self.assertRaises(ValueError):
                validate_data(houses, self.competitors)
        for competitors in [[[91, 39]], [[52, 181]], [[52]], [[52, float('nan')]]]:
            with self.subTest(competitors=competitors), self.assertRaises(ValueError):
                validate_data(self.houses, competitors)

    def test_stale_partial_and_future_dates_do_not_imply_freshness(self):
        current = self.now.timestamp()
        cases = [({'houses': {'fetched_at': current - 8 * 86400},
                   'competitors': {'fetched_at': current}}, 'stale', 'mixed_fetch_dates'),
                 ({'houses': {'fetched_at': current}}, 'unknown', 'unknown_freshness'),
                 ({'houses': {'fetched_at': current}, 'competitors': {'fetched_at': current + 301}},
                  'unknown', 'unknown_freshness'), ({}, 'unknown', 'unknown_freshness')]
        for metadata, freshness, reason in cases:
            with self.subTest(metadata=metadata):
                quality = self.quality(metadata)
                self.assertEqual(quality['freshness']['status'], freshness)
                self.assertIn(reason, {item['code'] for item in quality['completeness']['reasons']})
                # Этот статус проверяет пороги, а не свежесть или полноту OSM.
                self.assertEqual(quality['completeness']['status'], 'usable_for_model')
        limited = self.quality({}, house_count=0, residents=0, competitor_count=0)
        self.assertEqual(limited['completeness']['status'], 'limited')

    def test_empty_or_partial_loading_never_silently_succeeds_as_real_data(self):
        for houses in [np.empty((0, 3)), self.houses[:4]]:
            with self.subTest(rows=len(houses)), \
                 patch.object(analysis, 'CITY_DATA_URL', ''), \
                 patch.object(analysis.osm, 'get_houses', return_value=(houses, CacheInfo(True, 1))), \
                 patch.object(analysis.osm, 'get_competitors', return_value=(np.empty((0, 2)), CacheInfo(True, 1))):
                loaded = analysis.load_data(area_for('eleytsky'), 'cafe', False)
                self.assertEqual(loaded.source, 'demo')
                self.assertTrue(loaded.warning)
                custom = {**area_for('eleytsky'), 'custom': True}
                with self.assertRaises(UserError):
                    analysis.load_data(custom, 'cafe', False)

    def test_analysis_results_are_isolated_and_payload_matches_explanations(self):
        first_data = LoadedData(self.houses.copy(), self.competitors.copy(), 'cache', None,
                                cache_metadata(CacheInfo(True, self.now.timestamp() - 9 * 86400, True),
                                               CacheInfo(True, self.now.timestamp())))
        second_houses = self.houses.copy()
        second_houses[:, 2] *= 2
        second_data = LoadedData(second_houses, np.empty((0, 2)), 'cache', None)
        with patch.object(analysis, 'load_data', side_effect=[first_data, second_data, first_data]):
            first = analysis.analyze(area_for('eleytsky'), 'cafe')
            snapshot = copy.deepcopy(first)
            second = analysis.analyze(area_for('eleytsky'), 'pharmacy')
            repeated = analysis.analyze(area_for('eleytsky'), 'cafe')
        self.assertEqual(first, snapshot)
        self.assertNotEqual(first['analysis_id'], second['analysis_id'])
        self.assertNotEqual(first['analysis_id'], repeated['analysis_id'])
        for key in ['recommendations', 'grid', 'centroids', 'houses', 'competitors', 'stats']:
            self.assertEqual(first[key], repeated[key])
        self.assertEqual(second['stats']['residents'], 2 * first['stats']['residents'])
        self.assertEqual(second['stats']['competitors'], 0)
        self.assertEqual(first['best'], first['recommendations'][0])
        self.assertEqual(first['parameters']['radius_m'], BUSINESS_CATALOG['cafe']['R'])
        self.assertEqual(first['data_meta'], first_data.metadata)
        second['houses'][0]['residents'] = -1
        second['recommendations'][0]['explanation']['metrics']['model_demand'] = -1
        self.assertEqual(first, snapshot)


if __name__ == '__main__':
    unittest.main()
