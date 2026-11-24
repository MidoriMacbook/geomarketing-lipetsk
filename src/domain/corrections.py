"""Проверка и применение личных поправок к набору конкурентов."""
from dataclasses import dataclass
import re

import numpy as np

from src.domain.models import LoadedData, ScoringResult
from src.utils.geo import to_meters
from src.utils.validation import UserError


MAX_CORRECTIONS = 50
MANUAL_ID = re.compile(r'[A-Za-z0-9_-]{1,64}')
OSM_ID = re.compile(r'(node|way|relation):[1-9][0-9]{0,19}')


@dataclass(frozen=True)
class Corrections:
    added: tuple[tuple[str, float, float], ...]
    removed: tuple[str, ...]

    @classmethod
    def parse(cls, value, center, radius):
        if not isinstance(value, dict) or value.keys() - {'added', 'removed'}:
            raise UserError('Некорректный набор поправок.')
        added, removed = value.get('added', []), value.get('removed', [])
        if not isinstance(added, list) or not isinstance(removed, list):
            raise UserError('Добавления и удаления должны быть списками.')
        if len(added) + len(removed) > MAX_CORRECTIONS:
            raise UserError(f'Можно применить не больше {MAX_CORRECTIONS} поправок.')
        if any(not isinstance(key, str) or not OSM_ID.fullmatch(key) for key in removed):
            raise UserError('Для удаления нужен ID объекта OpenStreetMap.')
        if len(removed) != len(set(removed)):
            raise UserError('Один объект OpenStreetMap нельзя убрать дважды.')

        points = {}
        for row in added:
            if not isinstance(row, dict) or row.keys() != {'id', 'lat', 'lng'}:
                raise UserError('У добавленного конкурента нужны ID и координаты.')
            key, lat, lng = row['id'], row['lat'], row['lng']
            if not isinstance(key, str) or not MANUAL_ID.fullmatch(key) or key in points:
                raise UserError('Метки добавленных конкурентов должны иметь уникальные ID.')
            if (type(lat) not in (int, float) or type(lng) not in (int, float)
                    or not (-90 <= lat <= 90 and -180 <= lng <= 180)):
                raise UserError('Некорректные координаты добавленного конкурента.')
            points[key] = (float(lat), float(lng))

        if points:
            distances = np.linalg.norm(to_meters(list(points.values()), *center), axis=1)
            if np.any(distances > radius + 1e-6):
                raise UserError('Добавьте конкурента внутри области расчёта.')
        return cls(tuple((key, *points[key]) for key in sorted(points)), tuple(sorted(removed)))

    def apply(self, loaded: LoadedData):
        if set(self.removed) - set(loaded.competitor_ids):
            raise UserError('Некоторые конкуренты для удаления отсутствуют в исходных данных расчёта.')

        base = loaded.describe_competitors()
        added = [{'id': key, 'lat': lat, 'lng': lng} for key, lat, lng in self.added]
        removed = set(self.removed)
        effective = [row for row in base if row['id'] not in removed]
        effective.extend({**row, 'source': 'manual'} for row in added)
        context = {
            'version': 1,
            'base_competitors': base,
            'applied': {'added': added, 'removed': list(self.removed)},
            'counts': {'added': len(added), 'removed': len(removed)},
        }
        return effective, context


def recommendation_deltas(baseline: ScoringResult, updated: ScoringResult):
    """Сравниваем точные оценки в совпадающих ячейках двух поверхностей."""
    grid = baseline.grid
    n = grid['n']
    previous = {(row['lat'], row['lng']) for row in baseline.recommendations}
    for row in updated.recommendations:
        lat, lng = row['lat'], row['lng']
        x = round((lng - grid['lng_min']) * (n - 1) / (grid['lng_max'] - grid['lng_min']))
        y = round((lat - grid['lat_min']) * (n - 1) / (grid['lat_max'] - grid['lat_min']))
        baseline_score = float(baseline.scores[y * n + x])
        yield {
            'baseline_score': baseline_score,
            'score_delta': row['score'] - baseline_score,
            'is_new_location': (lat, lng) not in previous,
        }
