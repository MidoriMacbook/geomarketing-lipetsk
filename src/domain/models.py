"""Простые структуры данных предметной области сервера."""
from dataclasses import dataclass, field
from typing import TypedDict
import numpy as np


class Area(TypedDict):
    key: str
    custom: bool
    name: str
    center: tuple[float, float]
    radius: int


@dataclass(frozen=True)
class CacheInfo:
    cached: bool
    fetched_at: float
    stale: bool = False
    warning: str | None = None
    provenance: dict | None = None
    competitor_ids: tuple[str | None, ...] = ()
    competitor_details: dict[str, dict[str, str]] = field(default_factory=dict)

    def __bool__(self):
        return self.cached


@dataclass(frozen=True)
class LoadedData:
    houses: np.ndarray
    competitors: np.ndarray
    source: str
    warning: str | None
    metadata: dict = field(default_factory=dict)
    delivery: dict | None = None
    competitor_ids: tuple[str | None, ...] = ()
    competitor_details: dict[str, dict[str, str]] = field(default_factory=dict)
    network_coverage: dict[str, int] | None = None
    network_ids: frozenset[str] = frozenset()
    data_reliability: dict | None = None

    def describe_competitors(self):
        source = 'demo' if self.source == 'demo' else 'osm'
        ids = self.competitor_ids or (None,) * len(self.competitors)
        return [
            {'id': key, 'lat': float(lat), 'lng': float(lng), 'source': source,
             **(self.competitor_details.get(key, {}) if key is not None else {})}
            for key, (lat, lng) in zip(ids, self.competitors, strict=True)
        ]


@dataclass(frozen=True)
class ScoringResult:
    recommendations: list[dict]
    grid: dict
    centroids: list[dict]
    scores: np.ndarray = field(repr=False, compare=False)
