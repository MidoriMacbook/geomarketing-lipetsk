import copy
import importlib
import importlib.util
import time
import unittest

from src.config import DISTRICTS
from src.domain.businesses import BUSINESS_CATALOG
from src.services import analysis_service as analysis
from src.utils.validation import area_for
from unittest.mock import Mock, patch
import numpy as np


def city_rows():
    return [[round(d['center'][0] + (i // 10) * .0001, 6),
             round(d['center'][1] + (i % 10) * .0001, 6), 10]
            for d in DISTRICTS.values() for i in range(50)]


class CityDataTests(unittest.TestCase):
    def api(self):
        spec = importlib.util.find_spec('src.domain.city_data')
        self.assertIsNotNone(spec, 'Validated city data contract is required')
        return importlib.import_module('src.domain.city_data')

    def bundle(self):
        api = self.api()
        return api.make_bundle(city_rows(), {key: [[52.5935, 39.48]]
                               for key in BUSINESS_CATALOG}, time.time() - 100)

    def test_daily_data_is_used_without_contacting_overpass(self):
        houses = np.array([[52.5935, 39.48, 10]] * 5)
        loaded = analysis.LoadedData(houses, np.empty((0, 2)), 'osm', None,
                                    {'houses': {}, 'competitors': {}},
                                    )
        feed = Mock(); feed.load.return_value = loaded
        with patch.object(analysis, 'city_feed', feed, create=True), \
             patch.object(analysis, 'CITY_DATA_URL', 'https://example.test/city.json'), \
             patch.object(analysis.osm, 'get_houses', side_effect=RuntimeError('offline')):
            self.assertIs(analysis.load_data(area_for('eleytsky'), 'cafe', True), loaded)
            feed.load.assert_called_once()

    def test_round_trip_and_real_source_date(self):
        api = self.api(); bundle = self.bundle()
        self.assertEqual(api.validate_bundle(bundle), bundle)
        self.assertLess(bundle['fetched_at'], time.time() - 90)
        self.assertEqual(len(bundle['version']), 64)

    def test_finite_rows_with_overflowing_population_sum_are_rejected(self):
        api = self.api(); houses = city_rows()
        for row in houses[:50]: row[2] = 2.4e307
        with self.assertRaises(ValueError):
            api.make_bundle(houses, {key: [[52.5935,39.48]] for key in BUSINESS_CATALOG}, time.time())

    def test_unrepresentable_numbers_are_rejected_as_invalid_data(self):
        api = self.api(); competitors = {key: [[52.5935,39.48]] for key in BUSINESS_CATALOG}
        with self.assertRaises(ValueError): api.make_bundle(city_rows(), competitors, 10 ** 500)
        houses = city_rows(); houses[0][2] = 10 ** 500
        with self.assertRaises(ValueError): api.make_bundle(houses, competitors, time.time())

    def test_damage_missing_categories_and_future_dates_are_rejected(self):
        api = self.api(); bundle = self.bundle()
        for change in [lambda b: b['houses'][0].__setitem__(2, -1),
                       lambda b: b['competitors'].pop('dentist'),
                       lambda b: b.__setitem__('fetched_at', time.time() + 1000),
                       lambda b: b.__setitem__('version', '0' * 64),
                       lambda b: b.__setitem__('houses', [])]:
            damaged = copy.deepcopy(bundle); change(damaged)
            with self.assertRaises(ValueError): api.validate_bundle(damaged)

    def test_filter_preserves_circle_and_competitor_halo(self):
        api = self.api(); bundle = self.bundle(); area = area_for('eleytsky')
        houses, competitors = api.select_area(bundle, area, 'cafe')
        self.assertEqual(len(houses), 50)
        self.assertEqual(competitors, [[52.5935, 39.48]])
        self.assertEqual(sum(row[2] for row in houses), 500)

    def test_custom_area_near_allowed_boundary_has_complete_halo(self):
        api = self.api(); bundle = self.bundle()
        from src.utils.validation import custom_area
        for center in [(52.5, 39.35), (52.72, 39.8)]:
            area = custom_area(*center, 1500)
            houses, competitors = api.select_area(bundle, area, 'fitness')
            self.assertEqual(houses, [])
            self.assertEqual(competitors, [])

    def test_unavailable_daily_feed_falls_back_only_to_saved_presets(self):
        from src.services import city_feed_service as feed, osm_service as osm
        with patch.object(analysis, 'CITY_DATA_URL', 'https://example.test/city.json'), \
             patch.object(feed, 'load', side_effect=feed.FeedUnavailable('Daily feed offline')), \
             patch.object(osm, 'get_houses', return_value=(np.array([[52.5935,39.48,10]] * 5), True)) as houses, \
             patch.object(osm, 'get_competitors', return_value=(np.empty((0,2)), True)) as competitors:
            result = analysis.load_data(area_for('eleytsky'), 'cafe', True)
        self.assertTrue(houses.call_args.kwargs.get('cached_only'))
        self.assertTrue(competitors.call_args.kwargs.get('cached_only'))
        self.assertEqual(result.delivery['status'], 'unavailable')
        self.assertIn('Daily feed offline', result.warning)


if __name__ == '__main__': unittest.main()
