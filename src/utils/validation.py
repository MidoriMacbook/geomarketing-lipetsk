"""Parameter and analysis-data validation independent of Flask."""
import math
from collections.abc import Mapping
import numpy as np

from src.config import DISTRICTS, LIPETSK_BOUNDS, MIN_RADIUS, MAX_RADIUS
from src.domain.models import Area


class UserError(Exception):
    """Ошибка, понятная пользователю (неверные параметры, мало данных)."""


def validate_data(houses, competitors):
    """Reject unusable rows before clustering or serializing numeric results."""
    houses = np.asarray(houses, dtype=float)
    competitors = np.asarray(competitors, dtype=float)
    if competitors.shape == (0,):
        competitors = np.empty((0, 2))
    if competitors.ndim != 2 or competitors.shape[1] != 2:
        raise ValueError('Invalid competitor rows')
    if (houses.ndim != 2 or houses.shape[1] != 3 or not len(houses)
            or not np.isfinite(houses).all() or not np.isfinite(competitors).all()
            or np.any(houses[:, 2] <= 0) or not np.isfinite(houses[:, 2].sum())):
        raise ValueError('Invalid analysis data')
    for rows in (houses, competitors):
        if np.any(np.abs(rows[:, 0]) > 90) or np.any(np.abs(rows[:, 1]) > 180):
            raise ValueError('Invalid analysis coordinates')
    return houses, competitors


def area_for(district_key):
    """Готовый район -> область анализа."""
    return {'key': district_key, 'custom': False, **DISTRICTS[district_key]}


def custom_area(lat, lng, radius):
    """Произвольная область: центр — клик на карте. Кэш хранится отдельно для каждой области."""
    lat, lng = round(lat, 4), round(lng, 4)
    radius = int(min(max(radius, MIN_RADIUS), MAX_RADIUS))
    return {'key': f'custom_{lat:.4f}_{lng:.4f}_{radius}', 'custom': True,
            'name': 'Выбранная область', 'center': (lat, lng), 'radius': radius}


def resolve_area(args: Mapping[str, str]) -> Area:
    district = args.get('district', 'eleytsky')
    if district == 'custom':
        try:
            lat = float(args['lat'])
            lng = float(args['lng'])
            radius = float(args.get('radius', 1000))
        except (KeyError, ValueError):
            raise UserError('Не указана точка на карте. Кликните по карте, чтобы выбрать центр области.')
        if not all(math.isfinite(v) for v in (lat, lng, radius)):
            raise UserError('Координаты и радиус должны быть конечными числами.')
        if not MIN_RADIUS <= radius <= MAX_RADIUS:
            raise UserError(f'Выберите радиус от {MIN_RADIUS} до {MAX_RADIUS} м.')
        (lat_lo, lat_hi), (lng_lo, lng_hi) = LIPETSK_BOUNDS['lat'], LIPETSK_BOUNDS['lng']
        if not (lat_lo <= lat <= lat_hi and lng_lo <= lng <= lng_hi):
            raise UserError('Выберите точку в пределах Липецка.')
        return custom_area(lat, lng, radius)
    if district not in DISTRICTS:
        raise UserError('Неизвестный район. Выберите район из списка.')
    return area_for(district)
