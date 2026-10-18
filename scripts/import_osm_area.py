"""Validate a complete local OSM extract and atomically prepare offline snapshots.

The acquisition timestamp must be supplied from the download record. Importing
never uses the source file's modification time as evidence of acquisition.
"""
import argparse
import hashlib
import io
import json
import math
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.import_osm_competitors import extract_competitors
from src.config import APARTMENT_TYPES, PRIVATE_TYPES, MIN_FOOTPRINT_M2, SNAPSHOT_DIR
from src.domain.businesses import BUSINESS_CATALOG
from src.services import osm_service as osm
from src.services.cache_service import _validate_rows
from src.utils.geo import _bbox, _footprint_m2

MAX_SOURCE_BYTES = 64 * 1024 * 1024
MAX_PRIMITIVES = 250_000
MAX_RELATION_DEPTH = 16
MAX_GEOMETRY_NODE_VISITS = 1_000_000
MAX_XML_DEPTH = 16
SOURCE_ATTRIBUTION = 'OpenStreetMap API 0.6 XML extract; ODbL 1.0'


def _tags(element):
    try:
        tags = {}
        for tag in element.findall('tag'):
            key = tag.attrib['k']
            if key in tags:
                raise ValueError('Duplicate OSM tag key')
            tags[key] = tag.attrib['v']
        return tags
    except KeyError as exc:
        raise ValueError('Malformed OSM tags') from exc


def _house_candidate(element):
    if element.tag != 'way':
        return False
    tags = _tags(element)
    return (tags.get('building') in APARTMENT_TYPES | PRIVATE_TYPES
            or tags.get('building') == 'yes'
            and ('building:levels' in tags or 'addr:housenumber' in tags))


def _matches(element, businesses):
    tags = _tags(element)
    return any(tags.get(key.strip('"')) == value.strip('"')
               for business in businesses for tag in BUSINESS_CATALOG[business]['tags']
               for key, value in [tag.split('=', 1)])


def _coordinate(value, limit):
    number = float(value)
    if not math.isfinite(number) or not -limit <= number <= limit:
        raise ValueError('Invalid OSM coordinate')
    return number


def _read_source(source):
    # Bound the actual read as well as the stat: a growing file cannot bypass it.
    with Path(source).open('rb') as stream:
        raw = stream.read(MAX_SOURCE_BYTES + 1)
    if len(raw) > MAX_SOURCE_BYTES:
        raise ValueError('OSM source exceeds 64 MiB limit')
    # Decode before inspecting declarations: UTF-16's interleaved NUL bytes
    # can otherwise hide a DTD from an ASCII byte scan while ET accepts it.
    try:
        decoded = raw.decode('utf-8-sig')
    except UnicodeDecodeError as exc:
        raise ValueError('OSM source must be UTF-8') from exc
    if '\x00' in decoded:
        raise ValueError('OSM source must be UTF-8 without NUL bytes')
    declaration = re.match(r'<\?xml\b([^?]*)\?>', decoded)
    if declaration:
        encoding = re.search(r"encoding\s*=\s*(['\"])(.*?)\1", declaration.group(1))
        if encoding and encoding.group(2).lower() not in ('utf-8', 'utf8'):
            raise ValueError('OSM XML declaration must specify UTF-8')
    if '<!DOCTYPE' in decoded.upper() or '<!ENTITY' in decoded.upper():
        raise ValueError('OSM source must not declare DTDs or entities')
    allowed_children = {
        'osm': {'note', 'meta', 'bounds', 'node', 'way', 'relation'},
        'node': {'tag'}, 'way': {'nd', 'tag'}, 'relation': {'member', 'tag'},
        'note': set(), 'meta': set(), 'bounds': set(),
        'nd': set(), 'member': set(), 'tag': set(),
    }
    try:
        depth, count = 0, 0
        parents = []
        parser = ET.iterparse(io.BytesIO(raw), events=('start', 'end'))
        for event, element in parser:
            if event == 'start':
                depth += 1
                if parents and element.tag not in allowed_children.get(parents[-1], set()):
                    raise ValueError('Unsupported OSM element placement or wrapper')
                parents.append(element.tag)
                if depth > MAX_XML_DEPTH:
                    raise ValueError('OSM XML nesting limit exceeded')
                if element.tag in ('node', 'way', 'relation'):
                    if depth != 2:
                        raise ValueError('OSM primitives must be direct children of osm')
                    count += 1
                    if count > MAX_PRIMITIVES:
                        raise ValueError('OSM primitive limit exceeded')
                if element.tag in ('error', 'remark'):
                    raise ValueError('OSM response contains an error or remark')
            else:
                depth -= 1
                parents.pop()
        root = parser.root
        if root.tag != 'osm':
            raise ValueError('Source is not an OSM extract')
        bounds_elements = root.findall('bounds')
        if len(bounds_elements) != 1:
            raise ValueError('OSM extract must contain coverage bounds')
        bounds = dict(zip(('minlat', 'minlon', 'maxlat', 'maxlon'),
                          (_coordinate(bounds_elements[0].attrib[key], limit)
                           for key, limit in [('minlat', 90), ('minlon', 180),
                                              ('maxlat', 90), ('maxlon', 180)])))
        if bounds['minlat'] >= bounds['maxlat'] or bounds['minlon'] >= bounds['maxlon']:
            raise ValueError('Invalid OSM coverage bounds')
        elements, nodes = {}, {}
        for element in root:
            if element.tag not in ('node', 'way', 'relation'):
                continue
            ident = element.attrib['id']
            key = (element.tag, ident)
            if not ident or key in elements:
                raise ValueError('Duplicate or invalid OSM primitive identifier')
            elements[key] = element
            _tags(element)
            if element.tag == 'node':
                nodes[ident] = {'lat': _coordinate(element.attrib['lat'], 90),
                                'lon': _coordinate(element.attrib['lon'], 180)}
        # Also reject bad inline coordinates, even on unmatched primitives.
        for element in root.iter():
            for name, limit in [('lat', 90), ('lon', 180)]:
                if name in element.attrib:
                    _coordinate(element.attrib[name], limit)
        return raw, bounds, elements, nodes
    except (ET.ParseError, KeyError, TypeError, OverflowError) as exc:
        raise ValueError('Malformed OSM XML extract') from exc


def _require_coverage(bounds, area, margin=0):
    south, west, north, east = map(float, _bbox(area['center'], area['radius'] + margin).split(','))
    if not (bounds['minlat'] <= south + 1e-6 and bounds['minlon'] <= west + 1e-6
            and bounds['maxlat'] >= north - 1e-6 and bounds['maxlon'] >= east - 1e-6):
        raise ValueError('OSM extract does not cover the analysis area and competitor margin')


def _validate_geometry(elements, nodes, roots):
    """Bound legacy extractor work without expanding repeated relation members."""
    memo = {}

    def measure(key, active):
        if key in active:
            raise ValueError('Cyclic matching OSM relation geometry')
        if len(active) > MAX_RELATION_DEPTH:
            raise ValueError('OSM relation depth limit exceeded')
        if key in memo:
            return memo[key]
        element = elements.get(key)
        if element is None:
            raise ValueError('Incomplete matching OSM geometry')
        if key[0] == 'node':
            result = (1, 0)
        elif key[0] == 'way':
            refs = [nd.get('ref') for nd in element.findall('nd')]
            if not refs or any(ref not in nodes for ref in refs):
                raise ValueError('Incomplete matching OSM way geometry')
            result = (len(refs), 0)
        else:
            count, height = 0, 1
            members = element.findall('member')
            if not members:
                raise ValueError('Empty matching OSM relation geometry')
            for member in members:
                child = (member.get('type'), member.get('ref'))
                if child[0] not in ('node', 'way', 'relation'):
                    raise ValueError('Invalid OSM relation member')
                visits, child_height = measure(child, active | {key})
                count += visits
                height = max(height, 1 + child_height)
                if count > MAX_GEOMETRY_NODE_VISITS or height > MAX_RELATION_DEPTH:
                    raise ValueError('OSM geometry expansion or relation depth limit exceeded')
            result = (count, height)
        if result[0] > MAX_GEOMETRY_NODE_VISITS:
            raise ValueError('OSM geometry expansion limit exceeded')
        memo[key] = result
        return result

    total = 0
    for key in roots:
        visits, _ = measure(key, set())
        total += visits
        if total > MAX_GEOMETRY_NODE_VISITS:
            raise ValueError('Total OSM geometry expansion limit exceeded')


def _house_rows(elements, nodes, area):
    rows = []
    lat0, lng0 = area['center']
    for element in elements.values():
        if not _house_candidate(element):
            continue
        refs = [nd.get('ref') for nd in element.findall('nd')]
        if len(refs) < 4 or refs[0] != refs[-1] or len(set(refs)) < 3:
            raise ValueError('Incomplete residential OSM polygon')
        geom = [nodes[ref] for ref in refs]
        footprint = _footprint_m2(geom)
        if footprint < MIN_FOOTPRINT_M2:
            continue
        residents = osm.estimate_residents(_tags(element), footprint)
        if residents is None:
            continue
        lat = sum(point['lat'] for point in geom) / len(geom)
        lng = sum(point['lon'] for point in geom) / len(geom)
        distance = math.hypot((lng - lng0) * 111_000 * math.cos(math.radians(lat0)),
                              (lat - lat0) * 111_000)
        if distance <= area['radius']:
            rows.append([round(lat, 6), round(lng, 6), max(1, round(residents))])
    return rows


def extract_houses(source: Path, area: dict) -> list[list[float]]:
    _, bounds, elements, nodes = _read_source(source)
    _require_coverage(bounds, area)
    _validate_geometry(elements, nodes,
                       [key for key, element in elements.items() if _house_candidate(element)])
    return _house_rows(elements, nodes, area)


def generate_snapshots(source: Path, area: dict, output_dir: Path, businesses=None,
                       *, fetched_at: float) -> list[Path]:
    """Validate every selected payload before replacing any snapshot.

    None prepares houses and all business categories. An explicit iterable
    prepares only its competitor categories, including an empty iterable.
    """
    if (isinstance(fetched_at, bool) or not isinstance(fetched_at, (int, float))
            or not math.isfinite(fetched_at) or fetched_at <= 0):
        raise ValueError('A verified positive acquisition timestamp is required')
    include_houses = businesses is None
    if isinstance(businesses, str):
        raise ValueError('Businesses must be an iterable of catalog keys')
    selected = list(BUSINESS_CATALOG) if include_houses else list(dict.fromkeys(businesses))
    if any(business not in BUSINESS_CATALOG for business in selected):
        raise ValueError('Unknown business category')
    raw, bounds, elements, nodes = _read_source(source)
    _require_coverage(bounds, area, max((osm.competitor_margin(key) for key in selected), default=0))
    roots = [key for key, element in elements.items()
             if include_houses and _house_candidate(element)]
    # The legacy extractor traverses again for each selected category, so a
    # primitive tagged for several categories consumes the budget each time.
    roots.extend(key for business in selected for key, element in elements.items()
                 if _matches(element, [business]))
    _validate_geometry(elements, nodes, roots)
    metadata = {'fetched_at': fetched_at, 'bounds': bounds,
                'source_sha256': hashlib.sha256(raw).hexdigest(), 'source': SOURCE_ATTRIBUTION}
    payloads = []
    if include_houses:
        rows = _house_rows(elements, nodes, area)
        _validate_rows(rows, 3, allow_empty=False)
        payloads.append((f'houses_{osm.cache_key(area)}.json', {**metadata, 'data': rows}))
    for business in selected:
        # Use the validated byte sequence, avoiding a second read of a source
        # that could have changed since validation and provenance hashing.
        rows = extract_competitors(io.BytesIO(raw), business, area)
        _validate_rows(rows, 2, allow_empty=True)
        payloads.append((f'{osm.competitor_cache_name(business, area)}.json',
                         {**metadata, 'data': rows,
                          'coverage_margin_m': osm.competitor_margin(business)}))
    serialized = [(name, json.dumps(payload, allow_nan=False, ensure_ascii=False))
                  for name, payload in payloads]
    output_dir = Path(output_dir)
    staged = []
    try:
        if serialized:
            output_dir.mkdir(parents=True, exist_ok=True)
        for name, contents in serialized:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=output_dir,
                                             suffix='.tmp', delete=False) as stream:
                temporary = Path(stream.name)
                staged.append((temporary, output_dir / name))
                stream.write(contents)
        for temporary, target in staged:
            temporary.replace(target)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)
    return [target for _, target in staged]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--district', choices=osm.DISTRICTS, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, default=SNAPSHOT_DIR)
    parser.add_argument('--business', choices=BUSINESS_CATALOG, action='append')
    parser.add_argument('--fetched-at', type=float, required=True)
    args = parser.parse_args()
    paths = generate_snapshots(args.source, osm.area_for(args.district), args.output_dir,
                               args.business, fetched_at=args.fetched_at)
    print(f'{args.district}: wrote {len(paths)} snapshots')


if __name__ == '__main__':
    main()
