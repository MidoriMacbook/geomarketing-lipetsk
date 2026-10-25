import copy
import importlib
import importlib.util
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import make_bundle
from src.utils.validation import area_for
from tests.unit.test_city_data import city_rows


class CityFeedTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.find_spec('src.services.city_feed_service')
        self.assertIsNotNone(spec, 'Daily feed loading must be implemented')
        self.feed = importlib.import_module('src.services.city_feed_service')
        self.folder = tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-')
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / 'city.json'
        self.patchers = [patch.object(self.feed, 'CACHE_FILE', self.path),
                         patch.object(self.feed, '_memory', None),
                         patch.object(self.feed, '_last_check', 0),
                         patch.object(self.feed, '_etag', None),
                         patch.object(self.feed, '_last_error', None),
                         patch.object(self.feed, 'CITY_DATA_URL', 'https://example.test/city.json')]
        for p in self.patchers: p.start(); self.addCleanup(p.stop)
        self.bundle = make_bundle(city_rows(), {key: [[52.5935, 39.48]]
                                               for key in BUSINESS_CATALOG}, time.time() - 100)

    def response(self, bundle=None, status=200):
        raw = json.dumps(bundle or self.bundle).encode()
        response = Mock(status_code=status, headers={'ETag': 'v1'})
        response.iter_content.return_value = [raw]
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        return response

    def test_first_fetch_and_recheck_preserve_actual_date(self):
        with patch.object(self.feed.requests, 'get', return_value=self.response()) as request:
            first = self.feed.load(area_for('eleytsky'), 'cafe', True)
            self.assertEqual(first.delivery['status'], 'updated')
            saved = self.path.read_bytes()
            second = self.feed.load(area_for('eleytsky'), 'cafe', True)
            self.assertEqual(second.delivery['status'], 'unchanged')
            self.assertEqual(second.metadata['houses']['fetched_at'], self.bundle['fetched_at'])
            self.assertEqual(self.path.read_bytes(), saved)
            self.feed.load(area_for('center'), 'dentist', False)
            self.assertEqual(request.call_count, 2)

    def test_network_failure_keeps_last_complete_version(self):
        self.path.write_text(json.dumps(self.bundle))
        with patch.object(self.feed.requests, 'get', side_effect=OSError('offline')):
            result = self.feed.load(area_for('eleytsky'), 'cafe', True)
        self.assertEqual(result.delivery['status'], 'unavailable')
        self.assertEqual(result.metadata['houses']['fetched_at'], self.bundle['fetched_at'])
        self.assertEqual(json.loads(self.path.read_text()), self.bundle)
        self.assertTrue(result.warning)

    def test_bad_file_and_date_rollback_cannot_replace_good_version(self):
        self.path.write_text(json.dumps(self.bundle))
        older = copy.deepcopy(self.bundle)
        from src.domain.city_data import digest
        older['fetched_at'] -= 100; older['version'] = digest(older)
        huge = copy.deepcopy(self.bundle); huge['houses'][0][2] = 10 ** 500
        huge['version'] = digest(huge)
        for candidate in [older, {'schema': 99}, huge]:
            with patch.object(self.feed.requests, 'get', return_value=self.response(candidate)):
                result = self.feed.load(area_for('eleytsky'), 'cafe', True)
            self.assertEqual(result.delivery['status'], 'unavailable')
            self.assertEqual(json.loads(self.path.read_text()), self.bundle)

    def test_304_does_not_change_source_date(self):
        with patch.object(self.feed.requests, 'get', side_effect=[self.response(), self.response(status=304)]):
            self.feed.load(area_for('eleytsky'), 'cafe', True)
            result = self.feed.load(area_for('eleytsky'), 'cafe', True)
        self.assertEqual(result.delivery['status'], 'unchanged')
        self.assertEqual(result.metadata['competitors']['fetched_at'], self.bundle['fetched_at'])

    def test_overflowing_population_cannot_replace_good_copy(self):
        self.path.write_text(json.dumps(self.bundle))
        from src.domain.city_data import digest
        broken = copy.deepcopy(self.bundle)
        for row in broken['houses'][:50]: row[2] = 2.4e307
        broken['fetched_at'] += 50; broken['version'] = digest(broken)
        with patch.object(self.feed.requests, 'get', return_value=self.response(broken)):
            result = self.feed.load(area_for('eleytsky'), 'cafe', True)
        self.assertEqual(result.delivery['status'], 'unavailable')
        self.assertEqual(result.delivery['version'], self.bundle['version'])
        self.assertEqual(json.loads(self.path.read_text()), self.bundle)

    def test_no_network_and_no_copy_is_explicitly_unavailable(self):
        with patch.object(self.feed.requests, 'get', side_effect=OSError('offline')):
            with self.assertRaises(self.feed.FeedUnavailable):
                self.feed.load(area_for('eleytsky'), 'cafe', True)

    def test_newer_version_replaces_copy_and_survives_memory_reset(self):
        newer = make_bundle(city_rows(), self.bundle['competitors'], self.bundle['fetched_at'] + 50)
        with patch.object(self.feed.requests, 'get', side_effect=[self.response(), self.response(newer)]):
            self.feed.load(area_for('eleytsky'), 'cafe', True)
            result = self.feed.load(area_for('eleytsky'), 'cafe', True)
        self.assertEqual(result.delivery['status'], 'updated')
        self.assertEqual(json.loads(self.path.read_text())['version'], newer['version'])
        self.feed._memory = None
        with patch.object(self.feed.requests, 'get', side_effect=OSError('offline')):
            restored = self.feed.load(area_for('eleytsky'), 'cafe', True)
        self.assertEqual(restored.delivery['version'], newer['version'])
        self.assertEqual(restored.metadata['houses']['fetched_at'], newer['fetched_at'])

    def test_concurrent_check_serves_current_copy_without_another_download(self):
        self.feed._memory = self.bundle
        self.feed._lock.acquire()
        try:
            with patch.object(self.feed.requests, 'get') as request:
                result = self.feed.load(area_for('eleytsky'), 'cafe', True)
                request.assert_not_called()
            self.assertEqual(result.delivery['status'], 'checking')
        finally:
            self.feed._lock.release()


if __name__ == '__main__': unittest.main()
