"""Локальный Waitress с настоящим расчётом и контролируемым загрузчиком."""
import os
import logging

os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')

from datetime import datetime, timezone
from unittest.mock import patch

import numpy as np
from waitress import serve

from app import create_app
from src.domain.models import LoadedData
from src.services import analysis_service


def controlled_load_data(area, business, refresh):
    """Строит одинаковые исходные данные относительно выбранного центра."""
    lat, lng = area['center']
    offsets = [(0.0001, 0.0001, 600), (0.0002, 0.0003, 700),
               (-0.0002, -0.0002, 800), (-0.0003, 0.0004, 900),
               (0.0003, -0.0003, 1000), (0.0004, -0.0004, 1100)]
    houses = np.array([[lat + dy, lng + dx, residents]
                       for dy, dx, residents in offsets], dtype=float)
    competitors = np.array([[lat, lng + 0.0005], [lat + 0.001, lng]], dtype=float)
    fetched_at = datetime.now(timezone.utc).timestamp()
    metadata = {kind: {'cached': True, 'fetched_at': fetched_at,
                       'stale': False, 'warning': None}
                for kind in ('houses', 'competitors')}
    return LoadedData(houses, competitors, 'cache', None, metadata)


if __name__ == '__main__':
    # Параллельная загрузка локальных модулей создаёт кратковременную очередь.
    logging.getLogger('waitress.queue').setLevel(logging.ERROR)
    # Неожиданное обращение к внешнему источнику сразу прерывает проверку.
    with patch.object(analysis_service, 'load_data', controlled_load_data), \
         patch('requests.sessions.Session.request',
               side_effect=AssertionError('Внешняя сеть запрещена в smoke-сервере')):
        serve(create_app(), host='127.0.0.1', port=int(os.environ.get('SMOKE_PORT', '5017')), threads=4)
