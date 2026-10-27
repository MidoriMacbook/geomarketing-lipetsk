"""Offline structural checks: python scripts/validate_project.py.

This complements the runtime tests; it does not fetch OSM or validate model quality.
"""
from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    'app.py', 'serve.py', 'osm.py', 'businesses.py', 'requirements.txt',
    'render.yaml', 'Dockerfile', 'README.md', 'PROJECT_ANALYSIS.md', 'CHANGELOG.md',
    'src/__init__.py', 'src/config.py',
    *[f'src/{name}/__init__.py' for name in ('routes', 'domain', 'services', 'utils')],
    *[f'src/routes/{name}.py' for name in ('health', 'catalog', 'calculate')],
    *[f'src/domain/{name}.py' for name in ('businesses', 'models', 'scoring', 'explanations', 'data_quality', 'city_data')],
    *[f'src/services/{name}.py' for name in
      ('analysis_service', 'catalog_service', 'cache_service', 'osm_service', 'city_feed_service')],
    *[f'src/utils/{name}.py' for name in ('geo', 'formatting', 'validation')],
    'static/index.html', 'static/assets/favicon.svg',
    'static/assets/favicon-32.png', 'static/assets/apple-touch-icon.png',
    *[f'static/css/{name}.css' for name in
      ('tokens', 'base', 'layout', 'components', 'map', 'states', 'responsive', 'scenarios', 'field-checks', 'hero')],
    *[f'static/js/{name}.js' for name in
      ('app', 'api', 'state', 'map', 'recommendations', 'saved-places', 'report', 'ui', 'counters', 'choices', 'scenarios', 'scenario-storage', 'scenario-report', 'data-quality', 'field-checks', 'field-check-storage', 'navigation', 'hero-loader', 'kpi-interactions', 'data-delivery', 'analysis-focus', 'recommendation-brief', 'workspace-disclosure', 'mobile-workspace', 'comparison-guide')],
    'static/vendor/hero/hero-motion.js', 'scripts/frontend/hero-entry.js',
    'tests/unit/__init__.py', 'tests/integration/__init__.py',
    'tests/browser/smoke.js', 'tests/browser/workspace.js',
    'tests/fixtures/saved-places-v1.json', 'data/fixtures/example-cache.json',
    *[f'docs/architecture/{name}.md' for name in ('overview', 'backend', 'frontend', 'data-flow')],
    *[f'docs/design/{name}.md' for name in ('ui-audit', 'design-system', 'redesign-spec')],
    'scripts/check.py', 'scripts/import_osm_competitors.py',
]
REQUIRED_IDS = {
    'page-title', 'print-report', 'workspace', 'settings', 'district', 'business',
    'radius', 'run', 'refresh-data', 'error', 'loading-hint', 'catalog-status',
    'retry-catalog', 'map', 'map-card', 'map-status', 'map-message', 'retry-map',
    'map-context', 'layer-houses', 'layer-competitors', 'layer-centroids',
    'layer-zones', 'thr', 'thr-out', 'recommendations', 'recommendation-list',
    'result', 'result-empty', 'source', 'data-warning', 'data-section',
    'kpi-residents', 'kpi-houses', 'kpi-competitors', 'kpi-places', 'kpi-business',
    'saved-section', 'saved-list', 'saved-count', 'nav-saved-count',
    'saved-empty', 'storage-status', 'comparison', 'comparison-notice',
    'export-csv', 'model-dialog', 'model-button', 'close-model',
    'settings-title', 'area-hint', 'custom-box', 'custom-hint',
    'scenarios-section', 'scenario-save', 'scenario-status', 'scenario-list', 'scenario-comparison', 'data-quality',
    'business-parameters', 'map-title', 'recommendations-title', 'data-title',
    'display-options', 'display-options-summary', 'analysis-status',
    'area-details', 'mobile-settings-bar', 'mobile-settings-open',
    'mobile-settings-dialog', 'mobile-settings-title', 'mobile-settings-close', 'mobile-settings-content',
    'saved-title', 'comparison-title', 'model-title', 'print-report-content',
    'comparison-guide', 'comparison-guide-count', 'comparison-guide-open', 'comparison-guide-caption',
}


def find_cycles(graph: dict[str, set[str]]) -> list[str]:
    visiting: list[str] = []
    finished: set[str] = set()
    issues: list[str] = []

    def visit(node: str) -> None:
        if node in visiting:
            cycle = visiting[visiting.index(node):] + [node]
            message = 'Import cycle: ' + ' -> '.join(cycle)
            if message not in issues:
                issues.append(message)
            return
        if node in finished:
            return
        visiting.append(node)
        for dependency in sorted(graph.get(node, ())):
            visit(dependency)
        visiting.pop()
        finished.add(node)

    for node in sorted(graph):
        visit(node)
    return issues


def python_imports(issues: list[str]) -> None:
    files = list((ROOT / 'src').rglob('*.py'))
    modules = {}
    for path in files:
        parts = list(path.relative_to(ROOT).with_suffix('').parts)
        if parts[-1] == '__init__':
            parts.pop()
        modules['.'.join(parts)] = path
    graph = {name: set() for name in modules}
    for name, path in modules.items():
        try:
            tree = ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path))
        except (SyntaxError, UnicodeError) as error:
            issues.append(f'{path.relative_to(ROOT)}: {error}')
            continue
        package = name if path.name == '__init__.py' else name.rpartition('.')[0]
        for item in ast.walk(tree):
            imports = []
            if isinstance(item, ast.Import):
                imports = [alias.name for alias in item.names]
            elif isinstance(item, ast.ImportFrom):
                prefix = package.split('.')
                if item.level:
                    prefix = prefix[:len(prefix) - item.level + 1]
                    imported = '.'.join(prefix + (item.module or '').split('.')).rstrip('.')
                else:
                    imported = item.module or ''
                imports = [imported]
                imports.extend(f'{imported}.{alias.name}' for alias in item.names
                               if f'{imported}.{alias.name}' in modules)
            for imported in imports:
                if imported in modules:
                    graph[name].add(imported)
                if imported == 'app' or imported.startswith('app.'):
                    issues.append(f'{name} imports application entrypoint: {imported}')
                if name.startswith(('src.domain.', 'src.services.', 'src.utils.')) and (
                        imported in {'flask', 'src.routes'}
                        or imported.startswith(('flask.', 'src.routes.'))):
                    issues.append(f'{name} imports HTTP layer: {imported}')
    issues.extend(find_cycles(graph))


def static_imports(issues: list[str]) -> None:
    page = (ROOT / 'static/index.html').read_text(encoding='utf-8')
    ids = set(re.findall(r'\bid=["\']([^"\']+)', page))
    for missing in sorted(REQUIRED_IDS - ids):
        issues.append('Missing public DOM id: ' + missing)
    for reference in re.findall(r'aria-(?:labelledby|describedby)=["\']([^"\']+)', page):
        for target in reference.split():
            if target not in ids:
                issues.append('Broken ARIA id reference: ' + target)
    for target in re.findall(r'(?:src|href)=["\'](/static/[^"\']+)', page):
        if not (ROOT / target.split('?', 1)[0].lstrip('/')).is_file():
            issues.append('Missing static asset: ' + target)
    if not re.search(r'<script\b[^>]*\btype=["\']module["\'][^>]*>', page):
        issues.append('Browser ES module entrypoint is missing')
    graph: dict[str, set[str]] = {}
    for path in (ROOT / 'static/js').glob('*.js'):
        source = path.read_text(encoding='utf-8')
        graph[path.name] = set()
        for target in re.findall(r'(?:from\s*|import\s*(?:\(\s*)?)["\'](\.[^"\']+)["\']', source):
            resolved = (path.parent / target).resolve()
            if not resolved.is_file() or not resolved.is_relative_to(ROOT / 'static/js'):
                issues.append(f'{path.name}: missing or external local module {target}')
            else:
                graph[path.name].add(resolved.name)
    issues.extend(find_cycles(graph))
    # Palette is owned by tokens.css. Vendor assets are outside this rule.
    for folder, pattern in [('static/css', '*.css'), ('static/js', '*.js')]:
        for path in (ROOT / folder).glob(pattern):
            if path.name == 'tokens.css':
                continue
            if re.search(r'#[0-9a-fA-F]{3,8}\b', path.read_text(encoding='utf-8')):
                issues.append(f'{path.relative_to(ROOT)}: hex color outside tokens.css')


def main() -> int:
    issues = [f'Missing required file: {name}' for name in REQUIRED
              if not (ROOT / name).is_file()]
    if not issues:
        python_imports(issues)
        static_imports(issues)
        for name, limit in [('app.py', 160), ('osm.py', 80), ('businesses.py', 80)]:
            if len((ROOT / name).read_text(encoding='utf-8').splitlines()) > limit:
                issues.append(f'{name}: root entrypoint still contains too much internal code')
        fixture = json.loads((ROOT / 'tests/fixtures/saved-places-v1.json').read_text(encoding='utf-8'))
        if not isinstance(fixture, list) or not fixture:
            issues.append('Legacy saved-place fixture must be a nonempty list')
    if issues:
        for message in issues:
            print('FAIL:', message)
        return 1
    print(f'PASS: {len(REQUIRED)} files; Python/JS import DAG; static assets; DOM ids; token palette.')
    print('Runtime/API/storage/geometry/browser behavior is covered by the separate test suites.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
