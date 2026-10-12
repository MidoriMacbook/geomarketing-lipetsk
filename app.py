"""ГеоМаркетинг-Липецк: поиск оптимальной точки для малого бизнеса.

Алгоритм:
1. Дома и конкуренты берутся из OpenStreetMap (osm.py). Если OSM недоступен, используются демо-данные.
2. Взвешенный K-means (вес = число жителей) даёт центры спроса (центроиды).
3. По району строится сетка кандидатов. Для каждой точки:
      спрос       = sum(жители_i * exp(-(расстояние_i / R)^2))
      конкуренция = sum(exp(-(расстояние_до_конкурента / (0.8 R))^2))
      оценка      = спрос / (1 + alpha * конкуренция), нормируется на максимум (0..1)
4. Лучшая точка = максимум оценки. Всю сетку оценок получает карта и рисует «зелёные зоны».
"""
import math
import os
from dataclasses import asdict
from threading import BoundedSemaphore

import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from scipy.spatial.distance import cdist
from sklearn.cluster import KMeans

import osm

app = Flask(__name__, static_folder='static')
calculation_slots = BoundedSemaphore(2)

# Демо-данные: запасной вариант, если OpenStreetMap недоступен.
DEMO_HOUSES = {
    'eleytsky': [
        [52.5934, 39.4795, 420], [52.5925, 39.4812, 380], [52.5948, 39.4770, 510],
        [52.5912, 39.4835, 290], [52.5955, 39.4820, 350], [52.5941, 39.4800, 460],
    ],
    'universitetsky': [
        [52.6052, 39.5047, 600], [52.6067, 39.5022, 340], [52.6038, 39.5077, 280],
        [52.6079, 39.5062, 310], [52.6059, 39.5037, 450],
    ],
    'center': [
        [52.6134, 39.5855, 520], [52.6110, 39.5801, 330], [52.6155, 39.5890, 410],
        [52.6085, 39.5840, 270], [52.6120, 39.5830, 480],
    ],
}
DEMO_COMPETITORS = {
    'cafe': {
        'eleytsky': [[52.5928, 39.4790], [52.5950, 39.4815]],
        'universitetsky': [[52.6062, 39.5042], [52.6045, 39.5067]],
        'center': [[52.6128, 39.5850], [52.6100, 39.5815], [52.6150, 39.5880]],
    },
    'pharmacy': {
        'eleytsky': [[52.5940, 39.4805], [52.5915, 39.4830]],
        'universitetsky': [[52.6072, 39.5057]],
        'center': [[52.6118, 39.5835], [52.6090, 39.5850]],
    },
}

# R — радиус пешей доступности (м), alpha — сила штрафа за конкурентов
BUSINESS_PARAMS = {
    'cafe': {'R': 350, 'alpha': 1.5},
    'pharmacy': {'R': 500, 'alpha': 3.0},
}

GRID_SIZE = 60
N_CLUSTERS = 3
LOW_DATA_RESIDENTS = 3000  # меньше жителей в районе — предупреждаем о неполных данных
MIN_HOUSES = 5          # меньше — считаем, что в OSM для района мало данных
DEMO_HALF_SIZE_M = 600  # размер области анализа для демо-данных


def to_meters(points, lat0, lng0):
    pts = np.asarray(points, dtype=float)
    y = (pts[:, 0] - lat0) * 111_000
    x = (pts[:, 1] - lng0) * 111_000 * np.cos(np.radians(lat0))
    return np.column_stack([x, y])


class UserError(Exception):
    """Ошибка, понятная пользователю (неверные параметры, мало данных)."""


def load_data(area, business, refresh):
    """Возвращает (дома, конкуренты, источник, предупреждение)."""
    try:
        houses, h_cached = osm.get_houses(area, refresh)
        competitors, c_cached = osm.get_competitors(business, area, refresh)
        if len(houses) < MIN_HOUSES:
            raise RuntimeError(f'в OpenStreetMap найдено слишком мало домов ({len(houses)})')
        metadata = {key: asdict(value) for key, value in (
            ('houses', h_cached), ('competitors', c_cached)) if isinstance(value, osm.CacheInfo)}
        warnings = sorted({info['warning'] for info in metadata.values() if info['warning']})
        if any(info['stale'] for info in metadata.values()):
            warnings.append('Сохранённым данным больше 7 дней. Обновите их перед принятием решения.')
        return houses, competitors, ('cache' if h_cached and c_cached else 'osm'), ' '.join(warnings) or None, metadata
    except Exception as exc:  # noqa: BLE001
        if area['custom']:   # для произвольной области демо-данных нет
            if isinstance(exc, RuntimeError) and 'мало домов' in str(exc):
                raise UserError('В этой области в OpenStreetMap почти нет размеченных жилых домов. '
                                'Выберите другое место или увеличьте радиус.') from exc
            raise UserError('Не удалось загрузить данные OpenStreetMap. '
                            'Повторите через минуту или выберите готовый район.') from exc
        district = area['key']
        houses = np.array(DEMO_HOUSES[district], dtype=float)
        competitors = np.array(DEMO_COMPETITORS[business][district], dtype=float)
        app.logger.warning('Using demo data for %s: %s', district, exc)
        return houses, competitors, 'demo', 'Данные OpenStreetMap сейчас недоступны или неполны.', {}


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.get('/healthz')
def health():
    return jsonify({'status': 'ok'})


@app.route('/api/calculate')
def calculate():
    if not calculation_slots.acquire(blocking=False):
        return jsonify({'status': 'error', 'message': 'Сервис занят расчётами. Повторите через минуту.'}), 503, {'Retry-After': '30'}
    try:
        return run_calculation()
    except UserError as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 400
    except Exception:  # noqa: BLE001
        app.logger.exception('Calculation failed')
        return jsonify({'status': 'error', 'message': 'Не удалось выполнить расчёт. Повторите попытку позже.'}), 500
    finally:
        calculation_slots.release()


def resolve_area():
    district = request.args.get('district', 'eleytsky')
    if district == 'custom':
        try:
            lat = float(request.args['lat'])
            lng = float(request.args['lng'])
            radius = float(request.args.get('radius', 1000))
        except (KeyError, ValueError):
            raise UserError('Не указана точка на карте. Кликните по карте, чтобы выбрать центр области.')
        if not all(math.isfinite(v) for v in (lat, lng, radius)):
            raise UserError('Координаты и радиус должны быть конечными числами.')
        if not osm.MIN_RADIUS <= radius <= osm.MAX_RADIUS:
            raise UserError(f'Выберите радиус от {osm.MIN_RADIUS} до {osm.MAX_RADIUS} м.')
        (lat_lo, lat_hi), (lng_lo, lng_hi) = osm.LIPETSK_BOUNDS['lat'], osm.LIPETSK_BOUNDS['lng']
        if not (lat_lo <= lat <= lat_hi and lng_lo <= lng <= lng_hi):
            raise UserError('Выберите точку в пределах Липецка.')
        return osm.custom_area(lat, lng, radius)
    if district not in osm.DISTRICTS:
        raise UserError('Неизвестный район. Выберите район из списка.')
    return osm.area_for(district)


def run_calculation():
    area = resolve_area()
    business = request.args.get('type', 'cafe')
    refresh = request.args.get('refresh') == '1'
    if business not in BUSINESS_PARAMS:
        raise UserError('Неизвестный тип бизнеса. Выберите кофейню или аптеку.')

    info = area
    lat0, lng0 = info['center']
    p = BUSINESS_PARAMS[business]

    houses, competitors, source, warning, metadata = load_data(area, business, refresh)
    half = DEMO_HALF_SIZE_M if source == 'demo' else info['radius']
    notice = None
    if source != 'demo' and houses[:, 2].sum() < LOW_DATA_RESIDENTS:
        notice = ('В OpenStreetMap для этого района мало размеченных жилых домов, '
                  'поэтому спрос может быть занижен, а результат неточен.')

    h_xy = to_meters(houses[:, :2], lat0, lng0)
    c_xy = to_meters(competitors, lat0, lng0) if len(competitors) else np.empty((0, 2))
    pop = houses[:, 2]

    def to_latlng(xy):
        lat = lat0 + xy[1] / 111_000
        lng = lng0 + xy[0] / (111_000 * np.cos(np.radians(lat0)))
        return float(lat), float(lng)

    # 1. Взвешенный K-means в метрах: центры скоплений жителей
    k = min(N_CLUSTERS, len(houses))
    km = KMeans(n_clusters=k, init='k-means++', n_init=10, random_state=42)
    km.fit(h_xy, sample_weight=pop)
    centroids = []
    for idx, center in enumerate(km.cluster_centers_):
        lat, lng = to_latlng(center)
        centroids.append({'lat': lat, 'lng': lng, 'residents': int(pop[km.labels_ == idx].sum())})

    # 2. Сетка кандидатов
    axis = np.linspace(-half, half, GRID_SIZE)
    gx, gy = np.meshgrid(axis, axis)
    grid = np.column_stack([gx.ravel(), gy.ravel()])

    demand = (pop[None, :] * np.exp(-(cdist(grid, h_xy) / p['R']) ** 2)).sum(axis=1)
    if len(c_xy):
        competition = np.exp(-(cdist(grid, c_xy) / (p['R'] * 0.8)) ** 2).sum(axis=1)
    else:
        competition = np.zeros(len(grid))
    raw = demand / (1 + p['alpha'] * competition)
    raw[np.linalg.norm(grid, axis=1) > half] = 0
    score = raw / raw.max() if raw.max() > 0 else raw

    # 3. Лучшая точка
    best_xy = grid[int(np.where(np.linalg.norm(grid, axis=1) <= half, score, -1).argmax())]
    best_lat, best_lng = to_latlng(best_xy)
    residents_near = int(pop[np.linalg.norm(h_xy - best_xy, axis=1) <= p['R']].sum())
    nearest = round(float(np.linalg.norm(c_xy - best_xy, axis=1).min())) if len(c_xy) else None

    lat_min, lng_min = to_latlng(np.array([-half, -half]))
    lat_max, lng_max = to_latlng(np.array([half, half]))

    return jsonify({
        'status': 'success',
        'district': area['key'],
        'district_name': info['name'],
        'business': business,
        'source': source,          # osm | cache | demo
        'data_meta': metadata,
        'warning': warning,
        'notice': notice,
        'center': [lat0, lng0],
        'half_m': half,
        'stats': {
            'houses': int(len(houses)),
            'residents': int(pop.sum()),
            'competitors': int(len(competitors)),
        },
        'best': {
            'lat': best_lat, 'lng': best_lng,
            'residents_in_radius': residents_near,
            'radius_m': p['R'],
            'nearest_competitor_m': nearest,
        },
        'grid': {
            'n': GRID_SIZE,
            'lat_min': lat_min, 'lat_max': lat_max,
            'lng_min': lng_min, 'lng_max': lng_max,
            'scores': np.round(score, 3).tolist(),   # построчно, с юга на север
        },
        'centroids': centroids,
        'houses': [{'lat': float(h[0]), 'lng': float(h[1]), 'residents': int(h[2])} for h in houses],
        'competitors': [{'lat': float(c[0]), 'lng': float(c[1])} for c in competitors],
    })


if __name__ == '__main__':
    app.run(host=os.environ.get('HOST', '127.0.0.1'),
            port=int(os.environ.get('PORT', '5001')), debug=False, threaded=True)
