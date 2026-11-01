"""Подготовка снимков конкурентов из небольшой XML-выгрузки OSM API 0.6.

Импорт не обращается к сети. Подтверждённая дата получения передаётся
параметром --fetched-at; сырая выгрузка не включается в Git.
"""
import argparse
import json
import math
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.services import osm_service as osm
from src.services.cache_service import _validate_rows
from src.config import SNAPSHOT_DIR
from src.utils.geo import _bbox
from src.domain.businesses import BUSINESS_CATALOG


def extract_competitors(source, business, area, *, fetched_at=None):
    root = ET.parse(source).getroot()
    if root.tag != 'osm':
        raise ValueError('Source is not an OSM extract')
    south, west, north, east = map(float, _bbox(area['center'],
                                  area['radius'] + osm.competitor_margin(business)).split(','))
    bounds = root.find('bounds')
    if bounds is None:
        raise ValueError('OSM extract has no coverage bounds')
    limits = [float(bounds.attrib[key]) for key in ('minlat','minlon','maxlat','maxlon')]
    if not all(math.isfinite(value) for value in limits):
        raise ValueError('Invalid OSM coverage bounds')
    if not (limits[0] <= south + 1e-6 and limits[1] <= west + 1e-6
            and limits[2] >= north - 1e-6 and limits[3] >= east - 1e-6):
        raise ValueError('OSM extract does not cover the analysis area and competitor margin')
    elements = {}
    for element in root:
        if element.tag not in ('node', 'way', 'relation'):
            continue
        key = (element.tag, element.attrib['id'])
        if key in elements or int(key[1]) <= 0:
            raise ValueError('Повторяющийся или неверный идентификатор OSM')
        elements[key] = element
    nodes = {key[1]: {'lat': float(el.attrib['lat']), 'lon': float(el.attrib['lon'])}
             for key, el in elements.items() if key[0] == 'node'}

    def geometry(element, visited):
        key = (element.tag, element.attrib['id'])
        if key in visited:
            return None
        if element.tag == 'node':
            return [nodes[key[1]]]
        if element.tag == 'way':
            refs = [nd.attrib['ref'] for nd in element.findall('nd')]
            return [nodes[ref] for ref in refs] if refs and all(ref in nodes for ref in refs) else None
        points = []
        for member in element.findall('member'):
            referenced = elements.get((member.attrib['type'], member.attrib['ref']))
            if referenced is None:
                return None  # По неполному отношению нельзя определить надёжный центр.
            part = geometry(referenced, visited | {key})
            if part is None:
                return None
            points.extend(part)
        return points

    filters = [tuple(part.strip('"') for part in tag.split('=', 1))
               for tag in BUSINESS_CATALOG[business]['tags']]
    parsed = []
    for element in elements.values():
        tags = {tag.attrib['k']: tag.attrib['v'] for tag in element.findall('tag')}
        if not any(tags.get(key) == value for key, value in filters):
            continue
        points = geometry(element, set())
        if not points or not all(math.isfinite(p[axis]) for p in points for axis in ('lat', 'lon')):
            raise ValueError(f'Incomplete geometry for matching OSM {element.tag} {element.attrib["id"]}')
        lat = (min(p['lat'] for p in points) + max(p['lat'] for p in points)) / 2
        lng = (min(p['lon'] for p in points) + max(p['lon'] for p in points)) / 2
        if not (south <= lat <= north and west <= lng <= east):
            continue
        parsed.append({'type': element.tag, 'id': int(element.attrib['id']),
                       **({'lat': lat, 'lon': lng} if element.tag == 'node' else
                          {'center': {'lat': lat, 'lon': lng}})})
    rows = osm.parse_competitors(parsed, fetched_at=fetched_at)
    _validate_rows(rows, 2, allow_empty=True)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--district', choices=osm.DISTRICTS, required=True)
    parser.add_argument('--business', choices=BUSINESS_CATALOG, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--fetched-at', type=float, required=True)
    parser.add_argument('--output-dir', type=Path, default=SNAPSHOT_DIR)
    args = parser.parse_args()
    area = osm.area_for(args.district)
    if not math.isfinite(args.fetched_at) or args.fetched_at <= 0:
        raise ValueError('Требуется подтверждённая положительная дата получения')
    rows = extract_competitors(args.source, args.business, area, fetched_at=args.fetched_at)
    payload = {'fetched_at': args.fetched_at, 'data': rows, 'provenance': rows.provenance,
               'coverage_margin_m': osm.competitor_margin(args.business),
               'source': 'OpenStreetMap API 0.6 XML extract; ODbL 1.0'}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    target = args.output_dir / f'{osm.competitor_cache_name(args.business, area)}.json'
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=args.output_dir,
                                         suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(payload, stream, allow_nan=False)
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print(f'{args.district} / {args.business}: {len(rows)} competitors')


if __name__ == '__main__':
    main()
