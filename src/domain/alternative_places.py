"""Заполнение свободных позиций в выдаче по рассчитанной поверхности."""
import numpy as np

from src.config import MAX_RECOMMENDATIONS


MIN_DISTANCE_RADIUS_FACTOR = 0.8
MAX_SHARED_RESIDENTS_FRACTION = 0.6


def shared_resident_counts(population, first, second):
    """Общее население и население меньшего из двух охватов."""
    shared = population[first & second].sum()
    smaller = min(population[first].sum(), population[second].sum())
    return float(shared), float(smaller)


def select_alternative_places(grid, scores, useful, house_xy, population, radius, selected, memberships):
    """Дополняем непустой основной список ячейками с допустимым охватом."""
    if len(selected) >= MAX_RECOMMENDATIONS:
        return []

    minimum_distance = MIN_DISTANCE_RADIUS_FACTOR * radius
    previous = list(zip(selected, memberships, strict=True))
    remaining = (index for index in np.flatnonzero(useful) if index not in selected)
    candidates = sorted(remaining, key=lambda index: (-scores[index], index))
    alternatives = []
    for index in candidates:
        point = grid[index]
        membership = np.linalg.norm(house_xy - point, axis=1) <= radius
        comparisons = []
        for rank, (earlier, earlier_membership) in enumerate(previous, 1):
            distance = float(np.linalg.norm(grid[earlier] - point))
            if distance < minimum_distance:
                break
            shared, smaller = shared_resident_counts(population, membership, earlier_membership)
            if shared > MAX_SHARED_RESIDENTS_FRACTION * smaller:
                break
            comparisons.append({'rank': rank, 'distance_m': distance,
                                'shared_residents_fraction': shared / smaller if smaller else None})
        if len(comparisons) != len(previous):
            continue

        nearest = min(comparisons, key=lambda pair: pair['distance_m'])
        alternatives.append((index, membership, nearest))
        previous.append((index, membership))
        if len(previous) == MAX_RECOMMENDATIONS:
            break
    return alternatives
