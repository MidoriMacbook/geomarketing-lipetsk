"""Сетевые режимы аудита не должны зависеть от наличия локального кэша."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import audit_data


class AuditDataModeTests(unittest.TestCase):
    now = 1793275200
    temporary_parent = Path(__file__).resolve().parents[1] / 'artifacts'

    @classmethod
    def setUpClass(cls):
        cls.temporary_parent.mkdir(parents=True, exist_ok=True)

    def test_offline_with_populated_cache_never_calls_network(self):
        with tempfile.TemporaryDirectory(dir=self.temporary_parent) as directory:
            cache = Path(directory)
            area = {'key': 'eleytsky', **audit_data.DISTRICTS['eleytsky']}
            name = 'houses_' + audit_data.cache_key(area) + '.json'
            (cache / name).write_text(json.dumps({'fetched_at': self.now,
                                                 'data': [[52.5935, 39.48, 100]]}), encoding='utf-8')
            with patch.object(audit_data, 'CACHE_DIR', cache), \
                 patch.object(audit_data, 'runtime_audit', return_value={}) as runtime, \
                 patch.object(audit_data, 'public_sample') as sample, \
                 patch.object(audit_data, 'urlopen', side_effect=AssertionError('Сеть в автономном режиме запрещена')) as network:
                result = audit_data.audit(self.now, output_dir=cache / 'result')
            self.assertEqual(len(result['active_cache_overrides']), 1)
            self.assertNotIn('public_runtime', result.keys())
            runtime.assert_not_called()
            sample.assert_not_called()
            network.assert_not_called()

    def test_runtime_cli_with_empty_cache_runs_public_runtime_audit(self):
        with tempfile.TemporaryDirectory(dir=self.temporary_parent) as directory:
            cache = Path(directory)
            output = cache / 'result' / 'audit.json'
            evidence = {'requested_at': '2026-10-29T12:00:00Z', 'analyses': []}
            arguments = ['audit_data.py', '--at', '2026-10-29T12:00:00Z',
                         '--runtime', '--output', str(output)]
            with patch.object(audit_data, 'CACHE_DIR', cache), \
                 patch.object(audit_data, 'runtime_audit', return_value=evidence) as runtime, \
                 patch.object(audit_data, 'public_sample') as sample, \
                 patch.object(audit_data.sys, 'argv', arguments), \
                 patch('builtins.print'):
                audit_data.main()
            runtime.assert_called_once_with(output.parent)
            sample.assert_not_called()
            result = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(result['active_cache_overrides'], [])
            self.assertEqual(result['public_runtime'], evidence)


if __name__ == '__main__':
    unittest.main()
