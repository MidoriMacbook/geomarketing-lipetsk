"""Extract the exact two Overpass queries from the project's collector."""

from pathlib import Path
import sys
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[2]))
from scripts import collect_city_data


class QueriesWritten(Exception):
    pass


def capture(query):
    group = 'houses' if query.endswith('out body geom;') else 'competitors'
    (HERE / f'{group}.overpassql').write_bytes(query.encode())
    if group == 'competitors':
        raise QueriesWritten
    return []


with patch.object(collect_city_data, 'fetch_elements', side_effect=capture):
    try:
        collect_city_data.collect()
    except QueriesWritten:
        pass
