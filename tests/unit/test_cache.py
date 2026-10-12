import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from src.services import osm_service as osm
from src.services import cache_service


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.patcher = patch.object(cache_service, 'CACHE_DIR', self.root)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_corrupt_cache_is_replaced_from_network(self):
        (self.root / 'houses_test.json').write_text('{broken', encoding='utf-8')
        rows = [[52.61, 39.58, 100]]
        self.assertEqual(cache_service._cached('houses_test', lambda: rows)[0], rows)

    def test_write_failure_does_not_discard_fetched_data(self):
        rows = [[52.61, 39.58, 100]]
        with patch.object(Path, 'mkdir', side_effect=PermissionError('read-only')), \
             self.assertLogs(cache_service.logger, level='WARNING'):
            self.assertEqual(cache_service._cached('houses_test', lambda: rows)[0], rows)

    def test_failed_refresh_keeps_previous_data(self):
        rows = [[52.61, 39.58, 100]]
        (self.root / 'houses_test.json').write_text(json.dumps(rows), encoding='utf-8')
        def offline():
            raise RuntimeError('offline')
        result, cached = cache_service._cached('houses_test', offline, refresh=True)
        self.assertEqual(result, rows)
        self.assertTrue(cached)
        self.assertIn('Обновление', cached.warning)

    def test_changing_area_geometry_does_not_reuse_old_cache(self):
        area = osm.area_for('universitetsky')
        with patch.object(osm, '_load_houses', return_value=[[52.605 + i/1000, 39.505, 100] for i in range(5)]) as loader:
            osm.get_houses(area, refresh=True)
            moved = {**area, 'center': (52.615, 39.515)}
            osm.get_houses(moved)
        self.assertEqual(loader.call_count, 2)

    def test_partial_refresh_preserves_usable_houses(self):
        area = osm.area_for('eleytsky')
        rows = [[52.593 + i/1000, 39.480, 100] for i in range(5)]
        name = f'houses_{osm.cache_key(area)}'
        (self.root / f'{name}.json').write_text(json.dumps(rows), encoding='utf-8')
        with patch.object(osm, '_load_houses', return_value=rows[:2]):
            data, info = osm.get_houses(area, refresh=True)
        self.assertEqual(len(data), 5)
        self.assertTrue(info.warning)

    def test_busy_cache_returns_saved_copy_without_waiting(self):
        name = 'houses_test'
        rows = [[52.61, 39.58, 100]]
        (self.root / f'{name}.json').write_text(json.dumps(rows), encoding='utf-8')
        # A real lock would deadlock the old implementation: use an instrumented one.
        from unittest.mock import MagicMock, Mock
        busy = MagicMock()
        busy.acquire.return_value = False
        locks = [busy] * 32
        loader = Mock(return_value=[[52.60, 39.56, 80]])
        with patch.object(cache_service, '_CACHE_LOCKS', locks):
            data, info = cache_service._cached(name, loader, True)
        self.assertEqual(data, rows)
        loader.assert_not_called()

    def test_concurrent_refresh_reuses_previous_data(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Event
        name = 'houses_test'
        rows = [[52.61, 39.58, 100]]
        (self.root / f'{name}.json').write_text(json.dumps(rows), encoding='utf-8')
        started, release = Event(), Event()
        calls = []
        def loader():
            calls.append(1)
            started.set()
            if not release.wait(3):
                raise RuntimeError('test timeout')
            return [[52.61, 39.58, 150]]
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(cache_service._cached, name, loader, True)
            try:
                self.assertTrue(started.wait(1))
                second = pool.submit(cache_service._cached, name, loader, True)
                result, info = second.result(timeout=1)
                self.assertEqual(result, rows)
                self.assertTrue(info.warning)
            finally:
                release.set()
            self.assertEqual(first.result()[0][0][2], 150)
        self.assertEqual(len(calls), 1)

    def test_invalid_cached_values_trigger_recovery(self):
        path = self.root / 'houses_test.json'
        for invalid in ([[52,39,float('nan')]], [[52,39,-5]], [[52,39]], {'data':[], 'fetched_at':0}):
            with self.subTest(invalid=invalid):
                path.write_text(json.dumps(invalid), encoding='utf-8')
                rows = [[52.61,39.58,100]]
                self.assertEqual(cache_service._cached('houses_test', lambda: rows)[0], rows)


if __name__ == '__main__':
    unittest.main()
