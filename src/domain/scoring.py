"""Взвешенная кластеризация спроса и воспроизводимые разнесённые рекомендации."""
import numpy as np
from scipy.spatial.distance import cdist
from sklearn.cluster import KMeans

from src.config import (
    GRID_SIZE, N_CLUSTERS, MIN_RECOMMENDATION_DISTANCE_M, MAX_RECOMMENDATIONS,
    CLUSTER_RANDOM_STATE, MAX_SHARED_RESIDENTS_FRACTION,
)
from src.domain.models import ScoringResult
from src.utils.geo import to_meters, to_latlng
from src.utils.validation import UserError


def score_locations(houses, competitors, center, half, parameters) -> ScoringResult:
    lat0, lng0 = center
    p = parameters
    h_xy = to_meters(houses[:, :2], lat0, lng0)
    c_xy = to_meters(competitors, lat0, lng0) if len(competitors) else np.empty((0, 2))
    pop = houses[:, 2]

    def coordinates(xy):
        return to_latlng(xy, lat0, lng0)

    # 1. Взвешенный K-means в метрах: центры скоплений жителей
    k = min(N_CLUSTERS, len(np.unique(h_xy, axis=0)))
    km = KMeans(n_clusters=k, init='k-means++', n_init=10, random_state=CLUSTER_RANDOM_STATE)
    km.fit(h_xy, sample_weight=pop)
    centroids = []
    for idx, center in enumerate(km.cluster_centers_):
        lat, lng = coordinates(center)
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

    # 3. По одному максимуму в каждой области ближайшего центроида K-средних.
    # Формула поверхности и нормирование выше не зависят от отбора рекомендаций.
    inside = np.linalg.norm(grid, axis=1) <= half
    useful = inside & (demand > 0)
    if not np.isfinite(score).all() or not np.any(useful):
        raise UserError('В выбранной области недостаточно данных о спросе для рекомендации. '
                        'Выберите другое место или увеличьте радиус.')
    cluster_labels = km.predict(grid)
    candidates = []
    for cluster in range(k):
        eligible = np.flatnonzero(useful & (cluster_labels == cluster))
        if len(eligible):
            candidates.append(int(eligible[np.argmax(score[eligible])]))
    candidates.sort(key=lambda idx: (-score[idx], idx))
    selected, memberships = [], []
    for idx in candidates:
        membership = np.linalg.norm(h_xy - grid[idx], axis=1) <= p['R']
        residents = pop[membership].sum()
        if selected and np.any(np.linalg.norm(grid[selected] - grid[idx], axis=1)
                               < MIN_RECOMMENDATION_DISTANCE_M):
            continue
        if any(pop[membership & previous].sum() > MAX_SHARED_RESIDENTS_FRACTION
               * min(residents, pop[previous].sum()) for previous in memberships):
            continue
        selected.append(idx)
        memberships.append(membership)
        if len(selected) == MAX_RECOMMENDATIONS:
            break
    recommendations = []
    for rank, idx in enumerate(selected, 1):
        xy = grid[idx]
        lat, lng = coordinates(xy)
        competitor_distances = np.linalg.norm(c_xy - xy, axis=1)
        membership = memberships[rank - 1]
        shared = membership & memberships[0]
        residents = float(pop[membership].sum())
        recommendations.append({
            'rank': rank, 'lat': lat, 'lng': lng, 'score': float(score[idx]),
            'residents_in_radius': int(residents),
            'radius_m': p['R'],
            'competitors_in_radius': int((competitor_distances <= p['R']).sum()),
            'nearest_competitor_m': round(float(competitor_distances.min())) if len(c_xy) else None,
            'selection_method': 'cluster_maxima_v1',
            'cluster_id': int(cluster_labels[idx]) + 1,
            'independent_zones': len(selected),
            'comparison_to_best': None if rank == 1 else {
                'distance_m': round(float(np.linalg.norm(xy - grid[selected[0]]))),
                'shared_houses': int(shared.sum()),
                'shared_residents': int(pop[shared].sum()),
                # Доля жителей ЭТОГО места, также входящих в радиус лучшего.
                'shared_residents_fraction': float(pop[shared].sum() / residents) if residents else None,
            },
        })

    lat_min, lng_min = coordinates(np.array([-half, -half]))
    lat_max, lng_max = coordinates(np.array([half, half]))
    return ScoringResult(
        recommendations=recommendations,
        grid={'n': GRID_SIZE, 'lat_min': lat_min, 'lat_max': lat_max,
              'lng_min': lng_min, 'lng_max': lng_max,
              'scores': np.round(score, 3).tolist()},
        centroids=centroids,
    )
