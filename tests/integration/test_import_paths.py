"""Clean-process imports and direct CLI execution from outside the project."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from src.config import PROJECT_ROOT


class ImportPathTests(unittest.TestCase):
    def run_python(self, arguments, cwd, cache_dir=None, project_pythonpath=True):
        environment = {**os.environ, 'PYTHONPATH': str(PROJECT_ROOT)}
        if not project_pythonpath:
            environment.pop('PYTHONPATH', None)
        if cache_dir is None:
            environment.pop('CACHE_DIR', None)
        else:
            environment['CACHE_DIR'] = cache_dir
        result = subprocess.run([sys.executable, *arguments], cwd=cwd,
                                env=environment, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def test_cache_and_snapshot_paths_are_project_relative_in_clean_process(self):
        script = (
            'import json; from src import config; '
            'from src.services import cache_service; '
            'print(json.dumps([str(config.CACHE_DIR), str(config.SNAPSHOT_DIR), '
            'str(cache_service.CACHE_DIR), str(cache_service.SNAPSHOT_DIR)]))')
        with tempfile.TemporaryDirectory(dir=PROJECT_ROOT / 'tests', prefix='tmp-') as folder:
            for configured, expected in ((None, PROJECT_ROOT / 'cache'),
                                         ('relative-cache', PROJECT_ROOT / 'relative-cache')):
                with self.subTest(cache_dir=configured):
                    paths = json.loads(self.run_python(['-c', script], folder, configured))
                    self.assertEqual(paths, [str(expected), str(PROJECT_ROOT / 'data' / 'snapshots'),
                                             str(expected), str(PROJECT_ROOT / 'data' / 'snapshots')])

    def test_domain_and_services_import_without_flask(self):
        script = (
            'import sys; import src.domain.scoring; import src.services.analysis_service; '
            'import src.services.catalog_service; '
            'assert "flask" not in sys.modules; '
            'assert "app" not in sys.modules')
        self.run_python(['-c', script], PROJECT_ROOT)

    def test_diagnostic_import_has_no_network_or_output_side_effect(self):
        script = (
            'from unittest.mock import patch; '
            'p = patch("requests.post", side_effect=AssertionError("unexpected network")); '
            'mock = p.start(); import scripts.check; assert not mock.called; '
            'p.stop()')
        self.assertEqual(self.run_python(['-c', script], PROJECT_ROOT), '')

    def test_importer_help_works_when_invoked_directly_from_another_cwd(self):
        with tempfile.TemporaryDirectory(dir=PROJECT_ROOT / 'tests', prefix='tmp-') as folder:
            output = self.run_python([str(PROJECT_ROOT / 'scripts' / 'import_osm_competitors.py'),
                                      '--help'], folder, project_pythonpath=False)
        self.assertIn('--district', output)
        self.assertIn('--business', output)
