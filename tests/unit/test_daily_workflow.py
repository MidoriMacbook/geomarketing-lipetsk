"""Зависимости сборщика запускают выгрузку; косметика сайта — нет."""
import ast
import fnmatch
import re
import unittest
from pathlib import Path


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
