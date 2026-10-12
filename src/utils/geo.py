"""Local coordinate projection and geometry helpers."""
import math
import numpy as np


def to_meters(points, lat0, lng0):
    pts = np.asarray(points, dtype=float)
    y = (pts[:, 0] - lat0) * 111_000
    x = (pts[:, 1] - lng0) * 111_000 * np.cos(np.radians(lat0))
    return np.column_stack([x, y])


def to_latlng(xy, lat0, lng0):
    lat = lat0 + xy[1] / 111_000
    lng = lng0 + xy[0] / (111_000 * np.cos(np.radians(lat0)))
    return float(lat), float(lng)


def _bbox(center, radius):
    """Прямоугольник вокруг центра в формате Overpass: юг,запад,север,восток.
    Фильтр по рамке работает намного быстрее, чем around (по расстоянию)."""
    lat, lng = center
    dlat = radius / 111_000
    dlng = radius / (111_000 * math.cos(math.radians(lat)))
    return f'{lat - dlat:.6f},{lng - dlng:.6f},{lat + dlat:.6f},{lng + dlng:.6f}'


def _footprint_m2(geom):
    lat0 = geom[0]['lat']
    k_lat = 111_000
    k_lng = 111_000 * math.cos(math.radians(lat0))
    pts = [((g['lon'] - geom[0]['lon']) * k_lng, (g['lat'] - lat0) * k_lat) for g in geom]
    area = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        area += x1 * y2 - x2 * y1
    return abs(area) / 2
