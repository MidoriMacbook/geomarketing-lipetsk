"""Зависимости сборщика запускают выгрузку; косметика сайта — нет."""
import ast
import base64
import fnmatch
import json
import re
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

from scripts.publish_city_data import publish
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import make_bundle
from tests.unit.test_city_data import city_rows


ROOT = Path(__file__).resolve().parents[2]


def push_paths():
    text = (ROOT / '.github/workflows/osm-data.yml').read_text(encoding='utf-8')
    block = text.split('    paths:\n', 1)[1].split('\npermissions:', 1)[0]
    return re.findall(r"^      - '([^']+)'$", block, re.MULTILINE)


def collector_dependencies():
    """Статические импорты и инициализаторы локальных пакетов двух команд."""
    pending = [ROOT / 'scripts/collect_city_data.py', ROOT / 'scripts/publish_city_data.py']
    seen = set()
    while pending:
        path = pending.pop()
        if path in seen:
            continue
        seen.add(path)
        tree = ast.parse(path.read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            modules = ([node.module] if isinstance(node, ast.ImportFrom) and node.module
                       else [item.name for item in node.names] if isinstance(node, ast.Import) else [])
            for module in modules:
                if not module.startswith('src.'):
                    continue
                local = ROOT.joinpath(*module.split('.')).with_suffix('.py')
                if local.is_file():
                    pending.append(local)
                    for parent in local.parents:
                        if parent == ROOT:
                            break
                        init = parent / '__init__.py'
                        if init.is_file():
                            pending.append(init)
    return {path.relative_to(ROOT).as_posix() for path in seen}


class DailyWorkflowPathsTests(unittest.TestCase):
    def test_all_local_collector_dependencies_trigger_push(self):
        patterns = push_paths()
        required = collector_dependencies() | {'.python-version', 'requirements.txt', '.github/workflows/osm-data.yml'}
        missing = sorted(path for path in required if not any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns))
        self.assertEqual(missing, [], f'Не запускают сборку зависимые файлы: {missing}')

    def test_cosmetic_changes_do_not_trigger_collection(self):
        patterns = push_paths()
        for path in ['static/index.html', 'static/css/hero.css', 'static/js/counters.js',
                     'docs/design/design-system.md', 'README.md', 'scripts/prepare_history.py']:
            with self.subTest(path=path):
                self.assertFalse(any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns))

    def test_graph_includes_parser_provenance_and_population_settings(self):
        self.assertTrue({'src/services/osm_service.py', 'src/domain/provenance.py',
                         'src/config.py', 'src/utils/geo.py'} <= collector_dependencies())


class CityPublicationTests(unittest.TestCase):
    def setUp(self):
        bundle = make_bundle(city_rows(), {key: [[52.5935, 39.48]] for key in BUSINESS_CATALOG}, time.time())
        self.raw = json.dumps(bundle).encode()
        self.path = Mock()
        self.path.read_bytes.return_value = self.raw
        self.session_factory = self.enterContext(patch('scripts.publish_city_data.requests.Session'))
        self.session = self.session_factory.return_value.__enter__.return_value
        self.enterContext(patch.dict('os.environ', {'GITHUB_REPOSITORY': 'test/repo', 'GITHUB_TOKEN': 'test-token'}))
        self.session.get.side_effect = lambda url, **_: Mock(
            status_code=404 if url.endswith('/CITY-DATA-LICENSE.md') else 200,
            **{'json.return_value': {'sha': 'published-city-blob'}},
        )

    def test_notice_is_available_before_replacing_the_verified_city_file(self):
        publish(self.path)
        notice, city = self.session.put.call_args_list
        self.assertTrue(notice.args[0].endswith('/CITY-DATA-LICENSE.md'))
        license_text = base64.b64decode(notice.kwargs['json']['content']).decode('utf-8')
        self.assertIn('https://www.openstreetmap.org/copyright', license_text)
        self.assertIn('https://opendatacommons.org/licenses/odbl/1-0/', license_text)
        self.assertTrue(city.args[0].endswith('/city.json'))
        self.assertEqual(city.kwargs['json']['sha'], 'published-city-blob')
        self.assertEqual(base64.b64decode(city.kwargs['json']['content']), self.raw)

    def test_failed_notice_write_preserves_previous_city_file(self):
        self.session.put.return_value.raise_for_status.side_effect = requests.HTTPError('unavailable')
        with self.assertRaises(requests.HTTPError):
            publish(self.path)
        self.session.put.assert_called_once()
        self.assertTrue(self.session.put.call_args.args[0].endswith('/CITY-DATA-LICENSE.md'))

    def test_existing_notice_does_not_create_a_commit_for_each_city_update(self):
        publish(self.path)
        license_content = self.session.put.call_args_list[0].kwargs['json']['content']
        previously = self.session.get.side_effect
        self.session.get.side_effect = lambda url, **kwargs: (
            Mock(status_code=200, **{'json.return_value': {'content': license_content}})
            if url.endswith('/CITY-DATA-LICENSE.md') else previously(url, **kwargs)
        )
        self.session.put.reset_mock()
        publish(self.path)
        self.session.put.assert_called_once()
        self.assertTrue(self.session.put.call_args.args[0].endswith('/city.json'))
