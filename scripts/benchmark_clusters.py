"""Одинаковые сохранённые OSM-данные до/после, без сети и времени загрузки."""
import hashlib
import json
from pathlib import Path
import statistics
import sys
import time
import subprocess

import numpy as np
from threadpoolctl import threadpool_limits

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.scoring import score_locations
from src.utils.geo import to_meters

fixture = json.loads(Path('tests/fixtures/scoring-clusters.json').read_text(encoding='utf-8'))
phase = sys.argv[1]
baseline_ref = '9905f82'
if phase == 'before':
    # Читаем прежний алгоритм без checkout и без изменения рабочей копии.
    source = subprocess.check_output(['git', 'show', f'{baseline_ref}:src/domain/scoring.py'], encoding='utf-8')
    namespace = {'__name__': 'baseline_scoring'}
    exec(compile(source, 'baseline_scoring.py', 'exec'), namespace)
    score_locations = namespace['score_locations']
output = {'phase': phase, 'source_version': fixture['version'], 'fetched_at': fixture['fetched_at'],
          'business': 'cafe', 'baseline_ref': baseline_ref, 'threads': 1, 'repeats': 7, 'cases': []}
with threadpool_limits(limits=1):
    for case in fixture['cases']:
        houses = np.asarray(case['houses'], dtype=float)
        competitors = np.asarray(case['competitors'], dtype=float).reshape(-1, 2)
        args = (houses, competitors, case['center'], case['radius'], BUSINESS_CATALOG['cafe'])
        score_locations(*args)  # прогрев импортов и библиотек не включён в время расчёта
        elapsed = []
        for _ in range(7):
            start = time.perf_counter()
            result = score_locations(*args)
            elapsed.append((time.perf_counter() - start) * 1000)
        xy = to_meters([[r['lat'], r['lng']] for r in result.recommendations], *case['center'])
        hxy = to_meters(houses[:, :2], *case['center'])
        memberships = [np.linalg.norm(hxy - point, axis=1) <= 350 for point in xy]
        pairs = []
        for i in range(len(xy)):
            for j in range(i + 1, len(xy)):
                common = memberships[i] & memberships[j]
                pairs.append({'places': [i + 1, j + 1], 'distance_m': round(float(np.linalg.norm(xy[i] - xy[j])), 1),
                              'shared_houses': int(common.sum()), 'shared_residents': int(houses[common, 2].sum())})
        output['cases'].append({'key': case['key'], 'center': case['center'], 'radius': case['radius'],
                               'houses': len(houses), 'median_ms': statistics.median(elapsed), 'runs_ms': elapsed,
                               'grid_sha256': hashlib.sha256(json.dumps(result.grid, sort_keys=True).encode()).hexdigest(),
                               'recommendations': result.recommendations, 'pairs': pairs})
directory = Path('docs/verification/polish/14');directory.mkdir(parents=True, exist_ok=True)
(directory / f'benchmark-{phase}.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(output, ensure_ascii=False, indent=2))
