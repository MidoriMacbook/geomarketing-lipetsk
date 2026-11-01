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


@dataclass(frozen=True)
class ScoringResult:
    recommendations: list[dict]
    grid: dict
    centroids: list[dict]
