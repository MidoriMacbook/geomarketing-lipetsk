"""Quality states describe provenance limitations, never statistical confidence."""
from datetime import datetime, timedelta, timezone
import json
import unittest

from src.domain.data_quality import assess_data_quality


class DataQualityTests(unittest.TestCase):
    now = datetime(2026, 10, 18, 10, tzinfo=timezone.utc)

    def quality(self, house_age=0, competitor_age=0, **changes):
        args = dict(source='cache', metadata={
            'houses': {'fetched_at': (self.now - timedelta(seconds=house_age)).timestamp()},
            'competitors': {'fetched_at': (self.now - timedelta(seconds=competitor_age)).timestamp()},
        }, house_count=5, residents=3000, competitor_count=2, warning=None, notice=None, now=self.now)
        args.update(changes)
        return assess_data_quality(**args)

    def codes(self, result):
        return {item['code'] for item in result['completeness']['reasons']}

    def test_exact_freshness_boundaries_choose_oldest_dataset(self):
        for age, expected in [(0, 'fresh'), (86400, 'fresh'), (86401, 'recent'),
                              (604800, 'recent'), (604801, 'stale')]:
            with self.subTest(age=age):
                result = self.quality(competitor_age=age)
                self.assertEqual(result['freshness']['status'], expected)
                self.assertEqual(result['freshness']['oldest_data_at'],
                                 (self.now-timedelta(seconds=age)).isoformat().replace('+00:00', 'Z'))

    def test_missing_malformed_nonfinite_and_future_dates_are_unknown(self):
        for value in [None, 'broken', float('inf'), True, self.now.timestamp()+301]:
            with self.subTest(value=value):
                result = self.quality(metadata={'houses': {'fetched_at': value},
                                               'competitors': {'fetched_at': self.now.timestamp()}})
                self.assertEqual(result['freshness']['status'], 'unknown')
                self.assertIn('unknown_freshness', self.codes(result))
                json.dumps(result, allow_nan=False)
        self.assertEqual(self.quality(competitor_age=-300)['freshness']['status'], 'fresh')

    def test_iso_dates_and_mixed_fetches_preserve_both_source_dates(self):
        result = self.quality(metadata={
            'houses': {'fetched_at': '2026-10-17T10:00:00Z'},
            'competitors': {'fetched_at': '2026-10-18T10:00:00+00:00'},
        }, source='osm')
        self.assertEqual(result['source'], 'osm')
        self.assertEqual(result['freshness']['status'], 'fresh')
        reason = next(item for item in result['completeness']['reasons'] if item['code']=='mixed_fetch_dates')
        self.assertIn('2026-10-17', reason['text'])
        self.assertIn('2026-10-18', reason['text'])

    def test_demo_never_claims_real_freshness(self):
        result = self.quality(source='demo')
        self.assertEqual(result['freshness'], {'status': 'demo', 'oldest_data_at': None})
        self.assertEqual(result['completeness']['status'], 'limited')
        self.assertIn('demo_data', self.codes(result))

    def test_completeness_limits_and_review_precedence(self):
        self.assertEqual(self.quality()['completeness']['status'], 'usable_for_model')
        for changes in [dict(house_count=4), dict(residents=2999)]:
            self.assertEqual(self.quality(**changes)['completeness']['status'], 'limited')
        for changes in [dict(competitor_count=0), dict(warning='refresh failed'), dict(notice='low coverage')]:
            self.assertEqual(self.quality(**changes)['completeness']['status'], 'needs_review')
        result = self.quality(house_count=4, residents=100, competitor_count=0, warning='refresh failed')
        self.assertEqual(result['completeness']['status'], 'limited')
        self.assertTrue({'insufficient_houses','low_residents','no_mapped_competitors',
                         'load_warning','osm_coverage'}.issubset(self.codes(result)))
        reasons = ' '.join(item['text'] for item in result['completeness']['reasons'])
        self.assertIn('4', reasons)
        self.assertIn('100', reasons)
        self.assertIn('refresh failed', reasons)

    def test_stale_reason_and_assessment_time_are_explicit(self):
        result = self.quality(house_age=700000)
        self.assertIn('stale_data', self.codes(result))
        self.assertEqual(result['assessed_at'], '2026-10-18T10:00:00Z')
        self.assertEqual(result['version'], 1)

